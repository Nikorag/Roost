import { Card, CardContent } from "@/components/ui/card";
import { getSetting, SETTING_KEYS } from "@/lib/app-settings";
import { CalendarsClient } from "./calendars-client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CalendarsSettings() {
  const url = await getSetting(SETTING_KEYS.googleCalendarIcs);
  return (
    <div className="space-y-4">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Settings
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">Calendars</h1>
        <p className="text-sm text-muted-foreground">
          Paste the private ICS URL from your family Google calendar so meal AI can see
          what&apos;s on your week.
        </p>
      </header>
      <Card>
        <CardContent className="p-4 space-y-3">
          <CalendarsClient initial={url} />
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">How to get the URL from Google Calendar</summary>
            <ol className="list-decimal pl-5 mt-2 space-y-1">
              <li>Open Google Calendar in a browser.</li>
              <li>Hover the calendar in the left list → ⋮ → <strong>Settings and sharing</strong>.</li>
              <li>Scroll to <strong>Integrate calendar</strong>.</li>
              <li>
                Copy <strong>Secret address in iCal format</strong> (private — don&apos;t share).
                Paste it above.
              </li>
            </ol>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
