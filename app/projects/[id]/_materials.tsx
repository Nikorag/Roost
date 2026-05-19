"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Sparkles, Link2, ExternalLink, Plus, ShoppingCart, PackageCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatMoney, cn } from "@/lib/utils";
import { Modal } from "@/components/modal";
import type { OptionInput } from "@/lib/actions";

type Option = {
  id: string;
  label: string;
  vendor: string | null;
  url: string | null;
  priceCents: number | null;
  description: string | null;
};
type Material = {
  id: string;
  name: string;
  quantity: string | null;
  isOpenChoice: boolean;
  chosenOptionId: string | null;
  purchased: boolean;
  options: Option[];
};

type Actions = {
  addMaterial: (input: { name: string; quantity?: string }) => Promise<void>;
  editMaterial: (id: string, input: { name: string; quantity?: string }) => Promise<void>;
  deleteMaterial: (id: string) => Promise<void>;
  setPurchased: (id: string, purchased: boolean) => Promise<void>;
  addOption: (materialId: string, opt: OptionInput) => Promise<void>;
  editOption: (id: string, opt: OptionInput) => Promise<void>;
  deleteOption: (id: string) => Promise<void>;
  chooseOption: (materialId: string, optionId: string) => Promise<void>;
};

export function Materials({ materials, actions }: { materials: Material[]; actions: Actions }) {
  const toBuy = materials.filter((m) => !m.purchased);
  const onHand = materials.filter((m) => m.purchased);
  return (
    <div className="space-y-5">
      <AddMaterialBar onAdd={actions.addMaterial} />
      {materials.length === 0 && (
        <p className="text-sm text-muted-foreground">No materials yet.</p>
      )}
      {materials.length > 0 && (
        <>
          <section className="space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">
              <ShoppingCart className="size-3.5" /> To purchase
              <span className="text-muted-foreground/70">({toBuy.length})</span>
            </h3>
            {toBuy.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing left to buy.</p>
            ) : (
              toBuy.map((m) => <MaterialCard key={m.id} material={m} actions={actions} />)
            )}
          </section>
          <section className="space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">
              <PackageCheck className="size-3.5" /> On hand
              <span className="text-muted-foreground/70">({onHand.length})</span>
            </h3>
            {onHand.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing purchased yet.</p>
            ) : (
              onHand.map((m) => <MaterialCard key={m.id} material={m} actions={actions} />)
            )}
          </section>
        </>
      )}
    </div>
  );
}

