import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchRecipes, mealieConfigured } from "@/lib/mealie/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  if (!mealieConfigured()) return NextResponse.json({ items: [], configured: false });
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const items = await searchRecipes(q);
  return NextResponse.json({ items, configured: true });
}
