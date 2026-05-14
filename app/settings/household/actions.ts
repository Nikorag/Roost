"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { setSetting, SETTING_KEYS } from "@/lib/app-settings";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user;
}

export async function saveHouseholdProfile(text: string) {
  await requireUser();
  await setSetting(SETTING_KEYS.householdProfile, text);
  revalidatePath("/settings/household");
}
