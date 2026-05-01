import { db, schema } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createPersonnel, deletePersonnel, editPersonnel } from "@/lib/actions";
import { DirectoryCard } from "@/components/directory-card";

const FIELDS = [
  { name: "name", label: "Name", placeholder: "Name" },
  { name: "relation", label: "Relation", placeholder: "Relation (e.g. brother)" },
  { name: "phone", label: "Phone", type: "tel" as const },
  { name: "email", label: "Email", type: "email" as const },
  { name: "notes", label: "Notes", type: "textarea" as const },
];

export default async function PersonnelPage() {
  const rows = await db.select().from(schema.personnel).orderBy(schema.personnel.name);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">People</h1>
        <p className="text-sm text-muted-foreground">Friends and family you can call on for projects.</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Add a person</CardTitle></CardHeader>
        <CardContent>
          <form
            action={async (fd) => {
              "use server";
              const name = (fd.get("name") as string)?.trim();
              if (!name) return;
              await createPersonnel({
                name,
                relation: (fd.get("relation") as string) || undefined,
                phone: (fd.get("phone") as string) || undefined,
                email: (fd.get("email") as string) || undefined,
                notes: (fd.get("notes") as string) || undefined,
              });
            }}
            className="grid sm:grid-cols-2 gap-2"
          >
            <input name="name" placeholder="Name" required className="h-10 rounded-2xl border bg-background px-4 text-sm" />
            <input name="relation" placeholder="Relation (e.g. brother)" className="h-10 rounded-2xl border bg-background px-4 text-sm" />
            <input name="phone" placeholder="Phone" className="h-10 rounded-2xl border bg-background px-4 text-sm" />
            <input name="email" placeholder="Email" type="email" className="h-10 rounded-2xl border bg-background px-4 text-sm" />
            <textarea name="notes" placeholder="Notes" className="sm:col-span-2 min-h-[5rem] rounded-2xl border bg-background px-4 py-2 text-sm" />
            <Button type="submit" className="sm:col-span-2 sm:justify-self-start">Add</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((p) => {
          const id = p.id;
          return (
            <DirectoryCard
              key={id}
              id={id}
              values={{
                name: p.name,
                relation: p.relation ?? "",
                phone: p.phone ?? "",
                email: p.email ?? "",
                notes: p.notes ?? "",
              }}
              titleField="name"
              subtitleField="relation"
              bodyFields={[{ name: "phone" }, { name: "email" }, { name: "notes" }]}
              fields={FIELDS}
              onSave={async (values) => {
                "use server";
                await editPersonnel(id, {
                  name: values.name,
                  relation: values.relation || null,
                  phone: values.phone || null,
                  email: values.email || null,
                  notes: values.notes || null,
                });
              }}
              onDelete={async () => {
                "use server";
                await deletePersonnel(id);
              }}
            />
          );
        })}
        {rows.length === 0 && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No people yet.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
