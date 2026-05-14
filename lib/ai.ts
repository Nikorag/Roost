import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildPromptAdditions } from "@/lib/ai-settings";

export type GeneratedImage = {
  contentType: string;
  data: Buffer;
};

/**
 * Generate an "after" image, optionally conditioned on a "before" photo.
 * Uses Gemini's multimodal image-output model.
 */
export async function generateAfterImage(opts: {
  prompt: string;
  beforeImage?: { contentType: string; data: Buffer };
}): Promise<GeneratedImage | null> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return null;
  const genai = new GoogleGenerativeAI(apiKey);
  // Image-capable Gemini model.
  const model = genai.getGenerativeModel({ model: "gemini-2.5-flash-image" });

  const extra = await buildPromptAdditions("after_image");
  const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [];
  if (opts.beforeImage) {
    parts.push({
      inlineData: {
        mimeType: opts.beforeImage.contentType,
        data: opts.beforeImage.data.toString("base64"),
      },
    });
    parts.push({
      text: `Using the photo above as a reference of the current state, generate a single photorealistic image showing the finished result described below. Keep the same room/space, lighting style and camera angle where possible.\n\nFinished look: ${opts.prompt}${extra}`,
    });
  } else {
    parts.push({ text: `${opts.prompt}${extra}` });
  }

  // The SDK doesn't fully type responseModalities; cast through unknown.
  const config = {
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
  } as unknown as Parameters<typeof model.generateContent>[0];

  try {
    const res = await model.generateContent({
      contents: [{ role: "user", parts }],
      ...(config as object),
    } as Parameters<typeof model.generateContent>[0]);
    const candidates = res.response.candidates ?? [];
    for (const c of candidates) {
      for (const p of c.content?.parts ?? []) {
        const inline = (p as { inlineData?: { mimeType: string; data: string } }).inlineData;
        if (inline?.data) {
          return {
            contentType: inline.mimeType || "image/png",
            data: Buffer.from(inline.data, "base64"),
          };
        }
      }
    }
    return null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[roost] generateAfterImage failed:", err);
    return null;
  }
}

export type ExtractedPurchaseOption = {
  label: string;
  vendor?: string;
  url: string;
  priceCents?: number | null;
  description?: string;
};

export async function extractPurchaseOption(url: string): Promise<ExtractedPurchaseOption | null> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return null;
  let html = "";
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        // Pretend to be a real browser so retailers serve full HTML.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      // 10s soft timeout via AbortSignal.timeout (Node 20+)
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  // Strip script/style and collapse whitespace; cap to ~12k chars to keep prompt tight.
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12_000);
  // Pull a few likely structured-data hints back in.
  const og = Array.from(html.matchAll(/<meta[^>]+property="og:[^"]+"[^>]*>/gi))
    .map((m) => m[0])
    .slice(0, 30)
    .join("\n");
  const ld = Array.from(html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi))
    .map((m) => m[1])
    .slice(0, 3)
    .join("\n")
    .slice(0, 6_000);

  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" },
  });
  const prompt = `Extract a single product purchase option from a retailer page.

URL: ${url}
OpenGraph meta tags:
${og}

JSON-LD blocks:
${ld}

Visible text (truncated):
${text}

Return strict JSON:
{
  "label": string,                 // concise product name
  "vendor": string | null,         // retailer / brand store, e.g. "Wickes", "B&Q", "Amazon"
  "priceCents": number | null,     // integer in pence/cents (price * 100). null if unknown.
  "description": string | null     // 1-2 sentence summary
}
JSON only.${await buildPromptAdditions("purchase_extract")}`;

  try {
    const res = await model.generateContent(prompt);
    const data = JSON.parse(res.response.text()) as Partial<ExtractedPurchaseOption>;
    if (!data.label) return null;
    return {
      label: data.label,
      vendor: data.vendor ?? undefined,
      url,
      priceCents: typeof data.priceCents === "number" ? data.priceCents : null,
      description: data.description ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Suggest a single emoji that best represents a takeaway meal. Falls back to
 * 🥡 if the API isn't configured or the response is unusable.
 */
export async function suggestTakeawayEmoji(input: {
  name: string;
  vendor?: string | null;
  notes?: string | null;
}): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return "🥡";
  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" },
  });
  const extra = await buildPromptAdditions("takeaway_emoji");
  const prompt = `Pick one single emoji that best represents this takeaway meal.
Name: ${input.name}
Vendor: ${input.vendor ?? ""}
Notes: ${input.notes ?? ""}

Rules:
- Return exactly one emoji glyph, never multiple.
- Prefer food/cuisine over packaging. Avoid 🥡 unless it's literally a generic Chinese takeaway in a box.
- Examples: pizza → 🍕, sushi → 🍣, burger → 🍔, kebab → 🥙, curry → 🍛, fish and chips → 🍟, ramen → 🍜, taco → 🌮, fried chicken → 🍗.

Return strict JSON: {"emoji": "<one emoji>"}.${extra}`;
  try {
    const res = await model.generateContent(prompt);
    const json = JSON.parse(res.response.text()) as { emoji?: string };
    const raw = (json.emoji ?? "").trim();
    // Take the first grapheme so multi-emoji answers still produce a single glyph.
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    const first = segmenter.segment(raw)[Symbol.iterator]().next().value as
      | { segment: string }
      | undefined;
    return first?.segment || "🥡";
  } catch {
    return "🥡";
  }
}

