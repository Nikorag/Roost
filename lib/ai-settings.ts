import { db, schema } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";

/**
 * Every AI call site has an entry here. The `key` is stored in the DB and used
 * to look up user-supplied additions that get appended to the prompt.
 * Add a new one whenever you add a new AI feature.
 */
export const AI_PROMPT_KEYS = [
  {
    key: "global",
    label: "Global (added to every AI call)",
    description:
      "Universal preferences applied to ALL AI features. E.g. dietary restrictions, family size, allergies.",
  },
  {
    key: "meal_chat",
    label: "Tonight's meal assistant",
    description: "The chat that asks 'what should we eat tonight?' on the Meals home.",
  },
  {
    key: "weekly_plan",
    label: "Weekly plan suggester",
    description: "Builds a full week of dinners on the week view.",
  },
  {
    key: "recipe_ingredients",
    label: "Recipe ingredient suggestions",
    description: "Used when you click 'Suggest ingredients' for a new Mealie recipe.",
  },
  {
    key: "recipe_image",
    label: "Recipe hero image",
    description: "Generates the food photo when a new recipe is saved to Mealie.",
  },
  {
    key: "takeaway_emoji",
    label: "Takeaway emoji picker",
    description: "Picks an emoji when you save a takeaway.",
  },
  {
    key: "project_wizard",
    label: "Project wizard",
    description: "Suggests tasks/materials/etc when creating a household project.",
  },
  {
    key: "purchase_extract",
    label: "Product extractor",
    description: "Reads a retailer page and pulls out a material option.",
  },
  {
    key: "after_image",
    label: "Project 'predicted after' image",
    description: "Generates the AI-after photo for a project.",
  },
] as const;

export type AiPromptKey = (typeof AI_PROMPT_KEYS)[number]["key"];

export async function getPromptAddition(key: AiPromptKey): Promise<string> {
  try {
    const [row] = await db
      .select()
      .from(schema.aiPromptSettings)
      .where(eq(schema.aiPromptSettings.key, key))
      .limit(1);
    return row?.instructions?.trim() ?? "";
  } catch {
    // Table may not exist yet pre-migration; degrade silently.
    return "";
  }
}

/**
 * Build the markdown block to append to a prompt. Combines the user's global
 * instructions with the per-key instructions. Returns "" if nothing is set so
 * callers can concatenate unconditionally.
 */
export async function buildPromptAdditions(key: AiPromptKey): Promise<string> {
  try {
    const rows = await db
      .select()
      .from(schema.aiPromptSettings)
      .where(inArray(schema.aiPromptSettings.key, ["global", key]));
    const byKey = new Map(rows.map((r) => [r.key, (r.instructions ?? "").trim()]));
    const parts: string[] = [];
    const g = byKey.get("global");
    if (g) parts.push(g);
    const s = byKey.get(key);
    if (s) parts.push(s);
    if (parts.length === 0) return "";
    return `\n\n# Household preferences (user-defined)\n${parts.join("\n\n")}`;
  } catch {
    return "";
  }
}

export async function getAllPromptAdditions(): Promise<Record<string, string>> {
  try {
    const rows = await db.select().from(schema.aiPromptSettings);
    return Object.fromEntries(rows.map((r) => [r.key, r.instructions ?? ""]));
  } catch {
    return {};
  }
}
