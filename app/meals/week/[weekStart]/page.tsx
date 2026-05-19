import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DaySlot } from "@/components/meals/day-slot";
import { getEntriesInRange } from "@/lib/meals/queries";
import { startOfWeek } from "@/lib/meals/shopping";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BackToMeals } from "@/components/meals/back-link";
import { PlanSuggester } from "@/components/meals/plan-suggester";

export const dynamic = "force-dynamic";

function fmt(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function WeekPage(props: { params: Promise<{ weekStart: string }> }) {
  const { weekStart: param } = await props.params;
  const parsed = new Date(param);
  if (Number.isNaN(parsed.getTime())) notFound();
  const ws = startOfWeek(parsed);
  const we = new Date(ws);
  we.setDate(we.getDate() + 7);

  const slotted = await getEntriesInRange(ws, we);
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
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const prev = new Date(ws);
  prev.setDate(prev.getDate() - 7);
  const next = new Date(ws);
  next.setDate(next.getDate() + 7);
  const todayKey = isoDay(new Date(new Date().toISOString().slice(0, 10)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <BackToMeals />
        <PlanSuggester weekStartIso={isoDay(ws)} />
      </div>
      <header className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Previous week">
          <Link href={`/meals/week/${isoDay(prev)}`}><ChevronLeft className="size-4" /></Link>
        </Button>
        <h1 className="text-xl font-semibold">Week of {fmt(ws)}</h1>
        <Button asChild variant="ghost" size="icon" aria-label="Next week">
          <Link href={`/meals/week/${isoDay(next)}`}><ChevronRight className="size-4" /></Link>
        </Button>
      </header>

      <div className="space-y-3">
        {days.map((d) => {
          const key = isoDay(d);
          const slots = slotted[key] ?? {};
          return (
            <Card key={key} className={key === todayKey ? "ring-1 ring-blue-300" : ""}>
              <CardContent className="p-3 space-y-2">
                <div className="text-sm font-medium">{fmt(d)}</div>
                <DaySlot date={key} slot="dinner" entry={slots.dinner ?? null} takeaways={takeaways} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
