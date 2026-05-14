import { db, schema } from "@/lib/db";
import { and, eq, gte, lt } from "drizzle-orm";
import { startOfWeek } from "@/lib/meals/shopping";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingClient } from "./shopping-client";
import { ensureShoppingListForCurrentWeek } from "@/lib/meals/actions";
import { BackToMeals } from "@/components/meals/back-link";

export const dynamic = "force-dynamic";

export default async function ShoppingPage() {
  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  await ensureShoppingListForCurrentWeek();

  const [list] = await db
    .select()
    .from(schema.shoppingLists)
    .where(
      and(
        gte(schema.shoppingLists.weekStart, weekStart),
        lt(schema.shoppingLists.weekStart, weekEnd),
      ),
    )
    .limit(1);

  const items = list
    ? await db
        .select()
        .from(schema.shoppingListItems)
        .where(eq(schema.shoppingListItems.shoppingListId, list.id))
        .orderBy(schema.shoppingListItems.displayName)
    : [];

  return (
    <div className="space-y-4">
      <BackToMeals />
      <header>
        <h1 className="text-2xl font-semibold">Shopping list</h1>
        <p className="text-sm text-muted-foreground">
          Week of {weekStart.toLocaleDateString()} — auto-generated from this week&apos;s meal plan minus pantry.
        </p>
      </header>
      <Card>
        <CardContent className="p-4">
          {list ? (
            <ShoppingClient
              listId={list.id}
              items={items.map((i) => ({
                id: i.id,
                displayName: i.displayName,
                quantity: i.quantity,
                unit: i.unit,
                checked: i.checked,
                manuallyAdded: i.manuallyAdded,
              }))}
              generatedAt={list.generatedAt.toISOString()}
            />
          ) : (
            <div className="text-sm text-muted-foreground">List not initialized.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
