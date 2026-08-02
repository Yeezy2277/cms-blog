/**
 * Seed the `project` entries the portfolio hub overlays onto its local seed.
 * Change-detected: matches on `slug`, writes only when a field differs.
 * Run after migration 004.
 *
 * Images are intentionally left unset — the hub ships committed SVG previews as
 * its fallback; set a Preview image in Contentful only if you want to override.
 *
 *   npm run seed:projects              # create/update, skipping unchanged
 *   npm run seed:projects -- --prune   # also delete orphaned project entries
 *   npm run seed:projects -- --dry-run # report changes, write nothing
 */
import contentfulManagement from "contentful-management";
import { parseFlags, upsertBySlug, loadBySlug, prune, reportStats } from "./lib/cma.mjs";

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT ?? "master";
const LOCALE = process.env.CONTENTFUL_LOCALE ?? "en-US";

const flags = parseFlags();
const f = (value) => ({ [LOCALE]: value });

function requireCreds() {
  if (!SPACE_ID || !TOKEN) {
    console.error(
      "Missing CONTENTFUL_SPACE_ID / CONTENTFUL_MANAGEMENT_TOKEN.\n" +
        "Run via `npm run seed:projects` (loads .env.local).",
    );
    process.exit(1);
  }
}

/** Mirrors portfolio-hub/config/projects.local.ts (the seed the CMS overlays). */
const projects = [
  {
    slug: "cms-blog",
    title: "Lumen",
    summary:
      "A Contentful content platform: typed Next.js frontend plus custom editor apps, webhooks, a scheduled audit and content-model migrations — all on free infra.",
    liveUrl: "https://lumen.vitaliipopov.dev",
    repoUrl: "https://github.com/Yeezy2277/cms-blog",
    tags: ["Next.js", "Contentful", "TypeScript", "App Framework"],
    embeddable: true,
    featured: true,
    hidden: false,
    order: 0,
  },
  {
    slug: "rich-text-editor",
    title: "Rich text editor",
    summary:
      "A custom PlateJS editor for Contentful Rich Text fields, with a round-trip-tested Contentful ⇄ Plate transform, slash menu and native embeds.",
    liveUrl: "https://rte.vitaliipopov.dev/?demo=1",
    repoUrl: "https://github.com/Yeezy2277/cms-blog/tree/main/apps/rich-text-editor",
    tags: ["PlateJS", "Slate", "Contentful", "TypeScript"],
    embeddable: true,
    featured: false,
    hidden: false,
    order: 1,
  },
  {
    slug: "depot",
    title: "Depot — content API",
    summary:
      "The backend half of a CMS: email/password sessions + hashed delivery tokens, a typed Postgres content model (collections → items with a publish lifecycle), Zod validation, rate limiting and a token-secured delivery API. Next.js route handlers + Drizzle + Neon.",
    liveUrl: "https://depot.vitaliipopov.dev",
    repoUrl: "https://github.com/Yeezy2277/depot",
    tags: ["Next.js", "PostgreSQL", "Drizzle", "Auth", "REST API"],
    embeddable: true,
    featured: true,
    hidden: false,
    order: 1,
  },
  {
    slug: "editorial-toolkit",
    title: "Editorial Toolkit",
    summary:
      "One multi-location Contentful App, seven editor tools across four location types: slug, reading time, sponsored validation, related posts, URL→asset media importer, author sidebar and a validation hub — try them live against a mock CMS.",
    liveUrl: "https://toolkit.vitaliipopov.dev/?demo=1",
    repoUrl: "https://github.com/Yeezy2277/cms-blog/tree/main/apps/editorial-toolkit",
    tags: ["Contentful", "App Framework", "Forma 36", "TypeScript"],
    embeddable: true,
    featured: false,
    hidden: false,
    order: 2,
  },
  {
    slug: "live-ops-console",
    title: "Pulse — Live Ops Console",
    summary:
      "A real-time game-ops console: the world is simulated client-side and painted on canvas — high-frequency state, 60fps rendering decoupled from React, and a debounced event feed. No backend. A change of register from the Contentful work.",
    liveUrl: "https://pulse.vitaliipopov.dev",
    repoUrl: "https://github.com/Yeezy2277/live-ops-console",
    tags: ["React", "TypeScript", "Canvas", "Real-time"],
    embeddable: true,
    featured: false,
    hidden: false,
    order: 3,
  },
  {
    slug: "bim-clash-viewer",
    title: "Girder — BIM clash viewer",
    summary:
      "A browser BIM coordination viewer: procedural building model, three.js scene with section plane and NavisWorks-style ghosted clash isolation, and a pure, unit-tested clash-detection engine. No backend.",
    liveUrl: "https://girder.vitaliipopov.dev",
    repoUrl: "https://github.com/Yeezy2277/bim-clash-viewer",
    tags: ["three.js", "BIM", "TypeScript", "Computational geometry"],
    embeddable: true,
    featured: false,
    hidden: false,
    order: 4,
  },
];

async function run() {
  requireCreds();
  const client = contentfulManagement.createClient({ accessToken: TOKEN });
  const space = await client.getSpace(SPACE_ID);
  const env = await space.getEnvironment(ENVIRONMENT);

  const bySlug = await loadBySlug(env, "project", LOCALE);
  const stats = { created: 0, updated: 0, unchanged: 0, deleted: 0 };

  for (const p of projects) {
    const fields = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, f(v)]));
    await upsertBySlug(env, bySlug, "project", p.slug, fields, {
      locale: LOCALE, stats, dryRun: flags.dryRun,
    });
  }

  if (flags.prune) {
    stats.deleted += await prune(bySlug, projects.map((p) => p.slug), {
      dryRun: flags.dryRun, label: "project",
    });
  }

  reportStats(stats, { dryRun: flags.dryRun });
  if (!flags.dryRun) {
    console.log("The hub overlays projects on its next revalidation.");
  }
}

// Export the dataset so the validator can check it without credentials (CI).
export { projects };

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
