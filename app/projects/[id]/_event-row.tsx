"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { formatDate } from "@/lib/utils";

function toDateInput(d: Date) {
  return new Date(d).toISOString().slice(0, 10);
}

export function EventRow({
  event,
  onEdit,
  onDelete,
}: {
  event: { id: string; title: string; startsOn: Date; durationDays: number; notes: string | null };
  onEdit: (input: { title: string; startsOn: string; durationDays: number; notes: string }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(toDateInput(event.startsOn));
  const [days, setDays] = useState(String(event.durationDays));
  const [notes, setNotes] = useState(event.notes ?? "");

  if (editing) {
    return (
      <div className="rounded-2xl bg-muted/40 px-3 py-2 space-y-2">
        <div className="grid sm:grid-cols-4 gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="sm:col-span-2 h-9 rounded-xl border bg-background px-3 text-sm"
            placeholder="Title"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 rounded-xl border bg-background px-3 text-sm"
          />
          <input
            type="number"
            min="1"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="h-9 rounded-xl border bg-background px-3 text-sm"
          />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full min-h-[3rem] rounded-xl border bg-background px-3 py-2 text-sm"
          placeholder="Notes (optional)"
        />
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => {
              setTitle(event.title);
              setDate(toDateInput(event.startsOn));
              setDays(String(event.durationDays));
              setNotes(event.notes ?? "");
              setEditing(false);
            }}
            className="rounded-full px-3 h-8 text-xs hover:bg-muted"
          >
            <X className="size-3.5 inline" /> Cancel
          </button>
          <button
            type="button"
            disabled={pending || !title.trim() || !date}
            onClick={() =>
              start(async () => {
                await onEdit({
                  title: title.trim(),
                  startsOn: date,
                  durationDays: Math.max(1, Number(days) || 1),
                  notes: notes.trim(),
                });
                setEditing(false);
              })
            }
            className="rounded-full px-3 h-8 text-xs bg-primary text-primary-foreground disabled:opacity-50"
          >
            <Check className="size-3.5 inline" /> Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-muted/40 px-3 py-2 flex justify-between items-center gap-3">
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{event.title}</div>
        <div className="text-xs text-muted-foreground">
          {formatDate(event.startsOn)} · {event.durationDays === 1 ? "all day" : `${event.durationDays} days`}
        </div>
        {event.notes && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{event.notes}</div>}
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="size-8 rounded-full hover:bg-background flex items-center justify-center"
          aria-label="Edit event"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm(`Delete event "${event.title}"?`)) start(onDelete);
          }}
          className="size-8 rounded-full hover:bg-destructive/10 text-destructive flex items-center justify-center"
          aria-label="Delete event"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
