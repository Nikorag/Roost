import { readFileSync } from "node:fs";
import postgres from "postgres";
import { Storage } from "@google-cloud/storage";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

console.log("GCS_BUCKET:", env.GCS_BUCKET);
console.log("GCS_CREDENTIALS_JSON length:", env.GCS_CREDENTIALS_JSON?.length);

let parsed;
try {
  const raw = env.GCS_CREDENTIALS_JSON.trim();
  const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  parsed = JSON.parse(text);
  console.log("Parsed creds OK. project_id =", parsed.project_id, "client_email =", parsed.client_email);
} catch (e) {
  console.error("FAILED to parse creds:", e.message);
  process.exit(1);
}

const storage = new Storage({ credentials: parsed, projectId: parsed.project_id });

// Look up a recent upload row
const sql = postgres(env.DATABASE_URL, { ssl: "require" });
const rows = await sql`SELECT id, bucket, object_key, content_type FROM uploads ORDER BY created_at DESC LIMIT 5`;
console.log(`\nRecent uploads (${rows.length}):`);
for (const r of rows) console.log(`  ${r.id}  bucket=${r.bucket}  key=${r.object_key}  type=${r.content_type}`);
await sql.end();

if (rows.length === 0) {
  console.log("No upload rows to probe against.");
  process.exit(0);
}

const target = rows[0];
console.log(`\nProbing GET on ${target.bucket}/${target.object_key} …`);
try {
  const file = storage.bucket(target.bucket).file(target.object_key);
  const [exists] = await file.exists();
  console.log("  exists:", exists);
  if (exists) {
    const [meta] = await file.getMetadata();
    console.log("  size:", meta.size, "contentType:", meta.contentType);
    const [buf] = await file.download();
    console.log("  downloaded bytes:", buf.length);
  }
} catch (err) {
  console.error("  GCS error:", err.message);
  if (err.errors) console.error("  details:", JSON.stringify(err.errors, null, 2));
}