function AddMaterialBar({
  onAdd,
}: {
  onAdd: (input: { name: string; quantity?: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="grid sm:grid-cols-[1fr_140px_auto] gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Material (e.g. Skirting board paint)"
        className="h-10 rounded-2xl border bg-background px-4 text-sm"
      />
      <input
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        placeholder="Quantity"
        className="h-10 rounded-2xl border bg-background px-4 text-sm"
      />
      <button
        type="button"
        disabled={pending || !name.trim()}
        onClick={() =>
          start(async () => {
            await onAdd({ name: name.trim(), quantity: qty.trim() || undefined });
            setName("");
            setQty("");
          })
        }
        className="h-10 rounded-2xl px-4 bg-primary text-primary-foreground text-sm disabled:opacity-50"
      >
        Add material
      </button>
    </div>
  );
}

function MaterialCard({ material, actions }: { material: Material; actions: Actions }) {
  const [pending, start] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [optionDialog, setOptionDialog] = useState<{ mode: "add" } | { mode: "edit"; id: string } | null>(null);

  const editingOption =
    optionDialog?.mode === "edit"
      ? material.options.find((o) => o.id === optionDialog.id) ?? null
      : null;

  return (
    <div className={cn("rounded-2xl p-4 space-y-3", material.purchased ? "bg-pastel-sky/40" : "bg-muted/40")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{material.name}</span>
            {material.isOpenChoice && (
              <Badge className="bg-pastel-lemon text-yellow-900">Open choice</Badge>
            )}
          </div>
          {material.quantity && (
            <div className="text-xs text-muted-foreground">{material.quantity}</div>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            disabled={pending}
            onClick={() => start(() => actions.setPurchased(material.id, !material.purchased))}
            className={cn(
              "size-8 rounded-full flex items-center justify-center",
              material.purchased
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "hover:bg-background text-muted-foreground",
            )}
            aria-label={material.purchased ? "Mark as to purchase" : "Mark as purchased"}
            title={material.purchased ? "Mark as to purchase" : "Mark as purchased"}
          >
            {material.purchased ? <PackageCheck className="size-3.5" /> : <ShoppingCart className="size-3.5" />}
          </button>
          <button
            onClick={() => setEditOpen(true)}
            className="size-8 rounded-full hover:bg-background flex items-center justify-center"
            aria-label="Edit"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            disabled={pending}
            onClick={() => {
              if (confirm(`Delete material "${material.name}"?`))
                start(() => actions.deleteMaterial(material.id));
            }}
            className="size-8 rounded-full hover:bg-destructive/10 text-destructive flex items-center justify-center"
            aria-label="Delete"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {material.options.length > 0 && (
        <div className="space-y-2">
          {material.options.map((o) => (
            <OptionRow
              key={o.id}
              option={o}
              chosen={material.chosenOptionId === o.id}
              onChoose={() => actions.chooseOption(material.id, o.id)}
              onEdit={() => setOptionDialog({ mode: "edit", id: o.id })}
              onDelete={() => actions.deleteOption(o.id)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOptionDialog({ mode: "add" })}
        className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs hover:bg-background"
      >
        <Plus className="size-3.5" /> Add purchase option
      </button>

      <MaterialEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={{ name: material.name, quantity: material.quantity ?? "" }}
        onSave={async (input) => {
          await actions.editMaterial(material.id, {
            name: input.name,
            quantity: input.quantity || undefined,
          });
          setEditOpen(false);
        }}
      />

      <OptionDialog
        open={optionDialog !== null}
        mode={optionDialog?.mode === "edit" ? "edit" : "add"}
        onOpenChange={(o) => {
          if (!o) setOptionDialog(null);
        }}
        initial={
          editingOption
            ? {
                label: editingOption.label,
                vendor: editingOption.vendor ?? "",
                url: editingOption.url ?? "",
                priceCents: editingOption.priceCents,
                description: editingOption.description ?? "",
              }
            : undefined
        }
        onSave={async (opt) => {
          if (optionDialog?.mode === "edit") {
            await actions.editOption(optionDialog.id, opt);
          } else {
            await actions.addOption(material.id, opt);
          }
          setOptionDialog(null);
        }}
      />
    </div>
  );
}

function MaterialEditDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: { name: string; quantity: string };
  onSave: (input: { name: string; quantity: string }) => Promise<void>;
}) {
  const [name, setName] = useState(initial.name);
  const [qty, setQty] = useState(initial.quantity);
  const [pending, start] = useTransition();
  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setName(initial.name);
          setQty(initial.quantity);
        }
        onOpenChange(o);
      }}
      title="Edit material"
    >
      <div className="space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Material"
          className="w-full h-10 rounded-2xl border bg-background px-4 text-sm"
        />
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="Quantity"
          className="w-full h-10 rounded-2xl border bg-background px-4 text-sm"
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
          disabled={pending || !name.trim()}
          onClick={() =>
            start(async () => {
              await onSave({ name: name.trim(), quantity: qty.trim() });
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

function OptionRow({
  option,
  chosen,
  onChoose,
  onEdit,
  onDelete,
}: {
  option: Option;
  chosen: boolean;
  onChoose: () => Promise<void>;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const [pending, start] = useTransition();
  return (
    <div
      className={cn(
        "rounded-2xl border p-3 transition-colors",
        chosen ? "bg-pastel-sky/60 border-blue-200" : "bg-background hover:bg-muted/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(onChoose)}
          className="flex-1 text-left"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{option.label}</span>
            {option.vendor && (
              <span className="text-xs text-muted-foreground">{option.vendor}</span>
            )}
            {option.priceCents != null && (
              <span className="text-xs font-medium">{formatMoney(option.priceCents)}</span>
            )}
            {chosen && (
              <Badge className="bg-blue-500 text-white">Chosen</Badge>
            )}
          </div>
          {option.description && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {option.description}
            </div>
          )}
          {option.url && (
            <a
              href={option.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-blue-700 hover:underline inline-flex items-center gap-1 mt-1"
            >
              <ExternalLink className="size-3" />
              {hostnameOf(option.url)}
            </a>
          )}
        </button>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="size-7 rounded-full hover:bg-muted flex items-center justify-center"
            aria-label="Edit option"
          >
            <Pencil className="size-3" />
          </button>
          <button
            disabled={pending}
            onClick={() => {
              if (confirm(`Delete option "${option.label}"?`)) start(onDelete);
            }}
            className="size-7 rounded-full hover:bg-destructive/10 text-destructive flex items-center justify-center"
            aria-label="Delete option"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  initial?: { label: string; vendor: string; url: string; priceCents: number | null; description: string };
  onSave: (opt: OptionInput) => Promise<void>;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [vendor, setVendor] = useState(initial?.vendor ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [priceStr, setPriceStr] = useState(
    initial?.priceCents != null ? (initial.priceCents / 100).toString() : "",
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [pending, start] = useTransition();
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function fillFromUrl() {
    if (!url.trim()) return;
    setFetching(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/ai/material-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFetchError(data.error ?? "Couldn't extract details.");
        return;
      }
      const data = await res.json();
      if (data.label) setLabel(data.label);
      if (data.vendor) setVendor(data.vendor);
      if (data.priceCents != null) setPriceStr((data.priceCents / 100).toString());
      if (data.description) setDescription(data.description);
    } catch {
      setFetchError("Network error.");
    } finally {
      setFetching(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setLabel(initial?.label ?? "");
          setVendor(initial?.vendor ?? "");
          setUrl(initial?.url ?? "");
          setPriceStr(initial?.priceCents != null ? (initial.priceCents / 100).toString() : "");
          setDescription(initial?.description ?? "");
          setFetchError(null);
        }
        onOpenChange(o);
      }}
      title={mode === "edit" ? "Edit purchase option" : "Add purchase option"}
    >
      <div className="space-y-2">
        <div className="grid sm:grid-cols-[1fr_auto] gap-2">
          <div className="relative">
            <Link2 className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://… (paste a product URL)"
              className="w-full h-10 rounded-2xl border bg-background pl-9 pr-3 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={fillFromUrl}
            disabled={fetching || !url.trim()}
            className="h-10 rounded-2xl px-3 text-xs bg-pastel-lilac text-purple-900 disabled:opacity-50 inline-flex items-center gap-1"
          >
            <Sparkles className="size-3.5" />
            {fetching ? "Reading…" : "Fill from link"}
          </button>
        </div>
        {fetchError && <p className="text-xs text-destructive">{fetchError}</p>}

        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Skimming Stone 2.5L)"
          className="w-full h-10 rounded-2xl border bg-background px-4 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="From (vendor)"
            className="h-10 rounded-2xl border bg-background px-4 text-sm"
          />
          <input
            value={priceStr}
            onChange={(e) => setPriceStr(e.target.value)}
            inputMode="decimal"
            placeholder="Price (£)"
            className="h-10 rounded-2xl border bg-background px-4 text-sm"
          />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
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
          disabled={pending || !label.trim()}
          onClick={() =>
            start(async () => {
              const priceCents = priceStr ? Math.round(Number(priceStr) * 100) : null;
              await onSave({
                label: label.trim(),
                vendor: vendor.trim() || null,
                url: url.trim() || null,
                priceCents: Number.isFinite(priceCents as number) ? priceCents : null,
                description: description.trim() || null,
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

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
