/**
 * Shared Contentful Management helpers for the seed scripts.
 *
 * Centralises the three things every seed needs and used to re-implement:
 *   - config resolution (with a clear error when env is missing),
 *   - change detection (skip the update+publish when nothing actually changed),
 *   - pruning (delete published entries whose slug is no longer in the dataset).
 *
 * Env is loaded by the npm script via `node --env-file=.env.local`, so these
 * helpers only read `process.env`.
 */

export function getConfig() {
  const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
  const TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
  const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT ?? "master";
  const LOCALE = process.env.CONTENTFUL_LOCALE ?? "en-US";
  if (!SPACE_ID || !TOKEN) {
    console.error(
      "Missing CONTENTFUL_SPACE_ID / CONTENTFUL_MANAGEMENT_TOKEN.\n" +
        "Run via the npm script (which loads .env.local), e.g. `npm run seed`.",
    );
    process.exit(1);
  }
  return { SPACE_ID, TOKEN, ENVIRONMENT, LOCALE };
}

/** Parse the flags every seed understands: --dry-run and --prune. */
export function parseFlags(argv = process.argv.slice(2)) {
  return {
    dryRun: argv.includes("--dry-run"),
    prune: argv.includes("--prune"),
  };
}

export async function getEnvironment(cfg) {
  const { default: contentfulManagement } = await import("contentful-management");
  const client = contentfulManagement.createClient({ accessToken: cfg.TOKEN });
  const space = await client.getSpace(cfg.SPACE_ID);
  return space.getEnvironment(cfg.ENVIRONMENT);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;

/**
 * Structural equality tuned for CMA field values: object keys compared as a set
 * (Contentful reorders them), arrays compared in order, and ISO date strings
 * compared by instant (Contentful normalises "…Z" ↔ "…000Z").
 */
function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;

  if (typeof a === "string" && typeof b === "string") {
    if (ISO_DATE.test(a) && ISO_DATE.test(b)) {
      const da = Date.parse(a);
      const db = Date.parse(b);
      if (!Number.isNaN(da) && !Number.isNaN(db)) return da === db;
    }
    return false;
  }
  if (typeof a !== "object" || typeof b !== "object") return a === b;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }

  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(
    (k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]),
  );
}

/**
 * True when the entry already stores exactly `fields` (compared per-locale) AND
 * is cleanly published — i.e. re-seeding it would be a no-op.
 */
export function isUpToDate(entry, fields, locale) {
  if (!entry.isPublished() || entry.isUpdated()) return false;
  for (const key of Object.keys(fields)) {
    const next = fields[key]?.[locale];
    const cur = entry.fields?.[key]?.[locale];
    if (!deepEqual(cur, next)) return false;
  }
  return true;
}

/**
 * Create-or-update an entry keyed by `slug`, skipping the write when the stored
 * value already matches. `cache` is a Map<slug, Entry> preloaded by the caller.
 * `stats` accumulates {created, updated, unchanged}.
 */
export async function upsertBySlug(env, cache, contentType, slug, fields, opts) {
  const { locale, stats, dryRun } = opts;
  let entry = cache.get(slug);

  if (entry) {
    if (isUpToDate(entry, fields, locale)) {
      stats.unchanged++;
      return entry;
    }
    if (dryRun) {
      stats.updated++;
      return entry;
    }
    Object.assign(entry.fields, fields);
    entry = await entry.update();
    entry = await entry.publish();
    stats.updated++;
    cache.set(slug, entry);
    return entry;
  }

  if (dryRun) {
    stats.created++;
    return null;
  }
  entry = await env.createEntry(contentType, { fields });
  entry = await entry.publish();
  stats.created++;
  cache.set(slug, entry);
  return entry;
}

/** Load all entries of a content type into a Map keyed by slug. */
export async function loadBySlug(env, contentType, locale) {
  const map = new Map();
  const res = await env.getEntries({ content_type: contentType, limit: 1000 });
  for (const e of res.items) {
    const slug = e.fields.slug?.[locale];
    if (slug) map.set(slug, e);
  }
  return map;
}

/**
 * Delete entries whose slug is not in `keepSlugs`. Unpublishes first. Returns
 * the number removed. In dry-run mode it only logs what it would delete.
 */
export async function prune(cache, keepSlugs, opts) {
  const { dryRun, label = "entries" } = opts;
  const keep = new Set(keepSlugs);
  let removed = 0;
  for (const [slug, entry] of cache) {
    if (keep.has(slug)) continue;
    console.log(`  ${dryRun ? "would delete" : "deleting"} orphan ${label}: ${slug}`);
    if (!dryRun) {
      if (entry.isPublished()) await entry.unpublish();
      await entry.delete();
    }
    removed++;
  }
  return removed;
}

/** One-line summary line for a seed run. */
export function reportStats(stats, { dryRun } = {}) {
  const prefix = dryRun ? "[dry-run] " : "";
  console.log(
    `${prefix}created ${stats.created}, updated ${stats.updated}, ` +
      `unchanged ${stats.unchanged}, deleted ${stats.deleted ?? 0}`,
  );
}
