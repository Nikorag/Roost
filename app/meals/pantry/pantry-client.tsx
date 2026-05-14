"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import { addPantryItem, deletePantryItem } from "@/lib/meals/actions";

type Item = {
  id: string;
  displayName: string;
  quantity: string | null;
  unit: string | null;
};

const UNITS = ["", "g", "kg", "ml", "l", "pcs", "tbsp", "tsp", "cup", "other"] as const;
type UnitOpt = (typeof UNITS)[number];

export function PantryClient({ items }: { items: Item[] }) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState<UnitOpt>("");
  const [pending, start] = useTransition();

  function submit() {
    if (!name.trim()) return;
    const n = name;
    const q = qty;
    const u = unit;
    setName("");
    setQty("");
    setUnit("");
    start(async () => {
      await addPantryItem({
        name: n,
        quantity: q || null,
        unit: (u || null) as null | "g" | "kg" | "ml" | "l" | "pcs" | "tbsp" | "tsp" | "cup" | "other",
      });
    });
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-wrap gap-2"
      >
        <Input placeholder="Item" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 min-w-[10rem]" />
        <Input
          placeholder="Qty"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputMode="decimal"
          className="w-20"
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as UnitOpt)}
          className="rounded-2xl border bg-background px-3 text-sm h-10"
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u || "unit"}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={pending || !name.trim()}>
          <Plus className="size-4" /> Add
        </Button>
      </form>

      {items.length === 0 && (
        <div className="text-sm text-muted-foreground p-2">Nothing in the pantry yet.</div>
      )}
      <ul className="divide-y">
        {items.map((i) => (
          <li key={i.id} className="flex items-center justify-between py-2">
            <div>
              <div className="font-medium text-sm">{i.displayName}</div>
              <div className="text-xs text-muted-foreground">
                {i.quantity ? `${i.quantity}${i.unit ?? ""}` : "—"}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove"
              onClick={() => start(() => deletePantryItem(i.id))}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
