import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const sql = postgres(env.DATABASE_URL, { ssl: "require" });

console.log("Applying schema changes…");
await sql.begin(async (tx) => {
  // image_kind enum
  await tx`DO $$ BEGIN
    CREATE TYPE image_kind AS ENUM ('before','progress','after','other');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`;

  // events: add duration_days, copy from duration_minutes if present, drop old columns
  await tx`ALTER TABLE events ADD COLUMN IF NOT EXISTS duration_days integer NOT NULL DEFAULT 1`;
  await tx`ALTER TABLE events ADD COLUMN IF NOT EXISTS starts_on timestamptz`;

  const hasStartsAt = await tx`
    SELECT 1 FROM information_schema.columns
    WHERE table_name='events' AND column_name='starts_at'`;
  if (hasStartsAt.length > 0) {
    await tx`UPDATE events SET starts_on = COALESCE(starts_on, starts_at)`;
    await tx`ALTER TABLE events DROP COLUMN starts_at`;
  }
  await tx`ALTER TABLE events ALTER COLUMN starts_on SET NOT NULL`;
  await tx`ALTER TABLE events DROP COLUMN IF EXISTS duration_minutes`;
  await tx`ALTER TABLE events DROP COLUMN IF EXISTS all_day`;

  // uploads: add kind, caption, ai_generated
  await tx`ALTER TABLE uploads
           ADD COLUMN IF NOT EXISTS kind image_kind NOT NULL DEFAULT 'other'`;
  await tx`ALTER TABLE uploads ADD COLUMN IF NOT EXISTS caption text`;
  await tx`ALTER TABLE uploads
           ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false`;
});

console.log("Done.");
const evCols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name='events' ORDER BY ordinal_position`;
console.log("events columns:", evCols.map((c) => c.column_name).join(", "));
const upCols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name='uploads' ORDER BY ordinal_position`;
console.log("uploads columns:", upCols.map((c) => c.column_name).join(", "));

await sql.end();
