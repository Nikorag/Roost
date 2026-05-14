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
  tags?: string[];
};

/**
 * Tag name (case-insensitive) that excludes a recipe from automatic weekly
 * plan suggestions. Configurable via env, defaults to "no-plan".
 */
export function excludeTagName(): string {
  return (process.env.MEALIE_EXCLUDE_TAG ?? "no-plan").toLowerCase();
}

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
  tags?: Array<{ name?: string; slug?: string }>;
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
    tags: (r.tags ?? []).map((t) => (t.name ?? t.slug ?? "").toLowerCase()).filter(Boolean),
  };
}

export async function listPlannableRecipes(): Promise<MealieRecipeSummary[]> {
  const tag = excludeTagName();
  const all = await listAllRecipes();
  return all.filter((r) => !(r.tags ?? []).includes(tag));
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

export async function createRecipe(input: {
  name: string;
  ingredients: string[];
  description?: string;
}): Promise<{ slug: string; id: string } | null> {
  const base = baseUrl();
  if (!base || !process.env.MEALIE_API_TOKEN) return null;

  // Step 1: create a recipe stub. Mealie POST /api/recipes accepts { name }
  // and returns either the new slug as a JSON string or an object with `slug`.
  let slug: string | undefined;
  try {
    const res = await fetch(`${base}/api/recipes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({ name: input.name }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const data = (await res.json()) as unknown;
      if (typeof data === "string") slug = data;
      else if (data && typeof data === "object") {
        const o = data as { slug?: string; recipe?: { slug?: string } };
        slug = o.slug ?? o.recipe?.slug;
      }
    } else {
      slug = (await res.text()).replace(/^"|"$/g, "");
    }
  } catch {
    return null;
  }
  if (!slug) return null;

  // Step 2: fetch the freshly-created recipe so we can PATCH it back complete.
  const fetched = await fetch(`${base}/api/recipes/${encodeURIComponent(slug)}`, {
    headers: { Accept: "application/json", ...authHeaders() },
    signal: AbortSignal.timeout(10_000),
  });
  if (!fetched.ok) return null;
  const recipe = (await fetched.json()) as Record<string, unknown> & {
    id?: string;
    slug?: string;
  };

  // Step 3: PUT with ingredients filled in. We use the `note` field which
  // Mealie shows verbatim, so unstructured AI output renders correctly without
  // needing Food/Unit rows to exist.
  const body = {
    ...recipe,
    description: input.description ?? recipe.description ?? "",
    recipeIngredient: input.ingredients.map((text) => ({
      note: text,
      display: text,
      originalText: text,
      quantity: null,
      unit: null,
      food: null,
      isFood: false,
    })),
  };
  try {
    const put = await fetch(`${base}/api/recipes/${encodeURIComponent(slug)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!put.ok) return null;
  } catch {
    return null;
  }
  return { slug, id: (recipe.id as string) ?? slug };
}

export async function uploadRecipeImage(
  slug: string,
  image: { contentType: string; data: Buffer },
): Promise<boolean> {
  const base = baseUrl();
  if (!base || !process.env.MEALIE_API_TOKEN) return false;
  const ext = image.contentType.includes("png")
    ? "png"
    : image.contentType.includes("webp")
      ? "webp"
      : "jpg";
  const form = new FormData();
  // `Blob` works as a File in Node 20+ for multipart fetch bodies.
  form.append("image", new Blob([image.data as unknown as ArrayBuffer], { type: image.contentType }), `recipe.${ext}`);
  form.append("extension", ext);
  try {
    const res = await fetch(`${base}/api/recipes/${encodeURIComponent(slug)}/image`, {
      method: "PUT",
      headers: { ...authHeaders() },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    return res.ok;
  } catch {
    return false;
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
