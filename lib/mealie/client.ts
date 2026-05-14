/**
 * Thin Mealie REST client. Configured via env:
 *   MEALIE_BASE_URL  e.g. https://mealie.example.com
 *   MEALIE_API_TOKEN bearer token
 *
 * Only the endpoints we need are wrapped. Unknown response fields are kept as-is.
 */

export type MealieRecipeSummary = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  image?: string | null;
};

export type MealieIngredient = {
  /** Original full-line text, used as a fallback display. */
  display: string;
  food: string | null;
  quantity: number | null;
  unit: string | null;
  note: string | null;
};

export type MealieRecipe = MealieRecipeSummary & {
  ingredients: MealieIngredient[];
};

function baseUrl(): string | null {
  const u = process.env.MEALIE_BASE_URL;
  return u ? u.replace(/\/$/, "") : null;
}

function authHeaders(): Record<string, string> {
  const t = process.env.MEALIE_API_TOKEN;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function imageUrlFor(idOrSlug: string): string {
  // Routed through our own proxy so the browser doesn't need the Mealie token.
  return `/api/mealie/image/${encodeURIComponent(idOrSlug)}`;
}

export function mealieConfigured(): boolean {
  return Boolean(baseUrl() && process.env.MEALIE_API_TOKEN);
}

export function mealieRecipeUrl(slug: string): string {
  const base = baseUrl();
  return base ? `${base}/recipe/${slug}` : "";
}

type MealieRecipeJSON = {
  id?: string;
  slug?: string;
  name?: string;
  description?: string | null;
  image?: string | null;
  recipeIngredient?: Array<{
    display?: string;
    note?: string | null;
    quantity?: number | null;
    food?: { name?: string } | null;
    unit?: { name?: string; abbreviation?: string } | null;
    originalText?: string | null;
  }>;
};

function toSummary(r: MealieRecipeJSON): MealieRecipeSummary | null {
  if (!r?.id || !r?.slug || !r?.name) return null;
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description ?? null,
    image: imageUrlFor(r.id),
  };
}

export async function listAllRecipes(maxPages = 4): Promise<MealieRecipeSummary[]> {
  const out: MealieRecipeSummary[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const items = await searchRecipes("", { page, perPage: 100 });
    if (items.length === 0) break;
    out.push(...items);
    if (items.length < 100) break;
  }
  return out;
}

export async function searchRecipes(
  query: string,
  opts: { page?: number; perPage?: number } = {},
): Promise<MealieRecipeSummary[]> {
  const base = baseUrl();
  if (!base) return [];
  const params = new URLSearchParams({
    page: String(opts.page ?? 1),
    perPage: String(opts.perPage ?? 25),
    orderBy: "name",
    orderDirection: "asc",
  });
  if (query.trim()) params.set("search", query.trim());

  try {
    const res = await fetch(`${base}/api/recipes?${params}`, {
      headers: { Accept: "application/json", ...authHeaders() },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: MealieRecipeJSON[] };
    return (json.items ?? []).map(toSummary).filter((x): x is MealieRecipeSummary => x !== null);
  } catch {
    return [];
  }
}

export async function getRecipe(slugOrId: string): Promise<MealieRecipe | null> {
  const base = baseUrl();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/recipes/${encodeURIComponent(slugOrId)}`, {
      headers: { Accept: "application/json", ...authHeaders() },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const r = (await res.json()) as MealieRecipeJSON;
    const summary = toSummary(r);
    if (!summary) return null;
    const ingredients: MealieIngredient[] = (r.recipeIngredient ?? []).map((i) => ({
      display: i.display ?? i.originalText ?? [i.quantity, i.unit?.abbreviation ?? i.unit?.name, i.food?.name, i.note]
        .filter(Boolean)
        .join(" ")
        .trim(),
      food: i.food?.name ?? null,
      quantity: typeof i.quantity === "number" ? i.quantity : null,
      unit: i.unit?.abbreviation ?? i.unit?.name ?? null,
      note: i.note ?? null,
    }));
    return { ...summary, ingredients };
  } catch {
    return null;
  }
}
