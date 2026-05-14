"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { createTakeawayMeal, deleteTakeawayMeal } from "@/lib/meals/actions";

type Item = { id: string; name: string; vendor: string | null; notes: string | null; emoji: string | null };

export function TakeawaysClient({ items }: { items: Item[] }) {
  const [name, setName] = useState("");
  const [vendor, setVendor] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();

  function add() {
    if (!name.trim()) return;
    const n = name;
    const v = vendor;
    const note = notes;
    setName("");
    setVendor("");
    setNotes("");
    start(async () => {
      await createTakeawayMeal({ name: n, vendor: v || undefined, notes: note || undefined });
    });
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="space-y-2"
      >
        <div className="flex gap-2 flex-wrap">
          <Input placeholder="Meal (e.g. Margherita pizza)" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 min-w-[12rem]" />
          <Input placeholder="Vendor (optional)" value={vendor} onChange={(e) => setVendor(e.target.value)} className="flex-1 min-w-[10rem]" />
        </div>
        <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[4rem]" />
        <Button type="submit" disabled={pending || !name.trim()}>
          <Plus className="size-4" /> Add takeaway
        </Button>
      </form>

      {items.length === 0 && (
        <div className="text-sm text-muted-foreground p-2">No takeaways yet.</div>
      )}
      <ul className="divide-y">
        {items.map((t) => (
          <li key={t.id} className="flex items-center justify-between py-2">
            <div className="min-w-0">
              <div className="font-medium">{t.emoji ?? "🥡"} {t.name}</div>
              {t.vendor && <div className="text-xs text-muted-foreground">{t.vendor}</div>}
              {t.notes && <div className="text-xs text-muted-foreground line-clamp-2">{t.notes}</div>}
            </div>
            <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => start(() => deleteTakeawayMeal(t.id))}>
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
