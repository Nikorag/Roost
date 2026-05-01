"use server";

import { db, schema } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { generateAfterImageForProject } from "@/lib/actions";

export type WizardPayload = {
  title: string;
  description?: string;
  budgetCents?: number | null;
  targetDate?: string | null;
  tasks: { title: string; description?: string }[];
  materials: { name: string; quantity?: string; options?: string[] }[];
  contractorIds: string[];
  personnelIds: string[];
  toolIds: string[];
  beforeUploadId?: string;
  afterUploadId?: string;
};

export async function generateWizardAfterImage(input: {
  prompt: string;
  basedOnUploadId?: string;
}) {
  return generateAfterImageForProject({
    projectId: null,
    prompt: input.prompt,
    basedOnUploadId: input.basedOnUploadId,
  });
}

export async function createProjectFromWizard(input: WizardPayload) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const [project] = await db
    .insert(schema.projects)
    .values({
      title: input.title,
      description: input.description ?? null,
      status: "planning",
      budgetCents: input.budgetCents ?? null,
      targetDate: input.targetDate ? new Date(input.targetDate) : null,
      createdBy: session.user.id,
    })
    .returning();

  if (input.tasks.length) {
    await db.insert(schema.tasks).values(
      input.tasks.map((t, i) => ({
        projectId: project.id,
        title: t.title,
        description: t.description ?? null,
        position: i,
      })),
    );
  }

  for (const m of input.materials) {
    const [material] = await db
      .insert(schema.materials)
      .values({
        projectId: project.id,
        name: m.name,
        quantity: m.quantity ?? null,
        isOpenChoice: (m.options?.length ?? 0) > 1,
      })
      .returning();
    if (m.options?.length) {
      await db.insert(schema.materialOptions).values(
        m.options.map((label) => ({ materialId: material.id, label })),
      );
    }
  }

  if (input.contractorIds.length) {
    await db
      .insert(schema.projectContractors)
      .values(input.contractorIds.map((cid) => ({ projectId: project.id, contractorId: cid })))
      .onConflictDoNothing();
  }
  if (input.personnelIds.length) {
    await db
      .insert(schema.projectPersonnel)
      .values(input.personnelIds.map((pid) => ({ projectId: project.id, personnelId: pid })))
      .onConflictDoNothing();
  }
  if (input.toolIds.length) {
    await db
      .insert(schema.projectTools)
      .values(input.toolIds.map((tid) => ({ projectId: project.id, toolId: tid })))
      .onConflictDoNothing();
  }

  const uploadIds = [input.beforeUploadId, input.afterUploadId].filter(
    (x): x is string => Boolean(x),
  );
  if (uploadIds.length) {
    await db
      .update(schema.uploads)
      .set({ projectId: project.id })
      .where(inArray(schema.uploads.id, uploadIds));
  }

  revalidatePath("/projects");
  return { id: project.id };
}
