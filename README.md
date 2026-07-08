# Lumen — a Contentful content platform

Not just a blog: a **public site + the editorial tooling and automation around it**, built the way a real Contentful-backed product is. A typed Next.js frontend, a consolidated **Contentful App Framework** app for the editors, **webhook** automation, a **scheduled content audit**, and **content-model migrations** — all running on free infrastructure (Vercel + GitHub Actions + Contentful Hosting), no cloud billing account required.

> **Live demo:** _add your Vercel URL here_
> **Status:** demo / portfolio project

![Home page screenshot](./public/screenshot-home.png)
<!-- Add screenshots to /public and update these paths -->

---

## Why this exists

Most of my recent production work — a Contentful media platform with a dozen custom apps, webhooks, schedulers and migration pipelines — is under NDA. This is a public, self-contained reproduction of the same *shape* of system, scaled to a personal Contentful space and free hosting:

- the original deploys its apps and backends on **GCP** (Cloud Build, Cloud Run, Cloud Scheduler, Secret Manager). This project does the equivalent on **Vercel + GitHub Actions + Contentful Hosting** — see the mapping below.
- the original ships ~12 separate field/sidebar apps. This project consolidates the same patterns into **one multi-location App Framework app**, which is the more maintainable approach anyway.

---

## What's in here

| Layer | What it does | Where |
| --- | --- | --- |
| **Public site** | Typed Next.js App Router site — listing, post pages, ISR, SEO, related posts, reading-time & sponsored badges | `src/` |
| **Editorial Toolkit** (Contentful App) | One App Framework bundle: slug editor, reading-time display, sponsor validation, related-content picker, and a Content-QA page | `apps/editorial-toolkit/` |
| **Rich Text Editor** (Contentful App) | A custom PlateJS editor replacing the native Rich Text UI, with a round-trip-tested Contentful Rich Text transform | `apps/rich-text-editor/` |
| **Webhooks** | Serverless route handlers: recompute reading time on publish, on-demand ISR revalidation | `src/app/api/` |
| **Scheduled job** | CMA content audit (stale drafts, missing reading time, duplicate slugs) | `integrations/scheduled-jobs/` |
| **Content model** | Migrations + a field-assignment script (content-model as code) | `content-model/` |
| **CI/CD** | Lint·typecheck·build, app-bundle deploy, scheduled audit | `.github/workflows/` |

---

## Replacing GCP with free infrastructure

The source platform runs on Google Cloud. None of it needs a billing account here:

| Source (GCP) | Purpose | Used here instead |
| --- | --- | --- |
| Cloud Build | CI; build + upload app bundles | **GitHub Actions** (`deploy-toolkit.yml`, `deploy-rich-text-editor.yml`) |
| Cloud Run | Always-on Express webhook/backends | **Next.js Route Handlers on Vercel** (`src/app/api/**`) |
| Cloud Scheduler | Cron triggers for batch jobs | **GitHub Actions `schedule:` cron** (`scheduled-content-audit.yml`) |
| Secret Manager | CMA tokens, API keys | **GitHub / Vercel encrypted env vars** |
| Artifact Registry | Docker images | Not needed — serverless, no containers |
| App bundle hosting | Serving the built apps | **Contentful Hosting** (`contentful-app-scripts upload`) |

The neat part: on Vercel, the original "Express service on Cloud Run" collapses into a serverless function *inside the same Next.js app* — one deploy, one set of env vars.

---

## Architecture decisions

**Typed CMS layer with view-model mapping.** Components never touch raw Contentful entries. `src/lib/contentful.ts` fetches typed entries (`src/lib/types.ts`) and maps them into flat view models (`PostSummary`, `PostDetail`). Change the content model and only the mapper changes — not every component.

**One app, many locations.** `apps/editorial-toolkit` is a single App Framework bundle that routes on `sdk.location` (and, for fields, on a `tool` instance parameter). Five editor tools, one build, one bundle on Contentful Hosting. See [`apps/editorial-toolkit/README.md`](apps/editorial-toolkit/README.md).

**Reading time computed once, displayed live.** The field widget shows a live estimate as you type; the **webhook** writes the authoritative value on publish. Both share one formula (`max(1, round(words / 200))`, body text only) so the preview never disagrees with the saved value.

**Cross-field rules live in the app.** Contentful can't express "sponsor name is required iff isSponsored" — so the Sponsored field widget enforces it and clears the value when the article is un-sponsored.

**ISR, instant when it matters.** Pages are statically generated and revalidate hourly; the `/api/revalidate` webhook makes publish-to-live near-instant without a redeploy.

**Resilient by default.** Missing credentials degrade to empty states, so `npm run build` works on a fresh clone with no Contentful setup.

---

## Content model (Contentful)

**`blogPost`**

| Field | ID | Type | Notes |
| --- | --- | --- | --- |
| Title | `title` | Short text | |
| Slug | `slug` | Short text (unique) | Editor = Toolkit (auto from title) |
| Excerpt | `excerpt` | Short text | |
| Body | `body` | Rich text | |
| Cover image | `coverImage` | Media (one asset) | |
| Published date | `publishedDate` | Date & time | |
| Estimated reading time | `estimatedReadingTime` | Integer | Disabled; set by app/webhook |
| Tags | `tags` | Short text, list | |
| Sponsored article | `isSponsored` | Boolean | Gates `sponsorName` |
| Sponsor name | `sponsorName` | Short text | Editor = Toolkit |
| Related posts | `relatedPosts` | Reference, many → `blogPost` | Editor = Toolkit |
| Author | `author` | Reference → `author` | |

