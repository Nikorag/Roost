import { db, schema } from "@/lib/db";
import { and, eq, gte, lt } from "drizzle-orm";
import { getRecipe, type MealieIngredient } from "@/lib/mealie/client";

type PantryUnit = (typeof PANTRY_UNITS)[number];
export const PANTRY_UNITS = [
  "g",
  "kg",
  "ml",
  "l",
  "pcs",
  "tbsp",
  "tsp",
  "cup",
  "other",
] as const;

const UNIT_ALIASES: Record<string, PantryUnit> = {
  g: "g",
  gram: "g",
  grams: "g",
  gr: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  millilitre: "ml",
  milliliter: "ml",
  l: "l",
  litre: "l",
  liter: "l",
  pc: "pcs",
  pcs: "pcs",
  piece: "pcs",
  pieces: "pcs",
  ea: "pcs",
  each: "pcs",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  cup: "cup",
  cups: "cup",
};

export function normalizeUnit(unit: string | null | undefined): PantryUnit | null {
  if (!unit) return null;
  const key = unit.trim().toLowerCase().replace(/\./g, "");
  return UNIT_ALIASES[key] ?? null;
}

/** Lower-case, strip leading articles, collapse plurals naively. */
export function normalizeName(name: string): string {
  let n = name.trim().toLowerCase();
  n = n.replace(/^\s*(a |an |the )/, "");
  n = n.replace(/[(),.]/g, "");
  n = n.replace(/\s+/g, " ").trim();
  // Naive de-pluralisation.
  if (n.endsWith("ies") && n.length > 4) n = n.slice(0, -3) + "y";
  else if (n.endsWith("es") && n.length > 3) n = n.slice(0, -2);
  else if (n.endsWith("s") && n.length > 3) n = n.slice(0, -1);
  return n;
}

export type AggregatedItem = {
  nameKey: string;
  displayName: string;
  quantity: number | null;
  unit: PantryUnit | null;
  sources: string[];
};

function aggregateIngredients(
  recipes: { id: string; ingredients: MealieIngredient[] }[],
): AggregatedItem[] {
  const map = new Map<string, AggregatedItem>();
  for (const r of recipes) {
    for (const ing of r.ingredients) {
      const display = ing.food ?? ing.display;
      if (!display) continue;
      const nameKey = normalizeName(display);
      if (!nameKey) continue;
      const unit = normalizeUnit(ing.unit);
      const key = `${nameKey}::${unit ?? ""}`;
      const existing = map.get(key);
      if (existing) {
        if (ing.quantity != null && existing.quantity != null) {
          existing.quantity += ing.quantity;
        } else if (ing.quantity != null && existing.quantity == null) {
          existing.quantity = ing.quantity;
        }
        if (!existing.sources.includes(r.id)) existing.sources.push(r.id);
      } else {
        map.set(key, {
          nameKey,
          displayName: (ing.food ?? display).trim(),
          quantity: ing.quantity ?? null,
          unit,
          sources: [r.id],
        });
      }
    }
  }
  return Array.from(map.values());
}

function subtractPantry(items: AggregatedItem[], pantry: { nameKey: string; quantity: string | null; unit: PantryUnit | null }[]) {
  const result: AggregatedItem[] = [];
  for (const item of items) {
    const match = pantry.find((p) => p.nameKey === item.nameKey && p.unit === item.unit);
    if (!match) {
      result.push(item);
      continue;
    }
    const pantryQty = match.quantity != null ? Number(match.quantity) : null;
    if (item.quantity == null || pantryQty == null) {
      // Unit-less or unknown quantity — drop the item entirely if we have ANY pantry stock.
      continue;
    }
    if (pantryQty >= item.quantity) continue;
    result.push({ ...item, quantity: item.quantity - pantryQty });
  }
  return result;
}

export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0 Sun..6 Sat
  const diff = (day + 6) % 7; // Mon-anchored
  x.setDate(x.getDate() - diff);
  return x;
}

/**
 * Week the shopping list should target. Mon-Wed → current week. Thu-Sun → next
 * week, because by Thursday you're usually planning ahead, not for the days
 * that have already passed.
 */
export function shoppingWeekStart(d: Date = new Date()): Date {
  const day = d.getDay(); // 0 Sun..6 Sat
  const base = startOfWeek(d);
  const rollNext = day === 0 || day >= 4; // Sun, Thu, Fri, Sat
  if (rollNext) base.setDate(base.getDate() + 7);
  return base;
}

export async function generateShoppingListForWeek(
  weekStart: Date,
  createdBy: string | null,
): Promise<{ listId: string }> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const entries = await db
    .select()
    .from(schema.mealPlanEntries)
    .where(and(gte(schema.mealPlanEntries.date, weekStart), lt(schema.mealPlanEntries.date, weekEnd)));

  const mealieIds = Array.from(
    new Set(
      entries
        .filter((e) => e.source === "mealie" && e.mealieRecipeId)
        .map((e) => e.mealieRecipeId as string),
    ),
  );

  const recipes = (
    await Promise.all(mealieIds.map((id) => getRecipe(id)))
  ).filter((r): r is NonNullable<typeof r> => r !== null);

  const aggregated = aggregateIngredients(
    recipes.map((r) => ({ id: r.id, ingredients: r.ingredients })),
  );

  const pantryRows = await db.select().from(schema.pantryItems);
  const pantry = pantryRows.map((p) => ({
    nameKey: p.nameKey,
    quantity: p.quantity,
    unit: (p.unit ?? null) as PantryUnit | null,
  }));

  const final = subtractPantry(aggregated, pantry);

  // Find or create the list for this week; preserve manually-added items.
  const existing = await db
    .select()
    .from(schema.shoppingLists)
    .where(and(gte(schema.shoppingLists.weekStart, weekStart), lt(schema.shoppingLists.weekStart, weekEnd)))
    .limit(1);

  let listId: string;
  if (existing[0]) {
    listId = existing[0].id;
    // Drop only auto-generated items so user-added rows survive regeneration.
    await db
      .delete(schema.shoppingListItems)
      .where(
        and(
          eq(schema.shoppingListItems.shoppingListId, listId),
          eq(schema.shoppingListItems.manuallyAdded, false),
        ),
      );
    await db
      .update(schema.shoppingLists)
      .set({ generatedAt: new Date() })
      .where(eq(schema.shoppingLists.id, listId));
  } else {
    const [row] = await db
      .insert(schema.shoppingLists)
      .values({ weekStart, createdBy })
      .returning();
    listId = row.id;
  }

  if (final.length) {
    await db.insert(schema.shoppingListItems).values(
      final.map((i) => ({
        shoppingListId: listId,
        nameKey: i.nameKey,
        displayName: i.displayName,
        quantity: i.quantity != null ? String(i.quantity) : null,
        unit: i.unit,
        sources: i.sources,
        manuallyAdded: false,
      })),
    );
  }

  return { listId };
}
