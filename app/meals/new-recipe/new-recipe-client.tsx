"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { createMealieRecipeAction, suggestRecipeIngredientsAction } from "@/lib/meals/actions";

type Row = {
  id: number;
  text: string;
  /** Whether to include in the final recipe. AI-suggested rows can be unchecked. */
  include: boolean;
  ai: boolean;
};

let nextId = 1;
function row(text: string, ai: boolean, include = true): Row {
  return { id: nextId++, text, ai, include };
}

export function NewRecipeClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [hasAi, setHasAi] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [savePending, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [customDraft, setCustomDraft] = useState("");

  async function suggest() {
    if (!name.trim() || suggesting) return;
    setSuggesting(true);
    setError(null);
    try {
      const items = await suggestRecipeIngredientsAction(name);
      if (items.length === 0) {
        setError("AI didn't return anything. Try a more specific name or add ingredients manually.");
      }
      setRows((prev) => [...prev, ...items.map((t) => row(t, true))]);
      setHasAi(true);
    } finally {
      setSuggesting(false);
    }
  }

  function addCustom() {
    const v = customDraft.trim();
    if (!v) return;
    setRows((prev) => [...prev, row(v, false)]);
    setCustomDraft("");
  }

  function updateRow(id: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function save() {
    const ingredients = rows.filter((r) => r.include && r.text.trim()).map((r) => r.text.trim());
    if (!name.trim()) {
      setError("Give the recipe a name.");
      return;
    }
    if (ingredients.length === 0) {
      setError("Pick at least one ingredient.");
      return;
    }
    setError(null);
    startSave(async () => {
      const res = await createMealieRecipeAction({ name: name.trim(), ingredients });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.push("/meals");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="e.g. Spaghetti bolognese"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 min-w-[14rem]"
        />
        <Button onClick={suggest} disabled={!name.trim() || suggesting} variant="soft">
          {suggesting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {hasAi ? "Re-suggest" : "Suggest ingredients"}
        </Button>
      </div>

      {error && <div className="text-sm text-rose-700 bg-pastel-rose/50 rounded-2xl px-3 py-2">{error}</div>}

      {rows.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Ingredients</div>
          <ul className="divide-y rounded-2xl border">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-2 px-3 py-2">
                <input
                  type="checkbox"
                  checked={r.include}
                  onChange={(e) => updateRow(r.id, { include: e.target.checked })}
                  className="size-5 rounded"
                />
                <Input
                  value={r.text}
                  onChange={(e) => updateRow(r.id, { text: e.target.value })}
                  className={"flex-1 border-0 shadow-none focus-visible:ring-0 px-2 " + (r.include ? "" : "line-through text-muted-foreground")}
                />
                {r.ai && <span className="text-[10px] uppercase tracking-wide text-blue-700">AI</span>}
                <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => removeRow(r.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          addCustom();
        }}
        className="flex gap-2"
      >
        <Input
          placeholder="Add your own ingredient"
          value={customDraft}
          onChange={(e) => setCustomDraft(e.target.value)}
        />
        <Button type="submit" size="icon" aria-label="Add" disabled={!customDraft.trim()}>
          <Plus className="size-4" />
        </Button>
      </form>

      <div className="flex justify-end">
        <Button onClick={save} disabled={savePending || rows.length === 0}>
          {savePending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save to Mealie
        </Button>
      </div>
    </div>
  );
}
