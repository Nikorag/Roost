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

const tables = await sql`
  SELECT table_schema, table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
`;
const enums = await sql`
  SELECT n.nspname AS schema, t.typname AS name
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE t.typtype = 'e' AND n.nspname = 'public'
`;

console.log(`Dropping ${tables.length} tables and ${enums.length} enums…`);

await sql.begin(async (tx) => {
  for (const t of tables) {
    const ident = `"${t.table_schema}"."${t.table_name}"`;
    console.log(`  DROP TABLE ${ident}`);
    await tx.unsafe(`DROP TABLE IF EXISTS ${ident} CASCADE`);
  }
  for (const e of enums) {
    const ident = `"${e.schema}"."${e.name}"`;
    console.log(`  DROP TYPE ${ident}`);
    await tx.unsafe(`DROP TYPE IF EXISTS ${ident} CASCADE`);
  }
});

const remaining = await sql`
  SELECT count(*)::int AS n
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
`;
const remainingEnums = await sql`
  SELECT count(*)::int AS n
  FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE t.typtype = 'e' AND n.nspname = 'public'
`;
console.log(`\nDone. Remaining: ${remaining[0].n} tables, ${remainingEnums[0].n} enums.`);

await sql.end();
