"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Modal } from "@/components/modal";

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
  const [editOpen, setEditOpen] = useState(false);

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
          onClick={() => setEditOpen(true)}
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

      <EventEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={{
          title: event.title,
          date: toDateInput(event.startsOn),
          days: String(event.durationDays),
          notes: event.notes ?? "",
        }}
        onSave={async (input) => {
          await onEdit(input);
          setEditOpen(false);
        }}
      />
    </div>
  );
}

function EventEditDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: { title: string; date: string; days: string; notes: string };
  onSave: (input: { title: string; startsOn: string; durationDays: number; notes: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial.title);
  const [date, setDate] = useState(initial.date);
  const [days, setDays] = useState(initial.days);
  const [notes, setNotes] = useState(initial.notes);
  const [pending, start] = useTransition();
  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setTitle(initial.title);
          setDate(initial.date);
          setDays(initial.days);
          setNotes(initial.notes);
        }
        onOpenChange(o);
      }}
      title="Edit event"
    >
      <div className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full h-10 rounded-2xl border bg-background px-4 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-2xl border bg-background px-4 text-sm"
          />
          <input
            type="number"
            min="1"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            placeholder="Days"
            className="h-10 rounded-2xl border bg-background px-4 text-sm"
          />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="w-full min-h-[5rem] rounded-2xl border bg-background px-4 py-3 text-sm"
        />
      </div>
      <div className="flex justify-end gap-1 pt-1">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded-full px-3 h-9 text-xs hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending || !title.trim() || !date}
          onClick={() =>
            start(async () => {
              await onSave({
                title: title.trim(),
                startsOn: date,
                durationDays: Math.max(1, Number(days) || 1),
                notes: notes.trim(),
              });
            })
          }
          className="rounded-full px-3 h-9 text-xs bg-primary text-primary-foreground disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
