import Link from "next/link";
import { db, schema } from "@/lib/db";
import { inArray } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { Copy } from "lucide-react";

export default async function CalendarPage() {
  const session = await auth();
  const events = await db.select().from(schema.events).orderBy(schema.events.startsOn);
  const projectIds = Array.from(new Set(events.map((e) => e.projectId)));
  const projects = projectIds.length
    ? await db.select().from(schema.projects).where(inArray(schema.projects.id, projectIds))
    : [];
  const pmap = new Map(projects.map((p) => [p.id, p]));
  const base = process.env.APP_URL ?? "";
  const feedUrl = session?.user?.icsToken
    ? `${base}/api/calendar.ics?token=${session.user.icsToken}`
    : "";

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">Every event across every project.</p>
        </div>
        {feedUrl && (
          <Button asChild variant="soft">
            <Link href={feedUrl} target="_blank" rel="noreferrer">
              <Copy className="size-4" /> Subscribe (.ics)
            </Link>
          </Button>
        )}
      </header>

      {feedUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Live ICS feed</CardTitle>
            <p className="text-xs text-muted-foreground">
              Subscribe in Apple/Google/Outlook calendar with this URL — it auto-updates.
            </p>
          </CardHeader>
          <CardContent>
            <code className="block text-xs break-all rounded-2xl bg-muted px-3 py-2">{feedUrl}</code>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {events.length === 0 && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No events scheduled.</CardContent></Card>
        )}
        {events.map((e) => {
          const proj = pmap.get(e.projectId);
          return (
            <Link key={e.id} href={proj ? `/projects/${proj.id}` : "#"}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{e.title}</div>
                    {proj && <div className="text-xs text-muted-foreground">{proj.title}</div>}
                  </div>
                  <div className="text-sm text-right">
                    <div>{formatDate(e.startsOn)}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.durationDays === 1 ? "all day" : `${e.durationDays} days`}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
