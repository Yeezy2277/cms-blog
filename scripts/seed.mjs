/**
 * Seed — upserts the demo publication into a Contentful space.
 *
 * Six real articles (they document this project's own architecture), written
 * as Contentful Rich Text with headings, lists, quotes and dividers so the
 * custom PlateJS editor and the site's renderer both have something real to
 * chew on.
 *
 * Idempotent: entries are matched by slug — existing ones are updated and
 * re-published, missing ones are created. Safe to run repeatedly.
 *
 * Usage:
 *   set -a; source .env; set +a
 *   npm run seed
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

/* ----- tiny Rich Text DSL --------------------------------------------------- */

const t = (value, ...marks) => ({
  nodeType: "text",
  value,
  marks: marks.map((type) => ({ type })),
  data: {},
});
const bold = (value) => t(value, "bold");
const code = (value) => t(value, "code");
const node = (nodeType, content) => ({ nodeType, data: {}, content });
const p = (...c) => node("paragraph", c.map((x) => (typeof x === "string" ? t(x) : x)));
const h2 = (text) => node("heading-2", [t(text)]);
const h3 = (text) => node("heading-3", [t(text)]);
const quote = (...paras) => node("blockquote", paras);
const li = (...c) => node("list-item", [p(...c)]);
const ul = (...items) => node("unordered-list", items);
const ol = (...items) => node("ordered-list", items);
const hr = () => ({ nodeType: "hr", data: {}, content: [] });
const doc = (...content) => ({ nodeType: "document", data: {}, content });

/* ----- the articles ---------------------------------------------------------- */

