"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";

export type AttachItem = { id: string; label: string; sub?: string };

export function AttachCard({
  title,
  icon,
  available,
  attachedIds,
  onAttach,
  onDetach,
}: {
  title: string;
  icon: React.ReactNode;
  available: AttachItem[];
  attachedIds: string[];
  onAttach: (id: string) => Promise<void>;
  onDetach: (id: string) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState("");
  const attachedSet = new Set(attachedIds);
  const attached = available.filter((a) => attachedSet.has(a.id));
  const others = available
    .filter((a) => !attachedSet.has(a.id))
    .filter((a) =>
      filter ? `${a.label} ${a.sub ?? ""}`.toLowerCase().includes(filter.toLowerCase()) : true,
    );

  return (
    <div className="rounded-2xl border bg-card text-card-foreground shadow-sm">
      <div className="p-5 pb-3">
        <h3 className="text-base font-semibold flex items-center gap-2">
          {icon}
          {title}
        </h3>
      </div>
      <div className="px-5 pb-5 space-y-3">
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

        {available.length > attached.length && (
          <div className="space-y-2 pt-1">
            {available.length > 6 && (
              <input
                placeholder="Filter…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full h-9 rounded-full border bg-background px-3 text-sm"
              />
            )}
            <div className="flex flex-wrap gap-1.5">
              {others.length === 0 ? (
                <p className="text-xs text-muted-foreground">No matches.</p>
              ) : (
                others.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    disabled={pending}
                    onClick={() => start(() => onAttach(a.id))}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs hover:bg-muted"
                  >
                    <Plus className="size-3" />
                    {a.label}
                    {a.sub && <span className="text-muted-foreground">· {a.sub}</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
