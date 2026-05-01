# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (per README), but `package-lock.json` is checked in — npm works too.

- `pnpm dev` — Next.js dev server
- `pnpm build` / `pnpm start` — production build & serve
- `pnpm lint` — ESLint (`eslint-config-next`)
- `pnpm db:push` — sync Drizzle schema to the DB (no migration files)
- `pnpm db:generate` / `pnpm db:migrate` — versioned migrations via drizzle-kit
- `pnpm db:studio` — Drizzle Studio

There is no test runner configured.

One-off operational scripts live in `scripts/` and are run with `node scripts/<name>.mjs` (e.g. `probe-gcs.mjs`, `set-bucket-cors.mjs`, `list-tables.mjs`, `list-gemini-models.mjs`). They read env from `.env.local`.

## Architecture

Roost is a single-household project tracker built on Next.js 15 App Router (React 19, Server Actions). It is a single deployable; everything talks directly to Postgres via Drizzle.

### Data layer
- `lib/db/schema.ts` is the single source of truth for all tables, enums, and Drizzle relations. The domain centers on `projects`, with `tasks`, `actions` (assignable todos), `events` (all-day, with `durationDays`), `materials` (+ `materialOptions` for "open-choice" items the user is still picking between), `invoices`/`quotes` (always attached to a `task`), and `uploads` (GCS metadata, polymorphic to project or task).
- `projects` ⇄ directories (`contractors`, `personnel`, `tools`) use explicit join tables. `eventLinks` is intentionally polymorphic (`kind` + `refId`, no FK) so events can attach to people/contractors/materials.
- `lib/db/index.ts` caches the `postgres` client on `globalThis.__roostPg` to survive Next.js dev hot-reloads.

### Mutations
- All writes go through Server Actions in `lib/actions.ts` (`"use server"`). Every action calls `requireUser()` (throws if no session) and ends with `revalidatePath(...)`. There is no separate REST layer for CRUD — the API routes only exist for things that can't be Server Actions.

### Auth
- Auth.js v5 (`next-auth@5.0.0-beta`) configured in `lib/auth.ts`. JWT-session strategy, single generic OIDC provider configured purely from env (`OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, optional `OIDC_PROVIDER_NAME`). Works against Authentik, Keycloak, Auth0, Google, etc.
- The `jwt` callback **upserts the user row on first sign-in** and mints a permanent `icsToken` (random 24 bytes hex). `ALLOWED_EMAILS` (CSV) acts as the allowlist; empty = open.
- `middleware.ts` enforces auth globally with a small public-path allowlist (`/signin`, `/api/auth/*`, `/api/calendar.ics`, `/_next`, `/favicon`). It runs on the **Node.js runtime** (`runtime: "nodejs"` — Fluid Compute on Vercel) because Drizzle/postgres-js is not edge-compatible. Do not push DB-touching code into edge routes.

### API routes (`app/api/`)
- `calendar.ics/` — token-authenticated ICS feed (auth via `?token=` matched against `users.icsToken`, not the session). One stable URL per user.
- `upload/` — mints a v4 GCS signed PUT URL and records an `uploads` row. Browsers PUT directly to GCS, then store the returned `uploadId` against an invoice/quote/etc.
- `image/` — serves/proxies stored images.
- `ai/` — Gemini-backed endpoints used by the new-project wizard.
- `auth/` — Auth.js handlers.

### External integrations
- **GCS**: credentials are loaded from a single env var `GCS_CREDENTIALS_JSON`, accepted as either raw service-account JSON or its base64 encoding. No key file on disk. Helper lives in `lib/storage.ts`.
- **Gemini** (`@google/generative-ai`): used in `lib/ai.ts` for the project-create wizard. Opt-in per category — never assume AI suggestions are required for a flow to work.
- **ICS** (`ics` package): generates the calendar feed from `events` rows.

### UI
- App Router pages under `app/`: `projects` (list + `[id]` detail + `new` wizard), `contractors`, `personnel`, `tools`, `materials`, `calendar`, `signin`.
- Shared chrome in `components/` (`sidebar.tsx`, `directory-card.tsx`, `lightbox.tsx`, `logo.tsx`) and primitives in `components/ui/` (Radix-based, styled with Tailwind + `class-variance-authority`).
- Responsive pattern: persistent left sidebar on desktop, bottom tab-bar on mobile. Light/dark follows OS.
- Path alias `@/*` → repo root (see `tsconfig.json`).

## Conventions worth knowing
- Money is stored as integer cents (`*_cents` columns) — never as floats.
- Events are all-day only: `startsOn` + `durationDays`. There is no time-of-day field.
- `materials.isOpenChoice` + `chosenOptionId` is how the UI represents "I'm still deciding between these N products". Don't conflate it with quantity/units.
- Image kinds are constrained by the `image_kind` enum (`before` / `progress` / `after` / `other`); `aiGenerated` flags Gemini-produced "predicted after" shots.
