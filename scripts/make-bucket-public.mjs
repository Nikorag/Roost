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

const bucket = storage.bucket(env.GCS_BUCKET);

console.log(`Granting allUsers:objectViewer on gs://${env.GCS_BUCKET}…`);
await bucket.iam.setPolicy(await mergedPolicy(bucket));

const [policy] = await bucket.iam.getPolicy({ requestedPolicyVersion: 3 });
const viewerBinding = policy.bindings?.find((b) => b.role === "roles/storage.objectViewer");
console.log("\nobjectViewer members:", viewerBinding?.members ?? []);

async function mergedPolicy(b) {
  const [current] = await b.iam.getPolicy({ requestedPolicyVersion: 3 });
  const bindings = current.bindings ?? [];
  const existing = bindings.find((bind) => bind.role === "roles/storage.objectViewer");
  if (existing) {
    if (!existing.members.includes("allUsers")) existing.members.push("allUsers");
  } else {
    bindings.push({ role: "roles/storage.objectViewer", members: ["allUsers"] });
  }
  return { ...current, bindings };
}
