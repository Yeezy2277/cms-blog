import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSlug, validateSlug, checkSlugUniqueness, MAX_SLUG_LENGTH } from "./slug.ts";

test("generateSlug: lowercases, hyphenates and strips punctuation", () => {
  assert.equal(generateSlug("Hello, World!"), "hello-world");
});

test("generateSlug: drops stop words", () => {
  assert.equal(
    generateSlug("The Quiet Power of a Typed Webhook"),
    "quiet-power-typed-webhook",
  );
});

test("generateSlug: strips accents", () => {
  assert.equal(generateSlug("Café Déjà Vu"), "cafe-deja-vu");
});

test("generateSlug: collapses repeated separators and trims hyphens", () => {
  assert.equal(generateSlug("  spaced --- out   title  "), "spaced-out-title");
});

test("generateSlug: empty and whitespace-only titles give empty slug", () => {
  assert.equal(generateSlug(""), "");
  assert.equal(generateSlug("   "), "");
});

test("generateSlug: respects max length without trailing hyphen", () => {
  const slug = generateSlug("word ".repeat(60));
  assert.ok(slug.length <= MAX_SLUG_LENGTH);
  assert.ok(!slug.endsWith("-"));
});

test("validateSlug: accepts kebab-case", () => {
  assert.equal(validateSlug("valid-slug-123").isValid, true);
});

test("validateSlug: rejects empty, uppercase, and double hyphens", () => {
  assert.equal(validateSlug("").isValid, false);
  assert.equal(validateSlug("Not-Valid").isValid, false);
  assert.equal(validateSlug("double--hyphen").isValid, false);
});

test("checkSlugUniqueness: collision with another entry is reported", async () => {
  const cma = {
    entry: {
      getMany: async () => ({ items: [{ sys: { id: "other" } }] }),
    },
  };
  const res = await checkSlugUniqueness("taken", "blogPost", "current", cma);
  assert.equal(res.isUnique, false);
});

test("checkSlugUniqueness: the current entry itself is not a collision", async () => {
  const cma = {
    entry: {
      getMany: async () => ({ items: [{ sys: { id: "current" } }] }),
    },
  };
  const res = await checkSlugUniqueness("mine", "blogPost", "current", cma);
  assert.equal(res.isUnique, true);
});

test("checkSlugUniqueness: a failing CMA degrades to a soft warning, not a block", async () => {
  const cma = {
    entry: {
      getMany: async () => {
        throw new Error("network");
      },
    },
  };
  const res = await checkSlugUniqueness("any", "blogPost", "current", cma);
  assert.equal(res.isUnique, true);
  assert.ok(res.error);
});
