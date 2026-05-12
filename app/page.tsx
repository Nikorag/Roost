import Link from "next/link";
import { db, schema } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, STATUS_TINT, formatDate } from "@/lib/utils";
import { asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { imageUrl } from "@/lib/storage";
import { IMAGE_KIND_PRIORITY } from "@/lib/utils";
import { Plus, Calendar, Wrench, Home } from "lucide-react";

export default async function Dashboard() {
  const session = await auth();
  const [projects, openActions, upcoming] = await Promise.all([
    db
      .select()
      .from(schema.projects)
      .where(ne(schema.projects.status, "archived"))
      .orderBy(desc(schema.projects.updatedAt))
      .limit(6),
    db.select().from(schema.actions).where(eq(schema.actions.status, "open")).limit(6),
    db
      .select()
      .from(schema.events)
      .where(sql`${schema.events.startsOn} + (${schema.events.durationDays} || ' days')::interval > now()`)
      .orderBy(asc(schema.events.startsOn))
      .limit(5),
  ]);

  const heroByProject = await pickHeroImages(projects.map((p) => p.id));

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">
            Welcome back{session?.user?.name ? `, ${session.user.name.split(" ")[0]}` : ""}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Your roost</h1>
        </div>
        <Button asChild size="lg">
          <Link href="/projects/new">
            <Plus className="size-4" /> New project
          </Link>
        </Button>
      </header>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Active projects</h2>
          <Link href="/projects" className="text-sm text-muted-foreground hover:underline">
            View all
          </Link>
        </div>
        {projects.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No projects yet. Start your first one.
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <Card className="hover:shadow-md transition-shadow h-full overflow-hidden">
                  <div className="aspect-[16/9] bg-muted overflow-hidden flex items-center justify-center">
                    {heroByProject.get(p.id) ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={heroByProject.get(p.id)!}
                        alt=""
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Home className="size-10 text-muted-foreground/40" strokeWidth={1.5} />
                    )}
                  </div>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Badge className={STATUS_TINT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(p.targetDate)}
                      </span>
                    </div>
                    <CardTitle className="mt-2">{p.title}</CardTitle>
                    {p.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                    )}
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="size-4 text-emerald-700" /> Open actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {openActions.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing pending. Nice.</p>
            )}
            {openActions.map((a) => (
              <Link
                key={a.id}
                href={`/projects/${a.projectId}`}
                className="flex items-center justify-between rounded-2xl bg-muted/40 hover:bg-muted px-3 py-2"
              >
                <span className="text-sm truncate">{a.title}</span>
                <Badge className={STATUS_TINT[a.status]}>{STATUS_LABEL[a.status]}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="size-4 text-emerald-700" /> Upcoming
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground">No upcoming events.</p>
            )}
            {upcoming.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-2xl bg-muted/40 px-3 py-2">
                <span className="text-sm truncate">{e.title}</span>
                <span className="text-xs text-muted-foreground">{formatDate(e.startsOn)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

async function pickHeroImages(projectIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (projectIds.length === 0) return out;
  const rows = await db
    .select()
    .from(schema.uploads)
    .where(inArray(schema.uploads.projectId, projectIds));
  const grouped = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.projectId) continue;
    if (!(r.contentType ?? "").startsWith("image/") && !r.aiGenerated) continue;
    const arr = grouped.get(r.projectId) ?? [];
    arr.push(r);
    grouped.set(r.projectId, arr);
  }
  for (const [pid, arr] of grouped) {
    arr.sort((a, b) => {
      const pa = IMAGE_KIND_PRIORITY[a.kind] ?? 99;
      const pb = IMAGE_KIND_PRIORITY[b.kind] ?? 99;
      if (pa !== pb) return pa - pb;
      // Newest first within the same kind.
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    out.set(pid, imageUrl(arr[0].objectKey));
  }
  return out;
}
