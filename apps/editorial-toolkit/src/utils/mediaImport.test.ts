import { test } from "node:test";
import assert from "node:assert/strict";
import { parseImageUrl, assetTitleFromFileName } from "./mediaImport.ts";

test("parseImageUrl: accepts https image URLs and derives name/type", () => {
  const r = parseImageUrl("https://cdn.example.com/photos/hero-shot.webp?w=1200");
  assert.equal(r.ok, true);
  assert.equal(r.fileName, "hero-shot.webp");
  assert.equal(r.contentType, "image/webp");
});

test("parseImageUrl: decodes URL-encoded file names", () => {
  const r = parseImageUrl("https://cdn.example.com/my%20cover.png");
  assert.equal(r.ok, true);
  assert.equal(r.fileName, "my cover.png");
  assert.equal(r.contentType, "image/png");
});

test("parseImageUrl: rejects empty, malformed, http and non-image URLs", () => {
  assert.equal(parseImageUrl("").ok, false);
  assert.equal(parseImageUrl("not a url").ok, false);
  assert.equal(parseImageUrl("http://example.com/pic.png").ok, false, "http is not allowed");
  assert.equal(parseImageUrl("https://example.com/report.pdf").ok, false);
  assert.equal(parseImageUrl("https://example.com/no-extension").ok, false);
});

test("assetTitleFromFileName: prettifies kebab/snake case and strips extension", () => {
  assert.equal(assetTitleFromFileName("hero-shot_final.webp"), "Hero shot final");
  assert.equal(assetTitleFromFileName(".png"), "Imported image");
});
