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

// Mirrors portfolio-hub/config/profile.ts and the résumé (~/Documents/resume/build.js).
const data = {
  name: "Vitalii Popov",
  headline: "Senior Full-stack Engineer",
  tagline: "who started in frontend: React, TypeScript, Next.js, Node.js",
  location: "Lisbon, Portugal",
  timezone: "Remote B2B contracts, UTC+0/+1, overlapping European and US East Coast hours",
  available: false,
  availability: "Remote B2B contractor based in Lisbon, Portugal (UTC+0/+1).",
  bio: [
    "I started in frontend and grew into full-stack product work. For six years I have built web apps in React and TypeScript: data-heavy tools, editors and real-time interfaces. Since 2025 I also take features through Node.js services and APIs. Right now I own the operator-facing app of a B2B iGaming platform from the React frontend through its NestJS BFF, with Java/Spring Boot changes going through backend review. Before that, most of what I built at Paris Match was Node.js: an event-driven feeds platform on Cloud Run and Pub/Sub, plus the newsroom's rich-text editor on Contentful.",
    "My client work is under NDA, so the projects below rebuild the same patterns in public: Contentful apps and webhooks, a feeds pipeline, a promo back office, a real-time canvas console and a BIM viewer. Each one is live, and each has a demo you can drive.",
  ].join("\n\n"),
  stack: ["React", "TypeScript", "Next.js", "Node.js (NestJS, Express)", "Contentful", "PlateJS", "Java/Spring Boot", "GCP"],
  languages: [
    { name: "English", level: "Professional" },
    { name: "Russian", level: "Native" },
    { name: "Spanish", level: "Limited working" },
  ],
  certifications: ["Contentful Certified Professional"],
  experience: [
    {
      company: "Anakatech (via InDevLabs)",
      title: "Senior Frontend Engineer, contract",
      period: "Jan 2026 – Present",
      summary:
        "Own the back-office frontend (React, TypeScript, MUI DataGrid) and its NestJS BFF for a B2B iGaming platform. Built the reporting and admin screens, added Brazilian regulatory time-zone support to reports and exports, and hardened permissions and brand scoping. Java/Spring Boot changes go through backend review.",
      href: "/projects/podium",
      hrefLabel: "Promo back office rebuilt in public: Podium",
    },
    {
      company: "Paris Match",
      title: "Frontend / Fullstack Engineer (CMS), part-time contract",
      period: "Nov 2025 – Jun 2026",
      summary:
        "Built the newsroom's rich-text editor on PlateJS as a Contentful app and most of the event-driven feeds platform: Contentful webhooks, a Cloud Run receiver, Pub/Sub and a Node.js worker that publishes RSS feeds and Google News sitemaps. Also built the reading-time webhook service.",
      href: "/projects/wire",
      hrefLabel: "Feeds pipeline rebuilt in public: Wire",
    },
    {
      company: "EvionRP",
      title: "Senior Frontend Engineer",
      period: "Jan 2023 – Jul 2025",
      summary:
        "Owned the frontend of a multiplayer game client in a team of about six. Built the UI framework all ~23 in-game screens rendered through, moved the codebase to Feature-Sliced Design, and led an Ant Design based UI kit for the redesign.",
      href: "/projects/live-ops-console",
      hrefLabel: "Real-time patterns shown in Pulse",
    },
    {
      company: "Sberbank",
      title: "Frontend Engineer",
      period: "May 2022 – Jan 2023",
      summary:
        "Introduced feature flags for gradual rollouts and built a shared React component library with charts for analytics dashboards.",
    },
    {
      company: "Internetica",
      title: "Frontend Engineer, outsourcing",
      period: "Apr 2020 – May 2022",
      summary:
        "Rewrote a hybrid mobile app in React Native and built three.js extensions for a construction-tech client's BIM viewer: 3D navigation and clash inspection.",
      href: "/projects/bim-clash-viewer",
      hrefLabel: "BIM tooling rebuilt in Girder",
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