const articles = [
  {
    title: "Designing a content model that survives change",
    slug: "content-model-that-survives-change",
    excerpt:
      "The fields you choose on day one quietly decide how painful year two will be. Principles for modelling content you won't regret.",
    publishedDate: "2026-05-12T09:00:00Z",
    tags: ["Architecture", "CMS"],
    related: ["typed-cms-layer-view-models", "one-app-five-tools"],
    body: doc(
      p(
        "A content model is an API contract with your future self. Every shortcut you take while modelling — a stringly-typed status field, a rich-text blob doing a structured field's job — becomes a migration you'll be writing a year from now, live, against production content.",
      ),
      p(
        "This site's model is deliberately small: a ",
        code("blogPost"),
        " and an ",
        code("author"),
        ". But the way it grew is the interesting part, because it grew the way real models grow: editorial features arrived after launch.",
      ),
      h2("Start from the queries, not the data"),
      p(
        "The classic mistake is to model whatever shape the source data already has. Model the ",
        bold("questions your frontend asks"),
        " instead: list pages need a summary object; detail pages need the full body; both need stable identity. That's why the slug is a first-class validated field here and not something derived at render time.",
      ),
      ul(
        li("Fields the frontend never queries are candidates for deletion, not migration."),
        li("Anything that gates rendering (slug, published date) deserves validation at the model level."),
        li("Cross-field rules the model can't express belong in editor tooling — not in editors' memory."),
      ),
      h2("Let migrations carry the history"),
      p(
        "Every change to this model lives in a numbered migration file. ",
        code("000-create-content-types"),
        " builds the base model; ",
        code("001-add-editorial-fields"),
        " layers on reading time, sponsorship and related posts. A reviewer can read the model's whole biography in the diff.",
      ),
      quote(
        p(
          "If a field's meaning isn't obvious from the model alone, the model is wrong — no matter how good the documentation is.",
        ),
      ),
      hr(),
      p(
        "The payoff shows up later: when a webhook needs to write ",
        code("estimatedReadingTime"),
        ", it finds a disabled integer field waiting for it — added by a migration, owned by automation, invisible to editors. Nothing about that required touching the frontend.",
      ),
    ),
  },
  {
    title: "Server Components changed how I structure a frontend",
    slug: "server-components-changed-structure",
    excerpt:
      "Moving data fetching to the server and keeping client islands small made the pages faster and the codebase calmer. Notes from the shift.",
    publishedDate: "2026-04-28T09:00:00Z",
    tags: ["React", "Performance"],
    related: ["isr-in-practice", "content-model-that-survives-change"],
    body: doc(
      p(
        "The App Router made me renegotiate an old habit: reaching for client state by default. On this site exactly one component ships interactivity for content — the tag filter. Everything else renders on the server and arrives as HTML.",
      ),
      h2("The split that emerged"),
      ul(
        li(bold("Pages"), " are Server Components. They fetch, map, and pass plain props down."),
        li(bold("Client islands"), " are leaves: the tag filter, the theme toggle. No fetching inside."),
        li(
          bold("The data layer"),
          " is one file. Components never see a raw CMS entry — only typed view models.",
        ),
      ),
      p(
        "That last rule does the most work. When Contentful's response shape changes, one mapper changes. The components can't even tell.",
      ),
      h2("What it bought"),
      p(
        "First Load JS for a content page sits around 110 kB, most of it framework. The content itself costs nothing on the client — no hydration of article bodies, no fetch waterfalls, no loading spinners for text that was known at build time.",
      ),
      quote(
        p(
          "A loading spinner on static content is an apology for an architectural decision.",
        ),
      ),
      p(
        "The mental model is calmer too: data flows in one direction, and 'where does this state live' has a boring answer — on the server, unless a user interaction owns it.",
      ),
    ),
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
    related: ["webhook-that-writes-back", "server-components-changed-structure"],
    body: doc(
      p(
        "Editorial content has a lopsided rhythm: reads vastly outnumber writes. ISR is built for exactly that shape — pages are generated once, served from the CDN, and regenerated in the background when they go stale.",
      ),
      h2("The setup here"),
      ol(
        li("Every page exports ", code("revalidate = 3600"), " — an hourly staleness budget."),
        li(code("generateStaticParams"), " pre-builds all known posts at deploy time."),
        li("A new slug renders on first request, then joins the static set."),
      ),
      p(
        "That alone gives static-CDN performance with no redeploy on publish. But an hourly window is an eternity when an editor fixes a typo in a headline.",
      ),
      h2("On-demand revalidation closes the gap"),
      p(
        "A Contentful webhook fires on publish and unpublish, and a small route handler calls ",
        code("revalidatePath"),
        " for the affected pages. Publish-to-live drops from 'up to an hour' to seconds — and the hourly window remains as a safety net for anything the webhook misses.",
      ),
      quote(p("Cache invalidation stops being scary when you have two independent paths to correctness.")),
      hr(),
      p(
        "The failure modes are forgiving, which is the real argument. If the webhook dies, content is at most an hour stale. If the CMS is down, the site keeps serving the last good version. Slow is the worst case — not broken.",
      ),
    ),
  },
  {
    title: "The webhook that writes back — without the infinite loop",
    slug: "webhook-that-writes-back",
    excerpt:
      "Computing reading time on publish means a webhook that edits the entry that triggered it. Here's how it avoids eating its own tail.",
    publishedDate: "2026-06-10T09:00:00Z",
    tags: ["CMS", "Architecture"],
    related: ["isr-in-practice", "one-app-five-tools"],
    body: doc(
      p(
        "Reading time on this site is computed twice, on purpose. The editor widget shows a live estimate while you type; a webhook writes the authoritative value when the entry is published. Both share one formula — ",
        code("max(1, round(words / 200))"),
        " over the body text only — so the preview never disagrees with the stored value.",
      ),
      h2("The loop problem"),
      p(
        "The webhook fires on publish, updates the entry, and re-publishes it. That second publish fires the webhook again. Left alone, this is a perfectly efficient way to spend your rate limit forever.",
      ),
      p("The fix is a guard, not cleverness:"),
      ul(
        li("Recompute the value from the incoming payload."),
        li(
          "If the stored ",
          code("estimatedReadingTime"),
          " already equals the computed one, return 200 and do nothing.",
        ),
        li("Only write and re-publish when the value actually changed."),
      ),
      p(
        "The second webhook invocation finds the value already correct and stops. The loop terminates in exactly one extra call — bounded, boring, correct.",
      ),
      h2("Why not compute it in the frontend?"),
      p(
        "Because then it isn't data. Stored on the entry, reading time is queryable, sortable, and available to any consumer — feeds, search, the mobile app that doesn't exist yet. Derived-at-render values evaporate the moment a second consumer shows up.",
      ),
      quote(p("If two systems need the same derived value, derive it once and store it where both can see it.")),
    ),
  },
  {
    title: "One app, five tools: consolidating Contentful editor apps",
    slug: "one-app-five-tools",
    excerpt:
      "Instead of five App Framework apps with five bundles and five CI jobs, this project ships one app that routes on location. Anatomy of the pattern.",
    publishedDate: "2026-06-24T09:00:00Z",
    tags: ["CMS", "TypeScript", "Architecture"],
    related: ["slate-contentful-transform", "content-model-that-survives-change"],
    body: doc(
      p(
        "Custom editor tooling multiplies fast. A slug editor here, a validation widget there, a QA dashboard for the content team — and suddenly you're maintaining a fleet of nearly identical Vite apps that differ in one component.",
      ),
      h2("The consolidation"),
      p(
        "This project's Editorial Toolkit is a single App Framework bundle. At runtime it asks the SDK where it woke up — ",
        code("sdk.location"),
        " — and routes: field locations render one of four widgets (picked by an instance parameter, falling back to the field id), the page location renders a QA tool, the config location renders the install screen.",
      ),
      ul(
        li(bold("One build"), " — a single Vite bundle on Contentful Hosting."),
        li(bold("One deploy"), " — one CI job uploads it; every tool updates atomically."),
        li(bold("Shared logic"), " — the slug generator and reading-time formula live once, next to the widgets that use them."),
      ),
      h2("The part worth stealing"),
      p(
        "Cross-field rules live in widgets, not in editors' heads. Contentful's validations can't express 'sponsor name is required if and only if the post is sponsored' — so the sponsor-name widget subscribes to the ",
        code("isSponsored"),
        " field, disables itself when sponsorship is off, and complains when it's on and empty. The rule executes where the editor is looking.",
      ),
      quote(p("Editorial guardrails belong in the editing surface — an editor should never need the wiki to publish correctly.")),
      hr(),
      p(
        "The whole thing runs against a mock SDK in a public playground, because the widgets only ever talk to an interface. Swapping Contentful for an in-memory object is a one-file affair — which is also exactly what makes the widgets testable.",
      ),
    ),
  },
  {
    title: "Slate ⇄ Contentful: building a lossless rich-text transform",
    slug: "slate-contentful-transform",
    excerpt:
      "A custom PlateJS editor is only as good as its serialisation layer. How this one round-trips Contentful Rich Text without losing a node.",
    publishedDate: "2026-07-01T09:00:00Z",
    tags: ["React", "CMS", "TypeScript"],
    related: ["one-app-five-tools", "server-components-changed-structure"],
    body: doc(
      p(
        "Replacing Contentful's rich-text editor with a custom PlateJS one is mostly a UI project — until the moment you save. The editor thinks in Slate nodes; the CMS stores a strict JSON schema. The transform between them is where such projects quietly die.",
      ),
      h2("Two trees, one meaning"),
      p(
        "Contentful Rich Text is a fixed vocabulary: ",
        code("paragraph"),
        ", ",
        code("heading-1"),
        " through ",
        code("heading-6"),
        ", lists that must nest as ",
        code("list > list-item > paragraph"),
        ", text nodes carrying marks. Slate is freeform by design. The trick is to stop treating that freedom as a feature:",
      ),
      ul(
        li("Name the Plate node types after the Contentful ones — the mapping becomes a lookup table."),
        li("Enforce Contentful's nesting rules inside the editor, so invalid trees can't exist to begin with."),
        li("Make unsupported nodes degrade explicitly instead of silently disappearing."),
      ),
      h2("Round-trip or it didn't happen"),
      p(
        "The only serialisation test that matters is the round trip: ",
        code("serialize(deserialize(doc))"),
        " must reproduce the document byte for byte — headings, marks, hyperlinks, nested lists, embedded entries, all of it. That test caught every regression this editor has had, usually within seconds of writing the bug.",
      ),
      quote(p("A rich-text editor without a round-trip test is a data-loss incident on a delay timer.")),
      hr(),
      p(
        "The transform is ~200 lines and completely boring, which is the highest compliment serialisation code can earn. The editor above it can now evolve freely: toolbar, slash menu, custom blocks — none of it can corrupt the stored document.",
      ),
    ),
  },
];

