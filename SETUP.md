# Setup & deployment runbook

End-to-end steps to get everything running: the Lumen site, its two Contentful
apps, webhooks, the scheduled audit, and the separate Portfolio Hub. Work top to
bottom the first time — later phases depend on earlier ones.

Legend: 🖥️ = run in a terminal · 🌐 = do it in a web dashboard.

---

## Phase 0 — accounts & tools (one-time)

- [ ] **Node 20+** installed (`node -v`).
- [ ] A **Contentful** account — the free "Community" tier is enough → <https://www.contentful.com>
- [ ] A **GitHub** account.
- [ ] A **Vercel** account, linked to GitHub → <https://vercel.com>

---

## Phase 1 — Contentful space & tokens 🌐

1. In Contentful, create a **Space** (free tier). Note its **Space ID**:
   Settings → General settings.
2. Create API tokens under **Settings → API keys**:
   - Add an **API key** → gives you the **Content Delivery** token and the
     **Content Preview** token.
   - Tab **Content management tokens** → **Generate personal token** → this is
     the **CMA token** (write access — used by migrations, seed, webhooks, apps).
3. Note your **Organization ID**: Organization settings → the ID in the URL, or
   Settings → General. Needed later for app deploys.

You now have: `SPACE_ID`, `DELIVERY_TOKEN`, `PREVIEW_TOKEN`, `CMA_TOKEN`, `ORG_ID`.

---

## Phase 2 — Lumen site, locally 🖥️

```bash
cd ~/cms-blog
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```
CONTENTFUL_SPACE_ID=<SPACE_ID>
CONTENTFUL_ACCESS_TOKEN=<DELIVERY_TOKEN>
CONTENTFUL_PREVIEW_ACCESS_TOKEN=<PREVIEW_TOKEN>
CONTENTFUL_MANAGEMENT_TOKEN=<CMA_TOKEN>
CONTENTFUL_ENVIRONMENT=master
CONTENTFUL_WEBHOOK_SECRET=<pick-any-long-random-string>
CONTENTFUL_ORG_ID=<ORG_ID>
```

Create the content model and demo content (order matters):

```bash
npm run bootstrap   # creates the base content types: author + blogPost
npm run migrate     # adds editorial fields (reading time, sponsored, related)
npm run seed        # 3 demo posts, published
```

> `bootstrap` and `migrate` read the Contentful vars from your shell. If they
> can't see `.env.local`, prefix the command, e.g.
> `set -a; source .env.local; set +a` first, or
> `CONTENTFUL_SPACE_ID=... CONTENTFUL_MANAGEMENT_TOKEN=... npm run bootstrap`.

Run it:

```bash
npm run dev         # http://localhost:3000
```

✅ Checkpoint: the home page lists the 3 seeded posts; a post page renders. In
Contentful → Content, you see the posts. (`estimatedReadingTime` is empty for
now — the webhook fills it in Phase 6.)

---

## Phase 3 — deploy Lumen to Vercel 🌐

1. Push `~/cms-blog` to a GitHub repo.
2. Vercel → **Add New… → Project** → import the repo.
3. **Environment Variables** → add the same keys as `.env.local`
   (`CONTENTFUL_SPACE_ID`, `CONTENTFUL_ACCESS_TOKEN`,
   `CONTENTFUL_PREVIEW_ACCESS_TOKEN`, `CONTENTFUL_MANAGEMENT_TOKEN`,
   `CONTENTFUL_ENVIRONMENT`, `CONTENTFUL_WEBHOOK_SECRET`).
4. **Deploy.** Note the production URL, e.g. `https://lumen-xyz.vercel.app`.

✅ Checkpoint: the live URL shows your posts. Keep this URL — the webhooks in
Phase 6 point at it.

---

## Phase 4 — Editorial Toolkit app 🖥️ + 🌐

```bash
cd ~/cms-blog/apps/editorial-toolkit
npm install
npm run create-app     # opens a browser to authorise; prints the App ID
```

Copy the printed **App ID** into `~/cms-blog/.env.local` as
`EDITORIAL_TOOLKIT_APP_ID=...`, then:

```bash
npm run upload         # builds and uploads the bundle to Contentful Hosting
```

🌐 In Contentful → **Apps → Custom apps** → find *Editorial Toolkit* → **Install**
to your space/environment.

Now point the `blogPost` fields at the app (automated):

```bash
cd ~/cms-blog
set -a; source .env.local; set +a          # so the script sees the vars
EDITORIAL_TOOLKIT_APP_ID=<App ID> node content-model/assign-toolkit-fields.mjs
```

✅ Checkpoint: open a post in Contentful. The **Slug** field auto-fills from the
title, **Sponsor name** only enables when *Sponsored article* is on, and
**Related posts** shows tag-based suggestions.

---

## Phase 5 — Rich Text Editor app 🖥️ + 🌐

```bash
cd ~/cms-blog/apps/rich-text-editor
npm install
npm run create-app     # prints this app's App ID
```

Add it to `~/cms-blog/.env.local` as `RICH_TEXT_EDITOR_APP_ID=...`, then:

```bash
npm run upload
```

