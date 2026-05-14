"use client";
import { useState, useTransition } from "react";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Check } from "lucide-react";
import { savePromptAddition } from "./actions";

export function AiPromptsClient({
  k,
  label,
  description,
  value,
}: {
  k: string;
  label: string;
  description: string;
  value: string;
}) {
  const [text, setText] = useState(value);
  const [savedTick, setSavedTick] = useState(false);
  const [pending, start] = useTransition();
  const dirty = text !== value;

  function save() {
    start(async () => {
      await savePromptAddition(k, text);
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1500);
    });
  }

  return (
    <div className="space-y-2">
      <div>
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Textarea
        placeholder="e.g. We're vegetarian. Keep meals quick on weeknights."
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-[5rem]"
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={pending || !dirty} variant={savedTick ? "soft" : "default"}>
          {savedTick ? <Check className="size-4" /> : <Save className="size-4" />}
          {savedTick ? "Saved" : "Save"}
        </Button>
      </div>
    </div>
  );
}
