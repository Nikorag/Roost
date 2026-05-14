"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { setSetting, SETTING_KEYS } from "@/lib/app-settings";
import { fetchEventsInRange } from "@/lib/external-calendar";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user;
}

export async function saveGoogleCalendarUrl(url: string) {
  await requireUser();
  await setSetting(SETTING_KEYS.googleCalendarIcs, url);
  revalidatePath("/settings/calendars");
}

export async function testCalendar(url: string): Promise<{ ok: boolean; message: string }> {
  await requireUser();
  if (!url) return { ok: false, message: "URL is empty." };
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 14);
  const events = await fetchEventsInRange(url, from, to);
  if (events.length === 0) {
    return { ok: false, message: "Connected, but no events in the next 14 days (or the URL is wrong)." };
  }
  return {
    ok: true,
    message: `Connected — ${events.length} event${events.length === 1 ? "" : "s"} in the next 14 days. Next: ${events[0].date} ${events[0].summary}.`,
  };
}
