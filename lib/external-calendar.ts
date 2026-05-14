export type CalendarEvent = {
  date: string; // YYYY-MM-DD (start)
  end?: string; // YYYY-MM-DD (end, exclusive — only set for multi-day)
  summary: string;
  location?: string;
  allDay: boolean;
  /** Time-of-day for non-all-day events (UTC-ish). */
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
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function hhmm(d: Date) {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/* ---------- minimal ICS parser ----------
 * Avoids node-ical (pnpm symlink / temporal-polyfill / webpack issues).
 * Handles direct VEVENTs and simple RRULEs (DAILY/WEEKLY/MONTHLY/YEARLY with
 * INTERVAL, BYDAY, COUNT, UNTIL) plus EXDATE — which covers ~all household
 * calendars (kids' classes, weekly meetings, birthdays).
 */

type IcsDate = { date: Date; allDay: boolean };
type Rrule = {
  freq?: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval?: number;
  count?: number;
  until?: Date;
  byday?: string[]; // SU, MO, TU, WE, TH, FR, SA
};
type RawEvent = {
  start?: IcsDate;
  end?: IcsDate;
  summary?: string;
  location?: string;
  rrule?: Rrule;
  exdates?: Date[];
};

function unescape(v: string) {
  return v
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseIcsDate(value: string, forceDate: boolean): IcsDate | undefined {
  // YYYYMMDD (date-only)
  if (forceDate || /^\d{8}$/.test(value)) {
    const y = +value.slice(0, 4);
    const m = +value.slice(4, 6);
    const d = +value.slice(6, 8);
    return { date: new Date(Date.UTC(y, m - 1, d)), allDay: true };
  }
  // YYYYMMDDTHHMMSS[Z]
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return undefined;
  const [, y, mo, d, hh, mm, ss, z] = m;
  // Floating times (no Z, no TZID handling) — treat as UTC, the worst-case
  // error is the event displayed an hour off in the AI prompt.
  const dt = new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss));
  void z;
  return { date: dt, allDay: false };
}

function parseRrule(v: string): Rrule {
  const out: Rrule = {};
  for (const part of v.split(";")) {
    const [k, val] = part.split("=");
    if (!k || val == null) continue;
    if (k === "FREQ") out.freq = val as Rrule["freq"];
    else if (k === "INTERVAL") out.interval = parseInt(val, 10);
    else if (k === "COUNT") out.count = parseInt(val, 10);
    else if (k === "UNTIL") out.until = parseIcsDate(val, val.length === 8)?.date;
    else if (k === "BYDAY") out.byday = val.split(",").map((s) => s.toUpperCase());
  }
  return out;
}

function parseIcs(body: string): RawEvent[] {
  // RFC 5545 line unfolding — lines beginning with space/tab continue the prev.
  const unfolded = body.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const events: RawEvent[] = [];
  let cur: RawEvent | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      cur = {};
    } else if (line === "END:VEVENT") {
      if (cur) events.push(cur);
      cur = null;
    } else if (cur) {
      const colon = line.indexOf(":");
      if (colon === -1) continue;
      const head = line.slice(0, colon);
      const value = line.slice(colon + 1);
      const [name, ...params] = head.split(";");
      const isDate = params.some((p) => p.toUpperCase().startsWith("VALUE=DATE"));
      switch (name) {
        case "DTSTART":
          cur.start = parseIcsDate(value, isDate);
          break;
        case "DTEND":
          cur.end = parseIcsDate(value, isDate);
          break;
        case "SUMMARY":
          cur.summary = unescape(value);
          break;
        case "LOCATION":
          cur.location = unescape(value);
          break;
        case "RRULE":
          cur.rrule = parseRrule(value);
          break;
        case "EXDATE": {
          const dt = parseIcsDate(value, isDate);
          if (dt) (cur.exdates ??= []).push(dt.date);
          break;
        }
      }
    }
  }
  return events;
}

const DAY_INDEX: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function expand(raw: RawEvent, windowStart: Date, windowEnd: Date): CalendarEvent[] {
  if (!raw.start) return [];
  const baseStart = raw.start.date;
  const allDay = raw.start.allDay;
  const summary = raw.summary ?? "Event";
  const location = raw.location;

  const makeOne = (start: Date): CalendarEvent => ({
    date: iso(start),
    end: raw.end ? iso(raw.end.date) : undefined,
    summary,
    location,
    allDay,
    time: allDay ? undefined : hhmm(start),
  });

  if (!raw.rrule || !raw.rrule.freq) {
    if (baseStart >= windowStart && baseStart < windowEnd) return [makeOne(baseStart)];
    return [];
  }

  const out: CalendarEvent[] = [];
  const exSet = new Set((raw.exdates ?? []).map((d) => iso(d)));
  const interval = Math.max(1, raw.rrule.interval ?? 1);
  const count = raw.rrule.count ?? Infinity;
  const until = raw.rrule.until ?? new Date(8640000000000000);
  const cap = Math.min(windowEnd.getTime(), until.getTime());

  let cursor = new Date(baseStart);
  let produced = 0;
  // Safety: hard stop after ~5y of iterations to avoid runaway loops on
  // pathological rules.
  for (let i = 0; i < 4000 && produced < count && cursor.getTime() <= cap; i++) {
    const candidates: Date[] = [];
    if (raw.rrule.freq === "WEEKLY" && raw.rrule.byday && raw.rrule.byday.length) {
      // For each weekday in BYDAY, find the date within this week.
      const weekStart = addDays(cursor, -((cursor.getUTCDay() + 7) % 7));
      for (const code of raw.rrule.byday) {
        const dow = DAY_INDEX[code];
        if (dow == null) continue;
        const occurrence = addDays(weekStart, dow);
        // Preserve time-of-day from base.
        occurrence.setUTCHours(
          baseStart.getUTCHours(),
          baseStart.getUTCMinutes(),
          baseStart.getUTCSeconds(),
          0,
        );
        if (occurrence >= baseStart) candidates.push(occurrence);
      }
    } else {
      candidates.push(new Date(cursor));
    }

    for (const c of candidates) {
      if (produced >= count) break;
      if (c.getTime() > until.getTime()) break;
      if (c >= windowStart && c < windowEnd && !exSet.has(iso(c))) {
        out.push(makeOne(c));
      }
      produced++;
    }

    // Step cursor.
    switch (raw.rrule.freq) {
      case "DAILY":
        cursor = addDays(cursor, interval);
        break;
      case "WEEKLY":
        cursor = addDays(cursor, 7 * interval);
        break;
      case "MONTHLY":
        cursor = new Date(cursor);
        cursor.setUTCMonth(cursor.getUTCMonth() + interval);
        break;
      case "YEARLY":
        cursor = new Date(cursor);
        cursor.setUTCFullYear(cursor.getUTCFullYear() + interval);
        break;
    }
  }
  return out;
}

async function fetchAllEvents(url: string, from: Date, to: Date): Promise<CalendarEvent[]> {
  const cacheKey = `${url}::${iso(from)}::${iso(to)}`;
  const cached = cache.get(cacheKey);
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

  const raws = parseIcs(body);
  const events: CalendarEvent[] = [];
  for (const r of raws) events.push(...expand(r, from, to));
  events.sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time ?? "").localeCompare(b.time ?? ""),
  );
  cache.set(cacheKey, { fetchedAt: Date.now(), events });
  return events;
}

export async function fetchEventsInRange(
  url: string,
  from: Date,
  to: Date,
): Promise<CalendarEvent[]> {
  if (!url.trim()) return [];
  return fetchAllEvents(url, from, to);
}
