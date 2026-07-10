# Editorial Toolkit — Contentful App

> **▶ Live demo (no login):** <https://editorial-toolkit.vercel.app> — the real widget
> code running against an in-memory mock of the App SDK (`src/demo/`). Inside
> Contentful the same bundle runs as the actual field/page apps.

One [App Framework](https://www.contentful.com/developers/docs/extensibility/app-framework/) bundle that provides every custom editor tool for the `blogPost` content type. Rather than ship one app per field, this routes on `sdk.location` (and a per-field `tool` instance parameter) so it's a single build, a single bundle on Contentful Hosting, and a single thing to maintain.

| Tool | Location | What it does |
| --- | --- | --- |
| **Slug editor** | entry-field (`slug`) | Auto-generates the slug from the title while the entry is a draft; stops on manual edit; validates format and uniqueness across `blogPost`. |
| **Reading time** | entry-field (`estimatedReadingTime`) | Read-only display with a live estimate recomputed from the body as you type; flags when it has drifted from the saved value. |
| **Sponsored field** | entry-field (`sponsorName`) | Enabled only when `isSponsored` is on; clears itself and shows a validation error otherwise — a cross-field rule the content model can't express. |
| **Related content** | entry-field (`relatedPosts`) | Suggests posts sharing tags, lets editors add via the native picker or remove, and writes entry links. |
| **Media importer** | entry-field (`coverImage`) | Paste an https image URL → the app creates the asset via the CMA (create → process → poll → publish) and links it to the field; the native asset picker stays one click away. |
| **Author manager** | entry-sidebar | Shows the post's author, switches it from a dropdown of all `author` entries, or creates + publishes a new author inline — without leaving the entry. |
| **Validation Hub** | page | One scan, every editorial QA check: duplicate slugs, links to deleted entries, incomplete metadata (cover/tags/excerpt/reading time) and stale drafts — with severity badges and jump-to-entry. Checks are pure functions (`src/utils/audit.ts`), unit-tested and mirrored by the scheduled GitHub-Actions audit. |
| **Config** | app-config | Install screen + docs. |

## Develop

```bash
npm install
npm run dev            # Vite dev server; open it inside Contentful via an app's local URL
```

## Deploy (Contentful Hosting — no GCP)

```bash
npm run create-app     # one-time: create the AppDefinition (prints the App ID)
npm run upload         # build + upload bundle to Contentful Hosting
```

In CI this is done by `.github/workflows/deploy-toolkit.yml` via `npm run upload-ci`, which is the free-tier replacement for the source platform's Cloud Build → bundle-upload pipeline.

## Wire it to the content model

After uploading, install the app and point the `blogPost` fields at it:

```bash
EDITORIAL_TOOLKIT_APP_ID=<app id> \
  node ../../content-model/assign-toolkit-fields.mjs
```

Each field is assigned with a `tool` instance parameter (`slug` / `reading-time` / `sponsored` / `related`); the router also falls back to the field id, so manual assignment in the Contentful UI works too.

## Notes

- The reading-time formula here **must** match the webhook (`src/app/api/webhooks/reading-time/route.ts`): `max(1, round(words / 200))`, counting body text only. Keep `src/utils/readingTime.ts` and the webhook in sync.
- Built with React 19 + Forma 36 (`@contentful/f36-*`). The ~290 kB gzipped bundle is normal for a Forma 36 app and is served from Contentful Hosting, not shipped to site visitors.
