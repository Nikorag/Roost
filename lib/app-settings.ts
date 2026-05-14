import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const SETTING_KEYS = {
  googleCalendarIcs: "google_calendar_ics_url",
} as const;

export async function getSetting(key: string): Promise<string> {
  try {
    const [row] = await db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, key))
      .limit(1);
    return row?.value ?? "";
  } catch {
    return "";
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(schema.appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value, updatedAt: new Date() },
    });
}
