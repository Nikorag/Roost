import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const base = process.env.MEALIE_BASE_URL?.replace(/\/$/, "");
  const token = process.env.MEALIE_API_TOKEN;
  if (!base || !token) return new NextResponse("Mealie not configured", { status: 503 });

  // Mealie stores images under the recipe's UUID. If we were handed a slug
  // (older callers / cached data), resolve it to the UUID first.
  let recipeId = id;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    try {
      const lookup = await fetch(`${base}/api/recipes/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      });
      if (lookup.ok) {
        const json = (await lookup.json()) as { id?: string };
        if (json.id) recipeId = json.id;
      }
    } catch {
      // fall through — we'll just 404 below
    }
  }

  // Try common file names in descending quality.
  for (const file of ["original.webp", "min-original.webp", "tiny-original.webp"]) {
    const upstream = await fetch(`${base}/api/media/recipes/${recipeId}/images/${file}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (upstream.ok && upstream.body) {
      return new NextResponse(upstream.body, {
        headers: {
          "Content-Type": upstream.headers.get("content-type") ?? "image/webp",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
  }
  return new NextResponse("Not found", { status: 404 });
}
