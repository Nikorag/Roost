import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import { createEvents, type EventAttributes } from "ics";
import { mealieRecipeUrl } from "@/lib/mealie/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return new NextResponse("Missing token", { status: 401 });

  const userRow = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.icsToken, token))
    .limit(1);
  if (userRow.length === 0) return new NextResponse("Invalid token", { status: 403 });

  const entries = await db.select().from(schema.mealPlanEntries);

  const takeawayIds = Array.from(
    new Set(entries.map((e) => e.takeawayMealId).filter((x): x is string => Boolean(x))),
  );
  const mealieIds = Array.from(
    new Set(entries.map((e) => e.mealieRecipeId).filter((x): x is string => Boolean(x))),
  );

  const takeaways = takeawayIds.length
    ? await db
        .select()
        .from(schema.takeawayMeals)
        .where(inArray(schema.takeawayMeals.id, takeawayIds))
    : [];
  const mealieRows = mealieIds.length
    ? await db
        .select()
        .from(schema.mealieRecipes)
        .where(inArray(schema.mealieRecipes.id, mealieIds))
    : [];

  const takeawayMap = new Map(takeaways.map((t) => [t.id, t]));
  const mealieMap = new Map(mealieRows.map((m) => [m.id, m]));

  const slotLabel: Record<string, string> = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
  };

  const items: EventAttributes[] = entries.map((e) => {
    const d = new Date(e.date);
    let title = "Meal";
    let recipeLink = "";
    if (e.source === "mealie" && e.mealieRecipeId) {
      const m = mealieMap.get(e.mealieRecipeId);
      title = m?.name ?? "Mealie recipe";
      if (m?.slug) recipeLink = mealieRecipeUrl(m.slug);
    } else if (e.source === "takeaway" && e.takeawayMealId) {
      const t = takeawayMap.get(e.takeawayMealId);
      title = t ? `🥡 ${t.name}` : "Takeaway";
    } else if (e.source === "adhoc") {
      title = e.adhocName ?? "Meal";
    }
    const desc = [e.notes ?? "", recipeLink].filter(Boolean).join("\n").trim();
    return {
      uid: `${e.id}@roost-meals`,
      title: `${slotLabel[e.slot] ?? "Meal"}: ${title}`,
      description: desc || undefined,
      url: recipeLink || undefined,
      start: [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()],
      duration: { days: 1 },
      productId: "roost/meals",
    };
  });

  const { error, value } = createEvents(items);
  if (error || !value) {
    return new NextResponse(`ICS generation failed: ${error?.message ?? "unknown"}`, { status: 500 });
  }
  return new NextResponse(value, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": 'inline; filename="roost-meals.ics"',
    },
  });
}
