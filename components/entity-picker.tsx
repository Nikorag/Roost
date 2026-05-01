"use client";

import { useMemo, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, Search, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type PickerItem = { id: string; label: string; sub?: string };

export function EntityPicker({
  open,
  onOpenChange,
  title,
  items,
  attachedIds,
  multi = true,
  onAttach,
  onDetach,
  onCreate,
  createLabel = "Create",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: PickerItem[];
  attachedIds: string[];
  multi?: boolean;
  onAttach: (id: string) => Promise<void>;
  onDetach?: (id: string) => Promise<void>;
  onCreate?: (name: string) => Promise<{ id: string } | void>;
  createLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [pending, start] = useTransition();
  const attachedSet = useMemo(() => new Set(attachedIds), [attachedIds]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter((i) => `${i.label} ${i.sub ?? ""}`.toLowerCase().includes(q))
    : items;
  const exactMatch = items.some((i) => i.label.toLowerCase() === q);
  const canCreate = !!onCreate && q.length > 0 && !exactMatch;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-md rounded-3xl bg-card text-card-foreground border shadow-xl p-5 space-y-4 focus:outline-none">
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
            <Dialog.Close
              className="size-8 rounded-full hover:bg-muted flex items-center justify-center"
              aria-label="Close"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="relative">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search or type to create…"
              className="w-full h-10 rounded-2xl border bg-background pl-9 pr-3 text-sm"
            />
          </div>

          <div className="max-h-[55vh] overflow-y-auto rounded-2xl border bg-background/50 divide-y">
            {filtered.length === 0 && !canCreate && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</div>
            )}
            {filtered.map((item) => {
              const isAttached = attachedSet.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      if (isAttached) {
                        if (onDetach) await onDetach(item.id);
                      } else {
                        await onAttach(item.id);
                        if (!multi) onOpenChange(false);
                      }
                    })
                  }
                  className={cn(
                    "w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors",
                    isAttached && "bg-pastel-mint/40",
                  )}
                >
                  <div className="min-w-0">
                    <div className="text-sm truncate">{item.label}</div>
                    {item.sub && <div className="text-xs text-muted-foreground truncate">{item.sub}</div>}
                  </div>
                  {isAttached && <Check className="size-4 text-emerald-700 shrink-0" />}
                </button>
              );
            })}
            {canCreate && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    if (!onCreate) return;
                    const res = await onCreate(query.trim());
                    if (res?.id) {
                      await onAttach(res.id);
                      if (!multi) onOpenChange(false);
                    }
                    setQuery("");
                  })
                }
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/50 text-emerald-800"
              >
                <Plus className="size-3.5" />
                {createLabel} <span className="font-medium">"{query.trim()}"</span>
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
