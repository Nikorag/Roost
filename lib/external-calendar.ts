export type CalendarEvent = {
  date: string; // YYYY-MM-DD (start)
  end?: string; // YYYY-MM-DD (end, exclusive — only set for multi-day)
  summary: string;
  location?: string;
  allDay: boolean;
  /** Time-of-day for non-all-day events, local-ish. */
  time?: string;
};

type Cached = { fetchedAt: number; events: CalendarEvent[] };
declare global {
  // eslint-disable-next-line no-var
  var __roostCalCache: Map<string, Cached> | undefined;
}
const cache = (globalThis.__roostCalCache ??= new Map());
const TTL_MS = 15 * 60 * 1000;

function normaliseUrl(u: string): string {
  return u.replace(/^webcal:\/\//i, "https://").trim();
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function iso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function timeStr(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function fetchAllEvents(url: string): Promise<CalendarEvent[]> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.events;

  let body = "";
  try {
    const res = await fetch(normaliseUrl(url), {
      headers: { Accept: "text/calendar" },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    body = await res.text();
  } catch {
    return [];
  }

  // Loaded lazily — node-ical pulls in moment-timezone/rrule, which fail to
  // evaluate during Next's "Collecting page data" step on Vercel if imported
  // at module load.
  const ical = await import("node-ical");
  const parsed = ical.sync.parseICS(body);
  const events: CalendarEvent[] = [];
  type VEvent = {
    type: "VEVENT";
    start?: Date & { dateOnly?: boolean };
    end?: Date;
    summary?: string;
    location?: string;
  };
  for (const raw of Object.values(parsed)) {
    if (!raw || raw.type !== "VEVENT") continue;
    const item = raw as unknown as VEvent;
    const start = item.start;
    if (!start) continue;
    const end = item.end;
    const allDay = Boolean(start.dateOnly);
    events.push({
      date: iso(start),
      end: end ? iso(end) : undefined,
      summary: String(item.summary ?? "Event"),
      location: item.location ? String(item.location) : undefined,
      allDay,
      time: allDay ? undefined : timeStr(start),
    });
  }
  cache.set(url, { fetchedAt: Date.now(), events });
  return events;
}

export async function fetchEventsInRange(
  url: string,
  from: Date,
  to: Date,
): Promise<CalendarEvent[]> {
  if (!url.trim()) return [];
  const fromIso = iso(from);
  const toIso = iso(to);
  const all = await fetchAllEvents(url);
  return all
    .filter((e) => e.date >= fromIso && e.date < toIso)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time ?? "").localeCompare(b.time ?? "")));
}
