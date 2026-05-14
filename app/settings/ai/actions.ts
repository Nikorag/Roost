"use server";

import { db, schema } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user;
}

export async function savePromptAddition(key: string, instructions: string) {
  await requireUser();
  await db
    .insert(schema.aiPromptSettings)
    .values({ key, instructions, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.aiPromptSettings.key,
      set: { instructions, updatedAt: new Date() },
    });
  revalidatePath("/settings/ai");
}
