"use client";
import { useEffect, useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { planMealieMeal, planTakeawayMeal, planAdhocMeal } from "@/lib/meals/actions";

type Takeaway = { id: string; name: string; vendor: string | null; emoji: string | null };

type MealieHit = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image: string | null;
};

type Slot = "breakfast" | "lunch" | "dinner";

export function MealPicker({
  date,
  slot,
  takeaways,
  onClose,
}: {
  date: string;
  slot: Slot;
  takeaways: Takeaway[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"mealie" | "takeaway" | "adhoc">("mealie");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<MealieHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [mealieConfigured, setMealieConfigured] = useState(true);
  const [adhocName, setAdhocName] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (tab !== "mealie") return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/mealie/search?q=${encodeURIComponent(query)}`);
        const json = (await res.json()) as { items: MealieHit[]; configured: boolean };
        setHits(json.items ?? []);
        setMealieConfigured(json.configured !== false);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, tab]);

  function close() {
    onClose();
  }

  function chooseMealie(hit: MealieHit) {
    start(async () => {
      await planMealieMeal({ date, slot, recipeId: hit.id });
      close();
    });
  }
  function chooseTakeaway(t: Takeaway) {
    start(async () => {
      await planTakeawayMeal({ date, slot, takeawayMealId: t.id });
      close();
    });
  }
  function chooseAdhoc() {
    if (!adhocName.trim()) return;
    start(async () => {
      await planAdhocMeal({ date, slot, name: adhocName.trim() });
      close();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
      <Card className="w-full md:max-w-lg rounded-t-3xl md:rounded-3xl max-h-[85vh] flex flex-col">
        <CardContent className="p-4 flex flex-col gap-3 overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">{date} · {slot}</div>
              <div className="font-semibold">Add a meal</div>
            </div>
            <Button variant="ghost" size="icon" onClick={close} aria-label="Close">
              <X className="size-4" />
            </Button>
          </div>

          <div className="flex gap-1 rounded-2xl bg-muted p-1">
            {(["mealie", "takeaway", "adhoc"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={
                  "flex-1 rounded-xl text-sm py-1.5 capitalize " +
                  (tab === t ? "bg-background shadow-sm font-medium" : "text-muted-foreground")
                }
              >
                {t === "mealie" ? "Recipes" : t === "takeaway" ? "Takeaway" : "Quick"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            {tab === "mealie" && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    placeholder="Search Mealie recipes…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {!mealieConfigured && (
                  <div className="text-xs text-muted-foreground p-2">
                    Mealie isn&apos;t configured. Set <code>MEALIE_BASE_URL</code> and{" "}
                    <code>MEALIE_API_TOKEN</code> in env.
                  </div>
                )}
                {searching && <div className="p-2 text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="size-3 animate-spin" /> Searching…</div>}
                {hits.length === 0 && !searching && mealieConfigured && (
                  <div className="p-2 text-xs text-muted-foreground">No matches.</div>
                )}
                <Link
                  href="/meals/new-recipe"
                  className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline px-2"
                  onClick={close}
                >
                  <Sparkles className="size-3" /> Create a new recipe with AI
                </Link>
                <div className="grid gap-2">
                  {hits.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => chooseMealie(h)}
                      disabled={pending}
                      className="text-left rounded-2xl border p-3 hover:bg-muted transition flex gap-3 items-center"
                    >
                      {h.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={h.image} alt="" className="size-12 rounded-xl object-cover" />
                      ) : (
                        <div className="size-12 rounded-xl bg-muted" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{h.name}</div>
                        {h.description && (
                          <div className="text-xs text-muted-foreground line-clamp-2">{h.description}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tab === "takeaway" && (
              <div className="grid gap-2">
                {takeaways.length === 0 && (
                  <div className="p-2 text-xs text-muted-foreground">
                    No takeaways yet. Add some on the Takeaways page.
                  </div>
                )}
                {takeaways.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => chooseTakeaway(t)}
                    disabled={pending}
                    className="text-left rounded-2xl border p-3 hover:bg-muted transition"
                  >
                    <div className="font-medium">{t.emoji ?? "🥡"} {t.name}</div>
                    {t.vendor && <div className="text-xs text-muted-foreground">{t.vendor}</div>}
                  </button>
                ))}
              </div>
            )}

            {tab === "adhoc" && (
              <div className="space-y-2">
                <Input
                  autoFocus
                  placeholder="e.g. Leftovers, beans on toast"
                  value={adhocName}
                  onChange={(e) => setAdhocName(e.target.value)}
                />
                <Button onClick={chooseAdhoc} disabled={pending || !adhocName.trim()}>
                  Add
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
