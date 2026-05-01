import { Storage } from "@google-cloud/storage";

let cached: Storage | null = null;

function client() {
  if (cached) return cached;
  const raw = process.env.GCS_CREDENTIALS_JSON;
  if (!raw) {
    throw new Error(
      "GCS_CREDENTIALS_JSON is not set. Paste the full service-account JSON (or its base64) into that env var.",
    );
  }
  // Accept either raw JSON or base64-encoded JSON, since some hosts/shells dislike newlines.
  let parsed: Record<string, unknown>;
  try {
    const trimmed = raw.trim();
    const text = trimmed.startsWith("{") ? trimmed : Buffer.from(trimmed, "base64").toString("utf8");
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`GCS_CREDENTIALS_JSON is not valid JSON: ${(err as Error).message}`);
  }
  cached = new Storage({
    credentials: parsed as { client_email?: string; private_key?: string },
    projectId: (parsed as { project_id?: string }).project_id,
  });
  return cached;
}

export function bucketName() {
  const b = process.env.GCS_BUCKET;
  if (!b) throw new Error("GCS_BUCKET not configured");
  return b;
}

export async function createSignedUploadUrl(opts: {
  objectKey: string;
  contentType: string;
}) {
  const bucket = client().bucket(bucketName());
  const file = bucket.file(opts.objectKey);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000,
    contentType: opts.contentType,
  });
  return url;
}

export async function createSignedReadUrl(objectKey: string) {
  const bucket = client().bucket(bucketName());
  const file = bucket.file(objectKey);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 60 * 60 * 1000,
  });
  return url;
}

export function publicObjectUrl(objectKey: string) {
  return `https://storage.googleapis.com/${bucketName()}/${objectKey}`;
}

/** Stable, auth-gated URL that streams the upload via our /api/image route. */
export function imageUrl(uploadId: string) {
  return `/api/image/${uploadId}`;
}

export async function uploadBytes(opts: {
  objectKey: string;
  contentType: string;
  data: Buffer;
}) {
  const file = client().bucket(bucketName()).file(opts.objectKey);
  await file.save(opts.data, {
    contentType: opts.contentType,
    resumable: false,
  });
}

export async function downloadBytes(objectKey: string) {
  const file = client().bucket(bucketName()).file(objectKey);
  const [buf] = await file.download();
  return buf;
}
