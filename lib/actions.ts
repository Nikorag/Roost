"use server";

import { db, schema } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";

type ProjectStatus = "idea" | "planning" | "in_progress" | "blocked" | "completed" | "archived";
type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
type ActionStatus = "open" | "doing" | "done" | "cancelled";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user;
}

/* ---------- projects ---------- */

export async function createProject(input: {
  title: string;
  description?: string;
  status?: ProjectStatus;
  color?: string;
  budgetCents?: number | null;
  startDate?: Date | null;
  targetDate?: Date | null;
}) {
  const user = await requireUser();
  const [row] = await db
    .insert(schema.projects)
    .values({
      title: input.title,
      description: input.description,
      status: input.status ?? "planning",
      color: input.color ?? "mint",
      budgetCents: input.budgetCents ?? null,
      startDate: input.startDate ?? null,
      targetDate: input.targetDate ?? null,
      createdBy: user.id,
    })
    .returning();
  revalidatePath("/projects");
  return row;
}

export async function updateProjectStatus(id: string, status: ProjectStatus) {
  await requireUser();
  await db.update(schema.projects).set({ status, updatedAt: new Date() }).where(eq(schema.projects.id, id));
  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
}

export async function deleteProject(id: string) {
  await requireUser();
  await db.delete(schema.projects).where(eq(schema.projects.id, id));
  revalidatePath("/projects");
  redirect("/projects");
}

/* ---------- tasks (subtasks) ---------- */

export async function addTask(projectId: string, title: string) {
  await requireUser();
  await db.insert(schema.tasks).values({ projectId, title });
  revalidatePath(`/projects/${projectId}`);
}

export async function setTaskStatus(taskId: string, status: TaskStatus) {
  await requireUser();
  const [row] = await db
    .update(schema.tasks)
    .set({ status })
    .where(eq(schema.tasks.id, taskId))
    .returning();
  if (row) revalidatePath(`/projects/${row.projectId}`);
}

export async function editTask(taskId: string, input: { title: string; description?: string | null }) {
  await requireUser();
  const [row] = await db
    .update(schema.tasks)
    .set({ title: input.title, description: input.description ?? null })
    .where(eq(schema.tasks.id, taskId))
    .returning();
  if (row) revalidatePath(`/projects/${row.projectId}`);
}

export async function deleteTask(taskId: string) {
  await requireUser();
  const [row] = await db.delete(schema.tasks).where(eq(schema.tasks.id, taskId)).returning();
  if (row) revalidatePath(`/projects/${row.projectId}`);
}

export async function setTaskAssignee(taskId: string, userId: string | null) {
  await requireUser();
  const [row] = await db
    .update(schema.tasks)
    .set({ assigneeId: userId })
    .where(eq(schema.tasks.id, taskId))
    .returning();
  if (row) {
    revalidatePath(`/projects/${row.projectId}`);
    revalidatePath("/my/tasks");
  }
}

export async function attachTaskContractor(taskId: string, contractorId: string) {
  await requireUser();
  await db.insert(schema.taskContractors).values({ taskId, contractorId }).onConflictDoNothing();
  const [row] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId)).limit(1);
  if (row) revalidatePath(`/projects/${row.projectId}`);
}

export async function detachTaskContractor(taskId: string, contractorId: string) {
  await requireUser();
  await db
    .delete(schema.taskContractors)
    .where(and(eq(schema.taskContractors.taskId, taskId), eq(schema.taskContractors.contractorId, contractorId)));
  const [row] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId)).limit(1);
  if (row) revalidatePath(`/projects/${row.projectId}`);
}

export async function attachTaskPersonnel(taskId: string, personnelId: string) {
  await requireUser();
  await db.insert(schema.taskPersonnel).values({ taskId, personnelId }).onConflictDoNothing();
  const [row] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId)).limit(1);
  if (row) revalidatePath(`/projects/${row.projectId}`);
}

export async function detachTaskPersonnel(taskId: string, personnelId: string) {
  await requireUser();
  await db
    .delete(schema.taskPersonnel)
    .where(and(eq(schema.taskPersonnel.taskId, taskId), eq(schema.taskPersonnel.personnelId, personnelId)));
  const [row] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId)).limit(1);
  if (row) revalidatePath(`/projects/${row.projectId}`);
}

/* ---------- actions ---------- */

