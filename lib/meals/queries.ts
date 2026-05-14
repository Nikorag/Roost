import { db, schema } from "@/lib/db";
import { and, gte, inArray, lt } from "drizzle-orm";

export type Slot = "breakfast" | "lunch" | "dinner";

export type SlottedEntry = {
  id: string;
  source: "mealie" | "takeaway" | "adhoc";
  displayName: string;
  imageUrl?: string | null;
  emoji?: string | null;
  notes?: string | null;
};

export async function getEntriesInRange(start: Date, end: Date) {
  const entries = await db
    .select()
    .from(schema.mealPlanEntries)
    .where(and(gte(schema.mealPlanEntries.date, start), lt(schema.mealPlanEntries.date, end)));

  const mealieIds = Array.from(
    new Set(entries.map((e) => e.mealieRecipeId).filter((x): x is string => Boolean(x))),
  );
  const takeawayIds = Array.from(
    new Set(entries.map((e) => e.takeawayMealId).filter((x): x is string => Boolean(x))),
  );

  const [mealieRows, takeawayRows] = await Promise.all([
    mealieIds.length
      ? db.select().from(schema.mealieRecipes).where(inArray(schema.mealieRecipes.id, mealieIds))
      : Promise.resolve([] as (typeof schema.mealieRecipes.$inferSelect)[]),
    takeawayIds.length
      ? db.select().from(schema.takeawayMeals).where(inArray(schema.takeawayMeals.id, takeawayIds))
      : Promise.resolve([] as (typeof schema.takeawayMeals.$inferSelect)[]),
  ]);

  const mealieMap = new Map(mealieRows.map((m) => [m.id, m]));
  const takeawayMap = new Map(takeawayRows.map((t) => [t.id, t]));

  const slotted: Record<string, Partial<Record<Slot, SlottedEntry>>> = {};
  for (const e of entries) {
    const dayKey = new Date(e.date).toISOString().slice(0, 10);
    let displayName = "Meal";
    let imageUrl: string | null = null;
    let emoji: string | null = null;
    if (e.source === "mealie" && e.mealieRecipeId) {
      const m = mealieMap.get(e.mealieRecipeId);
      displayName = m?.name ?? "Mealie recipe";
      imageUrl = m?.imageUrl ?? null;
    } else if (e.source === "takeaway" && e.takeawayMealId) {
      const t = takeawayMap.get(e.takeawayMealId);
      displayName = t ? `${t.name}${t.vendor ? ` · ${t.vendor}` : ""}` : "Takeaway";
      emoji = t?.emoji ?? null;
    } else if (e.source === "adhoc") {
      displayName = e.adhocName ?? "Meal";
    }
    (slotted[dayKey] ??= {})[e.slot as Slot] = {
      id: e.id,
      source: e.source as "mealie" | "takeaway" | "adhoc",
      displayName,
      imageUrl,
      emoji,
      notes: e.notes ?? null,
    };
  }

  return slotted;
}
