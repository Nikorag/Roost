import Link from "next/link";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { auth } from "@/lib/auth";
import { eq, inArray } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL } from "@/lib/utils";

export default async function MyActionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const me = session.user.id;

  const actions = await db.select().from(schema.actions).where(eq(schema.actions.assigneeId, me));
  const projectIds = Array.from(new Set(actions.map((a) => a.projectId)));
  const projects = projectIds.length
    ? await db.select().from(schema.projects).where(inArray(schema.projects.id, projectIds))
    : [];
  const pmap = new Map(projects.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">My Actions</h1>
        <p className="text-sm text-muted-foreground">Actions assigned to you across every project.</p>
      </header>
      {actions.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Nothing assigned to you.</CardContent></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {actions.map((a) => {
            const proj = pmap.get(a.projectId);
            return (
              <Card key={a.id}>
                <CardHeader>
                  <CardTitle className="text-base">{a.title}</CardTitle>
                  {proj && (
                    <Link href={`/projects/${proj.id}`} className="text-xs text-muted-foreground hover:underline">
                      {proj.title}
                    </Link>
                  )}
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <Badge>{STATUS_LABEL[a.status]}</Badge>
                  {a.description && <p className="text-muted-foreground line-clamp-3">{a.description}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
