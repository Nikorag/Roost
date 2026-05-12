"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, X, Hammer, UsersRound, Plus } from "lucide-react";
import { ACTION_STATUSES, STATUS_LABEL, cn } from "@/lib/utils";
import { EntityPicker, type PickerItem } from "@/components/entity-picker";
import { Modal } from "@/components/modal";

export type ActionRowAttachments = {
  contractors: PickerItem[];
  personnel: PickerItem[];
};

export type ActionRowDirectories = {
  contractors: PickerItem[];
  personnel: PickerItem[];
  users: PickerItem[];
};

export function ActionRow({
  action,
  attachments,
  directories,
  onStatus,
  onEdit,
  onDelete,
  onSetAssignee,
  onAttachContractor,
  onDetachContractor,
  onAttachPersonnel,
  onDetachPersonnel,
  onCreateContractor,
  onCreatePersonnel,
}: {
  action: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    assigneeId: string | null;
  };
  attachments: ActionRowAttachments;
  directories: ActionRowDirectories;
  onStatus: (status: string) => Promise<void>;
  onEdit: (input: { title: string; description: string }) => Promise<void>;
  onDelete: () => Promise<void>;
  onSetAssignee: (userId: string | null) => Promise<void>;
  onAttachContractor: (id: string) => Promise<void>;
  onDetachContractor: (id: string) => Promise<void>;
  onAttachPersonnel: (id: string) => Promise<void>;
  onDetachPersonnel: (id: string) => Promise<void>;
  onCreateContractor: (name: string) => Promise<{ id: string } | void>;
  onCreatePersonnel: (name: string) => Promise<{ id: string } | void>;
}) {
  const [pending, start] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<null | "contractor" | "personnel">(null);

  const contractorIds = attachments.contractors.map((c) => c.id);
  const personnelIds = attachments.personnel.map((p) => p.id);

  return (
    <div className="rounded-2xl bg-muted/40 px-3 py-2 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-full sm:basis-0">
          <div className="text-sm truncate">{action.title}</div>
          {action.description && (
            <div className="text-xs text-muted-foreground line-clamp-2">{action.description}</div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 max-w-full">
          <select
            value={action.assigneeId ?? ""}
            disabled={pending}
            onChange={(e) => {
              const v = e.currentTarget.value;
              start(() => onSetAssignee(v || null));
            }}
            className="text-xs rounded-full border bg-background px-2 py-1 max-w-[6.5rem] sm:max-w-[8rem] min-w-0"
            title="Assignee"
          >
            <option value="">Unassigned</option>
            {directories.users.map((u) => (
              <option key={u.id} value={u.id}>{u.label}</option>
            ))}
          </select>
          <select
            defaultValue={action.status}
            disabled={pending}
            onChange={(e) => {
              const v = e.currentTarget.value;
              start(() => onStatus(v));
            }}
            className="text-xs rounded-full border bg-background px-2 py-1"
          >
            {ACTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="size-8 rounded-full hover:bg-muted flex items-center justify-center"
            aria-label="Edit"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm(`Delete "${action.title}"?`)) start(onDelete);
            }}
            className="size-8 rounded-full hover:bg-destructive/10 text-destructive flex items-center justify-center"
            aria-label="Delete"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <AttachChips
        kind="contractor"
        items={attachments.contractors}
        onDetach={onDetachContractor}
        onOpen={() => setPickerOpen("contractor")}
      />
      <AttachChips
        kind="personnel"
        items={attachments.personnel}
        onDetach={onDetachPersonnel}
        onOpen={() => setPickerOpen("personnel")}
      />

      <EntityPicker
        open={pickerOpen === "contractor"}
        onOpenChange={(o) => setPickerOpen(o ? "contractor" : null)}
        title="Attach contractors"
        items={directories.contractors}
        attachedIds={contractorIds}
        onAttach={onAttachContractor}
        onDetach={onDetachContractor}
        onCreate={onCreateContractor}
        createLabel="Create contractor"
      />
      <EntityPicker
        open={pickerOpen === "personnel"}
        onOpenChange={(o) => setPickerOpen(o ? "personnel" : null)}
        title="Attach people"
        items={directories.personnel}
        attachedIds={personnelIds}
        onAttach={onAttachPersonnel}
        onDetach={onDetachPersonnel}
        onCreate={onCreatePersonnel}
        createLabel="Create person"
      />

      <ActionEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initialTitle={action.title}
        initialDesc={action.description ?? ""}
        onSave={async (input) => {
          await onEdit(input);
          setEditOpen(false);
        }}
      />
    </div>
  );
}

function ActionEditDialog({
  open,
  onOpenChange,
  initialTitle,
  initialDesc,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTitle: string;
  initialDesc: string;
  onSave: (input: { title: string; description: string }) => Promise<void>;
}) {
  const [t, setT] = useState(initialTitle);
  const [d, setD] = useState(initialDesc);
  const [pending, start] = useTransition();
  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setT(initialTitle);
          setD(initialDesc);
        }
        onOpenChange(o);
      }}
      title="Edit action"
    >
      <div className="space-y-2">
        <input
          value={t}
          onChange={(e) => setT(e.target.value)}
          placeholder="Title"
          className="w-full h-10 rounded-2xl border bg-background px-4 text-sm"
        />
        <textarea
          value={d}
          onChange={(e) => setD(e.target.value)}
          placeholder="Description (optional)"
          className="w-full min-h-[6rem] rounded-2xl border bg-background px-4 py-3 text-sm"
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
          disabled={pending || !t.trim()}
          onClick={() =>
            start(async () => {
              await onSave({ title: t.trim(), description: d.trim() });
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

function AttachChips({
  kind,
  items,
  onDetach,
  onOpen,
}: {
  kind: "contractor" | "personnel";
  items: PickerItem[];
  onDetach: (id: string) => Promise<void>;
  onOpen: () => void;
}) {
  const [pending, start] = useTransition();
  const Icon = kind === "contractor" ? Hammer : UsersRound;
  const tint = kind === "contractor" ? "bg-pastel-peach text-orange-900" : "bg-pastel-lilac text-purple-900";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Icon className="size-3 text-muted-foreground" />
      {items.length === 0 && <span className="text-[11px] text-muted-foreground">None</span>}
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          disabled={pending}
          onClick={() => start(() => onDetach(it.id))}
          className={cn("group inline-flex items-center gap-1 rounded-full pl-2 pr-1.5 py-0.5 text-[11px]", tint)}
          title="Remove"
        >
          {it.label}
          <X className="size-3 opacity-60 group-hover:opacity-100" />
        </button>
      ))}
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] hover:bg-muted"
      >
        <Plus className="size-3" />
      </button>
    </div>
  );
}
