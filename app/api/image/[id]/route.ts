import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createSignedReadUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Signed read URLs live for 1h (see lib/storage.ts). Browser-cache the redirect for
// just under that so each tab only hits this route ~once an hour per image.
const REDIRECT_MAX_AGE = 50 * 60;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;

  const [row] = await db
    .select({ objectKey: schema.uploads.objectKey })
    .from(schema.uploads)
    .where(eq(schema.uploads.id, id))
    .limit(1);
  if (!row) return new NextResponse("Not found", { status: 404 });

  let url: string;
  try {
    url = await createSignedReadUrl(row.objectKey);
  } catch (err) {
    return new NextResponse(`Sign failed: ${(err as Error).message}`, { status: 502 });
  }

  return NextResponse.redirect(url, {
    status: 307,
    headers: {
      "Cache-Control": `private, max-age=${REDIRECT_MAX_AGE}`,
    },
  });
}
