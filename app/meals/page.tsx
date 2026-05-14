import Link from "next/link";
import { db, schema } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DaySlot } from "@/components/meals/day-slot";
import { AiSuggest } from "@/components/meals/ai-suggest";
import { getEntriesInRange } from "@/lib/meals/queries";
import { startOfWeek } from "@/lib/meals/shopping";
import { ChevronRight, CalendarDays, ShoppingCart, Package, Pizza } from "lucide-react";

export const dynamic = "force-dynamic";

function fmt(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export default async function MealsHome() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const weekStart = startOfWeek(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const slotted = await getEntriesInRange(weekStart, weekEnd);
  const todayKey = today.toISOString().slice(0, 10);
  const todayEntry = slotted[todayKey]?.dinner ?? null;

  const takeaways = await db
    .select({
      id: schema.takeawayMeals.id,
      name: schema.takeawayMeals.name,
      vendor: schema.takeawayMeals.vendor,
      emoji: schema.takeawayMeals.emoji,
    })
    .from(schema.takeawayMeals)
    .orderBy(schema.takeawayMeals.name);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  const weekStartIso = weekStart.toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Meals</h1>
          <p className="text-sm text-muted-foreground">Plan the week, generate a shopping list, ask the AI when you&apos;re stuck.</p>
        </div>
      </header>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Tonight</div>
              <div className="font-semibold">{fmt(today)}</div>
            </div>
            <Link href={`/meals/week/${weekStartIso}`} className="text-sm flex items-center gap-1 text-muted-foreground hover:text-foreground">
              Week <ChevronRight className="size-4" />
            </Link>
          </div>
          <DaySlot date={todayKey} slot="dinner" entry={todayEntry} takeaways={takeaways} />
          {!todayEntry && <AiSuggest date={todayKey} />}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {days.map((d) => {
          const key = d.toISOString().slice(0, 10);
          const dinner = slotted[key]?.dinner ?? null;
          const isToday = key === todayKey;
          return (
            <Card key={key} className={isToday ? "ring-1 ring-emerald-300" : ""}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{fmt(d)}</span>
                  {isToday && <span className="text-emerald-700">Today</span>}
                </div>
                <DaySlot date={key} slot="dinner" entry={dinner} takeaways={takeaways} compact />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button asChild variant="soft" size="lg" className="justify-start">
          <Link href="/meals/shopping"><ShoppingCart className="size-4" /> Shopping list</Link>
        </Button>
        <Button asChild variant="soft" size="lg" className="justify-start">
          <Link href="/meals/pantry"><Package className="size-4" /> Pantry</Link>
        </Button>
        <Button asChild variant="soft" size="lg" className="justify-start">
          <Link href="/meals/takeaways"><Pizza className="size-4" /> Takeaways</Link>
        </Button>
        <Button asChild variant="soft" size="lg" className="justify-start">
          <Link href="/meals/settings"><CalendarDays className="size-4" /> Calendar &amp; settings</Link>
        </Button>
      </div>
    </div>
  );
}
