import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { downloadBytes } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;

  const [row] = await db
    .select()
    .from(schema.uploads)
    .where(eq(schema.uploads.id, id))
    .limit(1);
  if (!row) return new NextResponse("Not found", { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await downloadBytes(row.objectKey);
  } catch (err) {
    return new NextResponse(`Download failed: ${(err as Error).message}`, { status: 502 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": row.contentType ?? "application/octet-stream",
      // Cache only on the user's own browser; never on shared CDNs.
      "Cache-Control": "private, max-age=300",
      "Content-Length": String(bytes.byteLength),
    },
  });
}
