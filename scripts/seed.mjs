/**
 * Seed script — populates a Contentful space with demo content so the site
 * isn't empty. Requires a Content Management API token (different from the
 * Delivery token).
 *
 * Usage:
 *   CONTENTFUL_SPACE_ID=... CONTENTFUL_MANAGEMENT_TOKEN=... node scripts/seed.mjs
 *
 * Install the management SDK first:
 *   npm i -D contentful-management
 *
 * This is intentionally a standalone script (not part of the app bundle).
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

const posts = [
  {
    title: "Designing a content model that survives change",
    slug: "content-model-that-survives-change",
    excerpt:
      "The fields you choose on day one quietly decide how painful year two will be. A few principles for modelling content you won't regret.",
    publishedDate: "2026-05-12T09:00:00Z",
    tags: ["Architecture", "CMS"],
  },
  {
    title: "Server Components changed how I structure a frontend",
    slug: "server-components-changed-structure",
    excerpt:
      "Moving data fetching to the server and keeping client islands small made our pages faster and the codebase calmer. Notes from the shift.",
    publishedDate: "2026-04-28T09:00:00Z",
    tags: ["React", "Performance"],
  },
  {
    title: "ISR in practice: static speed without the redeploys",
    slug: "isr-in-practice",
    excerpt:
      "Incremental Static Regeneration is the quiet workhorse of content sites. When to reach for it, and where on-demand revalidation fits.",
    publishedDate: "2026-04-03T09:00:00Z",
    tags: ["Next.js", "Performance"],
    isSponsored: true,
    sponsorName: "Vercel",
  },
];

function link(id) {
  return { sys: { type: "Link", linkType: "Entry", id } };
}

function richText(paragraph) {
  return {
    nodeType: "document",
    data: {},
    content: [
      {
        nodeType: "paragraph",
        data: {},
        content: [{ nodeType: "text", value: paragraph, marks: [], data: {} }],
      },
    ],
  };
}

async function run() {
  const client = contentfulManagement.createClient({ accessToken: TOKEN });
  const space = await client.getSpace(SPACE_ID);
  const env = await space.getEnvironment(ENVIRONMENT);

  const created = [];

  // Pass 1 — create every post (without relations, which need the other ids).
  for (const post of posts) {
    const fields = {
      title: { [LOCALE]: post.title },
      slug: { [LOCALE]: post.slug },
      excerpt: { [LOCALE]: post.excerpt },
      publishedDate: { [LOCALE]: post.publishedDate },
      tags: { [LOCALE]: post.tags },
      body: {
        [LOCALE]: richText(
          `${post.excerpt} This is seeded demo content — replace it with your own writing in Contentful.`,
        ),
      },
    };
    if (post.isSponsored) {
      fields.isSponsored = { [LOCALE]: true };
      fields.sponsorName = { [LOCALE]: post.sponsorName };
    }

    const entry = await env.createEntry("blogPost", { fields });
    created.push(entry);
    console.log(`Created: ${post.title}`);
  }

  // Pass 2 — wire up relatedPosts (each post links to the next two) and publish.
  // estimatedReadingTime is intentionally left for the reading-time webhook to
  // compute on publish, so the end-to-end flow is exercised.
  for (let i = 0; i < created.length; i++) {
    const entry = created[i];
    const related = [created[(i + 1) % created.length], created[(i + 2) % created.length]]
      .filter((e) => e.sys.id !== entry.sys.id)
      .map((e) => link(e.sys.id));
    entry.fields.relatedPosts = { [LOCALE]: related };
    const updated = await entry.update();
    await updated.publish();
    console.log(`Published: ${posts[i].title}`);
  }

  console.log("Done. Seeded", posts.length, "posts.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
