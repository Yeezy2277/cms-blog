import { test } from "node:test";
import assert from "node:assert/strict";
import {
  snapshotFromCma,
  findDuplicateSlugs,
  findStaleDrafts,
  findMissingFields,
  findBrokenRelated,
  type EntrySnapshot,
} from "./audit.ts";

const snap = (id: string, over: Partial<EntrySnapshot> = {}): EntrySnapshot => ({
  id,
  title: id,
  slug: id,
  tags: ["x"],
  hasCover: true,
  hasExcerpt: true,
  hasReadingTime: true,
  relatedIds: [],
  publishedAt: "2026-06-01T00:00:00Z",
  updatedAt: "2026-06-01T00:00:00Z",
  ...over,
});

test("snapshotFromCma: unwraps locale-keyed fields and link arrays", () => {
  const s = snapshotFromCma({
    sys: { id: "e1", updatedAt: "2026-01-01T00:00:00Z", publishedAt: "2026-01-02T00:00:00Z" },
    fields: {
      title: { "en-US": "Hello" },
      slug: { "en-US": "hello" },
      tags: { "en-US": ["a", "b"] },
      excerpt: { "en-US": "  " },
      estimatedReadingTime: { "en-US": 3 },
      coverImage: { "en-US": { sys: { id: "asset1" } } },
      relatedPosts: { "en-US": [{ sys: { id: "e2" } }, { sys: {} }] },
    },
  });
  assert.equal(s.title, "Hello");
  assert.deepEqual(s.tags, ["a", "b"]);
  assert.equal(s.hasExcerpt, false, "whitespace-only excerpt counts as missing");
  assert.equal(s.hasReadingTime, true);
  assert.equal(s.hasCover, true);
  assert.deepEqual(s.relatedIds, ["e2"], "links without an id are dropped");
});

test("snapshotFromCma: missing fields degrade to safe defaults", () => {
  const s = snapshotFromCma({ sys: { id: "e1", updatedAt: "2026-01-01T00:00:00Z" }, fields: {} });
  assert.equal(s.title, "Untitled");
  assert.equal(s.slug, "");
  assert.deepEqual(s.tags, []);
  assert.equal(s.hasCover, false);
});

test("findDuplicateSlugs: groups and sorts by count, ignores empty slugs", () => {
  const rows = findDuplicateSlugs([
    snap("a", { slug: "dup" }),
    snap("b", { slug: "dup" }),
    snap("c", { slug: "unique" }),
    snap("d", { slug: "" }),
    snap("e", { slug: "" }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.slug, "dup");
  assert.equal(rows[0]!.entries.length, 2);
});

test("findStaleDrafts: old unpublished entries only", () => {
  const now = new Date("2026-07-01T00:00:00Z");
  const rows = findStaleDrafts(
    [
      snap("fresh-draft", { publishedAt: undefined, updatedAt: "2026-06-25T00:00:00Z" }),
      snap("old-draft", { publishedAt: undefined, updatedAt: "2026-05-01T00:00:00Z" }),
      snap("old-published", { updatedAt: "2026-01-01T00:00:00Z" }),
    ],
    now,
    14,
  );
  assert.deepEqual(rows.map((r) => r.id), ["old-draft"]);
});

test("findMissingFields: collects all gaps, reading time only for published", () => {
  const rows = findMissingFields([
    snap("ok"),
    snap("bare", { hasCover: false, tags: [], hasExcerpt: false }),
    snap("draft-no-rt", { publishedAt: undefined, hasReadingTime: false }),
    snap("pub-no-rt", { hasReadingTime: false }),
  ]);
  const byId = new Map(rows.map((r) => [r.entry.id, r.missing]));
  assert.equal(byId.has("ok"), false);
  assert.deepEqual(byId.get("bare"), ["cover image", "tags", "excerpt"]);
  assert.equal(byId.has("draft-no-rt"), false, "drafts are not expected to have reading time");
  assert.deepEqual(byId.get("pub-no-rt"), ["reading time"]);
});

test("findBrokenRelated: flags links to entries outside the set", () => {
  const rows = findBrokenRelated([
    snap("a", { relatedIds: ["b", "ghost"] }),
    snap("b", { relatedIds: ["a"] }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.entry.id, "a");
  assert.deepEqual(rows[0]!.missingIds, ["ghost"]);
});
