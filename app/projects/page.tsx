import Link from "next/link";
import { db, schema } from "@/lib/db";
import { desc, eq, inArray } from "drizzle-orm";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IMAGE_KIND_PRIORITY,
  PROJECT_STATUSES,
  STATUS_LABEL,
  STATUS_TINT,
  cn,
  formatDate,
} from "@/lib/utils";
import { imageUrl } from "@/lib/storage";
import { Plus } from "lucide-react";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = (PROJECT_STATUSES as readonly string[]).includes(status ?? "")
    ? (status as (typeof PROJECT_STATUSES)[number])
    : null;

  const rows = await db
    .select()
    .from(schema.projects)
    .where(filter ? eq(schema.projects.status, filter) : undefined)
    .orderBy(desc(schema.projects.updatedAt));

  const heroByProject = await pickHeroImages(rows.map((r) => r.id));

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">All household projects, big and small.</p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="size-4" /> New project
          </Link>
        </Button>
      </header>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <FilterPill href="/projects" active={!filter} label="All" />
        {PROJECT_STATUSES.map((s) => (
          <FilterPill
            key={s}
            href={`/projects?status=${s}`}
            active={filter === s}
            label={STATUS_LABEL[s]}
            tint={STATUS_TINT[s]}
          />
        ))}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No projects {filter ? `with status "${STATUS_LABEL[filter]}"` : "yet"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Start one to see it here. The wizard will help you plan it.
            </p>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="hover:shadow-md transition-shadow h-full overflow-hidden">
                {heroByProject.get(p.id) && (
                  <div className="aspect-[16/9] bg-muted overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={heroByProject.get(p.id)!}
                      alt=""
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge className={STATUS_TINT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(p.targetDate)}</span>
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
    </div>
  );
}

function FilterPill({
  href,
  label,
  active,
  tint,
}: {
  href: string;
  label: string;
  active?: boolean;
  tint?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm whitespace-nowrap border transition-colors",
        active ? cn(tint ?? "bg-foreground text-background", "border-transparent") : "hover:bg-muted",
      )}
    >
      {label}
    </Link>
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
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    out.set(pid, imageUrl(arr[0].id));
  }
  return out;
}
