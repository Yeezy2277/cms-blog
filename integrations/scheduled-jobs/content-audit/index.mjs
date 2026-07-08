/**
 * Content audit — a scheduled CMA job.
 *
 * Free-tier replacement for the source platform's Cloud Scheduler + Cloud Run
 * jobs (mea-ranking-updater, content-expiry, …). Instead of a billed scheduler
 * triggering a container, a GitHub Actions cron runs this Node script on a
 * timer (see .github/workflows/scheduled-content-audit.yml).
 *
 * It reports editorial-health issues across all blogPost entries:
 *   - stale drafts (not updated in STALE_DAYS)
 *   - published posts missing an estimated reading time
 *   - duplicate slugs
 *
 * Output is written to the GitHub Step Summary; the job fails (exit 1) if any
 * duplicate slugs are found, so a broken canonical URL blocks silently no more.
 * Optionally posts the summary to SLACK_WEBHOOK_URL if set.
 */
import { appendFileSync } from "node:fs";
import contentfulManagement from "contentful-management";

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT ?? "master";
const STALE_DAYS = Number(process.env.STALE_DAYS ?? 14);
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const PAGE_SIZE = 100;

if (!SPACE_ID || !TOKEN) {
  console.error("Set CONTENTFUL_SPACE_ID and CONTENTFUL_MANAGEMENT_TOKEN.");
  process.exit(1);
}

const firstLocaleValue = (field) =>
  field && typeof field === "object" ? Object.values(field)[0] : undefined;

async function fetchAllPosts(env) {
  const items = [];
  let skip = 0;
  let total = Infinity;
  while (skip < total) {
    const resp = await env.getEntries({ content_type: "blogPost", limit: PAGE_SIZE, skip });
    total = resp.total;
    items.push(...resp.items);
    skip += resp.items.length;
    if (resp.items.length === 0) break;
  }
  return items;
}

function audit(posts) {
  const staleCutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
  const staleDrafts = [];
  const missingReadingTime = [];
  const slugMap = new Map();

  for (const entry of posts) {
    const title = firstLocaleValue(entry.fields.title) ?? "Untitled";
    const slug = firstLocaleValue(entry.fields.slug);
    const isPublished = Boolean(entry.sys.publishedAt);
    const updatedAt = new Date(entry.sys.updatedAt).getTime();

    if (!isPublished && updatedAt < staleCutoff) {
      staleDrafts.push({ id: entry.sys.id, title, updatedAt: entry.sys.updatedAt });
    }
    if (isPublished && !firstLocaleValue(entry.fields.estimatedReadingTime)) {
      missingReadingTime.push({ id: entry.sys.id, title });
    }
    if (slug) {
      const list = slugMap.get(slug) ?? [];
      list.push({ id: entry.sys.id, title });
      slugMap.set(slug, list);
    }
  }

  const duplicateSlugs = [...slugMap.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([slug, list]) => ({ slug, entries: list }));

  return { total: posts.length, staleDrafts, missingReadingTime, duplicateSlugs };
}

function renderMarkdown(report) {
  const lines = [
    "## Content audit",
    "",
    `- Posts scanned: **${report.total}**`,
    `- Stale drafts (> ${STALE_DAYS} days): **${report.staleDrafts.length}**`,
    `- Published, missing reading time: **${report.missingReadingTime.length}**`,
    `- Duplicate slugs: **${report.duplicateSlugs.length}**`,
    "",
  ];

  if (report.duplicateSlugs.length) {
    lines.push("### ⚠️ Duplicate slugs");
    for (const dup of report.duplicateSlugs) {
      lines.push(`- \`${dup.slug}\` → ${dup.entries.map((e) => e.title).join(", ")}`);
    }
    lines.push("");
  }
  if (report.staleDrafts.length) {
    lines.push("### 💤 Stale drafts");
    for (const d of report.staleDrafts) lines.push(`- ${d.title} (updated ${d.updatedAt})`);
    lines.push("");
  }
  return lines.join("\n");
}

async function run() {
  const client = contentfulManagement.createClient({ accessToken: TOKEN });
  const space = await client.getSpace(SPACE_ID);
  const env = await space.getEnvironment(ENVIRONMENT);

  const posts = await fetchAllPosts(env);
  const report = audit(posts);
  const markdown = renderMarkdown(report);

  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + "\n");
  }
  if (SLACK_WEBHOOK_URL) {
    await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: markdown }),
    }).catch((e) => console.warn("Slack notify failed:", e?.message ?? e));
  }

  // Fail the scheduled run when there are duplicate slugs — these are real bugs.
  if (report.duplicateSlugs.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
