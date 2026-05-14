import { db, schema } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { TakeawaysClient } from "./takeaways-client";
import { BackToMeals } from "@/components/meals/back-link";

export const dynamic = "force-dynamic";

export default async function TakeawaysPage() {
  const items = await db.select().from(schema.takeawayMeals).orderBy(schema.takeawayMeals.name);
  return (
    <div className="space-y-4">
      <BackToMeals />
      <header>
        <h1 className="text-2xl font-semibold">Takeaways</h1>
        <p className="text-sm text-muted-foreground">A library of takeaway meals you can drop into the planner.</p>
      </header>
      <Card>
        <CardContent className="p-4">
          <TakeawaysClient items={items.map((t) => ({ id: t.id, name: t.name, vendor: t.vendor, notes: t.notes, emoji: t.emoji }))} />
        </CardContent>
      </Card>
    </div>
  );
}
