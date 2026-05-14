"use client";
import { useState, useTransition } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MealPicker } from "./meal-picker";
import { deleteMealPlanEntry, markMealEaten } from "@/lib/meals/actions";
import type { SlottedEntry } from "@/lib/meals/queries";

export type { SlottedEntry };

type Slot = "breakfast" | "lunch" | "dinner";

export function DaySlot({
  date,
  slot,
  entry,
  takeaways,
  compact,
}: {
  date: string;
  slot: Slot;
  entry: SlottedEntry | null;
  takeaways: { id: string; name: string; vendor: string | null; emoji: string | null }[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  if (!entry) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className={
            "w-full rounded-2xl border border-dashed text-muted-foreground hover:bg-muted transition flex items-center justify-center gap-2 " +
            (compact ? "py-2 text-xs" : "py-4 text-sm")
          }
        >
          <Plus className="size-4" /> Add {slot}
        </button>
        {open && (
          <MealPicker date={date} slot={slot} takeaways={takeaways} onClose={() => setOpen(false)} />
        )}
      </>
    );
  }

  return (
    <div className={"rounded-2xl border bg-card flex items-center gap-3 " + (compact ? "p-2" : "p-3")}>
      {entry.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entry.imageUrl} alt="" className={compact ? "size-8 rounded-lg object-cover" : "size-12 rounded-xl object-cover"} />
      ) : (
        <div className={(compact ? "size-8" : "size-12") + " rounded-xl bg-muted flex items-center justify-center " + (compact ? "text-base" : "text-xl")}>
          {entry.source === "takeaway"
            ? (entry.emoji ?? "🥡")
            : entry.source === "adhoc"
              ? "🍽️"
              : "🍲"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className={"font-medium truncate " + (compact ? "text-xs" : "text-sm")}>{entry.displayName}</div>
        {!compact && entry.notes && (
          <div className="text-xs text-muted-foreground truncate">{entry.notes}</div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mark eaten"
          disabled={pending}
          onClick={() => start(() => markMealEaten(entry.id))}
        >
          <Check className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Remove"
          disabled={pending}
          onClick={() => start(() => deleteMealPlanEntry(entry.id))}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