export async function addAction(projectId: string, title: string, assigneeId?: string | null) {
  await requireUser();
  await db.insert(schema.actions).values({ projectId, title, assigneeId: assigneeId ?? null });
  revalidatePath(`/projects/${projectId}`);
}

export async function setActionStatus(id: string, status: ActionStatus) {
  await requireUser();
  const [row] = await db.update(schema.actions).set({ status }).where(eq(schema.actions.id, id)).returning();
  if (row) revalidatePath(`/projects/${row.projectId}`);
}

export async function editAction(id: string, input: { title: string; description?: string | null }) {
  await requireUser();
  const [row] = await db
    .update(schema.actions)
    .set({ title: input.title, description: input.description ?? null })
    .where(eq(schema.actions.id, id))
    .returning();
  if (row) revalidatePath(`/projects/${row.projectId}`);
}

export async function deleteAction(id: string) {
  await requireUser();
  const [row] = await db.delete(schema.actions).where(eq(schema.actions.id, id)).returning();
  if (row) revalidatePath(`/projects/${row.projectId}`);
}

export async function setActionAssignee(id: string, userId: string | null) {
  await requireUser();
  const [row] = await db
    .update(schema.actions)
    .set({ assigneeId: userId })
    .where(eq(schema.actions.id, id))
    .returning();
  if (row) {
    revalidatePath(`/projects/${row.projectId}`);
    revalidatePath("/my/actions");
  }
}

export async function attachActionContractor(actionId: string, contractorId: string) {
  await requireUser();
  await db.insert(schema.actionContractors).values({ actionId, contractorId }).onConflictDoNothing();
  const [row] = await db.select().from(schema.actions).where(eq(schema.actions.id, actionId)).limit(1);
  if (row) revalidatePath(`/projects/${row.projectId}`);
}

export async function detachActionContractor(actionId: string, contractorId: string) {
  await requireUser();
  await db
    .delete(schema.actionContractors)
    .where(and(eq(schema.actionContractors.actionId, actionId), eq(schema.actionContractors.contractorId, contractorId)));
  const [row] = await db.select().from(schema.actions).where(eq(schema.actions.id, actionId)).limit(1);
  if (row) revalidatePath(`/projects/${row.projectId}`);
}

export async function attachActionPersonnel(actionId: string, personnelId: string) {
  await requireUser();
  await db.insert(schema.actionPersonnel).values({ actionId, personnelId }).onConflictDoNothing();
  const [row] = await db.select().from(schema.actions).where(eq(schema.actions.id, actionId)).limit(1);
  if (row) revalidatePath(`/projects/${row.projectId}`);
}

export async function detachActionPersonnel(actionId: string, personnelId: string) {
  await requireUser();
  await db
    .delete(schema.actionPersonnel)
    .where(and(eq(schema.actionPersonnel.actionId, actionId), eq(schema.actionPersonnel.personnelId, personnelId)));
  const [row] = await db.select().from(schema.actions).where(eq(schema.actions.id, actionId)).limit(1);
  if (row) revalidatePath(`/projects/${row.projectId}`);
}

/* ---------- contractors / personnel / tools (directories) ---------- */

export async function createContractor(input: {
  name: string;
  trade?: string;
  phone?: string;
  email?: string;
  website?: string;
  notes?: string;
  rating?: number | null;
}) {
  await requireUser();
  const [row] = await db.insert(schema.contractors).values(input).returning();
  revalidatePath("/contractors");
  return row;
}

export async function editContractor(
  id: string,
  input: {
    name: string;
    trade?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    notes?: string | null;
  },
) {
  await requireUser();
  await db
    .update(schema.contractors)
    .set({
      name: input.name,
      trade: input.trade ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      website: input.website ?? null,
      notes: input.notes ?? null,
    })
    .where(eq(schema.contractors.id, id));
  revalidatePath("/contractors");
}

export async function deleteContractor(id: string) {
  await requireUser();
  await db.delete(schema.contractors).where(eq(schema.contractors.id, id));
  revalidatePath("/contractors");
}

export async function createPersonnel(input: {
  name: string;
  relation?: string;
  phone?: string;
  email?: string;
  notes?: string;
}) {
  await requireUser();
  const [row] = await db.insert(schema.personnel).values(input).returning();
  revalidatePath("/personnel");
  return row;
}

