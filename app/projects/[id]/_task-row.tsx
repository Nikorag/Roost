"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { TASK_STATUSES, STATUS_LABEL } from "@/lib/utils";

export function TaskRow({
  task,
  onStatus,
  onEdit,
  onDelete,
}: {
  task: { id: string; title: string; description: string | null; status: string };
  onStatus: (status: string) => Promise<void>;
  onEdit: (input: { title: string; description: string }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [desc, setDesc] = useState(task.description ?? "");

  if (editing) {
    return (
      <div className="rounded-2xl bg-muted/40 px-3 py-2 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full h-9 rounded-xl border bg-background px-3 text-sm"
          placeholder="Title"
        />
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="w-full min-h-[3rem] rounded-xl border bg-background px-3 py-2 text-sm"
          placeholder="Description (optional)"
        />
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => {
              setTitle(task.title);
              setDesc(task.description ?? "");
              setEditing(false);
            }}
            className="rounded-full px-3 h-8 text-xs hover:bg-muted"
          >
            <X className="size-3.5 inline" /> Cancel
          </button>
          <button
            type="button"
            disabled={pending || !title.trim()}
            onClick={() =>
              start(async () => {
                await onEdit({ title: title.trim(), description: desc.trim() });
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
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-sm truncate">{task.title}</div>
        {task.description && (
          <div className="text-xs text-muted-foreground line-clamp-2">{task.description}</div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <select
          defaultValue={task.status}
          disabled={pending}
          onChange={(e) => {
            const v = e.currentTarget.value;
            start(() => onStatus(v));
          }}
          className="text-xs rounded-full border bg-background px-2 py-1"
        >
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="size-8 rounded-full hover:bg-muted flex items-center justify-center"
          aria-label="Edit"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm(`Delete "${task.title}"?`)) start(onDelete);
          }}
          className="size-8 rounded-full hover:bg-destructive/10 text-destructive flex items-center justify-center"
          aria-label="Delete"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
