/**
 * Content-audit engine — pure functions over entry snapshots, shared by the
 * Validation Hub page (browser, scoped CMA) and unit-testable in isolation.
 * Mirrors the checks the scheduled GitHub-Actions audit runs server-side.
 */

export type EntrySnapshot = {
  id: string;
  title: string;
  slug: string;
  tags: string[];
  hasCover: boolean;
  hasExcerpt: boolean;
  hasReadingTime: boolean;
  relatedIds: string[];
  publishedAt?: string;
  updatedAt: string;
};

type CmaFields = Record<string, Record<string, unknown> | undefined>;
type CmaItem = {
  sys: { id: string; updatedAt: string; publishedAt?: string };
  fields: CmaFields;
};

const first = (byLocale: Record<string, unknown> | undefined): unknown =>
  byLocale ? Object.values(byLocale)[0] : undefined;

const firstString = (byLocale: Record<string, unknown> | undefined): string => {
  const v = first(byLocale);
  return typeof v === "string" ? v : "";
};

/** Flatten a raw CMA entry (locale-keyed fields) into a checkable snapshot. */
export function snapshotFromCma(item: CmaItem): EntrySnapshot {
  const f = item.fields ?? {};
  const related = first(f.relatedPosts);
  const relatedIds = Array.isArray(related)
    ? related
        .map((l) => (l as { sys?: { id?: string } })?.sys?.id)
        .filter((id): id is string => typeof id === "string")
    : [];
  const tags = first(f.tags);

  return {
    id: item.sys.id,
    title: firstString(f.title) || "Untitled",
    slug: firstString(f.slug),
    tags: Array.isArray(tags) ? (tags as string[]) : [],
    hasCover: Boolean(first(f.coverImage)),
    hasExcerpt: firstString(f.excerpt).trim().length > 0,
    hasReadingTime: typeof first(f.estimatedReadingTime) === "number",
    relatedIds,
    publishedAt: item.sys.publishedAt,
    updatedAt: item.sys.updatedAt,
  };
}

/* ----- checks --------------------------------------------------------------- */

export type DuplicateSlugRow = { slug: string; entries: { id: string; title: string }[] };

export function findDuplicateSlugs(entries: EntrySnapshot[]): DuplicateSlugRow[] {
  const bySlug = new Map<string, { id: string; title: string }[]>();
  for (const e of entries) {
    if (!e.slug) continue;
    const list = bySlug.get(e.slug) ?? [];
    list.push({ id: e.id, title: e.title });
    bySlug.set(e.slug, list);
  }
  return [...bySlug.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([slug, list]) => ({ slug, entries: list }))
    .sort((a, b) => b.entries.length - a.entries.length);
}

/** Drafts (never published) not touched for `staleDays`. */
export function findStaleDrafts(
  entries: EntrySnapshot[],
  now: Date,
  staleDays: number,
): EntrySnapshot[] {
  const cutoff = now.getTime() - staleDays * 24 * 60 * 60 * 1000;
  return entries.filter(
    (e) => !e.publishedAt && new Date(e.updatedAt).getTime() < cutoff,
  );
}

export type MissingFieldsRow = { entry: EntrySnapshot; missing: string[] };

/** Editorial completeness: published posts should carry these fields. */
export function findMissingFields(entries: EntrySnapshot[]): MissingFieldsRow[] {
  const rows: MissingFieldsRow[] = [];
  for (const e of entries) {
    const missing: string[] = [];
    if (!e.hasCover) missing.push("cover image");
    if (e.tags.length === 0) missing.push("tags");
    if (!e.hasExcerpt) missing.push("excerpt");
    if (e.publishedAt && !e.hasReadingTime) missing.push("reading time");
    if (missing.length > 0) rows.push({ entry: e, missing });
  }
  return rows;
}

export type BrokenRelatedRow = { entry: EntrySnapshot; missingIds: string[] };

/** relatedPosts links that point at entries which no longer exist. */
export function findBrokenRelated(entries: EntrySnapshot[]): BrokenRelatedRow[] {
  const known = new Set(entries.map((e) => e.id));
  const rows: BrokenRelatedRow[] = [];
  for (const e of entries) {
    const missingIds = e.relatedIds.filter((id) => !known.has(id));
    if (missingIds.length > 0) rows.push({ entry: e, missingIds });
  }
  return rows;
}
