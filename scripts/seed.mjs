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
  {
    title: "The CI that couldn't upload: when a token isn't enough",
    slug: "ci-that-couldnt-upload",
    excerpt:
      "A deploy pipeline that kept failing taught me to read the HTTP status, not the stack trace — and that the cheapest fix is often moving the work, not forcing the path.",
    publishedDate: "2026-07-08T09:00:00Z",
    tags: ["CI/CD", "Architecture"],
    related: ["webhook-that-writes-back", "isr-in-practice"],
    body: doc(
      p(
        "The deploy workflow for the CMS apps kept going red. Two problems hid behind one red X, and untangling them is a decent tour of how I debug a pipeline: read the exact failure, then decide whether to fix the path or change it.",
      ),
      h2("Problem one: a prompt with no one to answer it"),
      p(
        "The job died with exit code 130. That number is the tell — ",
        code("128 + SIGINT"),
        " — a process interrupted while waiting. The upload CLI was asking, interactively, ",
        code("Add a comment to the created bundle?"),
        " and CI has no keyboard. Passing ",
        code("--comment"),
        " answered the first prompt; a second one (",
        code("activate the bundle? (Y/n)"),
        ") needed ",
        code("yes |"),
        " piped in — with ",
        code("set +o pipefail"),
        " so the ",
        code("SIGPIPE"),
        " that kills ",
        code("yes"),
        " doesn't fail the step. Non-interactive at last.",
      ),
      h2("Problem two: a 404 that wasn't about the URL"),
      p(
        "Then the upload itself returned ",
        code("404"),
        " on ",
        code("POST /organizations/{org}/app_uploads"),
        ". A 404 on a write endpoint you can see in the docs is rarely a wrong URL — it's usually the API saying \"your credentials can't do this here.\" And that was it: Contentful's app-bundle hosting needs an OAuth token, not a personal management token. A PAT can read definitions and 404s on uploads.",
      ),
      h2("The decision"),
      p(
        "I could have stood up an OAuth app with a refresh-token dance in CI. For a portfolio, that's a lot of moving parts to keep a green checkmark. But the apps already live as public demos on Vercel — and the same bundle that serves the demo serves the CMS iframe. So the honest move was to point the deploy workflow at Vercel, where the apps actually run, and keep the Contentful bundle refresh as a local, OAuth-authenticated step.",
      ),
      ul(
        li("Lost: \"CI uploads to Contentful Hosting.\""),
        li("Gained: a green, honest pipeline that deploys exactly where the code runs."),
      ),
      quote(
        p(
          "A 404 on a write endpoint means \"you can't,\" not \"wrong address.\" And the cheapest fix is often to change where the work happens, not to force the original path.",
        ),
      ),
    ),
  },
  {
    title: "An invisible clash: the three.js transparency trap",
    slug: "threejs-transparency-trap",
    excerpt:
      "Setting material.opacity did nothing. The fix was one line — and a reminder that in retained-mode 3D, some properties are compiled into the shader, not read every frame.",
    publishedDate: "2026-07-09T09:00:00Z",
    tags: ["three.js", "Debugging", "Performance"],
    related: ["slate-contentful-transform", "living-world-no-server"],
    body: doc(
      p(
        "In the BIM clash viewer, clicking a clash isolates the offending pair and ghosts the rest of the model to glass — the way a coordination review reads a conflict through the surrounding structure. It worked for some elements and silently did nothing for others.",
      ),
      h2("The symptom"),
      p(
        "The ghosting code was trivial: for every element that isn't in the clash, set ",
        code("material.opacity = 0.07"),
        ". Elements that were already translucent (the architecture layer) faded correctly. Elements that started fully opaque (columns, beams) stayed solid — the same line, ignored.",
      ),
      h2("The cause"),
      p(
        "three.js compiles a material into a GPU shader program once, and whether the material is ",
        bold("transparent"),
        " is baked into that program at compile time — it changes the render pass, blending and depth-write behaviour. Flipping ",
        code("material.transparent = true"),
        " at runtime doesn't recompile the program, so a material that was born opaque keeps rendering opaque no matter what you do to ",
        code("opacity"),
        ".",
      ),
      p("The fix is one line — force the recompile:"),
      ul(
        li(code("material.transparent = true")),
        li(code("material.opacity = 0.07")),
        li(code("material.needsUpdate = true"), "  ← the line that was missing"),
      ),
      h2("The nuance worth keeping"),
      p(
        "Not every property behaves this way. ",
        code("color"),
        " and ",
        code("opacity"),
        " are shader uniforms — live, cheap, per-frame. ",
        code("transparent"),
        ", clipping planes, and light counts are compile-time — changing them costs a program rebuild. So ",
        code("needsUpdate"),
        " is a sledgehammer: right once on a state change, wrong every frame in the render loop.",
      ),
      quote(
        p(
          "In retained-mode 3D, \"set a property\" isn't always \"and it takes effect.\" Know which properties are uniforms and which recompile the shader.",
        ),
      ),
    ),
  },
  {
    title: "A living world with no server: real-time on the client",
    slug: "living-world-no-server",
    excerpt:
      "A live ops dashboard with no backend. The trick was decoupling the thing that changes fast (animation) from the thing that changes meaningfully (data) — three layers, one smooth result.",
    publishedDate: "2026-07-10T09:00:00Z",
    tags: ["React", "Performance", "Real-time"],
    related: ["threejs-transparency-trap", "server-components-changed-structure"],
    body: doc(
      p(
        "The live ops console had to feel alive — regions pulsing, metrics ticking, an event stream scrolling — with no backend at all. The interesting engineering isn't the simulation; it's keeping the whole thing smooth without asking React to animate.",
      ),
      h2("Three layers, deliberately separate"),
      ol(
        li(
          bold("The simulation"),
          " ticks at 4 Hz on a seeded RNG, mutating a plain state object. Deterministic, so it's the same world every load — and unit-testable.",
        ),
        li(
          bold("An observable store"),
          " bumps a version each tick. React's scalar readouts (players online, matches per minute) read it through ",
          code("useSyncExternalStore"),
          " and re-render four times a second — cheap, and exactly as often as the numbers change.",
        ),
        li(
          bold("The canvas map"),
          " runs its own ",
          code("requestAnimationFrame"),
          " loop, reads the latest state directly, and interpolates the pulse by wall-clock time. 60 fps, zero React re-renders.",
        ),
      ),
      h2("Why not just re-render everything?"),
      p(
        "Because the map's pulse animates every frame, and the data behind it changes four times a second. If React drove the animation, you'd reconcile a tree 60 times a second for motion the reconciler adds nothing to — and the pulse would stutter whenever the sim ticked. Letting the canvas own the hot path means the animation is smooth regardless of the simulation rate.",
      ),
      quote(
        p(
          "Decouple the thing that changes fast from the thing that changes meaningfully. React for data; requestAnimationFrame and canvas for motion.",
        ),
      ),
      hr(),
      p(
        "It's the same split I leaned on shipping real-time game UI: the framework renders state, a separate loop renders time. Keep them apart and each stays simple.",
      ),
    ),
  },
];

