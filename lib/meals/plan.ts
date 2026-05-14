import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildPromptAdditions } from "@/lib/ai-settings";

export type PlanCandidate = {
  kind: "mealie" | "takeaway";
  id: string;
  name: string;
};

export type PlanPick = {
  /** ISO date YYYY-MM-DD */
  date: string;
  kind: "mealie" | "takeaway" | "skip";
  /** Mealie recipe id or takeaway uuid. Omitted when kind=skip. */
  id?: string;
  name?: string;
  reason?: string;
};

export type PlanContext = {
  weekDates: string[]; // 7 ISO dates
  alreadyPlanned: { date: string; name: string }[];
  recentMeals: { date: string; name: string }[];
  pantry: string[];
  takeawayCountLast14d: number;
  mealieCandidates: PlanCandidate[];
  takeawayCandidates: PlanCandidate[];
};

const SYSTEM = `You build a weekly dinner plan for one household.

# HARD RULES
- For each day, pick EXACTLY ONE meal from the candidate lists below, OR skip the day.
- Use the exact \`id\` from the candidates — never invent ids or names.
- Never repeat a meal within the week you're planning.
- The "recent meals" list is informational only — use it for variety but don't
  strictly rule those meals out. If something still fits, it's fine to repeat.

# Preferences
- Mix cuisines and effort levels across the week.
- Lean on pantry ingredients where it overlaps with a candidate's typical recipe.
- If they've ordered lots of takeaways recently, prefer cooking; otherwise 1 takeaway/week is fine.
- Days already planned should be returned as-is with kind="skip" (don't overwrite).

# Output
Return strict JSON only, matching:
{
  "picks": [
    { "date": "YYYY-MM-DD", "kind": "mealie"|"takeaway"|"skip", "id": "<id>"|null, "reason": "<short why>" }
  ]
}
One pick per date in weekDates, in order.`;

export async function suggestWeeklyPlan(ctx: PlanContext): Promise<PlanPick[]> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return [];
  const extra = await buildPromptAdditions("weekly_plan");
  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM + extra,
    generationConfig: { responseMimeType: "application/json" },
  });

  const prompt = `Week dates: ${ctx.weekDates.join(", ")}

Already planned (leave alone, kind="skip"):
${ctx.alreadyPlanned.map((p) => `- ${p.date}: ${p.name}`).join("\n") || "(none)"}

Recent meals (last 14d):
${ctx.recentMeals.map((m) => `- ${m.date}: ${m.name}`).join("\n") || "(none)"}

Pantry on hand:
${ctx.pantry.length ? ctx.pantry.map((p) => `- ${p}`).join("\n") : "(empty)"}

Takeaways in last 14d: ${ctx.takeawayCountLast14d}

# Mealie candidates (id — name)
${ctx.mealieCandidates.map((c) => `${c.id} — ${c.name}`).join("\n") || "(none)"}

# Takeaway candidates (id — name)
${ctx.takeawayCandidates.map((c) => `${c.id} — ${c.name}`).join("\n") || "(none)"}`;

  try {
    const res = await model.generateContent(prompt);
    const json = JSON.parse(res.response.text()) as { picks?: PlanPick[] };
    const picks = Array.isArray(json.picks) ? json.picks : [];
    // Validate ids match a candidate; coerce mismatches to "skip".
    const mealieIds = new Set(ctx.mealieCandidates.map((c) => c.id));
    const takeawayIds = new Set(ctx.takeawayCandidates.map((c) => c.id));
    return ctx.weekDates.map((date) => {
      const p = picks.find((x) => x.date === date);
      if (!p) return { date, kind: "skip" as const };
      if (p.kind === "mealie" && p.id && mealieIds.has(p.id)) {
        const cand = ctx.mealieCandidates.find((c) => c.id === p.id);
        return { date, kind: "mealie" as const, id: p.id, name: cand?.name, reason: p.reason };
      }
      if (p.kind === "takeaway" && p.id && takeawayIds.has(p.id)) {
        const cand = ctx.takeawayCandidates.find((c) => c.id === p.id);
        return { date, kind: "takeaway" as const, id: p.id, name: cand?.name, reason: p.reason };
      }
      return { date, kind: "skip" as const, reason: p.reason };
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[roost] suggestWeeklyPlan failed:", err);
    return [];
  }
}
