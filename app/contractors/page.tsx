import { db, schema } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createContractor, deleteContractor, editContractor } from "@/lib/actions";
import { DirectoryCard } from "@/components/directory-card";

const FIELDS = [
  { name: "name", label: "Name", placeholder: "Name" },
  { name: "trade", label: "Trade", placeholder: "Trade (e.g. plumber)" },
  { name: "phone", label: "Phone", type: "tel" as const },
  { name: "email", label: "Email", type: "email" as const },
  { name: "website", label: "Website", type: "url" as const },
  { name: "notes", label: "Notes", type: "textarea" as const },
];

export default async function Contractors() {
  const rows = await db.select().from(schema.contractors).orderBy(schema.contractors.name);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Contractors</h1>
        <p className="text-sm text-muted-foreground">Trades you've worked with and might call again.</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Add contractor</CardTitle></CardHeader>
        <CardContent>
          <form
            action={async (fd) => {
              "use server";
              const name = (fd.get("name") as string)?.trim();
              if (!name) return;
              await createContractor({
                name,
                trade: (fd.get("trade") as string) || undefined,
                phone: (fd.get("phone") as string) || undefined,
                email: (fd.get("email") as string) || undefined,
                website: (fd.get("website") as string) || undefined,
                notes: (fd.get("notes") as string) || undefined,
              });
            }}
            className="grid sm:grid-cols-2 gap-2"
          >
            <input name="name" placeholder="Name" required className="h-10 rounded-2xl border bg-background px-4 text-sm" />
            <input name="trade" placeholder="Trade (e.g. plumber)" className="h-10 rounded-2xl border bg-background px-4 text-sm" />
            <input name="phone" placeholder="Phone" className="h-10 rounded-2xl border bg-background px-4 text-sm" />
            <input name="email" placeholder="Email" type="email" className="h-10 rounded-2xl border bg-background px-4 text-sm" />
            <input name="website" placeholder="Website" className="sm:col-span-2 h-10 rounded-2xl border bg-background px-4 text-sm" />
            <textarea name="notes" placeholder="Notes" className="sm:col-span-2 min-h-[5rem] rounded-2xl border bg-background px-4 py-2 text-sm" />
            <Button type="submit" className="sm:col-span-2 sm:justify-self-start">Add</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((c) => {
          const id = c.id;
          return (
            <DirectoryCard
              key={id}
              id={id}
              values={{
                name: c.name,
                trade: c.trade ?? "",
                phone: c.phone ?? "",
                email: c.email ?? "",
                website: c.website ?? "",
                notes: c.notes ?? "",
              }}
              titleField="name"
              subtitleField="trade"
              bodyFields={[
                { name: "phone" },
                { name: "email" },
                { name: "website", label: "Website", isLink: "url" },
                { name: "notes" },
              ]}
              fields={FIELDS}
              onSave={async (values) => {
                "use server";
                await editContractor(id, {
                  name: values.name,
                  trade: values.trade || null,
                  phone: values.phone || null,
                  email: values.email || null,
                  website: values.website || null,
                  notes: values.notes || null,
                });
              }}
              onDelete={async () => {
                "use server";
                await deleteContractor(id);
              }}
            />
          );
        })}
        {rows.length === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">No contractors yet.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
