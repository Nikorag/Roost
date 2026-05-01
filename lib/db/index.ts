import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // eslint-disable-next-line no-console
  console.warn("[roost] DATABASE_URL not set — DB queries will fail at runtime.");
}

declare global {
  // eslint-disable-next-line no-var
  var __roostPg: ReturnType<typeof postgres> | undefined;
}

const client =
  global.__roostPg ??
  postgres(connectionString ?? "postgres://localhost:5432/roost", {
    max: 10,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") global.__roostPg = client;

export const db = drizzle(client, { schema });
export { schema };
