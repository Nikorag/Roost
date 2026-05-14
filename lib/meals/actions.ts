"use server";

import { db, schema } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createRecipe, getRecipe, listPlannableRecipes, uploadRecipeImage } from "@/lib/mealie/client";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { suggestWeeklyPlan, type PlanPick } from "./plan";
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

/* ---------- AI recipe creation ---------- */

export async function suggestRecipeIngredientsAction(name: string): Promise<string[]> {
  await requireUser();
  if (!name.trim()) return [];
  const { suggestRecipeIngredients } = await import("@/lib/ai");
  return suggestRecipeIngredients(name.trim());
}

export async function createMealieRecipeAction(input: {
  name: string;
  ingredients: string[];
}): Promise<{ slug: string; id: string } | { error: string }> {
  await requireUser();
  const name = input.name.trim();
  if (!name) return { error: "Name required" };
  const ingredients = (input.ingredients ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  const created = await createRecipe({ name, ingredients });
  if (!created) return { error: "Mealie create failed. Check MEALIE_BASE_URL/MEALIE_API_TOKEN." };

  // Generate a hero image and upload it to Mealie. Failures here don't fail
  // the whole save — the recipe still exists, just without an image.
  try {
    const { generateRecipeImage } = await import("@/lib/ai");
    const image = await generateRecipeImage(name);
    if (image) await uploadRecipeImage(created.slug, image);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[roost] recipe image generation failed:", err);
  }

  // Pull the full recipe back so our local cache has the right metadata.
  const recipe = await getRecipe(created.slug);
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
  revalidatePath("/meals");
  return created;
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

/* ---------- AI weekly-plan suggestion ---------- */

export async function suggestWeeklyPlanAction(weekStartIso: string): Promise<PlanPick[]> {
  await requireUser();
  const weekStart = startOfWeek(new Date(weekStartIso));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const fourteenBack = new Date(weekStart);
  fourteenBack.setDate(fourteenBack.getDate() - 14);

  const weekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    weekDates.push(d.toISOString().slice(0, 10));
  }

  const [planned, history, pantryRows, takeawayRows, mealieRecipes] = await Promise.all([
    db
      .select()
      .from(schema.mealPlanEntries)
      .where(and(gte(schema.mealPlanEntries.date, weekStart), lt(schema.mealPlanEntries.date, weekEnd))),
    db
      .select()
      .from(schema.mealHistory)
      .where(gte(schema.mealHistory.eatenOn, fourteenBack))
      .orderBy(desc(schema.mealHistory.eatenOn))
      .limit(40),
    db.select().from(schema.pantryItems),
    db.select().from(schema.takeawayMeals),
    listPlannableRecipes(),
  ]);

  const cachedMealie = await db.select().from(schema.mealieRecipes);
  const mealieNameMap = new Map(cachedMealie.map((m) => [m.id, m.name]));

  const alreadyPlanned = planned.map((p) => ({
    date: new Date(p.date).toISOString().slice(0, 10),
    name:
      p.source === "mealie" && p.mealieRecipeId
        ? mealieNameMap.get(p.mealieRecipeId) ?? "Recipe"
        : p.source === "takeaway" && p.takeawayMealId
          ? takeawayRows.find((t) => t.id === p.takeawayMealId)?.name ?? "Takeaway"
          : p.adhocName ?? "Meal",
  }));

  const recentMeals = history.map((h) => ({
    date: new Date(h.eatenOn).toISOString().slice(0, 10),
    name:
      h.source === "mealie" && h.mealieRecipeId
        ? mealieNameMap.get(h.mealieRecipeId) ?? "Recipe"
        : h.source === "takeaway" && h.takeawayMealId
          ? takeawayRows.find((t) => t.id === h.takeawayMealId)?.name ?? "Takeaway"
          : h.adhocName ?? "Meal",
  }));

  return suggestWeeklyPlan({
    weekDates,
    alreadyPlanned,
    recentMeals,
    pantry: pantryRows.map((p) => p.displayName),
    takeawayCountLast14d: history.filter((h) => h.source === "takeaway").length,
    mealieCandidates: mealieRecipes.map((r) => ({ kind: "mealie", id: r.id, name: r.name })),
    takeawayCandidates: takeawayRows.map((t) => ({ kind: "takeaway", id: t.id, name: t.name })),
  });
}

export async function applyWeeklyPlanAction(picks: PlanPick[]) {
  const user = await requireUser();
  for (const p of picks) {
    if (p.kind === "skip" || !p.id) continue;
    const date = dayOnly(p.date);
    // Skip if a dinner already exists for this date.
    const existing = await db
      .select()
      .from(schema.mealPlanEntries)
      .where(and(eq(schema.mealPlanEntries.date, date), eq(schema.mealPlanEntries.slot, "dinner")))
      .limit(1);
    if (existing[0]) continue;

    if (p.kind === "mealie") {
      // Make sure we have the recipe in our local cache so it renders nicely.
      const cached = await db
        .select()
        .from(schema.mealieRecipes)
        .where(eq(schema.mealieRecipes.id, p.id))
        .limit(1);
      if (!cached[0]) {
        const fresh = await getRecipe(p.id);
        if (fresh) {
          await db
            .insert(schema.mealieRecipes)
            .values({
              id: fresh.id,
              slug: fresh.slug,
              name: fresh.name,
              description: fresh.description ?? null,
              imageUrl: fresh.image ?? null,
              payload: fresh,
              lastFetchedAt: new Date(),
            })
            .onConflictDoNothing();
        }
      }
      await db.insert(schema.mealPlanEntries).values({
        date,
        slot: "dinner",
        source: "mealie",
        mealieRecipeId: p.id,
        createdBy: user.id,
      });
    } else if (p.kind === "takeaway") {
      await db.insert(schema.mealPlanEntries).values({
        date,
        slot: "dinner",
        source: "takeaway",
        takeawayMealId: p.id,
        createdBy: user.id,
      });
    }
  }
  revalMeals();
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