/**
 * Generate a photorealistic hero shot of a finished dish. Uses the same Gemini
 * image model as `generateAfterImage` but with a food-photography prompt.
 */
export async function generateRecipeImage(name: string): Promise<GeneratedImage | null> {
  const extra = await buildPromptAdditions("recipe_image");
  const prompt = `A high-quality overhead food photograph of "${name}", plated on a simple ceramic dish on a wooden table, soft natural daylight, shallow depth of field, appetising, magazine-style. No text, no watermarks, no utensils held by hands.${extra}`;
  // Bypass after_image additions by reusing the underlying call without re-adding them.
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return null;
  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({ model: "gemini-2.5-flash-image" });
  const config = {
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
  } as unknown as Parameters<typeof model.generateContent>[0];
  try {
    const res = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      ...(config as object),
    } as Parameters<typeof model.generateContent>[0]);
    for (const c of res.response.candidates ?? []) {
      for (const p of c.content?.parts ?? []) {
        const inline = (p as { inlineData?: { mimeType: string; data: string } }).inlineData;
        if (inline?.data) {
          return {
            contentType: inline.mimeType || "image/png",
            data: Buffer.from(inline.data, "base64"),
          };
        }
      }
    }
    return null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[roost] generateRecipeImage failed:", err);
    return null;
  }
}

/**
 * Suggest ingredients for a recipe by name. Returns one ingredient per string,
 * each ready to be displayed as-is (e.g. "500g minced beef", "2 cloves garlic").
 */
export async function suggestRecipeIngredients(name: string): Promise<string[]> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return [];
  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" },
  });
  const extra = await buildPromptAdditions("recipe_ingredients");
  const prompt = `Suggest the ingredients for a typical home-cooked "${name}" for 4 people.

Rules:
- Return strict JSON: {"ingredients": string[]}.
- Each entry is one ingredient line, ready to display, e.g. "500g minced beef",
  "2 cloves garlic, finely chopped", "1 tbsp olive oil".
- Prefer metric units. Be specific with quantities.
- 6-16 entries. No headings, no instructions, no method, no steps.
- Don't include water, salt, or pepper unless distinctive to the dish.${extra}`;
  try {
    const res = await model.generateContent(prompt);
    const json = JSON.parse(res.response.text()) as { ingredients?: unknown };
    const arr = Array.isArray(json.ingredients) ? json.ingredients : [];
    return arr
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 24);
  } catch {
    return [];
  }
}

export type WizardSuggestion = {
  tasks: { title: string; description?: string }[];
  contractors: { trade: string; reason: string }[];
  personnel: { role: string; reason: string }[];
  materials: { name: string; quantity?: string; options?: string[] }[];
  tools: { name: string; reason?: string }[];
};

const fallback: WizardSuggestion = {
  tasks: [],
  contractors: [],
  personnel: [],
  materials: [],
  tools: [],
};

export async function suggestForProject(input: {
  title: string;
  description?: string;
  knownContractors: { name: string; trade?: string | null }[];
  knownPersonnel: { name: string; relation?: string | null }[];
  knownTools: { name: string }[];
}): Promise<WizardSuggestion> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return fallback;
  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" },
  });

  const prompt = `You are helping plan a household project for a single household.
Project title: ${input.title}
Project description: ${input.description ?? "(none)"}

The household has the following directories already (prefer reusing them):
- Contractors: ${JSON.stringify(input.knownContractors)}
- Personnel (friends & family): ${JSON.stringify(input.knownPersonnel)}
- Tools: ${JSON.stringify(input.knownTools)}

Return a strict JSON object with this shape:
{
  "tasks": [{"title": string, "description"?: string}],
  "contractors": [{"trade": string, "reason": string}],
  "personnel": [{"role": string, "reason": string}],
  "materials": [{"name": string, "quantity"?: string, "options"?: string[]}],
  "tools": [{"name": string, "reason"?: string}]
}

Guidelines:
- Tasks: 4-8 concrete subtasks in execution order.
- Contractors: only include trades genuinely needed (e.g. electrician, plumber).
- Personnel: roles you might ask friends/family to help with (e.g. "extra pair of hands for plasterboard").
- Materials: practical shopping list. Where the user has a choice (e.g. paint colour, tile finish), include 2-4 sensible options.
- Tools: physical tools needed; prefer those already in the directory.
Output JSON only.${await buildPromptAdditions("project_wizard")}`;

  try {
    const res = await model.generateContent(prompt);
    const text = res.response.text();
    const parsed = JSON.parse(text) as Partial<WizardSuggestion>;
    return {
      tasks: parsed.tasks ?? [],
      contractors: parsed.contractors ?? [],
      personnel: parsed.personnel ?? [],
      materials: parsed.materials ?? [],
      tools: parsed.tools ?? [],
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[roost] Gemini suggestion failed:", err);
    return fallback;
  }
}
