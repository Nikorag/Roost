import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { createSignedUploadUrl, imageUrl, bucketName } from "@/lib/storage";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const Body = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().optional(),
  projectId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  kind: z.enum(["before", "progress", "after", "other"]).optional(),
  caption: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
  const json = await req.json();
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json(parsed.error.flatten(), { status: 400 });

  const { filename, contentType, sizeBytes, projectId, taskId, kind, caption } = parsed.data;
  const safeName = filename.replace(/[^\w.\-]+/g, "_");
  const objectKey = `${projectId ?? "loose"}/${randomUUID()}-${safeName}`;
  const uploadUrl = await createSignedUploadUrl({ objectKey, contentType });

  const [row] = await db
    .insert(schema.uploads)
    .values({
      bucket: bucketName(),
      objectKey,
      contentType,
      sizeBytes: sizeBytes ?? null,
      originalName: filename,
      projectId: projectId ?? null,
      taskId: taskId ?? null,
      kind: kind ?? "other",
      caption: caption ?? null,
      uploadedBy: session.user.id,
    })
    .returning();

  return NextResponse.json({
    uploadId: row.id,
    uploadUrl,
    // Stable, auth-gated URL — the bucket itself stays private.
    publicUrl: imageUrl(row.id),
    objectKey,
  });
}
