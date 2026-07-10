import { test } from "node:test";
import assert from "node:assert/strict";
import { initials, validateAuthorName } from "./author.ts";

test("initials: first letters of the first two words, uppercased", () => {
  assert.equal(initials("Vitaly Popov"), "VP");
  assert.equal(initials("madonna"), "M");
  assert.equal(initials("  ada   lovelace  king "), "AL");
});

test("initials: empty input degrades to a placeholder", () => {
  assert.equal(initials("   "), "?");
});

test("validateAuthorName: rejects too short and too long, trims first", () => {
  assert.equal(validateAuthorName(" A ").ok, false);
  assert.equal(validateAuthorName("Al").ok, true);
  assert.equal(validateAuthorName("x".repeat(81)).ok, false);
});
