"use client";
import { useState, useTransition } from "react";
import { Sparkles, Loader2, X, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { applyWeeklyPlanAction, suggestWeeklyPlanAction } from "@/lib/meals/actions";
import type { PlanPick } from "@/lib/meals/plan";

export function PlanSuggester({ weekStartIso }: { weekStartIso: string }) {
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState<PlanPick[]>([]);
  const [excluded, setExcluded] = useState<Record<string, true>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applying, startApply] = useTransition();

  async function load() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setExcluded({});
    try {
      const res = await suggestWeeklyPlanAction(weekStartIso);
      setPicks(res);
      if (res.length === 0) setError("No suggestions returned. Add recipes/takeaways or check the AI key.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function apply() {
    const final = picks.map<PlanPick>((p) =>
      excluded[p.date] ? { date: p.date, kind: "skip" } : p,
    );
    startApply(async () => {
      await applyWeeklyPlanAction(final);
      setOpen(false);
    });
  }

  return (
    <>
      <Button variant="soft" size="sm" onClick={load} disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        Plan with AI
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
          <Card className="w-full md:max-w-lg rounded-t-3xl md:rounded-3xl max-h-[85vh] flex flex-col">
            <CardContent className="p-4 flex flex-col gap-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="font-semibold flex items-center gap-2">
                  <Sparkles className="size-4" /> Weekly plan
                </div>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
                  <X className="size-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Uncheck any day to leave it empty. Already-planned days are left alone.
              </p>

              <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2">
                {loading && (
                  <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" /> Thinking…
                  </div>
                )}
                {error && (
                  <div className="text-sm text-rose-700 bg-pastel-rose/50 rounded-2xl px-3 py-2">{error}</div>
                )}
                {!loading &&
                  picks.map((p) => {
                    const isSkip = p.kind === "skip";
                    const isExcluded = excluded[p.date] || isSkip;
                    return (
                      <label
                        key={p.date}
                        className={
                          "flex items-center gap-3 rounded-2xl border p-3 cursor-pointer " +
                          (isExcluded ? "opacity-60" : "")
                        }
                      >
                        <input
                          type="checkbox"
                          checked={!isExcluded}
                          disabled={isSkip}
                          onChange={(e) =>
                            setExcluded((s) => {
                              const c = { ...s };
                              if (e.target.checked) delete c[p.date];
                              else c[p.date] = true;
                              return c;
                            })
                          }
                          className="size-5 rounded"
                        />
                        <div className="text-xs w-16 shrink-0 text-muted-foreground">
                          {new Date(p.date).toLocaleDateString(undefined, {
                            weekday: "short",
                            day: "numeric",
                          })}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {p.kind === "skip"
                              ? "— skip —"
                              : `${p.kind === "takeaway" ? "🥡" : "🍲"} ${p.name ?? "Meal"}`}
                          </div>
                          {p.reason && (
                            <div className="text-xs text-muted-foreground line-clamp-2">{p.reason}</div>
                          )}
                        </div>
                      </label>
                    );
                  })}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  onClick={apply}
                  disabled={applying || loading || picks.every((p) => p.kind === "skip")}
                >
                  {applying ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Apply
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
