"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { EntityPicker } from "@/components/entity-picker";

export type AttachItem = { id: string; label: string; sub?: string };

export function AttachCard({
  title,
  icon,
  available,
  attachedIds,
  onAttach,
  onDetach,
  onCreate,
  createLabel,
}: {
  title: string;
  icon: React.ReactNode;
  available: AttachItem[];
  attachedIds: string[];
  onAttach: (id: string) => Promise<void>;
  onDetach: (id: string) => Promise<void>;
  onCreate?: (name: string) => Promise<{ id: string } | void>;
  createLabel?: string;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const attachedSet = new Set(attachedIds);
  const attached = available.filter((a) => attachedSet.has(a.id));

  return (
    <div className="rounded-2xl border bg-card text-card-foreground shadow-sm">
      <div className="p-5 pb-3 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold flex items-center gap-2">
          {icon}
          {title}
        </h3>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs hover:bg-muted"
        >
          <Plus className="size-3.5" /> Add
        </button>
      </div>
      <div className="px-5 pb-5">
        {attached.length === 0 ? (
          <p className="text-sm text-muted-foreground">None attached.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {attached.map((a) => (
              <button
                key={a.id}
                type="button"
                disabled={pending}
                onClick={() => start(() => onDetach(a.id))}
                className="group inline-flex items-center gap-1.5 rounded-full bg-pastel-mint text-emerald-900 pl-3 pr-2 py-1 text-xs"
                title="Click to remove"
              >
                <span>
                  {a.label}
                  {a.sub && <span className="text-emerald-800/70"> · {a.sub}</span>}
                </span>
                <X className="size-3.5 opacity-60 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        )}
      </div>

      <EntityPicker
        open={open}
        onOpenChange={setOpen}
        title={`Attach ${title.toLowerCase()}`}
        items={available}
        attachedIds={attachedIds}
        onAttach={onAttach}
        onDetach={onDetach}
        onCreate={onCreate}
        createLabel={createLabel ?? "Create"}
      />
    </div>
  );
}
