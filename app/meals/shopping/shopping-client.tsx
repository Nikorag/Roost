"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, RefreshCw, Trash2, PackagePlus } from "lucide-react";
import {
  addShoppingItemManual,
  deleteShoppingItem,
  moveShoppingItemToPantry,
  regenerateShoppingList,
  toggleShoppingItem,
} from "@/lib/meals/actions";

type Item = {
  id: string;
  displayName: string;
  quantity: string | null;
  unit: string | null;
  checked: boolean;
  manuallyAdded: boolean;
};

export function ShoppingClient({
  listId,
  items,
  generatedAt,
}: {
  listId: string;
  items: Item[];
  generatedAt: string;
}) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [pending, start] = useTransition();

  function add() {
    if (!name.trim()) return;
    const n = name;
    const q = qty;
    setName("");
    setQty("");
    start(async () => {
      await addShoppingItemManual({ shoppingListId: listId, name: n, quantity: q || null });
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-muted-foreground">
          Last generated {new Date(generatedAt).toLocaleString()}
        </div>
        <Button
          variant="soft"
          size="sm"
          disabled={pending}
          onClick={() => start(() => regenerateShoppingList())}
        >
          <RefreshCw className="size-4" /> Regenerate
        </Button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex gap-2"
      >
        <Input placeholder="Add item" value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
        <Input
          placeholder="Qty"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-20"
          inputMode="decimal"
        />
        <Button type="submit" size="icon" aria-label="Add">
          <Plus className="size-4" />
        </Button>
      </form>

      {items.length === 0 && (
        <div className="text-sm text-muted-foreground p-2">List is empty. Plan some meals to generate it.</div>
      )}
      <ul className="divide-y">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-2">
            <input
              type="checkbox"
              checked={i.checked}
              onChange={(e) => start(() => toggleShoppingItem(i.id, e.target.checked))}
              className="size-5 rounded"
            />
            <div className={"flex-1 min-w-0 " + (i.checked ? "line-through text-muted-foreground" : "")}>
              <div className="text-sm font-medium truncate">{i.displayName}</div>
              <div className="text-xs text-muted-foreground">
                {i.quantity ? `${i.quantity}${i.unit ?? ""}` : ""}
                {i.manuallyAdded && <span className="ml-2">· added</span>}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Move to pantry"
              onClick={() => start(() => moveShoppingItemToPantry(i.id))}
            >
              <PackagePlus className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove"
              onClick={() => start(() => deleteShoppingItem(i.id))}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
