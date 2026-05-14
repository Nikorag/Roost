import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { listAllRecipes, mealieConfigured } from "@/lib/mealie/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const [takeawayRows, mealie] = await Promise.all([
    db
      .select({ id: schema.takeawayMeals.id, name: schema.takeawayMeals.name })
      .from(schema.takeawayMeals)
      .orderBy(schema.takeawayMeals.name),
    mealieConfigured() ? listAllRecipes() : Promise.resolve([]),
  ]);

  return NextResponse.json({
    mealie: mealie.map((r) => ({ id: r.id, name: r.name, image: r.image ?? null })),
    takeaways: takeawayRows.map((t) => ({ id: t.id, name: t.name })),
  });
}