export async function editPersonnel(
  id: string,
  input: {
    name: string;
    relation?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
  },
) {
  await requireUser();
  await db
    .update(schema.personnel)
    .set({
      name: input.name,
      relation: input.relation ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      notes: input.notes ?? null,
    })
    .where(eq(schema.personnel.id, id));
  revalidatePath("/personnel");
}

export async function deletePersonnel(id: string) {
  await requireUser();
  await db.delete(schema.personnel).where(eq(schema.personnel.id, id));
  revalidatePath("/personnel");
}

export async function createTool(input: { name: string; ownedBy?: string; location?: string; notes?: string }) {
  await requireUser();
  const [row] = await db.insert(schema.tools).values(input).returning();
  revalidatePath("/tools");
  return row;
}

export async function editTool(
  id: string,
  input: { name: string; ownedBy?: string | null; location?: string | null; notes?: string | null },
) {
  await requireUser();
  await db
    .update(schema.tools)
    .set({
      name: input.name,
      ownedBy: input.ownedBy ?? null,
      location: input.location ?? null,
      notes: input.notes ?? null,
    })
    .where(eq(schema.tools.id, id));
  revalidatePath("/tools");
}

export async function deleteTool(id: string) {
  await requireUser();
  await db.delete(schema.tools).where(eq(schema.tools.id, id));
  revalidatePath("/tools");
}

export async function attachContractor(projectId: string, contractorId: string, role?: string) {
  await requireUser();
  await db
    .insert(schema.projectContractors)
    .values({ projectId, contractorId, role: role ?? null })
    .onConflictDoNothing();
  revalidatePath(`/projects/${projectId}`);
}

export async function attachPersonnel(projectId: string, personnelId: string, role?: string) {
  await requireUser();
  await db
    .insert(schema.projectPersonnel)
    .values({ projectId, personnelId, role: role ?? null })
    .onConflictDoNothing();
  revalidatePath(`/projects/${projectId}`);
}

export async function attachTool(projectId: string, toolId: string) {
  await requireUser();
  await db.insert(schema.projectTools).values({ projectId, toolId }).onConflictDoNothing();
  revalidatePath(`/projects/${projectId}`);
}

export async function detachContractor(projectId: string, contractorId: string) {
  await requireUser();
  await db
    .delete(schema.projectContractors)
    .where(
      and(
        eq(schema.projectContractors.projectId, projectId),
        eq(schema.projectContractors.contractorId, contractorId),
      ),
    );
  revalidatePath(`/projects/${projectId}`);
}

export async function detachPersonnel(projectId: string, personnelId: string) {
  await requireUser();
  await db
    .delete(schema.projectPersonnel)
    .where(
      and(
        eq(schema.projectPersonnel.projectId, projectId),
        eq(schema.projectPersonnel.personnelId, personnelId),
      ),
    );
  revalidatePath(`/projects/${projectId}`);
}

export async function detachTool(projectId: string, toolId: string) {
  await requireUser();
  await db
    .delete(schema.projectTools)
    .where(
      and(eq(schema.projectTools.projectId, projectId), eq(schema.projectTools.toolId, toolId)),
    );
  revalidatePath(`/projects/${projectId}`);
}

/* ---------- materials ---------- */

export type OptionInput = {
  label: string;
  vendor?: string | null;
  url?: string | null;
  priceCents?: number | null;
  description?: string | null;
};

export async function addMaterial(input: {
  projectId: string;
  name: string;
  quantity?: string;
  isOpenChoice?: boolean;
  options?: OptionInput[];
}) {
  await requireUser();
  const [m] = await db
    .insert(schema.materials)
    .values({
      projectId: input.projectId,
      name: input.name,
      quantity: input.quantity,
      isOpenChoice: input.isOpenChoice ?? (input.options?.length ?? 0) > 1,
    })
    .returning();
  if (input.options?.length) {
    await db.insert(schema.materialOptions).values(
      input.options.map((o) => ({
        materialId: m.id,
        label: o.label,
        vendor: o.vendor ?? null,
        url: o.url ?? null,
        priceCents: o.priceCents ?? null,
        description: o.description ?? null,
      })),
    );
  }
  revalidatePath(`/projects/${input.projectId}`);
}

export async function editMaterial(id: string, input: { name: string; quantity?: string | null }) {
  await requireUser();
  const [row] = await db
    .update(schema.materials)
    .set({ name: input.name, quantity: input.quantity ?? null })
    .where(eq(schema.materials.id, id))
    .returning();
  if (row) revalidatePath(`/projects/${row.projectId}`);
}

