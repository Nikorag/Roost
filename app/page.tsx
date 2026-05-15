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
import { Plus, Calendar, Wrench, Home, UtensilsCrossed, ChevronRight } from "lucide-react";
import { getEntriesInRange } from "@/lib/meals/queries";
import { startOfWeek } from "@/lib/meals/shopping";

export default async function Dashboard() {
  const session = await auth();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const weekStart = startOfWeek(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekStartIso = weekStart.toISOString().slice(0, 10);

  const [projects, openActions, upcoming, mealEntries] = await Promise.all([
    db
      .select()
      .from(schema.projects)
      .where(ne(schema.projects.status, "archived"))
      .orderBy(desc(schema.projects.updatedAt))
      .limit(8),
    db.select().from(schema.actions).where(eq(schema.actions.status, "open")).limit(6),
    db
      .select()
      .from(schema.events)
      .where(sql`${schema.events.startsOn} + (${schema.events.durationDays} || ' days')::interval > now()`)
      .orderBy(asc(schema.events.startsOn))
      .limit(5),
    getEntriesInRange(today, weekEnd),
  ]);

  const heroByProject = await pickHeroImages(projects.map((p) => p.id));

  const mealDays: { key: string; label: string; isToday: boolean; dinner: ReturnType<typeof pickDinner> }[] = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    mealDays.push({
      key,
      label: i === 0 ? "Tonight" : d.toLocaleDateString(undefined, { weekday: "short" }),
      isToday: i === 0,
      dinner: pickDinner(mealEntries[key]?.dinner),
    });
  }

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">
            Welcome back{session?.user?.name ? `, ${session.user.name.split(" ")[0]}` : ""}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Your Roost</h1>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <Card className="hover:shadow-md transition-shadow h-full overflow-hidden">
                  <div className="aspect-[4/3] bg-muted overflow-hidden flex items-center justify-center">
                    {heroByProject.get(p.id) ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={heroByProject.get(p.id)!}
                        alt=""
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Home className="size-8 text-muted-foreground/40" strokeWidth={1.5} />
                    )}
                  </div>
                  <CardHeader className="p-3">
                    <CardTitle className="text-sm leading-snug line-clamp-2">{p.title}</CardTitle>
                    <div className="flex items-center justify-between mt-1 gap-2">
                      <Badge className={`${STATUS_TINT[p.status]} text-[10px] px-1.5 py-0`}>{STATUS_LABEL[p.status]}</Badge>
                      {p.targetDate && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          {formatDate(p.targetDate)}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Meals</h2>
          <Link href="/meals" className="text-sm text-muted-foreground hover:underline">
            Plan week
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {mealDays.map((d) => (
            <Link key={d.key} href={`/meals/week/${weekStartIso}`}>
              <Card className={`hover:shadow-md transition-shadow h-full ${d.isToday ? "ring-1 ring-emerald-300" : ""}`}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{d.label}</span>
                    <UtensilsCrossed className="size-3.5 text-muted-foreground" />
                  </div>
                  {d.dinner ? (
                    <div className="flex items-center gap-2">
                      {d.dinner.emoji && <span className="text-lg leading-none">{d.dinner.emoji}</span>}
                      <span className="text-sm font-medium line-clamp-2">{d.dinner.displayName}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      Not planned <ChevronRight className="size-3" />
                    </span>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
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

function pickDinner(
  entry: { displayName: string; emoji?: string | null } | undefined,
): { displayName: string; emoji?: string | null } | null {
  return entry ? { displayName: entry.displayName, emoji: entry.emoji } : null;
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
