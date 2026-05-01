import { db, schema } from "@/lib/db";
import { Wizard } from "./wizard";

export default async function NewProjectPage() {
  const [contractors, personnel, tools] = await Promise.all([
    db.select().from(schema.contractors),
    db.select().from(schema.personnel),
    db.select().from(schema.tools),
  ]);
  return (
    <Wizard
      directory={{
        contractors: contractors.map((c) => ({ id: c.id, name: c.name, trade: c.trade ?? null })),
        personnel: personnel.map((p) => ({ id: p.id, name: p.name, relation: p.relation ?? null })),
        tools: tools.map((t) => ({ id: t.id, name: t.name })),
      }}
    />
  );
}
