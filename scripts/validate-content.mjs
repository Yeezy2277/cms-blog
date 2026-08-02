/**
 * Content-integrity checks for the seed datasets.
 *
 * blogPost articles cross-reference each other by slug in `related`; nothing at
 * the type level guarantees those resolve, so a typo or a renamed slug ships a
 * broken relation. This asserts the graph is sound before it reaches Contentful.
 *
 *   npm run validate        # CLI, no credentials needed (used in CI)
 *   import { validateArticles } from "./validate-content.mjs"  // used by seeds
 */

/** Returns problems; throws when `throwOnError` and any exist. */
export function validateArticles(articles, { throwOnError = true } = {}) {
  const errors = [];
  const slugs = new Set();

  for (const a of articles) {
    if (!a.slug) {
      errors.push(`article missing slug: ${a.title ?? JSON.stringify(a)}`);
      continue;
    }
    if (slugs.has(a.slug)) errors.push(`duplicate article slug: ${a.slug}`);
    else slugs.add(a.slug);
    if (!a.title) errors.push(`article ${a.slug} missing title`);
    if (!a.body) errors.push(`article ${a.slug} missing body`);
    if (a.isSponsored && !a.sponsorName) {
      errors.push(`article ${a.slug} is sponsored but has no sponsorName`);
    }
  }

  for (const a of articles) {
    for (const rel of a.related ?? []) {
      if (rel === a.slug) errors.push(`article ${a.slug} lists itself in related`);
      else if (!slugs.has(rel)) {
        errors.push(`article ${a.slug} → broken related link "${rel}"`);
      }
    }
  }

  return finish(errors, throwOnError);
}

/** Returns problems; throws when `throwOnError` and any exist. */
export function validateProjects(projects, { throwOnError = true } = {}) {
  const errors = [];
  const slugs = new Set();

  for (const p of projects) {
    if (!p.slug) {
      errors.push(`project missing slug: ${p.title ?? JSON.stringify(p)}`);
      continue;
    }
    if (slugs.has(p.slug)) errors.push(`duplicate project slug: ${p.slug}`);
    else slugs.add(p.slug);
    if (!p.title) errors.push(`project ${p.slug} missing title`);
    if (p.liveUrl && !/^https?:\/\//.test(p.liveUrl)) {
      errors.push(`project ${p.slug} → liveUrl is not an absolute URL`);
    }
    if (p.repoUrl && !/^https?:\/\//.test(p.repoUrl)) {
      errors.push(`project ${p.slug} → repoUrl is not an absolute URL`);
    }
  }

  return finish(errors, throwOnError);
}

function finish(errors, throwOnError) {
  if (errors.length && throwOnError) {
    throw new Error(
      `Content validation failed (${errors.length}):\n  - ${errors.join("\n  - ")}`,
    );
  }
  return errors;
}

// CLI: validate every seed dataset with no Contentful credentials.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [{ articles }, { projects }] = await Promise.all([
    import("./seed.mjs"),
    import("./seed-projects.mjs"),
  ]);
  const errors = [
    ...validateArticles(articles, { throwOnError: false }),
    ...validateProjects(projects, { throwOnError: false }),
  ];
  if (errors.length) {
    console.error(`✗ ${errors.length} content problem(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(
    `✓ content OK — ${articles.length} articles, ${projects.length} projects, all links resolve.`,
  );
}