/* ----- upsert ---------------------------------------------------------------- */

const link = (id) => ({ sys: { type: "Link", linkType: "Entry", id } });
const f = (value) => ({ [LOCALE]: value });

async function run() {
  const client = contentfulManagement.createClient({ accessToken: TOKEN });
  const space = await client.getSpace(SPACE_ID);
  const env = await space.getEnvironment(ENVIRONMENT);

  const existing = await env.getEntries({ content_type: "blogPost", limit: 100 });
  const bySlug = new Map(
    existing.items.map((e) => [e.fields.slug?.[LOCALE], e]),
  );

  // Pass 1 — create or update every article (without relations).
  const saved = new Map();
  for (const a of articles) {
    const fields = {
      title: f(a.title),
      slug: f(a.slug),
      excerpt: f(a.excerpt),
      publishedDate: f(a.publishedDate),
      tags: f(a.tags),
      body: f(a.body),
      isSponsored: f(Boolean(a.isSponsored)),
      sponsorName: f(a.sponsorName ?? ""),
    };

    let entry = bySlug.get(a.slug);
    if (entry) {
      Object.assign(entry.fields, fields);
      entry = await entry.update();
      console.log(`Updated: ${a.title}`);
    } else {
      entry = await env.createEntry("blogPost", { fields });
      console.log(`Created: ${a.title}`);
    }
    saved.set(a.slug, entry);
  }

  // Pass 2 — wire relations by slug, then publish.
  for (const a of articles) {
    let entry = saved.get(a.slug);
    const related = (a.related ?? [])
      .map((slug) => saved.get(slug))
      .filter(Boolean)
      .map((e) => link(e.sys.id));
    entry.fields.relatedPosts = f(related);
    entry = await entry.update();
    await entry.publish();
    console.log(`Published: ${a.title}`);
  }

  console.log(`Done. ${articles.length} articles are live.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