🌐 Contentful → **Apps → Custom apps** → *Rich Text Editor* → **Install**. Then
**Content model → blogPost → field `body` → Appearance** → select **Rich Text
Editor**. (Optional: under the field's Validations, enable the embed node types
you want.)

✅ Checkpoint: editing a post's body now uses the custom PlateJS editor — toolbar,
`/` slash menu, and the *+ Entry / + Asset* embeds.

---

## Phase 6 — webhooks 🌐

Contentful → **Settings → Webhooks → Add webhook**. Create **two**, both adding a
custom header **`x-webhook-secret`** = the `CONTENTFUL_WEBHOOK_SECRET` you chose.

| Webhook | URL | Trigger |
| --- | --- | --- |
| Reading time | `https://<lumen-domain>/api/webhooks/reading-time` | Entry → **Publish** |
| Revalidate | `https://<lumen-domain>/api/revalidate` | Entry → **Publish** and **Unpublish** |

(You can scope both to the `blogPost` content type in the webhook filters.)

✅ Checkpoint: edit and **publish** a post. Within a moment its
`estimatedReadingTime` is set in Contentful, and the change appears on the live
site without a redeploy.

---

## Phase 7 — scheduled content audit 🌐

This runs on GitHub Actions cron (`.github/workflows/scheduled-content-audit.yml`,
weekdays 07:00 UTC). In your GitHub repo → **Settings → Secrets and variables →
Actions**, add:

- `CONTENTFUL_SPACE_ID`
- `CONTENTFUL_MANAGEMENT_TOKEN`
- `SLACK_WEBHOOK_URL` — optional; without it, results still show in the Actions
  run summary.

✅ Checkpoint: **Actions → Scheduled content audit → Run workflow** → the run
summary lists stale drafts / missing reading time / duplicate slugs.

> Also add the app-deploy secrets if you want CI to re-upload the apps on push:
> `CONTENTFUL_ORG_ID`, `CONTENTFUL_CMA_TOKEN`, `EDITORIAL_TOOLKIT_APP_ID`,
> `RICH_TEXT_EDITOR_APP_ID` (used by `deploy-toolkit.yml` and
> `deploy-rich-text-editor.yml`).

---

## Phase 8 — Portfolio Hub 🖥️ + 🌐

```bash
cd ~/portfolio-hub
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```
GITHUB_USER=<your-github-username>
PORTFOLIO_TOPIC=portfolio
GITHUB_TOKEN=              # optional PAT (public repo read) for a higher rate limit
REVALIDATE_SECRET=<pick-any-long-random-string>
```

```bash
npm run dev               # http://localhost:3000
npm test                  # optional: 8 unit tests should pass
```

Make projects discoverable — for each repo you want shown (e.g. `cms-blog`,
`rich-text-editor`) on **GitHub → the repo → About (gear icon)**:

- add the topic **`portfolio`**,
- set the **Website** field to its live URL.

(Optional per repo: commit a `.portfolio.json` — see
`~/portfolio-hub/examples/.portfolio.example.json` — to control title, summary,
tags, preview image, `featured`, and `embeddable` for the in-hub iframe preview.)

Deploy the hub: push `~/portfolio-hub` to GitHub → import in Vercel → set the
env vars → deploy.

✅ Checkpoint: the hub shows a card per tagged repo, with search + tag filters,
and clicking a card opens the preview modal.

---

## Phase 9 — instant hub refresh on new deploys 🌐 (optional)

So a freshly deployed project appears on the hub immediately (not on the next
hourly window):

1. In the hub's Vercel project, confirm `REVALIDATE_SECRET` is set.
2. In each spoke repo, copy `~/portfolio-hub/examples/spoke-notify-hub.yml` to
   `.github/workflows/notify-hub.yml`, and add a repo secret
   `HUB_REVALIDATE_URL` = `https://<hub-domain>/api/revalidate?secret=<REVALIDATE_SECRET>`.

✅ Checkpoint: after a spoke deploys, the hub reflects it within seconds.

---

## What lives where

| Thing | Where it runs | Configured in |
| --- | --- | --- |
| Lumen site + webhooks | Vercel | Vercel env vars |
| Editorial Toolkit / Rich Text apps | Contentful Hosting | `create-app` + `upload` |
| Content model + demo data | Contentful | `bootstrap` · `migrate` · `seed` |
| Scheduled audit | GitHub Actions cron | GitHub repo secrets |
| Portfolio Hub | Vercel | Vercel env vars |

## Troubleshooting

- **`bootstrap`/`migrate` "content type not found" or auth errors** — the shell
  didn't get the env vars. `set -a; source .env.local; set +a` then re-run.
- **`contentful: command not found`** — run from `~/cms-blog` after `npm install`
  (the CLI is a dev dependency there), not from a subfolder.
- **App widgets don't appear on fields** — the app must be **Installed** to the
  environment (Phase 4/5) *before* `assign-toolkit-fields.mjs` / Appearance
  selection takes effect.
- **Webhook does nothing** — check the `x-webhook-secret` header matches
  `CONTENTFUL_WEBHOOK_SECRET` exactly, and the Vercel deploy has that env var.
- **Hub shows only seed cards** — set `GITHUB_USER`, and make sure the repos have
  the `portfolio` topic and are public.
