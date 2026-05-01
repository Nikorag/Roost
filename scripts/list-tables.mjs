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
  WHERE table_schema NOT IN ('pg_catalog','information_schema')
  ORDER BY table_schema, table_name
`;
const enums = await sql`
  SELECT n.nspname AS schema, t.typname AS name
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE t.typtype = 'e'
    AND n.nspname NOT IN ('pg_catalog','information_schema')
  ORDER BY n.nspname, t.typname
`;
const schemas = await sql`
  SELECT schema_name
  FROM information_schema.schemata
  WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
  ORDER BY schema_name
`;

console.log("Schemas:", schemas.map((s) => s.schema_name).join(", "));
console.log(`\n${tables.length} tables:`);
for (const t of tables) console.log(`  ${t.table_schema}.${t.table_name}`);
console.log(`\n${enums.length} enums:`);
for (const e of enums) console.log(`  ${e.schema}.${e.name}`);

await sql.end();