export async function setMaterialPurchased(id: string, purchased: boolean) {
  await requireUser();
  const [row] = await db
    .update(schema.materials)
    .set({ purchased })
    .where(eq(schema.materials.id, id))
    .returning();
  if (row) revalidatePath(`/projects/${row.projectId}`);
}

export async function deleteMaterial(id: string) {
  await requireUser();
  const [row] = await db.delete(schema.materials).where(eq(schema.materials.id, id)).returning();
  if (row) revalidatePath(`/projects/${row.projectId}`);
}

export async function addMaterialOption(materialId: string, opt: OptionInput) {
  await requireUser();
  await db.insert(schema.materialOptions).values({
    materialId,
    label: opt.label,
    vendor: opt.vendor ?? null,
    url: opt.url ?? null,
    priceCents: opt.priceCents ?? null,
    description: opt.description ?? null,
  });
  // Mark as open choice if it now has 2+ options.
  const opts = await db.select().from(schema.materialOptions).where(eq(schema.materialOptions.materialId, materialId));
  await db
    .update(schema.materials)
    .set({ isOpenChoice: opts.length > 1 })
    .where(eq(schema.materials.id, materialId));
  const [m] = await db.select().from(schema.materials).where(eq(schema.materials.id, materialId)).limit(1);
  if (m) revalidatePath(`/projects/${m.projectId}`);
}

export async function editMaterialOption(id: string, opt: OptionInput) {
  await requireUser();
  const [row] = await db
    .update(schema.materialOptions)
    .set({
      label: opt.label,
      vendor: opt.vendor ?? null,
      url: opt.url ?? null,
      priceCents: opt.priceCents ?? null,
      description: opt.description ?? null,
    })
    .where(eq(schema.materialOptions.id, id))
    .returning();
  if (row) {
    const [m] = await db.select().from(schema.materials).where(eq(schema.materials.id, row.materialId)).limit(1);
    if (m) revalidatePath(`/projects/${m.projectId}`);
  }
}

export async function deleteMaterialOption(id: string) {
  await requireUser();
  const [row] = await db.delete(schema.materialOptions).where(eq(schema.materialOptions.id, id)).returning();
  if (row) {
    // If the deleted option was the chosen one, clear the choice.
    await db
      .update(schema.materials)
      .set({ chosenOptionId: null })
      .where(and(eq(schema.materials.id, row.materialId), eq(schema.materials.chosenOptionId, id)));
    const [m] = await db.select().from(schema.materials).where(eq(schema.materials.id, row.materialId)).limit(1);
    if (m) revalidatePath(`/projects/${m.projectId}`);
  }
}

export async function chooseMaterialOption(materialId: string, optionId: string) {
  await requireUser();
  const [row] = await db
    .update(schema.materials)
    .set({ chosenOptionId: optionId })
    .where(eq(schema.materials.id, materialId))
    .returning();
  if (row) revalidatePath(`/projects/${row.projectId}`);
}

/* ---------- invoices & quotes ---------- */

export async function addInvoice(input: {
  taskId: string;
  vendor?: string;
  totalCents: number;
  reference?: string;
  contractorId?: string;
  uploadId?: string;
}) {
  await requireUser();
  await db.insert(schema.invoices).values(input);
  const [t] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, input.taskId)).limit(1);
  if (t) revalidatePath(`/projects/${t.projectId}`);
}

export async function addQuote(input: {
  taskId: string;
  vendor?: string;
  totalCents: number;
  contractorId?: string;
  uploadId?: string;
}) {
  await requireUser();
  await db.insert(schema.quotes).values(input);
  const [t] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, input.taskId)).limit(1);
  if (t) revalidatePath(`/projects/${t.projectId}`);
}

/* ---------- events ---------- */

export async function addEvent(input: {
  projectId: string;
  title: string;
  startsOn: Date;
  durationDays?: number;
  notes?: string;
  links?: { kind: "personnel" | "contractor" | "material"; refId: string }[];
}) {
  await requireUser();
  const days = Math.max(1, Math.round(input.durationDays ?? 1));
  const [e] = await db
    .insert(schema.events)
    .values({
      projectId: input.projectId,
      title: input.title,
      startsOn: input.startsOn,
      durationDays: days,
      notes: input.notes,
    })
    .returning();
  if (input.links?.length) {
    await db.insert(schema.eventLinks).values(
      input.links.map((l) => ({ eventId: e.id, kind: l.kind, refId: l.refId })),
    );
  }
  revalidatePath(`/projects/${input.projectId}`);
  revalidatePath("/calendar");
}

