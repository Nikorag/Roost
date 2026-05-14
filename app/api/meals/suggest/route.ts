import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { and, desc, gte, inArray, lt } from "drizzle-orm";
import { streamMealSuggestion, type ChatMessage, type SuggestionContext } from "@/lib/meals/ai";
import { listAllRecipes, mealieConfigured } from "@/lib/mealie/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const body = (await req.json().catch(() => null)) as { messages?: ChatMessage[] } | null;
  const messages = body?.messages ?? [];
  if (!Array.isArray(messages) || messages.length === 0) {
    return new NextResponse("messages required", { status: 400 });
  }

  const now = new Date();
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 14);
  const weekEnd = new Date(today);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const history = await db
    .select()
    .from(schema.mealHistory)
    .where(gte(schema.mealHistory.eatenOn, fourteenDaysAgo))
    .orderBy(desc(schema.mealHistory.eatenOn))
    .limit(40);

  // Plan entries from the last 14 days up to (but not including) today are
  // treated as already-eaten even if the user hasn't ticked them off — that
  // way the AI knows what's been on the menu this week.
  const pastPlanned = await db
    .select()
    .from(schema.mealPlanEntries)
    .where(
      and(
        gte(schema.mealPlanEntries.date, fourteenDaysAgo),
        lt(schema.mealPlanEntries.date, today),
      ),
    );

  const planned = await db
    .select()
    .from(schema.mealPlanEntries)
    .where(and(gte(schema.mealPlanEntries.date, today), lt(schema.mealPlanEntries.date, weekEnd)));

  const pantry = await db.select().from(schema.pantryItems);
  const takeaways = await db.select().from(schema.takeawayMeals);
  const mealieLibrary = mealieConfigured() ? await listAllRecipes() : [];

  // Hydrate mealie names from the local cache where available.
  const mealieIds = Array.from(
    new Set(
      [...history, ...planned, ...pastPlanned]
        .map((r) => ("mealieRecipeId" in r ? r.mealieRecipeId : null))
        .filter((x): x is string => Boolean(x)),
    ),
  );
  const mealieRows = mealieIds.length
    ? await db
        .select()
        .from(schema.mealieRecipes)
        .where(inArray(schema.mealieRecipes.id, mealieIds))
    : [];
  const mealieMap = new Map(mealieRows.map((m) => [m.id, m.name]));

  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
  const resolveName = (r: { source: string; mealieRecipeId: string | null; takeawayMealId: string | null; adhocName: string | null }) => {
    if (r.source === "mealie" && r.mealieRecipeId) return mealieMap.get(r.mealieRecipeId) ?? "Recipe";
    if (r.source === "takeaway" && r.takeawayMealId)
      return takeaways.find((t) => t.id === r.takeawayMealId)?.name ?? "Takeaway";
    return r.adhocName ?? "Meal";
  };

  // Merge explicit history with past-dated plan entries; de-dupe by (date, name).
  const mergedRecent: { name: string; date: string; source: string }[] = [];
  const seen = new Set<string>();
  for (const h of history) {
    const date = fmtDate(new Date(h.eatenOn));
    const name = resolveName(h);
    const key = `${date}::${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    mergedRecent.push({ name, date, source: h.source });
  }
  for (const p of pastPlanned) {
    const date = fmtDate(new Date(p.date));
    const name = resolveName(p);
    const key = `${date}::${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    mergedRecent.push({ name, date, source: `${p.source} (planned)` });
  }
  mergedRecent.sort((a, b) => (a.date < b.date ? 1 : -1));

  const takeawayCountLast14d =
    history.filter((h) => h.source === "takeaway").length +
    pastPlanned.filter((p) => p.source === "takeaway").length;

  const ctx: SuggestionContext = {
    recentMeals: mergedRecent,
    plannedThisWeek: planned.map((p) => ({
      name: resolveName(p),
      date: fmtDate(new Date(p.date)),
    })),
    pantry: pantry.map((p) => ({ displayName: p.displayName, quantity: p.quantity, unit: p.unit })),
    takeawayCountLast14d,
    mealieLibrary: mealieLibrary.map((r) => ({ name: r.name, description: r.description ?? null })),
    takeawayLibrary: takeaways.map((t) => ({ name: t.name, vendor: t.vendor })),
  };

  const stream = await streamMealSuggestion(messages, ctx);
  if (!stream) {
    return NextResponse.json(
      { error: "AI not configured. Set GOOGLE_GENERATIVE_AI_API_KEY." },
      { status: 503 },
    );
  }
  return new NextResponse(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
