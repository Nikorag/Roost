import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import { createEvents, type EventAttributes } from "ics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return new NextResponse("Missing token", { status: 401 });

  const userRow = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.icsToken, token))
    .limit(1);
  if (userRow.length === 0) return new NextResponse("Invalid token", { status: 403 });

  const allEvents = await db.select().from(schema.events);
  const projectIds = Array.from(new Set(allEvents.map((e) => e.projectId)));
  const projectRows = projectIds.length
    ? await db.select().from(schema.projects).where(inArray(schema.projects.id, projectIds))
    : [];
  const projectMap = new Map(projectRows.map((p) => [p.id, p]));

  const items: EventAttributes[] = allEvents.map((e) => {
    const project = projectMap.get(e.projectId);
    const d = new Date(e.startsOn);
    return {
      uid: `${e.id}@roost`,
      title: project ? `[${project.title}] ${e.title}` : e.title,
      description: e.notes ?? undefined,
      start: [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()],
      duration: { days: Math.max(1, e.durationDays) },
      productId: "roost/ics",
    };
  });

  const { error, value } = createEvents(items);
  if (error || !value) {
    return new NextResponse(`ICS generation failed: ${error?.message ?? "unknown"}`, {
      status: 500,
    });
  }
  return new NextResponse(value, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": 'inline; filename="roost.ics"',
    },
  });
}
