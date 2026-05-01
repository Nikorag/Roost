"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type FieldDef = {
  name: string;
  label: string;
  placeholder?: string;
  type?: "text" | "email" | "url" | "tel" | "textarea";
};

export type DirectoryCardProps = {
  id: string;
  values: Record<string, string>;
  /** Field shown as the card title (and required). */
  titleField: string;
  /** Field shown as the subheading under the title. */
  subtitleField?: string;
  /** Body fields rendered with `label: value`. */
  bodyFields: { name: string; label?: string; isLink?: "url" }[];
  fields: FieldDef[];
  onSave: (values: Record<string, string>) => Promise<void>;
  onDelete: () => Promise<void>;
};

export function DirectoryCard({
  values,
  titleField,
  subtitleField,
  bodyFields,
  fields,
  onSave,
  onDelete,
}: DirectoryCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(values);
  const [pending, start] = useTransition();

  if (editing) {
    return (
      <Card>
        <CardContent className="p-5 space-y-2">
          {fields.map((f) =>
            f.type === "textarea" ? (
              <label key={f.name} className="block text-sm">
                <span className="text-xs text-muted-foreground">{f.label}</span>
                <textarea
                  value={draft[f.name] ?? ""}
                  onChange={(e) => setDraft({ ...draft, [f.name]: e.target.value })}
                  placeholder={f.placeholder}
                  className="mt-1 w-full min-h-[4rem] rounded-2xl border bg-background px-3 py-2 text-sm"
                />
              </label>
            ) : (
              <label key={f.name} className="block text-sm">
                <span className="text-xs text-muted-foreground">{f.label}</span>
                <input
                  type={f.type ?? "text"}
                  value={draft[f.name] ?? ""}
                  onChange={(e) => setDraft({ ...draft, [f.name]: e.target.value })}
                  placeholder={f.placeholder}
                  className="mt-1 w-full h-10 rounded-2xl border bg-background px-3 text-sm"
                />
              </label>
            ),
          )}
          <div className="flex justify-end gap-1 pt-2">
            <button
              type="button"
              onClick={() => {
                setDraft(values);
                setEditing(false);
              }}
              className="rounded-full px-3 h-8 text-xs hover:bg-muted"
            >
              <X className="size-3.5 inline" /> Cancel
            </button>
            <button
              type="button"
              disabled={pending || !(draft[titleField] ?? "").trim()}
              onClick={() =>
                start(async () => {
                  const trimmed = Object.fromEntries(
                    Object.entries(draft).map(([k, v]) => [k, (v ?? "").trim()]),
                  );
                  await onSave(trimmed);
                  setEditing(false);
                })
              }
              className="rounded-full px-3 h-8 text-xs bg-primary text-primary-foreground disabled:opacity-50"
            >
              <Check className="size-3.5 inline" /> Save
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate">{values[titleField]}</CardTitle>
            {subtitleField && values[subtitleField] && (
              <p className="text-sm text-muted-foreground truncate">{values[subtitleField]}</p>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              onClick={() => setEditing(true)}
              className="size-8 rounded-full hover:bg-muted flex items-center justify-center"
              aria-label="Edit"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              disabled={pending}
              onClick={() => {
                if (confirm(`Delete "${values[titleField]}"?`)) start(onDelete);
              }}
              className="size-8 rounded-full hover:bg-destructive/10 text-destructive flex items-center justify-center"
              aria-label="Delete"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="text-sm space-y-1">
        {bodyFields.map((b) => {
          const v = values[b.name];
          if (!v) return null;
          if (b.isLink === "url") {
            return (
              <a
                key={b.name}
                href={v}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-700 hover:underline block"
              >
                {b.label ?? "Website"}
              </a>
            );
          }
          return (
            <div key={b.name} className={b.label === undefined ? "" : "text-muted-foreground"}>
              {b.label ? <span className="text-muted-foreground">{b.label}: </span> : null}
              {v}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
