"use server";

import { db, schema } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getRecipe } from "@/lib/mealie/client";
import { generateShoppingListForWeek, normalizeName, normalizeUnit, startOfWeek } from "./shopping";

type MealSlot = "breakfast" | "lunch" | "dinner";
type PantryUnitInput =
  | "g"
  | "kg"
  | "ml"
  | "l"
  | "pcs"
  | "tbsp"
  | "tsp"
  | "cup"
  | "other"
  | null;

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user;
}

function dayOnly(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function revalMeals() {
  revalidatePath("/meals");
  revalidatePath("/meals/week");
}

/* ---------- plan entries ---------- */

export async function planMealieMeal(input: {
  date: string;
  slot?: MealSlot;
  recipeId: string;
  notes?: string;
}) {
  const user = await requireUser();
  const recipe = await getRecipe(input.recipeId);
  if (recipe) {
    await db
      .insert(schema.mealieRecipes)
      .values({
        id: recipe.id,
        slug: recipe.slug,
        name: recipe.name,
        description: recipe.description ?? null,
        imageUrl: recipe.image ?? null,
        payload: recipe,
        lastFetchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.mealieRecipes.id,
        set: {
          slug: recipe.slug,
          name: recipe.name,
          description: recipe.description ?? null,
          imageUrl: recipe.image ?? null,
          payload: recipe,
          lastFetchedAt: new Date(),
        },
      });
  }
  await db.insert(schema.mealPlanEntries).values({
    date: dayOnly(input.date),
    slot: input.slot ?? "dinner",
    source: "mealie",
    mealieRecipeId: input.recipeId,
    notes: input.notes,
    createdBy: user.id,
  });
  revalMeals();
}

export async function planTakeawayMeal(input: {
  date: string;
  slot?: MealSlot;
  takeawayMealId: string;
  notes?: string;
}) {
  const user = await requireUser();
  await db.insert(schema.mealPlanEntries).values({
    date: dayOnly(input.date),
    slot: input.slot ?? "dinner",
    source: "takeaway",
    takeawayMealId: input.takeawayMealId,
    notes: input.notes,
    createdBy: user.id,
  });
  revalMeals();
}

export async function planAdhocMeal(input: {
  date: string;
  slot?: MealSlot;
  name: string;
  notes?: string;
}) {
  const user = await requireUser();
  await db.insert(schema.mealPlanEntries).values({
    date: dayOnly(input.date),
    slot: input.slot ?? "dinner",
    source: "adhoc",
    adhocName: input.name,
    notes: input.notes,
    createdBy: user.id,
  });
  revalMeals();
}

export async function deleteMealPlanEntry(id: string) {
  await requireUser();
  await db.delete(schema.mealPlanEntries).where(eq(schema.mealPlanEntries.id, id));
  revalMeals();
}

export async function markMealEaten(id: string) {
  await requireUser();
  const [entry] = await db
    .select()
    .from(schema.mealPlanEntries)
    .where(eq(schema.mealPlanEntries.id, id))
    .limit(1);
  if (!entry) return;
  await db.insert(schema.mealHistory).values({
    eatenOn: entry.date,
    source: entry.source,
    mealieRecipeId: entry.mealieRecipeId,
    takeawayMealId: entry.takeawayMealId,
    adhocName: entry.adhocName,
    notes: entry.notes,
  });
  revalMeals();
}

/* ---------- takeaway library ---------- */

export async function createTakeawayMeal(input: { name: string; vendor?: string; notes?: string }) {
  const user = await requireUser();
  const { suggestTakeawayEmoji } = await import("@/lib/ai");
  const emoji = await suggestTakeawayEmoji({
    name: input.name,
    vendor: input.vendor ?? null,
    notes: input.notes ?? null,
  });
  const [row] = await db
    .insert(schema.takeawayMeals)
    .values({
      name: input.name,
      vendor: input.vendor,
      notes: input.notes,
      emoji,
      createdBy: user.id,
    })
    .returning();
  revalidatePath("/meals/takeaways");
  return row;
}

export async function editTakeawayMeal(
  id: string,
  input: { name: string; vendor?: string | null; notes?: string | null },
) {
  await requireUser();
  const { suggestTakeawayEmoji } = await import("@/lib/ai");
  const emoji = await suggestTakeawayEmoji({
    name: input.name,
    vendor: input.vendor,
    notes: input.notes,
  });
  await db
    .update(schema.takeawayMeals)
    .set({
      name: input.name,
      vendor: input.vendor ?? null,
      notes: input.notes ?? null,
      emoji,
    })
    .where(eq(schema.takeawayMeals.id, id));
  revalidatePath("/meals/takeaways");
}

export async function deleteTakeawayMeal(id: string) {
  await requireUser();
  await db.delete(schema.takeawayMeals).where(eq(schema.takeawayMeals.id, id));
  revalidatePath("/meals/takeaways");
}

/* ---------- pantry ---------- */

export async function addPantryItem(input: {
  name: string;
  quantity?: string | null;
  unit?: PantryUnitInput;
  expiresOn?: string | null;
}) {
  await requireUser();
  const nameKey = normalizeName(input.name);
  if (!nameKey) throw new Error("Name required");
  const unit = input.unit ? (normalizeUnit(input.unit) ?? "other") : null;
  const expiresOn = input.expiresOn ? new Date(input.expiresOn) : null;

  // If an item with the same nameKey/unit already exists, merge quantities.
  const existing = await db
    .select()
    .from(schema.pantryItems)
    .where(eq(schema.pantryItems.nameKey, nameKey))
    .limit(20);
  const sameUnit = existing.find((e) => (e.unit ?? null) === unit);
  if (sameUnit && input.quantity != null && sameUnit.quantity != null) {
    const merged = Number(sameUnit.quantity) + Number(input.quantity);
    await db
      .update(schema.pantryItems)
      .set({ quantity: String(merged), updatedAt: new Date(), expiresOn: expiresOn ?? sameUnit.expiresOn })
      .where(eq(schema.pantryItems.id, sameUnit.id));
  } else {
    await db.insert(schema.pantryItems).values({
      nameKey,
      displayName: input.name.trim(),
      quantity: input.quantity ?? null,
      unit,
      expiresOn,
    });
  }
  revalidatePath("/meals/pantry");
  revalidatePath("/meals/shopping");
}

export async function editPantryItem(
  id: string,
  input: { name: string; quantity?: string | null; unit?: PantryUnitInput },
) {
  await requireUser();
  await db
    .update(schema.pantryItems)
    .set({
      nameKey: normalizeName(input.name),
      displayName: input.name.trim(),
      quantity: input.quantity ?? null,
      unit: input.unit ? (normalizeUnit(input.unit) ?? "other") : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.pantryItems.id, id));
  revalidatePath("/meals/pantry");
  revalidatePath("/meals/shopping");
}

export async function deletePantryItem(id: string) {
  await requireUser();
  await db.delete(schema.pantryItems).where(eq(schema.pantryItems.id, id));
  revalidatePath("/meals/pantry");
  revalidatePath("/meals/shopping");
}

/* ---------- shopping ---------- */

export async function regenerateShoppingList(weekStartIso?: string) {
  const user = await requireUser();
  const weekStart = startOfWeek(weekStartIso ? new Date(weekStartIso) : new Date());
  await generateShoppingListForWeek(weekStart, user.id);
  revalidatePath("/meals/shopping");
}

export async function addShoppingItemManual(input: {
  shoppingListId: string;
  name: string;
  quantity?: string | null;
  unit?: PantryUnitInput;
}) {
  await requireUser();
  await db.insert(schema.shoppingListItems).values({
    shoppingListId: input.shoppingListId,
    nameKey: normalizeName(input.name),
    displayName: input.name.trim(),
    quantity: input.quantity ?? null,
    unit: input.unit ? (normalizeUnit(input.unit) ?? "other") : null,
    sources: ["manual"],
    manuallyAdded: true,
  });
  revalidatePath("/meals/shopping");
}

export async function toggleShoppingItem(id: string, checked: boolean) {
  await requireUser();
  await db
    .update(schema.shoppingListItems)
    .set({ checked })
    .where(eq(schema.shoppingListItems.id, id));
  revalidatePath("/meals/shopping");
}

export async function deleteShoppingItem(id: string) {
  await requireUser();
  await db.delete(schema.shoppingListItems).where(eq(schema.shoppingListItems.id, id));
  revalidatePath("/meals/shopping");
}

export async function moveShoppingItemToPantry(id: string) {
  await requireUser();
  const [row] = await db
    .select()
    .from(schema.shoppingListItems)
    .where(eq(schema.shoppingListItems.id, id))
    .limit(1);
  if (!row) return;
  await db.insert(schema.pantryItems).values({
    nameKey: row.nameKey,
    displayName: row.displayName,
    quantity: row.quantity,
    unit: row.unit,
  });
  await db
    .delete(schema.shoppingListItems)
    .where(eq(schema.shoppingListItems.id, id));
  revalidatePath("/meals/shopping");
  revalidatePath("/meals/pantry");
}

/* ---------- helper: ensure list for this week exists ---------- */

export async function ensureShoppingListForCurrentWeek(): Promise<string> {
  const user = await requireUser();
  const weekStart = startOfWeek(new Date());
  const existing = await db
    .select()
    .from(schema.shoppingLists)
    .where(eq(schema.shoppingLists.weekStart, weekStart))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const [row] = await db
    .insert(schema.shoppingLists)
    .values({ weekStart, createdBy: user.id })
    .returning();
  return row.id;
}

