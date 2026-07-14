/**
 * Seed the singleton `profile` entry the portfolio hub renders in its hero.
 * Idempotent: updates the existing entry if one exists. Run after migration 002.
 *
 *   set -a; source .env.local; set +a
 *   npm run seed:profile
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

const data = {
  name: "Vitalii Popov",
  headline: "Senior Frontend Engineer",
  tagline: "React · Next.js · TypeScript · Headless CMS (Contentful)",
  location: "Tbilisi, Georgia",
  timezone: "Remote · daily overlap with US East Coast hours",
  available: true,
  availability: "Open to remote roles with US teams — full-time or B2B contract",
  bio: [
    "Senior Frontend Engineer with 5+ years shipping product web platforms in React, Next.js and TypeScript. I own the frontend end-to-end — architecture, performance, and the CI/CD pipeline that ships it — and I pick up the DevOps slack so delivery never blocks on someone else.",
    "Don't take the résumé's word for it: everything on this page is live and inspectable. It's a public reproduction of my production Contentful platform work — custom CMS apps, webhooks, content-model migrations, quality gates — plus real-time canvas and 3D/BIM work. Read the code, click the demos.",
  ].join("\n\n"),
  stack: ["React", "Next.js", "TypeScript", "React Native", "Contentful", "GCP", "CI/CD (GitHub Actions)"],
  certifications: ["Contentful Certified Professional", "Meta — Introduction to Front-End Development"],
  languages: [
    { name: "English", level: "Professional" },
    { name: "German", level: "Limited working" },
    { name: "Russian", level: "Native" },
    { name: "Polish", level: "Elementary" },
    { name: "Spanish", level: "Limited working" },
  ],
  experience: [
    {
      company: "Confidential Media Client (EU)",
      title: "Frontend Developer",
      period: "2025 – 2026",
      summary:
        "Owned the frontend of a Contentful-based media platform (React, Next.js, TypeScript): shipped custom in-CMS editor apps, an RSS syndication system, and ran GCP deployments with GitHub Actions CI/CD solo.",
      href: "/projects/cms-blog",
      hrefLabel: "This portfolio reproduces that work in public →",
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
      company: "Internetica",
      title: "Frontend Developer · Outsourcing",
      period: "2020 – 2022",
      summary:
        "Product work for telecom, marketplace and construction-tech clients: rewrote a hybrid app to native React Native (cutting launch time and UI latency) and built BIM viewer extensions on three.js — clash-review and element-grouping tooling on top of an embedded 3D component.",
      href: "/projects/bim-clash-viewer",
      hrefLabel: "BIM tooling reproduced in Girder →",
    },
    {
      company: "Sberbank",
      title: "Frontend Developer",
      period: "2022",
      summary:
        "Short engagement on internal tooling: introduced feature-toggling for safe releases and contributed to a shared React component library.",
    },
  ],
  links: [
    { label: "Email", url: "mailto:vital.popov.03@gmail.com" },
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
