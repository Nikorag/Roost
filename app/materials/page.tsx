import Link from "next/link";
import { db, schema } from "@/lib/db";
import { inArray } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils";

export default async function MaterialsPage() {
  const materials = await db.select().from(schema.materials);
  const projectIds = Array.from(new Set(materials.map((m) => m.projectId)));
  const [projects, options] = await Promise.all([
    projectIds.length
      ? db.select().from(schema.projects).where(inArray(schema.projects.id, projectIds))
      : Promise.resolve([]),
    db.select().from(schema.materialOptions),
  ]);
  const pmap = new Map(projects.map((p) => [p.id, p]));
  const omap = new Map<string, typeof options>();
  for (const o of options) {
    const arr = omap.get(o.materialId) ?? [];
    arr.push(o);
    omap.set(o.materialId, arr);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Materials</h1>
        <p className="text-sm text-muted-foreground">All materials across all projects.</p>
      </header>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {materials.length === 0 && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Nothing tracked yet.</CardContent></Card>
        )}
        {materials.map((m) => {
          const proj = pmap.get(m.projectId);
          const opts = omap.get(m.id) ?? [];
          const chosen = opts.find((o) => o.id === m.chosenOptionId);
          return (
            <Card key={m.id}>
              <CardHeader>
                <CardTitle>{m.name}</CardTitle>
                {proj && (
                  <Link href={`/projects/${proj.id}`} className="text-xs text-muted-foreground hover:underline">
                    {proj.title}
                  </Link>
                )}
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                {m.quantity && <div className="text-muted-foreground">{m.quantity}</div>}
                {m.isOpenChoice && (
                  <div className="flex flex-wrap gap-1">
                    {opts.map((o) => (
                      <Badge
                        key={o.id}
                        className={
                          o.id === m.chosenOptionId
                            ? "bg-pastel-mint text-emerald-900"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {o.label}
                        {o.priceCents != null ? ` · ${formatMoney(o.priceCents)}` : ""}
                      </Badge>
                    ))}
                  </div>
                )}
                {chosen && (
                  <p className="text-xs text-emerald-700">Chosen: {chosen.label}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
