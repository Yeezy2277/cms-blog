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
  timezone: "UTC+4 · comfortable in EU / Central-European hours",
  available: true,
  availability: "Open to long-term remote B2B — European teams, incl. DACH",
  bio: [
    "Senior Frontend Engineer with 5+ years building product-oriented web platforms in React, Next.js and TypeScript. I work best when I own the frontend end-to-end — component architecture, performance, and the delivery pipeline that ships it — and I'll happily pick up the DevOps slack so delivery stays unblocked.",
    "Everything on this page is live, inspectable, and built on free infrastructure: a public reproduction of the kind of Contentful platform work I do day to day — custom CMS apps, webhooks, content-model migrations and CI/CD — so you can read the code, not just the résumé.",
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
      company: "Confidential European Media Client",
      title: "Frontend Developer",
      period: "2025 – 2026",
      summary:
        "Owned the frontend of a Contentful-based media platform (React, Next.js, TypeScript): custom in-CMS editor apps, an RSS syndication system, and GCP deployments with GitHub Actions CI/CD.",
      href: "/projects/cms-blog",
      hrefLabel: "This portfolio reproduces that work in public →",
    },
    {
      company: "EvionRP",
      title: "Senior Frontend Developer",
      period: "2023 – 2025",
      summary:
        "Frontend owner of a real-time multiplayer game client: built the core UI framework every in-game screen rendered through (web UI over the game via CEF) and real-time systems — player economy, messaging, interactive maps.",
    },
    {
      company: "Sberbank · Internetica",
      title: "Frontend Developer",
      period: "2020 – 2022",
      summary:
        "Reusable component libraries, feature-toggling to de-risk releases, and a React Native rewrite that cut launch time and UI latency for a web marketplace.",
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