/* ----- cover art -------------------------------------------------------------
   Abstract geometric SVG covers, one motif per article, in the site's dark
   palette. Generated here and uploaded as Contentful assets so the cards and
   post heroes aren't empty placeholders. */

const C = {
  bg: "#0d1117",
  surface: "#161b22",
  line: "#2a313c",
  blue: "#4c8dff",
  blueSoft: "rgba(76,141,255,0.35)",
  teal: "#2dd4bf",
  amber: "#f5b544",
  text: "#e6edf3",
};

const svgWrap = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">` +
  `<rect width="1200" height="675" fill="${C.bg}"/>` +
  `<g stroke="${C.line}" stroke-width="1">` +
  Array.from({ length: 11 }, (_, i) => `<line x1="${i * 120}" y1="0" x2="${i * 120}" y2="675"/>`).join("") +
  `</g>` +
  inner +
  `</svg>`;

const covers = {
  // nested schema blocks
  "content-model-that-survives-change": svgWrap(
    `<rect x="330" y="150" width="540" height="375" rx="24" fill="none" stroke="${C.blue}" stroke-width="3"/>
     <rect x="400" y="220" width="400" height="90" rx="14" fill="${C.surface}" stroke="${C.blueSoft}" stroke-width="2"/>
     <rect x="400" y="340" width="270" height="60" rx="12" fill="${C.surface}" stroke="${C.blueSoft}" stroke-width="2"/>
     <rect x="400" y="430" width="330" height="60" rx="12" fill="${C.surface}" stroke="${C.blueSoft}" stroke-width="2"/>
     <circle cx="430" cy="265" r="10" fill="${C.teal}"/>
     <circle cx="430" cy="370" r="10" fill="${C.blue}"/>
     <circle cx="430" cy="460" r="10" fill="${C.amber}"/>`,
  ),
  // server block streaming to small client islands
  "server-components-changed-structure": svgWrap(
    `<rect x="180" y="180" width="330" height="315" rx="20" fill="${C.surface}" stroke="${C.blue}" stroke-width="3"/>
     <g fill="${C.blueSoft}">${[0, 1, 2, 3].map((i) => `<rect x="220" y="${225 + i * 60}" width="${250 - i * 40}" height="24" rx="8"/>`).join("")}</g>
     <g stroke="${C.teal}" stroke-width="2.5" fill="none">
       <path d="M510 260 C 640 260, 640 240, 760 240"/>
       <path d="M510 340 C 660 340, 660 380, 780 380"/>
       <path d="M510 420 C 630 420, 630 500, 740 500"/>
     </g>
     <circle cx="800" cy="240" r="34" fill="${C.teal}" opacity="0.9"/>
     <circle cx="822" cy="382" r="26" fill="${C.teal}" opacity="0.65"/>
     <circle cx="778" cy="502" r="20" fill="${C.teal}" opacity="0.45"/>`,
  ),
  // regeneration arcs
  "isr-in-practice": svgWrap(
    `<g fill="none" stroke-linecap="round">
       <circle cx="600" cy="337" r="170" stroke="${C.line}" stroke-width="26"/>
       <path d="M600 167 A 170 170 0 1 1 430 337" stroke="${C.blue}" stroke-width="26"/>
       <path d="M600 237 A 100 100 0 1 1 500 337" stroke="${C.teal}" stroke-width="16"/>
     </g>
     <polygon points="418,300 468,337 404,360" fill="${C.blue}"/>
     <circle cx="600" cy="337" r="14" fill="${C.amber}"/>`,
  ),
  // a loop deliberately broken
  "webhook-that-writes-back": svgWrap(
    `<g fill="none" stroke-linecap="round">
       <path d="M420 460 C 320 360, 380 200, 540 190 L 660 185" stroke="${C.blue}" stroke-width="22"/>
       <path d="M660 185 C 840 180, 900 330, 800 440" stroke="${C.blue}" stroke-width="22" opacity="0.55"/>
       <path d="M800 440 C 760 480, 700 500, 640 500" stroke="${C.amber}" stroke-width="22" stroke-dasharray="4 44"/>
     </g>
     <polygon points="655,150 715,187 655,222" fill="${C.blue}"/>
     <rect x="560" y="462" width="76" height="76" rx="16" fill="${C.surface}" stroke="${C.teal}" stroke-width="3"/>
     <path d="M580 500 l 14 14 l 28 -32" stroke="${C.teal}" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  ),
  // five tiles feeding one app
  "one-app-five-tools": svgWrap(
    `<g>${[0, 1, 2, 3, 4].map((i) => `<rect x="${240 + i * 90}" y="150" width="66" height="66" rx="14" fill="${C.surface}" stroke="${i === 2 ? C.amber : C.blueSoft}" stroke-width="2.5"/>`).join("")}</g>
     <g stroke="${C.line}" stroke-width="2.5" fill="none">${[0, 1, 2, 3, 4].map((i) => `<path d="M${273 + i * 90} 216 C ${273 + i * 90} 300, 600 290, 600 350"/>`).join("")}</g>
     <rect x="450" y="350" width="300" height="150" rx="20" fill="${C.surface}" stroke="${C.blue}" stroke-width="3"/>
     <circle cx="520" cy="425" r="14" fill="${C.blue}"/>
     <rect x="560" y="405" width="140" height="14" rx="7" fill="${C.blueSoft}"/>
     <rect x="560" y="432" width="100" height="14" rx="7" fill="${C.blueSoft}"/>`,
  ),
  // two trees, lossless bridge
  "slate-contentful-transform": svgWrap(
    `<g stroke="${C.blue}" stroke-width="2.5" fill="${C.surface}">
       <circle cx="320" cy="220" r="26"/><circle cx="250" cy="340" r="20"/><circle cx="390" cy="340" r="20"/><circle cx="320" cy="460" r="20"/>
       <line x1="320" y1="246" x2="250" y2="320"/><line x1="320" y1="246" x2="390" y2="320"/><line x1="390" y1="360" x2="320" y2="440"/>
     </g>
     <g stroke="${C.teal}" stroke-width="2.5" fill="${C.surface}">
       <circle cx="880" cy="220" r="26"/><circle cx="810" cy="340" r="20"/><circle cx="950" cy="340" r="20"/><circle cx="880" cy="460" r="20"/>
       <line x1="880" y1="246" x2="810" y2="320"/><line x1="880" y1="246" x2="950" y2="320"/><line x1="950" y1="360" x2="880" y2="440"/>
     </g>
     <g stroke="${C.amber}" stroke-width="8" fill="none" stroke-linecap="round">
       <path d="M480 310 L 700 310"/><path d="M700 365 L 480 365"/>
     </g>
     <polygon points="700,290 740,310 700,330" fill="${C.amber}"/>
     <polygon points="480,345 440,365 480,385" fill="${C.amber}"/>`,
  ),
  // pipeline: blocked node, rerouted around it
  "ci-that-couldnt-upload": svgWrap(
    `<g fill="none" stroke-width="8" stroke-linecap="round">
       <path d="M170 337 L 470 337" stroke="${C.blue}"/>
       <path d="M470 337 L 560 337" stroke="${C.red}" stroke-dasharray="2 26"/>
       <path d="M470 337 C 560 337, 560 200, 690 200 L 1030 200" stroke="${C.teal}"/>
     </g>
     <rect x="120" y="307" width="60" height="60" rx="12" fill="${C.surface}" stroke="${C.blue}" stroke-width="3"/>
     <rect x="500" y="300" width="74" height="74" rx="14" fill="${C.surface}" stroke="${C.red}" stroke-width="3"/>
     <path d="M518 318 l 38 38 M556 318 l -38 38" stroke="${C.red}" stroke-width="5" stroke-linecap="round"/>
     <rect x="1000" y="170" width="60" height="60" rx="12" fill="${C.surface}" stroke="${C.teal}" stroke-width="3"/>
     <path d="M1016 200 l 12 12 l 26 -30" stroke="${C.teal}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  ),
  // overlapping translucent cubes — the transparency trap
  "threejs-transparency-trap": svgWrap(
    `<g stroke-width="2.5">
       <rect x="430" y="240" width="180" height="180" rx="6" fill="${C.blueSoft}" stroke="${C.blue}"/>
       <rect x="540" y="300" width="180" height="180" rx="6" fill="rgba(45,212,191,0.28)" stroke="${C.teal}"/>
       <rect x="490" y="360" width="150" height="150" rx="6" fill="rgba(226,86,74,0.30)" stroke="${C.red}"/>
     </g>
     <circle cx="565" cy="390" r="9" fill="${C.amber}"/>`,
  ),
  // concentric pulse — a world tick
  "living-world-no-server": svgWrap(
    `<g fill="none" stroke="${C.teal}" stroke-width="2.5">
       <circle cx="600" cy="337" r="40" opacity="0.9"/>
       <circle cx="600" cy="337" r="90" opacity="0.55"/>
       <circle cx="600" cy="337" r="150" opacity="0.3"/>
       <circle cx="600" cy="337" r="220" opacity="0.14"/>
     </g>
     <circle cx="600" cy="337" r="16" fill="${C.teal}"/>
     <g fill="${C.blue}">
       <circle cx="330" cy="200" r="10"/><circle cx="900" cy="240" r="10"/>
       <circle cx="860" cy="470" r="10"/><circle cx="340" cy="460" r="10"/>
     </g>`,
  ),
};

const AVATAR_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">` +
  `<rect width="400" height="400" rx="200" fill="#161b22"/>` +
  `<circle cx="200" cy="155" r="70" fill="#4c8dff"/>` +
  `<path d="M60 400 C 60 300, 340 300, 340 400 Z" fill="#4c8dff" opacity="0.75"/>` +
  `</svg>`;

/* ----- upsert ---------------------------------------------------------------- */

const link = (id) => ({ sys: { type: "Link", linkType: "Entry", id } });
const assetLink = (id) => ({ sys: { type: "Link", linkType: "Asset", id } });
const f = (value) => ({ [LOCALE]: value });

/** Create-or-reuse a published SVG asset, matched by title. */
async function ensureSvgAsset(env, title, fileName, svg) {
  const found = await env.getAssets({ "fields.title": title, limit: 1 });
  if (found.items.length > 0) return found.items[0];

  let asset = await env.createAssetFromFiles({
    fields: {
      title: f(title),
      description: f("Generated cover art"),
      file: f({
        contentType: "image/svg+xml",
        fileName,
        file: svg,
      }),
    },
  });
  asset = await asset.processForAllLocales();
  asset = await asset.publish();
  console.log(`Asset: ${title}`);
  return asset;
}

/** Create-or-reuse the demo author entry. */
async function ensureAuthor(env) {
  const found = await env.getEntries({ content_type: "author", limit: 1 });
  if (found.items.length > 0) return found.items[0];

  const avatar = await ensureSvgAsset(env, "Author avatar", "avatar.svg", AVATAR_SVG);
  let author = await env.createEntry("author", {
    fields: {
      name: f("Vitaly Popov"),
      title: f("Frontend Engineer"),
      avatar: f(assetLink(avatar.sys.id)),
    },
  });
  author = await author.publish();
  console.log("Author: Vitaly Popov");
  return author;
}

async function run() {
  const client = contentfulManagement.createClient({ accessToken: TOKEN });
  const space = await client.getSpace(SPACE_ID);
  const env = await space.getEnvironment(ENVIRONMENT);

  const existing = await env.getEntries({ content_type: "blogPost", limit: 100 });
  const bySlug = new Map(
    existing.items.map((e) => [e.fields.slug?.[LOCALE], e]),
  );

  const author = await ensureAuthor(env);

  // Pass 1 — create or update every article (without relations).
  const saved = new Map();
  for (const a of articles) {
    const cover = covers[a.slug]
      ? await ensureSvgAsset(env, `Cover — ${a.slug}`, `${a.slug}.svg`, covers[a.slug])
      : null;

    const fields = {
      title: f(a.title),
      slug: f(a.slug),
      excerpt: f(a.excerpt),
      publishedDate: f(a.publishedDate),
      tags: f(a.tags),
      body: f(a.body),
      isSponsored: f(Boolean(a.isSponsored)),
      sponsorName: f(a.sponsorName ?? ""),
      author: f(link(author.sys.id)),
      ...(cover ? { coverImage: f(assetLink(cover.sys.id)) } : {}),
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
