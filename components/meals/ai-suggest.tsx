"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Plus, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { planMealieMeal, planTakeawayMeal } from "@/lib/meals/actions";

type Msg = { role: "user" | "model"; text: string };

type Library = {
  mealie: { id: string; name: string; image: string | null }[];
  takeaways: { id: string; name: string }[];
};

type Pick =
  | { kind: "mealie"; id: string; name: string; image: string | null; why: string }
  | { kind: "takeaway"; id: string; name: string; why: string };

export function AiSuggest({ date }: { date: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [library, setLibrary] = useState<Library | null>(null);
  const [added, setAdded] = useState<Record<string, true>>({});
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || library) return;
    fetch("/api/meals/library")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setLibrary(j));
  }, [open, library]);

  function extractPicks(text: string): Pick[] {
    if (!library) return [];
    // Each pick is a markdown bullet (or line) with **Bold Name** somewhere in it.
    const picks: Pick[] = [];
    const seen = new Set<string>();
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/\*\*([^*]+)\*\*\s*[—–\-:]*\s*(.*)$/);
      if (!match) continue;
      const rawName = match[1].trim();
      const why = match[2].trim();
      const norm = rawName.toLowerCase();
      const mealie = library.mealie.find((m) => m.name.toLowerCase() === norm);
      if (mealie) {
        const key = `m:${mealie.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        picks.push({ kind: "mealie", id: mealie.id, name: mealie.name, image: mealie.image, why });
        continue;
      }
      const takeaway = library.takeaways.find((t) => t.name.toLowerCase() === norm);
      if (takeaway) {
        const key = `t:${takeaway.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        picks.push({ kind: "takeaway", id: takeaway.id, name: takeaway.name, why });
      }
    }
    return picks;
  }

  function addPick(p: Pick) {
    const key = `${p.kind}:${p.id}`;
    start(async () => {
      if (p.kind === "mealie") {
        await planMealieMeal({ date, slot: "dinner", recipeId: p.id });
      } else {
        await planTakeawayMeal({ date, slot: "dinner", takeawayMealId: p.id });
      }
      setAdded((a) => ({ ...a, [key]: true }));
    });
  }

  async function send() {
    const text = draft.trim();
    if (!text || streaming) return;
    setDraft("");
    const next: Msg[] = [...messages, { role: "user", text }];
    setMessages(next);
    setStreaming(true);
    try {
      const res = await fetch("/api/meals/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) {
        setMessages((m) => [...m, { role: "model", text: `Sorry, that didn't work (${res.status}).` }]);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      setMessages((m) => [...m, { role: "model", text: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "model", text: acc };
          return copy;
        });
        endRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } finally {
      setStreaming(false);
    }
  }

  if (!open) {
    return (
      <Button
        variant="soft"
        onClick={() => {
          setOpen(true);
          if (messages.length === 0) {
            setMessages([
              {
                role: "model",
                text: "Stuck for tonight? Tell me how hungry you are, how much effort you want, or just say 'surprise me'.",
              },
            ]);
          }
        }}
      >
        <Sparkles className="size-4" /> What should we eat tonight?
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold flex items-center gap-2">
            <Sparkles className="size-4" /> Tonight&apos;s meal
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button>
        </div>
        <div className="space-y-2 max-h-[28rem] overflow-y-auto">
          {messages.map((m, i) => {
            const isStreamingThis = streaming && i === messages.length - 1;
            const picks = m.role === "model" && !isStreamingThis ? extractPicks(m.text) : [];
            return (
              <div key={i} className="space-y-2">
                <div
                  className={
                    "rounded-2xl px-3 py-2 text-sm " +
                    (m.role === "user" ? "bg-pastel-mint/60 text-emerald-900 ml-8" : "bg-muted mr-8")
                  }
                >
                  {m.role === "user" ? (
                    <div className="whitespace-pre-wrap">{m.text}</div>
                  ) : m.text ? (
                    <div className="markdown space-y-1">
                      <ReactMarkdown
                        components={{
                          p: (p) => <p className="leading-snug">{p.children}</p>,
                          ul: (p) => <ul className="list-disc pl-5 space-y-0.5">{p.children}</ul>,
                          ol: (p) => <ol className="list-decimal pl-5 space-y-0.5">{p.children}</ol>,
                          li: (p) => <li className="leading-snug">{p.children}</li>,
                          strong: (p) => <strong className="font-semibold">{p.children}</strong>,
                          em: (p) => <em className="italic">{p.children}</em>,
                          code: (p) => (
                            <code className="rounded bg-background/60 px-1 py-0.5 text-xs">
                              {p.children}
                            </code>
                          ),
                          h1: (p) => <div className="font-semibold text-sm">{p.children}</div>,
                          h2: (p) => <div className="font-semibold text-sm">{p.children}</div>,
                          h3: (p) => <div className="font-semibold text-sm">{p.children}</div>,
                        }}
                      >
                        {m.text}
                      </ReactMarkdown>
                    </div>
                  ) : isStreamingThis ? (
                    "…"
                  ) : null}
                </div>
                {picks.length > 0 && (
                  <div className="grid gap-2 mr-8">
                    {picks.map((p) => {
                      const key = `${p.kind}:${p.id}`;
                      const isAdded = added[key];
                      return (
                        <div
                          key={key}
                          className="rounded-2xl border bg-card p-3 flex items-center gap-3"
                        >
                          {p.kind === "mealie" && p.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.image} alt="" className="size-12 rounded-xl object-cover" />
                          ) : (
                            <div className="size-12 rounded-xl bg-muted flex items-center justify-center text-lg">
                              {p.kind === "takeaway" ? "🥡" : "🍲"}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">{p.name}</div>
                            {p.why && (
                              <div className="text-xs text-muted-foreground line-clamp-2">{p.why}</div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant={isAdded ? "soft" : "default"}
                            disabled={pending || isAdded}
                            onClick={() => addPick(p)}
                          >
                            {isAdded ? (
                              <>
                                <Check className="size-4" /> Added
                              </>
                            ) : (
                              <>
                                <Plus className="size-4" /> Add
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex gap-2"
        >
          <Input
            placeholder={streaming ? "Thinking…" : "Reply…"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={streaming}
          />
          <Button type="submit" size="icon" disabled={streaming || !draft.trim()} aria-label="Send">
            <Send className="size-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
