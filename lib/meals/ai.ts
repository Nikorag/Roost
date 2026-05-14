import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildPromptAdditions } from "@/lib/ai-settings";

export type ChatMessage = { role: "user" | "model"; text: string };

export type SuggestionContext = {
  recentMeals: { name: string; date: string; source: string }[];
  plannedThisWeek: { name: string; date: string }[];
  pantry: { displayName: string; quantity: string | null; unit: string | null }[];
  takeawayCountLast14d: number;
  mealieLibrary: { name: string; description: string | null }[];
  takeawayLibrary: { name: string; vendor: string | null }[];
  calendarEvents?: { date: string; summary: string; time?: string; allDay: boolean }[];
};

const SYSTEM_PROMPT = `You are a warm, practical household meal-planning helper.
You help one family decide what to eat tonight when no meal is planned.

# HARD RULE — read carefully
You may ONLY suggest meals that appear in the household's library:
- Recipes from the "Mealie recipe library" list below, OR
- Items from the "Takeaway library" list below.

Do not invent, generalise, or recommend any meal not in those two lists.
If neither list contains anything suitable, say so honestly and ask the user
to add something, rather than guessing.

# Style
- Use Markdown (bold, lists). Keep replies short and conversational.
- Ask AT MOST one clarifying follow-up at a time (quick vs slow, hungry level,
  comfort vs healthy, effort). Stop asking after two follow-ups.
- When you commit, give 2–3 concrete picks from the library. Format like:
  - **<exact name from library>** — <one-line why it fits>

# Preferences
- Use the recent-meals list as context for variety, but DON'T rule meals out
  just because they were eaten recently. If something still fits, suggest it.
- Favour recipes whose typical ingredients overlap with the pantry list.
- If they've ordered a lot of takeaways recently, gently lean toward cooking.
- Mark takeaway picks with 🥡 and recipes with 🍲 so they're easy to spot.
- If the family calendar shows busy/late events tonight (or on the day in
  question), lean toward quick or prep-ahead meals. Mention the calendar event
  briefly in your reasoning ("you've got football at 6, so…").`;

function fmtContext(ctx: SuggestionContext): string {
  const lines: string[] = [];
  lines.push("# Household context");
  lines.push(
    `## Mealie recipe library (${ctx.mealieLibrary.length} items) — you MAY suggest these:`,
  );
  if (ctx.mealieLibrary.length === 0) {
    lines.push("(empty — no Mealie recipes available)");
  } else {
    for (const r of ctx.mealieLibrary) {
      lines.push(`- ${r.name}${r.description ? ` — ${r.description.slice(0, 120)}` : ""}`);
    }
  }
  lines.push("");
  lines.push(`## Takeaway library (${ctx.takeawayLibrary.length} items) — you MAY suggest these:`);
  if (ctx.takeawayLibrary.length === 0) {
    lines.push("(empty — no takeaways saved)");
  } else {
    for (const t of ctx.takeawayLibrary) {
      lines.push(`- ${t.name}${t.vendor ? ` (${t.vendor})` : ""}`);
    }
  }
  lines.push("");
  lines.push("## Recently eaten (last 14d)");
  lines.push(
    ctx.recentMeals.length
      ? ctx.recentMeals.map((m) => `- ${m.date} ${m.name} (${m.source})`).join("\n")
      : "(none recorded)",
  );
  lines.push("");
  lines.push("## Already planned this week");
  lines.push(
    ctx.plannedThisWeek.length
      ? ctx.plannedThisWeek.map((m) => `- ${m.date} ${m.name}`).join("\n")
      : "(nothing planned yet)",
  );
  lines.push("");
  lines.push("## Pantry on hand");
  lines.push(
    ctx.pantry.length
      ? ctx.pantry
          .map((p) => `- ${p.displayName}${p.quantity ? ` (${p.quantity}${p.unit ?? ""})` : ""}`)
          .join("\n")
      : "(empty / unknown)",
  );
  lines.push("");
  lines.push(`## Takeaways ordered in last 14d: ${ctx.takeawayCountLast14d}`);
  if (ctx.calendarEvents && ctx.calendarEvents.length) {
    lines.push("");
    lines.push("## Family calendar (next 7 days)");
    for (const e of ctx.calendarEvents) {
      const when = e.allDay ? "all-day" : e.time ?? "";
      lines.push(`- ${e.date}${when ? ` ${when}` : ""}: ${e.summary}`);
    }
  }
  return lines.join("\n");
}

export async function streamMealSuggestion(
  messages: ChatMessage[],
  ctx: SuggestionContext,
): Promise<ReadableStream<Uint8Array> | null> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return null;

  const extra = await buildPromptAdditions("meal_chat");
  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_PROMPT + extra,
  });

  const contents = [
    { role: "user" as const, parts: [{ text: fmtContext(ctx) }] },
    {
      role: "model" as const,
      parts: [
        {
          text:
            "Got it — I'll only pick from your Mealie recipes and takeaway library. What are you in the mood for tonight?",
        },
      ],
    },
    ...messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
  ];

  const encoder = new TextEncoder();
  try {
    const result = await model.generateContentStream({ contents });
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) controller.enqueue(encoder.encode(text));
          }
        } catch (err) {
          controller.enqueue(encoder.encode(`\n[error: ${(err as Error).message}]`));
        } finally {
          controller.close();
        }
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[roost] streamMealSuggestion failed:", err);
    return null;
  }
}
