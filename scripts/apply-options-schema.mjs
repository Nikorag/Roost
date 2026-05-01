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

console.log("Applying material_options column changes…");
await sql.begin(async (tx) => {
  await tx`ALTER TABLE material_options ADD COLUMN IF NOT EXISTS vendor text`;
  await tx`ALTER TABLE material_options ADD COLUMN IF NOT EXISTS description text`;
  // Backfill description from notes if the column is still around
  const cols = await tx`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'material_options' AND column_name = 'notes'
  `;
  if (cols.length > 0) {
    await tx`UPDATE material_options SET description = COALESCE(description, notes)`;
    await tx`ALTER TABLE material_options DROP COLUMN notes`;
    console.log("  migrated notes → description and dropped notes");
  } else {
    console.log("  notes column already absent");
  }
});

const cols = await sql`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'material_options'
  ORDER BY ordinal_position
`;
console.log("\nmaterial_options columns now:");
for (const c of cols) console.log(`  ${c.column_name}: ${c.data_type}`);

await sql.end();
