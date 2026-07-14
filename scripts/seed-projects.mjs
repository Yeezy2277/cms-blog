/**
 * Seed the `project` entries the portfolio hub overlays onto its local seed.
 * Idempotent: matches on `slug` and updates in place. Run after migration 004.
 *
 * Images are intentionally left unset — the hub ships committed SVG previews as
 * its fallback; set a Preview image in Contentful only if you want to override.
 *
 *   set -a; source .env.local; set +a
 *   npm run seed:projects
 */
import contentfulManagement from "contentful-management";

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT ?? "master";
const LOCALE = process.env.CONTENTFUL_LOCALE ?? "en-US";

if (!SPACE_ID || !TOKEN) {
  console.error("Set CONTENTFUL_SPACE_ID and CONTENTFUL_MANAGEMENT_TOKEN.");
  process.exit(1);
}

const f = (value) => ({ [LOCALE]: value });

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
  const client = contentfulManagement.createClient({ accessToken: TOKEN });
  const space = await client.getSpace(SPACE_ID);
  const env = await space.getEnvironment(ENVIRONMENT);

  const existing = await env.getEntries({ content_type: "project", limit: 100 });
  const bySlug = new Map(
    existing.items.map((e) => [e.fields.slug?.[LOCALE], e]),
  );

  for (const p of projects) {
    const fields = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, f(v)]));
    let entry = bySlug.get(p.slug);
    if (entry) {
      Object.assign(entry.fields, fields);
      entry = await entry.update();
      console.log(`Updated project: ${p.slug}`);
    } else {
      entry = await env.createEntry("project", { fields });
      console.log(`Created project: ${p.slug}`);
    }
    await entry.publish();
  }
  console.log("Done. All projects published — the hub overlays them on its next revalidation.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
