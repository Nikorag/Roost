import { db, schema } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { PantryClient } from "./pantry-client";
import { BackToMeals } from "@/components/meals/back-link";

export const dynamic = "force-dynamic";

export default async function PantryPage() {
  const items = await db.select().from(schema.pantryItems).orderBy(schema.pantryItems.displayName);
  return (
    <div className="space-y-4">
      <BackToMeals />
      <header>
        <h1 className="text-2xl font-semibold">Pantry</h1>
        <p className="text-sm text-muted-foreground">
          Items here are subtracted from generated shopping lists.
        </p>
      </header>
      <Card>
        <CardContent className="p-4">
          <PantryClient items={items.map((i) => ({
            id: i.id,
            displayName: i.displayName,
            quantity: i.quantity,
            unit: i.unit,
          }))} />
        </CardContent>
      </Card>
    </div>
  );
}