**`author`** — `name` (Short text), `title` (Short text), `avatar` (Media).

You don't create any of this by hand — it's content-model-as-code:

```bash
npm run bootstrap   # creates the base types (author + blogPost)  → 000-create-content-types.cjs
npm run migrate     # adds the editorial fields                   → 001-add-editorial-fields.cjs
```

---

## Setup, end to end

> 📋 **Full step-by-step runbook — including accounts, the two Contentful apps,
> webhooks, the scheduled audit and the Portfolio Hub — is in [SETUP.md](SETUP.md).**
> The summary below is the site + content-model essentials.

### 1. The site

```bash
npm install
cp .env.example .env.local      # fill in your Contentful values
npm run dev
```

`.env.local` (see `.env.example` for the full annotated list):

```
CONTENTFUL_SPACE_ID=...
CONTENTFUL_ACCESS_TOKEN=...            # Delivery API token
CONTENTFUL_PREVIEW_ACCESS_TOKEN=...    # Preview API token
CONTENTFUL_MANAGEMENT_TOKEN=...        # CMA token (migrations, webhook, seed, audit)
CONTENTFUL_WEBHOOK_SECRET=...          # shared secret for the webhook routes
```

### 2. Content model + demo content

```bash
npm run bootstrap  # create the base content types (author + blogPost)
npm run migrate    # add the editorial fields
npm run seed       # 3 demo posts, wired with relatedPosts (reading time fills in on publish)
```

### 3. The Editorial Toolkit app

```bash
cd apps/editorial-toolkit
npm install
npm run create-app     # one-time: create the AppDefinition, prints the App ID
npm run upload         # build + upload the bundle to Contentful Hosting
```

Then assign the app to the right fields and install it (one command):

```bash
cd ../..
EDITORIAL_TOOLKIT_APP_ID=<app id> node content-model/assign-toolkit-fields.mjs
```

The Rich Text Editor app is a separate bundle:

```bash
cd apps/rich-text-editor
npm install && npm run create-app && npm run upload
```

Then in Contentful → content model → `blogPost` → field `body` → **Appearance**, select **Rich Text Editor**.

### 4. Webhooks (after deploying to Vercel)

In Contentful → **Settings → Webhooks**, add two webhooks, both sending the header
`x-webhook-secret: <CONTENTFUL_WEBHOOK_SECRET>`:

| Trigger | URL |
| --- | --- |
| Entry · Publish (blogPost) | `https://<your-app>/api/webhooks/reading-time` |
| Entry · Publish & Unpublish (blogPost) | `https://<your-app>/api/revalidate` |

### 5. CI/CD secrets (GitHub repo → Settings → Secrets)

`CONTENTFUL_SPACE_ID`, `CONTENTFUL_ACCESS_TOKEN`, `CONTENTFUL_PREVIEW_ACCESS_TOKEN`,
`CONTENTFUL_MANAGEMENT_TOKEN`, `CONTENTFUL_ORG_ID`, `EDITORIAL_TOOLKIT_APP_ID`,
`RICH_TEXT_EDITOR_APP_ID`, `CONTENTFUL_CMA_TOKEN` (+ optional `SLACK_WEBHOOK_URL`).

---

## Scripts

```bash
npm run dev        # local dev server
npm run build      # production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit (strict)
npm run migrate    # apply the content-model migration
npm run seed       # seed demo content
```

---

## Project structure

```
src/
  app/
    page.tsx                     # home (Server Component, ISR)
    posts/[slug]/page.tsx        # post detail: generateStaticParams + metadata + related posts
    api/
      webhooks/reading-time/route.ts   # recompute reading time on publish (CMA)
      revalidate/route.ts              # on-demand ISR
  components/                    # PostCard, PostList (client tag filter), RichText, …
  lib/
    contentful.ts                # typed client + data access + view-model mapping
    types.ts                     # content model + view-model types

apps/editorial-toolkit/          # one multi-location Contentful App (Vite + Forma 36)
  src/App.tsx                    # location + tool router
  src/locations/                 # SlugField, ReadingTimeField, SponsoredField,
                                 #   RelatedContentField, DuplicateScannerPage, ConfigScreen
  src/utils/                     # slug + reading-time logic (shared formula with the webhook)

apps/rich-text-editor/           # custom PlateJS Rich Text field editor (Vite)
  src/transform.ts               # Contentful Rich Text <-> Plate value (round-trip tested)
  src/editor/                    # RichTextEditor, Toolbar, SlashMenu, element renderers

content-model/
  migrations/001-add-editorial-fields.cjs
  assign-toolkit-fields.mjs      # install app + point fields at it

integrations/
  scheduled-jobs/content-audit/index.mjs   # CMA audit run by GitHub Actions cron

.github/workflows/
  ci.yml                         # lint · typecheck · build
  deploy-toolkit.yml             # build + upload app bundle (replaces Cloud Build)
  scheduled-content-audit.yml    # cron audit (replaces Cloud Scheduler)
```

---

## Possible next steps

- Draft preview route using the Preview API + Next.js draft mode.
- Multi-environment app deploy (develop / staging / master) — the source platform runs one upload per environment.
- Unit tests for the slug / reading-time / audit logic (pure functions, easy to cover).
- Pagination / search for larger content sets.
