/**
 * Seed the singleton `profile` entry the portfolio hub renders in its hero.
 * Change-detected: updates + republishes only when a field actually differs.
 * Run after migration 002.
 *
 *   npm run seed:profile              # update if changed
 *   npm run seed:profile -- --dry-run # report whether it would change
 */
import contentfulManagement from "contentful-management";
import { parseFlags, isUpToDate } from "./lib/cma.mjs";

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT ?? "master";
const LOCALE = process.env.CONTENTFUL_LOCALE ?? "en-US";

if (!SPACE_ID || !TOKEN) {
  console.error(
    "Missing CONTENTFUL_SPACE_ID / CONTENTFUL_MANAGEMENT_TOKEN.\n" +
      "Run via `npm run seed:profile` (loads .env.local).",
  );
  process.exit(1);
}

const flags = parseFlags();
const f = (value) => ({ [LOCALE]: value });

const data = {
  name: "Vitalii Popov",
  headline: "Senior Fullstack Engineer",
  tagline: "React · Node.js · TypeScript · Headless CMS (Contentful)",
  location: "São Paulo, Brazil",
  timezone: "Remote · US business hours (UTC-3, 1–2h ahead of US Eastern)",
  available: false,
  availability:
    "Remote · São Paulo, Brazil (UTC-3), working US business hours.",
  bio: [
    "Fullstack engineer with 6 years building product platforms, mostly React and Node.js in TypeScript. I own features end-to-end: the UI, the API, the service behind it and the release. Right now I own the back office of a B2B platform for regulated gaming operators (React, NestJS, Java/Spring); before that I built the event-driven feeds platform and the newsroom's rich-text editor at Paris Match.",
    "The projects below are public rebuilds of patterns from my NDA work: Contentful apps and webhooks, a headless content API, real-time canvas and 3D/BIM. Read the code, click the demos.",
  ].join("\n\n"),
  stack: ["React", "Next.js", "TypeScript", "Node.js (NestJS, Express)", "Java (Spring Boot)", "Contentful", "GCP", "CI/CD"],
  certifications: ["Contentful Certified Professional"],
  languages: [
    { name: "English", level: "Professional" },
    { name: "German", level: "Limited working" },
    { name: "Russian", level: "Native" },
    { name: "Polish", level: "Elementary" },
    { name: "Spanish", level: "Limited working" },
  ],
  experience: [
    {
      company: "Anakatech (via InDevLabs)",
      title: "Senior Frontend Engineer · Contract",
      period: "2026 – Present",
      summary:
        "Own the back office of a B2B iGaming platform for regulated operators, the React/TypeScript app and its NestJS layer, and ship changes into the Java/Spring Boot core services through backend review: promo tools, reporting, Brazilian regulatory time-zone support, and a tournament-prize data migration.",
    },
    {
      company: "Paris Match",
      title: "Fullstack Engineer (CMS) · Part-time contract",
      period: "2025 – 2026",
      summary:
        "Built most of the event-driven feeds platform (Contentful webhooks → Cloud Run → Pub/Sub → Node.js worker → GCS/CDN): RSS, Google News sitemaps and partner feeds for MSN, Yahoo and Flipboard. Also built the newsroom's custom PlateJS rich-text editor app and the reading-time webhook service.",
      href: "/projects/rich-text-editor",
      hrefLabel: "Rich-text editor patterns rebuilt in public →",
    },
    {
      company: "EvionRP",
      title: "Senior Frontend Developer",
      period: "2023 – 2025",
      summary:
        "Frontend owner of a real-time multiplayer game client: built the core UI framework every in-game screen rendered through (web UI over the game via CEF) and the real-time systems on top — player economy, messaging, interactive maps.",
      href: "/projects/live-ops-console",
      hrefLabel: "Real-time patterns demoed in Pulse →",
    },
    {
      company: "Sberbank",
      title: "Frontend Developer",
      period: "2022 – 2023",
      summary:
        "Short engagement on internal tooling: introduced feature-toggling for safe releases and contributed to a shared React component library.",
    },
    {
      company: "Internetica",
      title: "Frontend Developer · Outsourcing",
      period: "2020 – 2022",
      summary:
        "Product work for telecom, marketplace and construction-tech clients: rewrote a hybrid app to native React Native (cutting launch time and UI latency) and built BIM viewer extensions on three.js — clash-review and element-grouping tooling on top of an embedded 3D component.",
      href: "/projects/bim-clash-viewer",
      hrefLabel: "BIM tooling reproduced in Girder →",
    },
  ],
  links: [
    { label: "Email", url: "mailto:contact@vitaliipopov.dev" },
    { label: "LinkedIn", url: "https://www.linkedin.com/in/vitalii-popov-front-dev" },
    { label: "GitHub", url: "https://github.com/Yeezy2277" },
  ],
};

async function run() {
  const client = contentfulManagement.createClient({ accessToken: TOKEN });
  const space = await client.getSpace(SPACE_ID);
  const env = await space.getEnvironment(ENVIRONMENT);

  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, f(v)]));

  const existing = await env.getEntries({ content_type: "profile", limit: 1 });
  let entry = existing.items[0];

  if (entry && isUpToDate(entry, fields, LOCALE)) {
    console.log("Profile already up to date — nothing to do.");
    return;
  }
  if (flags.dryRun) {
    console.log(`[dry-run] would ${entry ? "update" : "create"} the profile entry.`);
    return;
  }

  if (entry) {
    Object.assign(entry.fields, fields);
    entry = await entry.update();
    console.log("Updated profile entry.");
  } else {
    entry = await env.createEntry("profile", { fields });
    console.log("Created profile entry.");
  }
  await entry.publish();
  console.log("Published. The hub will pick it up on its next revalidation.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
