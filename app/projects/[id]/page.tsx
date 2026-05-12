import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  STATUS_LABEL,
  STATUS_TINT,
  formatDate,
  formatMoney,
} from "@/lib/utils";
import {
  addAction,
  addEvent,
  addInvoice,
  addMaterial,
  addMaterialOption,
  addQuote,
  addTask,
  attachActionContractor,
  attachActionPersonnel,
  attachContractor,
  attachPersonnel,
  attachTaskContractor,
  attachTaskPersonnel,
  attachTool,
  chooseMaterialOption,
  createContractor,
  createPersonnel,
  createTool,
  deleteAction,
  deleteEvent,
  editEvent,
  deleteMaterial,
  deleteMaterialOption,
  deleteTask,
  deleteUpload,
  detachActionContractor,
  detachActionPersonnel,
  detachContractor,
  detachPersonnel,
  detachTaskContractor,
  detachTaskPersonnel,
  detachTool,
  editAction,
  editMaterial,
  editMaterialOption,
  editTask,
  generateAfterImageForProject,
  setActionAssignee,
  setActionStatus,
  setMaterialPurchased,
  setTaskAssignee,
  setTaskStatus,
  setUploadKind,
  setUploadAiGenerated,
  updateProjectStatus,
  type OptionInput,
} from "@/lib/actions";
import { PROJECT_STATUSES } from "@/lib/utils";
import { ProjectStatusSelect } from "./_status-select";
import { TaskRow } from "./_task-row";
import { ActionRow } from "./_action-row";
import { AttachCard } from "./_attach";
import { Materials } from "./_materials";
import { EventRow } from "./_event-row";
import { ProjectImages } from "./_images";
import { imageUrl } from "@/lib/storage";
import {
  Hammer,
  PackageOpen,
  UsersRound,
  Wrench,
  FileText,
  Calendar,
  Images,
} from "lucide-react";

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1);
  if (!project) notFound();

  const [
    tasks,
    actions,
    materials,
    events,
    pcs,
    pps,
    pts,
    allContractors,
    allPersonnel,
    allTools,
    allUsers,
    uploadRows,
  ] = await Promise.all([
    db.select().from(schema.tasks).where(eq(schema.tasks.projectId, id)).orderBy(schema.tasks.position),
    db.select().from(schema.actions).where(eq(schema.actions.projectId, id)),
    db.select().from(schema.materials).where(eq(schema.materials.projectId, id)),
    db.select().from(schema.events).where(eq(schema.events.projectId, id)).orderBy(schema.events.startsOn),
    db.select().from(schema.projectContractors).where(eq(schema.projectContractors.projectId, id)),
    db.select().from(schema.projectPersonnel).where(eq(schema.projectPersonnel.projectId, id)),
    db.select().from(schema.projectTools).where(eq(schema.projectTools.projectId, id)),
    db.select().from(schema.contractors),
    db.select().from(schema.personnel),
    db.select().from(schema.tools),
    db.select().from(schema.users),
    db.select().from(schema.uploads).where(eq(schema.uploads.projectId, id)).orderBy(schema.uploads.createdAt),
  ]);

  const taskIds = tasks.map((t) => t.id);
  const actionIds = actions.map((a) => a.id);
  const materialIds = materials.map((m) => m.id);

  const [options, taskCs, taskPs, actionCs, actionPs, invoices, quotes] = await Promise.all([
    materialIds.length
      ? db.select().from(schema.materialOptions).where(inArray(schema.materialOptions.materialId, materialIds))
      : Promise.resolve([] as (typeof schema.materialOptions.$inferSelect)[]),
    taskIds.length
      ? db.select().from(schema.taskContractors).where(inArray(schema.taskContractors.taskId, taskIds))
      : Promise.resolve([] as (typeof schema.taskContractors.$inferSelect)[]),
    taskIds.length
      ? db.select().from(schema.taskPersonnel).where(inArray(schema.taskPersonnel.taskId, taskIds))
      : Promise.resolve([] as (typeof schema.taskPersonnel.$inferSelect)[]),
    actionIds.length
      ? db.select().from(schema.actionContractors).where(inArray(schema.actionContractors.actionId, actionIds))
      : Promise.resolve([] as (typeof schema.actionContractors.$inferSelect)[]),
    actionIds.length
      ? db.select().from(schema.actionPersonnel).where(inArray(schema.actionPersonnel.actionId, actionIds))
      : Promise.resolve([] as (typeof schema.actionPersonnel.$inferSelect)[]),
    taskIds.length
      ? db.select().from(schema.invoices).where(inArray(schema.invoices.taskId, taskIds))
      : Promise.resolve([] as (typeof schema.invoices.$inferSelect)[]),
    taskIds.length
      ? db.select().from(schema.quotes).where(inArray(schema.quotes.taskId, taskIds))
      : Promise.resolve([] as (typeof schema.quotes.$inferSelect)[]),
  ]);
  const projectImages = uploadRows
    .filter((u) => (u.contentType ?? "").startsWith("image/") || u.aiGenerated)
    .map((u) => ({
      id: u.id,
      url: imageUrl(u.objectKey),
      kind: u.kind,
      caption: u.caption,
      aiGenerated: u.aiGenerated,
      createdAt: u.createdAt.toISOString(),
    }));

  const projectInvoices = invoices;
  const projectQuotes = quotes;
  const totalSpend = projectInvoices.reduce((sum, i) => sum + i.totalCents, 0);

  const optionsByMaterial = new Map<string, typeof options>();
  for (const o of options) {
    const arr = optionsByMaterial.get(o.materialId) ?? [];
    arr.push(o);
    optionsByMaterial.set(o.materialId, arr);
  }
  const materialsWithOptions = materials.map((m) => ({
    id: m.id,
    name: m.name,
    quantity: m.quantity,
    isOpenChoice: m.isOpenChoice,
    chosenOptionId: m.chosenOptionId,
    purchased: m.purchased,
    options: (optionsByMaterial.get(m.id) ?? []).map((o) => ({
      id: o.id,
      label: o.label,
      vendor: o.vendor,
      url: o.url,
      priceCents: o.priceCents,
      description: o.description,
    })),
  }));

  const attachedContractorIds = pcs.map((x) => x.contractorId);
  const attachedPersonnelIds = pps.map((x) => x.personnelId);
  const attachedToolIds = pts.map((x) => x.toolId);

  const contractorById = new Map(allContractors.map((c) => [c.id, c]));
  const personnelById = new Map(allPersonnel.map((p) => [p.id, p]));

  const taskContractorsByTask = new Map<string, string[]>();
  for (const r of taskCs) {
    const arr = taskContractorsByTask.get(r.taskId) ?? [];
    arr.push(r.contractorId);
    taskContractorsByTask.set(r.taskId, arr);
  }
  const taskPersonnelByTask = new Map<string, string[]>();
  for (const r of taskPs) {
    const arr = taskPersonnelByTask.get(r.taskId) ?? [];
    arr.push(r.personnelId);
    taskPersonnelByTask.set(r.taskId, arr);
  }
  const actionContractorsByAction = new Map<string, string[]>();
  for (const r of actionCs) {
    const arr = actionContractorsByAction.get(r.actionId) ?? [];
    arr.push(r.contractorId);
    actionContractorsByAction.set(r.actionId, arr);
  }
  const actionPersonnelByAction = new Map<string, string[]>();
  for (const r of actionPs) {
    const arr = actionPersonnelByAction.get(r.actionId) ?? [];
    arr.push(r.personnelId);
    actionPersonnelByAction.set(r.actionId, arr);
  }

  const directories = {
    contractors: allContractors.map((c) => ({ id: c.id, label: c.name, sub: c.trade ?? undefined })),
    personnel: allPersonnel.map((p) => ({ id: p.id, label: p.name, sub: p.relation ?? undefined })),
    users: allUsers.map((u) => ({ id: u.id, label: u.name ?? u.email, sub: u.name ? u.email : undefined })),
  };

  function pickerItemsFor(ids: string[], kind: "contractor" | "personnel") {
    if (kind === "contractor") {
      return ids
        .map((cid) => contractorById.get(cid))
        .filter(Boolean)
        .map((c) => ({ id: c!.id, label: c!.name, sub: c!.trade ?? undefined }));
    }
    return ids
      .map((pid) => personnelById.get(pid))
      .filter(Boolean)
      .map((p) => ({ id: p!.id, label: p!.name, sub: p!.relation ?? undefined }));
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Badge className={STATUS_TINT[project.status]}>{STATUS_LABEL[project.status]}</Badge>
            <span className="text-xs text-muted-foreground">Target {formatDate(project.targetDate)}</span>
          </div>
          <ProjectStatusSelect
            id={project.id}
            current={project.status}
            options={PROJECT_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            action={async (formData: FormData) => {
              "use server";
              const next = formData.get("status") as string;
              if (PROJECT_STATUSES.includes(next as (typeof PROJECT_STATUSES)[number])) {
                await updateProjectStatus(project.id, next as (typeof PROJECT_STATUSES)[number]);
              }
            }}
          />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{project.title}</h1>
        {project.description && <p className="text-muted-foreground max-w-2xl">{project.description}</p>}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {project.budgetCents != null && <span>Budget {formatMoney(project.budgetCents)}</span>}
          <span>Spent {formatMoney(totalSpend)}</span>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Images className="size-4 text-emerald-700" /> Images
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectImages
            projectId={project.id}
            projectTitle={project.title}
            projectDescription={project.description}
            images={projectImages}
            actions={{
              setKind: async (uploadId: string, kind: "before" | "progress" | "after" | "other") => {
                "use server";
                await setUploadKind(uploadId, kind);
              },
              remove: async (uploadId: string) => {
                "use server";
                await deleteUpload(uploadId);
              },
              setAi: async (uploadId: string, aiGenerated: boolean) => {
                "use server";
                await setUploadAiGenerated(uploadId, aiGenerated);
              },
              generateAfter: async (input: { prompt: string; basedOnUploadId?: string }) => {
                "use server";
                return generateAfterImageForProject({
                  projectId: project.id,
                  prompt: input.prompt,
                  basedOnUploadId: input.basedOnUploadId,
                });
              },
            }}
          />
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Subtasks</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <form
              action={async (fd) => {
                "use server";
                const t = (fd.get("title") as string)?.trim();
                if (t) await addTask(project.id, t);
              }}
              className="flex gap-2"
            >
              <input
                name="title"
                placeholder="Add a subtask…"
                className="flex-1 h-10 rounded-2xl border bg-background px-4 text-sm"
              />
              <Button size="sm" type="submit">Add</Button>
            </form>
            {tasks.length === 0 && <p className="text-sm text-muted-foreground py-2">No subtasks yet.</p>}
            {tasks.map((t) => {
              const tCs = taskContractorsByTask.get(t.id) ?? [];
              const tPs = taskPersonnelByTask.get(t.id) ?? [];
              return (
                <TaskRow
                  key={t.id}
                  task={{
                    id: t.id,
                    title: t.title,
                    description: t.description,
                    status: t.status,
                    assigneeId: t.assigneeId,
                  }}
                  attachments={{
                    contractors: pickerItemsFor(tCs, "contractor"),
                    personnel: pickerItemsFor(tPs, "personnel"),
                  }}
                  directories={directories}
                  onStatus={async (status: string) => {
                    "use server";
                    await setTaskStatus(t.id, status as never);
                  }}
                  onEdit={async (input: { title: string; description: string }) => {
                    "use server";
                    await editTask(t.id, input);
                  }}
                  onDelete={async () => {
                    "use server";
                    await deleteTask(t.id);
                  }}
                  onSetAssignee={async (uid: string | null) => {
                    "use server";
                    await setTaskAssignee(t.id, uid);
                  }}
                  onAttachContractor={async (cid: string) => {
                    "use server";
                    await attachTaskContractor(t.id, cid);
                  }}
                  onDetachContractor={async (cid: string) => {
                    "use server";
                    await detachTaskContractor(t.id, cid);
                  }}
                  onAttachPersonnel={async (pid: string) => {
                    "use server";
                    await attachTaskPersonnel(t.id, pid);
                  }}
                  onDetachPersonnel={async (pid: string) => {
                    "use server";
                    await detachTaskPersonnel(t.id, pid);
                  }}
                  onCreateContractor={async (name: string) => {
                    "use server";
                    const c = await createContractor({ name });
                    return c ? { id: c.id } : undefined;
                  }}
                  onCreatePersonnel={async (name: string) => {
                    "use server";
                    const p = await createPersonnel({ name });
                    return p ? { id: p.id } : undefined;
                  }}
                />
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <form
              action={async (fd) => {
                "use server";
                const t = (fd.get("title") as string)?.trim();
                if (t) await addAction(project.id, t);
              }}
              className="flex gap-2"
            >
              <input
                name="title"
                placeholder="Add an action…"
                className="flex-1 h-10 rounded-2xl border bg-background px-4 text-sm"
              />
              <Button size="sm" type="submit">Add</Button>
            </form>
            {actions.length === 0 && <p className="text-sm text-muted-foreground py-2">No open actions.</p>}
            {actions.map((a) => {
              const aCs = actionContractorsByAction.get(a.id) ?? [];
              const aPs = actionPersonnelByAction.get(a.id) ?? [];
              return (
                <ActionRow
                  key={a.id}
                  action={{
                    id: a.id,
                    title: a.title,
                    description: a.description,
                    status: a.status,
                    assigneeId: a.assigneeId,
                  }}
                  attachments={{
                    contractors: pickerItemsFor(aCs, "contractor"),
                    personnel: pickerItemsFor(aPs, "personnel"),
                  }}
                  directories={directories}
                  onStatus={async (status: string) => {
                    "use server";
                    await setActionStatus(a.id, status as never);
                  }}
                  onEdit={async (input: { title: string; description: string }) => {
                    "use server";
                    await editAction(a.id, input);
                  }}
                  onDelete={async () => {
                    "use server";
                    await deleteAction(a.id);
                  }}
                  onSetAssignee={async (uid: string | null) => {
                    "use server";
                    await setActionAssignee(a.id, uid);
                  }}
                  onAttachContractor={async (cid: string) => {
                    "use server";
                    await attachActionContractor(a.id, cid);
                  }}
                  onDetachContractor={async (cid: string) => {
                    "use server";
                    await detachActionContractor(a.id, cid);
                  }}
                  onAttachPersonnel={async (pid: string) => {
                    "use server";
                    await attachActionPersonnel(a.id, pid);
                  }}
                  onDetachPersonnel={async (pid: string) => {
                    "use server";
                    await detachActionPersonnel(a.id, pid);
                  }}
                  onCreateContractor={async (name: string) => {
                    "use server";
                    const c = await createContractor({ name });
                    return c ? { id: c.id } : undefined;
                  }}
                  onCreatePersonnel={async (name: string) => {
                    "use server";
                    const p = await createPersonnel({ name });
                    return p ? { id: p.id } : undefined;
                  }}
                />
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageOpen className="size-4 text-emerald-700" /> Materials
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Materials
            materials={materialsWithOptions}
            actions={{
              addMaterial: async (input) => {
                "use server";
                await addMaterial({ projectId: project.id, name: input.name, quantity: input.quantity });
              },
              editMaterial: async (mid, input) => {
                "use server";
                await editMaterial(mid, { name: input.name, quantity: input.quantity ?? null });
              },
              deleteMaterial: async (mid) => {
                "use server";
                await deleteMaterial(mid);
              },
              setPurchased: async (mid, purchased) => {
                "use server";
                await setMaterialPurchased(mid, purchased);
              },
              addOption: async (mid, opt: OptionInput) => {
                "use server";
                await addMaterialOption(mid, opt);
              },
              editOption: async (oid, opt: OptionInput) => {
                "use server";
                await editMaterialOption(oid, opt);
              },
              deleteOption: async (oid) => {
                "use server";
                await deleteMaterialOption(oid);
              },
              chooseOption: async (mid, oid) => {
                "use server";
                await chooseMaterialOption(mid, oid);
              },
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-4 text-emerald-700" /> Events
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            action={async (fd) => {
              "use server";
              const title = (fd.get("title") as string)?.trim();
              const date = fd.get("date") as string;
              const days = Math.max(1, Number(fd.get("days") || 1));
              if (!title || !date) return;
              await addEvent({
                projectId: project.id,
                title,
                startsOn: new Date(`${date}T00:00:00Z`),
                durationDays: days,
              });
            }}
            className="grid sm:grid-cols-4 gap-2 items-start"
          >
            <input
              name="title"
              placeholder="Event title"
              className="sm:col-span-2 h-10 rounded-2xl border bg-background px-4 text-sm"
              required
            />
            <input type="date" name="date" className="h-10 rounded-2xl border bg-background px-4 text-sm" required />
            <input
              type="number"
              min="1"
              defaultValue="1"
              name="days"
              placeholder="Days"
              className="h-10 rounded-2xl border bg-background px-4 text-sm"
            />
            <Button size="sm" type="submit" className="sm:col-span-4 sm:justify-self-start">Add event</Button>
          </form>
          {events.length === 0 && <p className="text-sm text-muted-foreground">No events scheduled.</p>}
          {events.map((e) => (
            <EventRow
              key={e.id}
              event={{
                id: e.id,
                title: e.title,
                startsOn: e.startsOn,
                durationDays: e.durationDays,
                notes: e.notes,
              }}
              onEdit={async (input) => {
                "use server";
                await editEvent(e.id, {
                  title: input.title,
                  startsOn: new Date(`${input.startsOn}T00:00:00Z`),
                  durationDays: input.durationDays,
                  notes: input.notes,
                });
              }}
              onDelete={async () => {
                "use server";
                await deleteEvent(e.id);
              }}
            />
          ))}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <AttachCard
          title="Contractors"
          icon={<Hammer className="size-4 text-emerald-700" />}
          available={directories.contractors}
          attachedIds={attachedContractorIds}
          onAttach={async (cid: string) => {
            "use server";
            await attachContractor(project.id, cid);
          }}
          onDetach={async (cid: string) => {
            "use server";
            await detachContractor(project.id, cid);
          }}
          onCreate={async (name: string) => {
            "use server";
            const c = await createContractor({ name });
            return c ? { id: c.id } : undefined;
          }}
          createLabel="Create contractor"
        />
        <AttachCard
          title="People"
          icon={<UsersRound className="size-4 text-emerald-700" />}
          available={directories.personnel}
          attachedIds={attachedPersonnelIds}
          onAttach={async (pid: string) => {
            "use server";
            await attachPersonnel(project.id, pid);
          }}
          onDetach={async (pid: string) => {
            "use server";
            await detachPersonnel(project.id, pid);
          }}
          onCreate={async (name: string) => {
            "use server";
            const p = await createPersonnel({ name });
            return p ? { id: p.id } : undefined;
          }}
          createLabel="Create person"
        />
        <AttachCard
          title="Tools"
          icon={<Wrench className="size-4 text-emerald-700" />}
          available={allTools.map((t) => ({ id: t.id, label: t.name, sub: t.location ?? undefined }))}
          attachedIds={attachedToolIds}
          onAttach={async (tid: string) => {
            "use server";
            await attachTool(project.id, tid);
          }}
          onDetach={async (tid: string) => {
            "use server";
            await detachTool(project.id, tid);
          }}
          onCreate={async (name: string) => {
            "use server";
            const t = await createTool({ name });
            return t ? { id: t.id } : undefined;
          }}
          createLabel="Create tool"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-emerald-700" /> Quotes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <form
              action={async (fd) => {
                "use server";
                const taskId = fd.get("taskId") as string;
                const vendor = (fd.get("vendor") as string)?.trim();
                const total = Math.round(Number(fd.get("total") || 0) * 100);
                if (taskId && total > 0) await addQuote({ taskId, vendor, totalCents: total });
              }}
              className="grid sm:grid-cols-4 gap-2 items-start"
            >
              <select name="taskId" className="h-10 rounded-2xl border bg-background px-3 text-sm sm:col-span-2" required defaultValue="">
                <option value="" disabled>Select task</option>
                {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
              <input name="vendor" placeholder="Vendor" className="h-10 rounded-2xl border bg-background px-4 text-sm" />
              <input name="total" type="number" step="0.01" placeholder="Total (£)" className="h-10 rounded-2xl border bg-background px-4 text-sm" required />
              <Button size="sm" type="submit" className="sm:col-span-4 sm:justify-self-start">Add quote</Button>
            </form>
            {projectQuotes.length === 0 && <p className="text-sm text-muted-foreground">No quotes yet.</p>}
            {projectQuotes.map((q) => (
              <div key={q.id} className="rounded-2xl bg-muted/40 px-3 py-2 flex justify-between text-sm">
                <span>{q.vendor || "Quote"}</span>
                <span>{formatMoney(q.totalCents)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-emerald-700" /> Invoices
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <form
              action={async (fd) => {
                "use server";
                const taskId = fd.get("taskId") as string;
                const vendor = (fd.get("vendor") as string)?.trim();
                const total = Math.round(Number(fd.get("total") || 0) * 100);
                if (taskId && total > 0) await addInvoice({ taskId, vendor, totalCents: total });
              }}
              className="grid sm:grid-cols-4 gap-2 items-start"
            >
              <select name="taskId" className="h-10 rounded-2xl border bg-background px-3 text-sm sm:col-span-2" required defaultValue="">
                <option value="" disabled>Select task</option>
                {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
              <input name="vendor" placeholder="Vendor" className="h-10 rounded-2xl border bg-background px-4 text-sm" />
              <input name="total" type="number" step="0.01" placeholder="Total (£)" className="h-10 rounded-2xl border bg-background px-4 text-sm" required />
              <Button size="sm" type="submit" className="sm:col-span-4 sm:justify-self-start">Add invoice</Button>
            </form>
            {projectInvoices.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
            {projectInvoices.map((i) => (
              <div key={i.id} className="rounded-2xl bg-muted/40 px-3 py-2 flex justify-between text-sm">
                <span>{i.vendor || "Invoice"}</span>
                <span>{formatMoney(i.totalCents)}</span>
              </div>
            ))}
            <div className="border-t pt-2 mt-2 flex justify-between text-sm font-medium">
              <span>Total spend</span>
              <span>{formatMoney(totalSpend)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
