"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Sparkles, ChevronRight, ChevronLeft, Check, Wand2, ImagePlus, X } from "lucide-react";
import { createProjectFromWizard, generateWizardAfterImage } from "./actions";
import type { WizardSuggestion } from "@/lib/ai";
import { cn } from "@/lib/utils";

type DirectoryEntry = { id: string; name: string };
type Directory = {
  contractors: (DirectoryEntry & { trade: string | null })[];
  personnel: (DirectoryEntry & { relation: string | null })[];
  tools: DirectoryEntry[];
};

type Picked = {
  tasks: Set<number>;
  contractors: Set<string>;
  personnel: Set<string>;
  materials: Set<number>;
  tools: Set<string>;
};

const STEPS = ["Basics", "AI suggestions", "Photos", "Review", "Create"] as const;

export function Wizard({ directory }: { directory: Directory }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState<string>("");
  const [target, setTarget] = useState<string>("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [suggestions, setSuggestions] = useState<WizardSuggestion | null>(null);
  const [picked, setPicked] = useState<Picked>({
    tasks: new Set(),
    contractors: new Set(),
    personnel: new Set(),
    materials: new Set(),
    tools: new Set(),
  });
  const [pending, start] = useTransition();

  // Photos
  const [beforeUpload, setBeforeUpload] = useState<{ id: string; url: string } | null>(null);
  const [afterUpload, setAfterUpload] = useState<{ id: string; url: string } | null>(null);
  const [afterPrompt, setAfterPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [uploadingBefore, setUploadingBefore] = useState(false);
  const beforeInput = useRef<HTMLInputElement>(null);

  async function uploadBeforeFile(file: File) {
    setUploadingBefore(true);
    setGenError(null);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          kind: "before",
        }),
      });
      if (!res.ok) {
        setGenError("Could not start upload.");
        return;
      }
      const data = await res.json();
      let putOk = false;
      try {
        const put = await fetch(data.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        putOk = put.ok;
        if (!putOk) setGenError(`Upload failed (${put.status}).`);
      } catch (err) {
        setGenError(`Upload failed: ${(err as Error).message}`);
      }
      if (!putOk) {
        await fetch(`/api/upload/${data.uploadId}`, { method: "DELETE" }).catch(() => {});
        return;
      }
      setBeforeUpload({ id: data.uploadId, url: data.publicUrl });
      // Seed the after-prompt with a sensible default once we have a project description.
      if (!afterPrompt.trim()) {
        setAfterPrompt(
          `A photorealistic image showing the finished result of "${title || "this project"}". ${description}`.trim(),
        );
      }
    } finally {
      setUploadingBefore(false);
    }
  }

  async function generateAfter() {
    setGenerating(true);
    setGenError(null);
    try {
      const result = await generateWizardAfterImage({
        prompt: afterPrompt.trim(),
        basedOnUploadId: beforeUpload?.id,
      });
      if ("error" in result) {
        setGenError(result.error);
        return;
      }
      setAfterUpload({ id: result.uploadId, url: result.url });
    } finally {
      setGenerating(false);
    }
  }

  async function fetchSuggestions() {
    setLoadingAI(true);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const data = (await res.json()) as WizardSuggestion;
      setSuggestions(data);
      // pre-pick everything by default; user can opt out.
      setPicked({
        tasks: new Set(data.tasks.map((_, i) => i)),
        materials: new Set(data.materials.map((_, i) => i)),
        contractors: new Set(),
        personnel: new Set(),
        tools: new Set(),
      });
    } finally {
      setLoadingAI(false);
    }
  }

  function toggleNum(key: "tasks" | "materials", i: number) {
    setPicked((p) => {
      const next = new Set(p[key]);
      next.has(i) ? next.delete(i) : next.add(i);
      return { ...p, [key]: next };
    });
  }
  function toggleId(key: "contractors" | "personnel" | "tools", id: string) {
    setPicked((p) => {
      const next = new Set(p[key]);
      next.has(id) ? next.delete(id) : next.add(id);
      return { ...p, [key]: next };
    });
  }

  function next() {
    if (step === 0 && !title.trim()) return;
    if (step === 1 && !suggestions) {
      // skipping AI is allowed
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }
  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  function submit() {
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      budgetCents: budget ? Math.round(Number(budget) * 100) : null,
      targetDate: target ? new Date(target).toISOString() : null,
      tasks:
        suggestions?.tasks
          .map((t, i) => (picked.tasks.has(i) ? t : null))
          .filter((t): t is { title: string; description?: string } => t != null) ?? [],
      materials:
        suggestions?.materials
          .map((m, i) => (picked.materials.has(i) ? m : null))
          .filter((m): m is { name: string; quantity?: string; options?: string[] } => m != null) ?? [],
      contractorIds: Array.from(picked.contractors),
      personnelIds: Array.from(picked.personnel),
      toolIds: Array.from(picked.tools),
      beforeUploadId: beforeUpload?.id,
      afterUploadId: afterUpload?.id,
    };
    start(async () => {
      const result = await createProjectFromWizard(payload);
      if (result?.id) router.push(`/projects/${result.id}`);
    });
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">New project</h1>
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={cn(
                "h-1.5 w-8 rounded-full transition-colors",
                i <= step ? "bg-emerald-500" : "bg-muted",
              )}
            />
          ))}
        </div>
      </header>

      {step === 0 && (
        <Card>
          <CardHeader><CardTitle>Tell me about it</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <label className="block text-sm">
              <span className="text-muted-foreground">Title</span>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Repaint the lounge" className="mt-1" />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Description</span>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What needs doing? Any constraints, preferences, or context."
                className="mt-1"
              />
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-muted-foreground">Budget (£)</span>
                <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="mt-1" />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">Target date</span>
                <Input type="date" value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1" />
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-emerald-700" />
              AI suggestions
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Optional. Let Gemini propose subtasks, materials, and recommend contractors, friends, or tools you already have.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!suggestions ? (
              <Button onClick={fetchSuggestions} disabled={loadingAI || !title.trim()}>
                {loadingAI ? "Thinking…" : "Get suggestions"}
              </Button>
            ) : (
              <div className="space-y-5">
                <SuggestionGroup
                  title="Subtasks"
                  empty="No task suggestions."
                  items={suggestions.tasks.map((t, i) => ({
                    key: i,
                    label: t.title,
                    sub: t.description,
                    selected: picked.tasks.has(i),
                    onToggle: () => toggleNum("tasks", i),
                  }))}
                />

                <SuggestionGroup
                  title="Materials"
                  empty="No material suggestions."
                  items={suggestions.materials.map((m, i) => ({
                    key: i,
                    label: m.name,
                    sub: [m.quantity, m.options?.length ? `Options: ${m.options.join(", ")}` : null]
                      .filter(Boolean)
                      .join(" · "),
                    selected: picked.materials.has(i),
                    onToggle: () => toggleNum("materials", i),
                  }))}
                />

                <DirectoryMatch
                  title="Contractors"
                  empty="None recommended."
                  reasons={suggestions.contractors}
                  options={directory.contractors.map((c) => ({
                    id: c.id,
                    label: c.name,
                    sub: c.trade ?? undefined,
                  }))}
                  picked={picked.contractors}
                  toggle={(id) => toggleId("contractors", id)}
                />

                <DirectoryMatch
                  title="People"
                  empty="None recommended."
                  reasons={suggestions.personnel}
                  options={directory.personnel.map((p) => ({
                    id: p.id,
                    label: p.name,
                    sub: p.relation ?? undefined,
                  }))}
                  picked={picked.personnel}
                  toggle={(id) => toggleId("personnel", id)}
                />

                <DirectoryMatch
                  title="Tools"
                  empty="None recommended."
                  reasons={suggestions.tools.map((t) => ({ trade: t.name, reason: t.reason ?? "" }))}
                  options={directory.tools.map((t) => ({ id: t.id, label: t.name }))}
                  picked={picked.tools}
                  toggle={(id) => toggleId("tools", id)}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImagePlus className="size-4 text-emerald-700" />
              Photos
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Optional. Add a "before" photo and let Gemini imagine the finished result.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Before */}
            <div>
              <h3 className="font-medium text-sm mb-2">Before</h3>
              {beforeUpload ? (
                <div className="relative size-40 rounded-2xl overflow-hidden border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={beforeUpload.url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setBeforeUpload(null)}
                    className="absolute top-1 right-1 size-7 rounded-full bg-white/90 flex items-center justify-center"
                    aria-label="Remove"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => beforeInput.current?.click()}
                  disabled={uploadingBefore}
                  className="size-40 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  <ImagePlus className="size-6" />
                  <span className="text-xs">{uploadingBefore ? "Uploading…" : "Add before photo"}</span>
                </button>
              )}
              <input
                ref={beforeInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadBeforeFile(f);
                  e.target.value = "";
                }}
              />
            </div>

            {/* After */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm">After (Gemini-generated)</h3>
              <p className="text-xs text-muted-foreground">
                Refine the prompt below, then generate. {beforeUpload ? "Your before photo will be used as a visual reference." : "No before photo — Gemini will work from the prompt alone."}
              </p>
              <textarea
                value={afterPrompt}
                onChange={(e) => setAfterPrompt(e.target.value)}
                className="w-full min-h-[5rem] rounded-2xl border bg-background px-4 py-3 text-sm"
                placeholder={`A photorealistic image showing the finished result of "${title}".`}
              />
              {genError && <p className="text-xs text-destructive">{genError}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="soft"
                  onClick={generateAfter}
                  disabled={generating || !afterPrompt.trim()}
                >
                  <Wand2 className="size-3.5" />
                  {generating ? "Generating…" : afterUpload ? "Regenerate" : "Generate after"}
                </Button>
                {afterUpload && (
                  <button
                    type="button"
                    onClick={() => setAfterUpload(null)}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Discard
                  </button>
                )}
              </div>
              {afterUpload && (
                <div className="size-56 rounded-2xl overflow-hidden border mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={afterUpload.url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Title" value={title || "—"} />
            <Row label="Description" value={description || "—"} />
            <Row label="Budget" value={budget ? `£${budget}` : "—"} />
            <Row label="Target" value={target || "—"} />
            <Row
              label="Subtasks"
              value={
                suggestions
                  ? `${picked.tasks.size} of ${suggestions.tasks.length} suggested`
                  : "0"
              }
            />
            <Row
              label="Materials"
              value={
                suggestions
                  ? `${picked.materials.size} of ${suggestions.materials.length} suggested`
                  : "0"
              }
            />
            <Row label="Contractors" value={`${picked.contractors.size} attached`} />
            <Row label="People" value={`${picked.personnel.size} attached`} />
            <Row label="Tools" value={`${picked.tools.size} attached`} />
            <Row label="Before photo" value={beforeUpload ? "Attached" : "—"} />
            <Row label="AI-generated after" value={afterUpload ? "Attached" : "—"} />
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Create</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">All set. Hit go to create the project.</p>
            <Button onClick={submit} disabled={pending || !title.trim()} size="lg">
              <Check className="size-4" /> {pending ? "Creating…" : "Create project"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={back} disabled={step === 0 || pending}>
          <ChevronLeft className="size-4" /> Back
        </Button>
        {step < STEPS.length - 1 && (
          <Button onClick={next} disabled={step === 0 && !title.trim()}>
            Next <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b last:border-b-0 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function SuggestionGroup({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: { key: string | number; label: string; sub?: string; selected: boolean; onToggle: () => void }[];
}) {
  return (
    <div>
      <h3 className="font-medium mb-2">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((it) => (
            <button
              key={String(it.key)}
              onClick={it.onToggle}
              className={cn(
                "w-full text-left rounded-2xl px-3 py-2 border transition-colors flex items-start gap-3",
                it.selected
                  ? "bg-pastel-mint/60 border-emerald-200"
                  : "bg-muted/30 hover:bg-muted",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 size-5 rounded-md border flex items-center justify-center text-emerald-700",
                  it.selected && "bg-emerald-500 text-white border-emerald-500",
                )}
              >
                {it.selected && <Check className="size-3.5" />}
              </span>
              <span className="flex-1">
                <span className="text-sm font-medium block">{it.label}</span>
                {it.sub && <span className="text-xs text-muted-foreground">{it.sub}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DirectoryMatch({
  title,
  empty,
  reasons,
  options,
  picked,
  toggle,
}: {
  title: string;
  empty: string;
  reasons: { trade?: string; role?: string; reason: string }[];
  options: { id: string; label: string; sub?: string }[];
  picked: Set<string>;
  toggle: (id: string) => void;
}) {
  return (
    <div>
      <h3 className="font-medium mb-2">{title}</h3>
      {reasons.length > 0 && (
        <div className="mb-2 space-y-1">
          {reasons.map((r, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{r.trade ?? r.role}</span> — {r.reason}
            </p>
          ))}
        </div>
      )}
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {empty} <span className="text-xs">Add some on the directory pages first.</span>
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((o) => {
            const selected = picked.has(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => toggle(o.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs border transition-colors",
                  selected
                    ? "bg-pastel-mint text-emerald-900 border-emerald-200"
                    : "hover:bg-muted",
                )}
              >
                {o.label}
                {o.sub ? <span className="text-muted-foreground"> · {o.sub}</span> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