export async function editEvent(
  id: string,
  input: { title: string; startsOn: Date; durationDays: number; notes?: string | null },
) {
  await requireUser();
  const days = Math.max(1, Math.round(input.durationDays));
  const [row] = await db
    .update(schema.events)
    .set({
      title: input.title,
      startsOn: input.startsOn,
      durationDays: days,
      notes: input.notes ?? null,
    })
    .where(eq(schema.events.id, id))
    .returning();
  if (row) {
    revalidatePath(`/projects/${row.projectId}`);
    revalidatePath("/calendar");
  }
}

export async function deleteEvent(id: string) {
  await requireUser();
  const [row] = await db.delete(schema.events).where(eq(schema.events.id, id)).returning();
  if (row) {
    revalidatePath(`/projects/${row.projectId}`);
    revalidatePath("/calendar");
  }
}

/* ---------- uploads / images ---------- */

export async function setUploadProject(uploadId: string, projectId: string | null) {
  await requireUser();
  await db
    .update(schema.uploads)
    .set({ projectId })
    .where(eq(schema.uploads.id, uploadId));
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function setUploadKind(
  uploadId: string,
  kind: "before" | "progress" | "after" | "other",
  caption?: string | null,
) {
  await requireUser();
  const [row] = await db
    .update(schema.uploads)
    .set({ kind, caption: caption ?? null })
    .where(eq(schema.uploads.id, uploadId))
    .returning();
  if (row?.projectId) revalidatePath(`/projects/${row.projectId}`);
}

export async function setUploadAiGenerated(uploadId: string, aiGenerated: boolean) {
  await requireUser();
  const [row] = await db
    .update(schema.uploads)
    .set({ aiGenerated })
    .where(eq(schema.uploads.id, uploadId))
    .returning();
  if (row?.projectId) revalidatePath(`/projects/${row.projectId}`);
}

export async function deleteUpload(uploadId: string) {
  await requireUser();
  const [row] = await db.delete(schema.uploads).where(eq(schema.uploads.id, uploadId)).returning();
  if (row?.projectId) revalidatePath(`/projects/${row.projectId}`);
}

export async function generateAfterImageForProject(input: {
  projectId: string | null;
  prompt: string;
  basedOnUploadId?: string;
}): Promise<{ uploadId: string; url: string } | { error: string }> {
  const user = await requireUser();
  const { generateAfterImage } = await import("@/lib/ai");
  const { uploadBytes, downloadBytes, bucketName, imageUrl } = await import("@/lib/storage");
  const { randomUUID } = await import("node:crypto");

  let beforeImage: { contentType: string; data: Buffer } | undefined;
  if (input.basedOnUploadId) {
    const [up] = await db
      .select()
      .from(schema.uploads)
      .where(eq(schema.uploads.id, input.basedOnUploadId))
      .limit(1);
    if (up) {
      try {
        const data = await downloadBytes(up.objectKey);
        beforeImage = { contentType: up.contentType ?? "image/jpeg", data };
      } catch {
        // ignore — we'll generate from text only
      }
    }
  }

  const generated = await generateAfterImage({ prompt: input.prompt, beforeImage });
  if (!generated) {
    return { error: "Image generation failed. Check the API key and try a different prompt." };
  }

  const ext = generated.contentType.includes("png")
    ? "png"
    : generated.contentType.includes("webp")
      ? "webp"
      : "jpg";
  const objectKey = `${input.projectId ?? "loose"}/ai-after-${randomUUID()}.${ext}`;
  await uploadBytes({ objectKey, contentType: generated.contentType, data: generated.data });

  const [row] = await db
    .insert(schema.uploads)
    .values({
      bucket: bucketName(),
      objectKey,
      contentType: generated.contentType,
      sizeBytes: generated.data.byteLength,
      originalName: "ai-after." + ext,
      projectId: input.projectId,
      kind: "after",
      aiGenerated: true,
      uploadedBy: user.id,
    })
    .returning();

  if (input.projectId) revalidatePath(`/projects/${input.projectId}`);
  return { uploadId: row.id, url: imageUrl(row.objectKey) };
}
