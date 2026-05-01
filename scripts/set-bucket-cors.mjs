import { readFileSync } from "node:fs";
import { Storage } from "@google-cloud/storage";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const raw = env.GCS_CREDENTIALS_JSON.trim();
const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
const credentials = JSON.parse(text);
const storage = new Storage({ credentials, projectId: credentials.project_id });

const ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://192.168.1.39:3000",
  "https://*.vercel.app",
  ...(env.APP_URL ? [env.APP_URL] : []),
];

const cors = [
  {
    origin: ORIGINS,
    method: ["PUT", "GET", "HEAD", "OPTIONS"],
    responseHeader: ["Content-Type", "x-goog-content-length-range", "x-goog-resumable"],
    maxAgeSeconds: 3600,
  },
];

console.log(`Setting CORS on gs://${env.GCS_BUCKET}…`);
console.log("origins:", ORIGINS);
await storage.bucket(env.GCS_BUCKET).setCorsConfiguration(cors);

const [meta] = await storage.bucket(env.GCS_BUCKET).getMetadata();
console.log("\nBucket CORS now:");
console.dir(meta.cors, { depth: null });
