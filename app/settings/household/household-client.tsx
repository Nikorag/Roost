"use client";
import { useState, useTransition } from "react";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Check } from "lucide-react";
import { saveHouseholdProfile } from "./actions";

export function HouseholdClient({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const dirty = text !== initial;

  function save() {
    start(async () => {
      await saveHouseholdProfile(text);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div className="space-y-2">
      <Textarea
        placeholder={`e.g. Two adults (Jamie and Sam), two kids (Maya 7, Tommy 4).
Maya is vegetarian. Sam works late on Wednesdays.
The "Dad's anniversary" event in May is the anniversary of my father's death — keep that day low-key.`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-[12rem]"
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={save}
          disabled={pending || !dirty}
          variant={saved ? "soft" : "default"}
        >
          {saved ? <Check className="size-4" /> : <Save className="size-4" />}
          {saved ? "Saved" : "Save"}
        </Button>
      </div>
    </div>
  );
}
