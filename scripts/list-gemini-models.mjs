import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const key = env.GOOGLE_GENERATIVE_AI_API_KEY;
const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=200`,
);
const data = await res.json();
const models = data.models ?? [];

console.log(`${models.length} models. Image-capable:`);
for (const m of models) {
  const name = m.name?.replace(/^models\//, "");
  if (
    /image|vision|imagen/i.test(name) ||
    (m.supportedGenerationMethods ?? []).includes("predict")
  ) {
    console.log(`  ${name}`);
    console.log(`    methods: ${(m.supportedGenerationMethods ?? []).join(", ")}`);
  }
}

console.log("\nAll model names:");
for (const m of models) console.log("  " + m.name?.replace(/^models\//, ""));
