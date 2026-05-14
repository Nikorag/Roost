import { Card, CardContent } from "@/components/ui/card";
import { getSetting, SETTING_KEYS } from "@/lib/app-settings";
import { HouseholdClient } from "./household-client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HouseholdSettings() {
  const profile = await getSetting(SETTING_KEYS.householdProfile);
  return (
    <div className="space-y-4">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Settings
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">Household profile</h1>
        <p className="text-sm text-muted-foreground">
          Tell the AI about your family so it can interpret calendar events with the right tone. It
          won&apos;t share this back at you — it&apos;s context only.
        </p>
      </header>
      <Card>
        <CardContent className="p-4 space-y-3">
          <HouseholdClient initial={profile} />
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">What to put here</summary>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Who lives in the house (names, ages, dietary needs).</li>
              <li>
                Sensitive dates — e.g. <em>&ldquo;Tommy&apos;s anniversary&rdquo; on the calendar
                is the anniversary of my dad&apos;s death, not a wedding.</em>
              </li>
              <li>Custody arrangements, late shifts, anything that changes the tone of a day.</li>
              <li>Anything you&apos;d want a thoughtful housemate to know.</li>
            </ul>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
