"use client";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Save, Loader2, Plug } from "lucide-react";
import { saveGoogleCalendarUrl, testCalendar } from "./actions";

export function CalendarsClient({ initial }: { initial: string }) {
  const [url, setUrl] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savePending, startSave] = useTransition();
  const [testPending, startTest] = useTransition();

  function save() {
    startSave(async () => {
      await saveGoogleCalendarUrl(url.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  function test() {
    setStatus(null);
    startTest(async () => {
      const res = await testCalendar(url.trim());
      setStatus(res.message);
    });
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium">Google calendar ICS URL</label>
      <Input
        placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={test} disabled={testPending || !url.trim()}>
          {testPending ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
          Test
        </Button>
        <Button size="sm" onClick={save} disabled={savePending} variant={saved ? "soft" : "default"}>
          {saved ? <Check className="size-4" /> : <Save className="size-4" />}
          {saved ? "Saved" : "Save"}
        </Button>
      </div>
      {status && <div className="text-xs text-muted-foreground">{status}</div>}
    </div>
  );
}
