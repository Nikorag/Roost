import { db, schema } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createTool, deleteTool, editTool } from "@/lib/actions";
import { DirectoryCard } from "@/components/directory-card";

const FIELDS = [
  { name: "name", label: "Name", placeholder: "Name" },
  { name: "ownedBy", label: "Owned by" },
  { name: "location", label: "Location", placeholder: "e.g. shed" },
  { name: "notes", label: "Notes", type: "textarea" as const },
];

export default async function ToolsPage() {
  const rows = await db.select().from(schema.tools).orderBy(schema.tools.name);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Tools</h1>
        <p className="text-sm text-muted-foreground">What you've got, and where it lives.</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Add tool</CardTitle></CardHeader>
        <CardContent>
          <form
            action={async (fd) => {
              "use server";
              const name = (fd.get("name") as string)?.trim();
              if (!name) return;
              await createTool({
                name,
                ownedBy: (fd.get("ownedBy") as string) || undefined,
                location: (fd.get("location") as string) || undefined,
                notes: (fd.get("notes") as string) || undefined,
              });
            }}
            className="grid sm:grid-cols-2 gap-2"
          >
            <input name="name" placeholder="Name" required className="h-10 rounded-2xl border bg-background px-4 text-sm" />
            <input name="ownedBy" placeholder="Owned by" className="h-10 rounded-2xl border bg-background px-4 text-sm" />
            <input name="location" placeholder="Location (e.g. shed)" className="sm:col-span-2 h-10 rounded-2xl border bg-background px-4 text-sm" />
            <textarea name="notes" placeholder="Notes" className="sm:col-span-2 min-h-[5rem] rounded-2xl border bg-background px-4 py-2 text-sm" />
            <Button type="submit" className="sm:col-span-2 sm:justify-self-start">Add</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((t) => {
          const id = t.id;
          return (
            <DirectoryCard
              key={id}
              id={id}
              values={{
                name: t.name,
                ownedBy: t.ownedBy ?? "",
                location: t.location ?? "",
                notes: t.notes ?? "",
              }}
              titleField="name"
              subtitleField="location"
              bodyFields={[{ name: "ownedBy", label: "Owner" }, { name: "notes" }]}
              fields={FIELDS}
              onSave={async (values) => {
                "use server";
                await editTool(id, {
                  name: values.name,
                  ownedBy: values.ownedBy || null,
                  location: values.location || null,
                  notes: values.notes || null,
                });
              }}
              onDelete={async () => {
                "use server";
                await deleteTool(id);
              }}
            />
          );
        })}
        {rows.length === 0 && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No tools yet.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
