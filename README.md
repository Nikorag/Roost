# Roost

Single-household project tracker. Plan everything from "repaint the lounge" to a loft conversion in one place.

## Stack

- **Next.js 15** (App Router, React 19, Server Actions)
- **Postgres** via Drizzle ORM (Neon, Supabase, or local — anything `postgres://`)
- **Auth.js v5** with a generic OIDC provider (Authentik, Keycloak, Auth0, Google, etc.)
- **Google Cloud Storage** for image and document uploads
- **Google Generative AI (Gemini)** for the new-project wizard
- **ICS feed** so the household calendar syncs into Apple/Google/Outlook

## What's in here

- Filterable project list with status pills
- Per-project detail: subtasks, actions, materials with open-choice options, events, invoices, quotes, total spend
- Contractors, people (friends & family), tools directories — all attachable to projects
- Project-create wizard with optional Gemini suggestions, opt-in for every category
- Live ICS feed at `/api/calendar.ics?token=…` (one stable token per user)
- Responsive UI: persistent left nav on desktop, bottom tab-bar app feel on mobile, pastel highlights, rounded everything
- Light & dark mode follows the OS

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in DATABASE_URL, OIDC_*, GCS_*, GOOGLE_GENERATIVE_AI_API_KEY
openssl rand -base64 32      # → AUTH_SECRET
pnpm db:push                 # create the schema
pnpm dev
```

The first user to sign in is auto-provisioned. Set `ALLOWED_EMAILS` to lock the app down to just your household.

## Calendar feed

Each user gets a personal ICS URL on their `/calendar` page. Subscribe to it from your calendar app — it auto-refreshes.

## Uploads

The `/api/upload` route mints a v4 signed URL for direct browser → GCS uploads, then records metadata in Postgres. Wire your `<input type="file">` to POST `{ filename, contentType }`, PUT the file to the returned `uploadUrl`, then store the `uploadId` against an invoice/quote.

GCS credentials are supplied entirely through `GCS_CREDENTIALS_JSON` — paste the whole service-account JSON in. The helper accepts either raw JSON or its base64 encoding, so you don't need a key file on disk. Quick base64:

```bash
base64 -w0 sa.json   # Linux
base64 -i sa.json    # macOS
```

## Production

Designed for Vercel. Add the env vars, link a Postgres provider from the Marketplace, and deploy. The middleware uses Fluid Compute (Node.js); no edge-runtime constraints.
