/**
 * Contentful space backup — a dependency-light JSON export for disaster
 * recovery. One shared free-tier space serves the whole portfolio (blog,
 * profile, projects, and Recall's prep content), so it's a single point of
 * failure — and CMS-authored blog posts aren't reproducible from the seeds.
 *
 * Dumps every content type + every entry + asset metadata to a timestamped
 * JSON file. Structured content only (no binary asset bytes); the asset `file`
 * URLs are recorded so images can be re-fetched if needed.
 *
 *   npm run backup                 # writes backups/<space>-<timestamp>.json
 *   npm run backup -- --out=dir    # write into a different directory
 *
 * In CI this runs on a schedule and uploads the file as a workflow artifact
 * (see .github/workflows/scheduled-backup.yml).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import contentfulManagement from "contentful-management";

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT ?? "master";

if (!SPACE_ID || !TOKEN) {
  console.error(
    "Missing CONTENTFUL_SPACE_ID / CONTENTFUL_MANAGEMENT_TOKEN.\n" +
      "Run via `npm run backup` (loads .env.local).",
  );
  process.exit(1);
}

const outArg = process.argv.find((a) => a.startsWith("--out="));
const outDir = outArg ? outArg.slice("--out=".length) : "backups";

/** Page through a CMA collection endpoint until every item is fetched. */
async function fetchAll(fetchPage) {
  const items = [];
  let skip = 0;
  const limit = 1000;
  for (;;) {
    const res = await fetchPage({ skip, limit });
    items.push(...res.items);
    skip += res.items.length;
    if (skip >= res.total || res.items.length === 0) break;
  }
  return items;
}

async function run() {
  const client = contentfulManagement.createClient({ accessToken: TOKEN });
  const space = await client.getSpace(SPACE_ID);
  const env = await space.getEnvironment(ENVIRONMENT);

  const [contentTypes, entries, assets, locales] = await Promise.all([
    fetchAll((q) => env.getContentTypes(q)),
    fetchAll((q) => env.getEntries(q)),
    fetchAll((q) => env.getAssets(q)),
    env.getLocales(),
  ]);

  const backup = {
    exportedAt: new Date().toISOString(),
    space: SPACE_ID,
    environment: ENVIRONMENT,
    counts: {
      contentTypes: contentTypes.length,
      entries: entries.length,
      assets: assets.length,
    },
    locales: locales.items.map((l) => l.code),
    // Keep the plain object payloads; the SDK wrapper methods don't serialise.
    contentTypes: contentTypes.map((c) => c.toPlainObject()),
    entries: entries.map((e) => e.toPlainObject()),
    assets: assets.map((a) => a.toPlainObject()),
  };

  await mkdir(outDir, { recursive: true });
  const stamp = backup.exportedAt.replace(/[:.]/g, "-");
  const file = join(outDir, `${SPACE_ID}-${ENVIRONMENT}-${stamp}.json`);
  await writeFile(file, JSON.stringify(backup, null, 2));

  console.log(
    `Backup written: ${file}\n  ${backup.counts.contentTypes} content types, ` +
      `${backup.counts.entries} entries, ${backup.counts.assets} assets.`,
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
