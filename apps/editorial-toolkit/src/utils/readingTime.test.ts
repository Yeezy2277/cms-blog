import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countWords,
  calcReadingMinutes,
  richTextToPlainText,
  WORDS_PER_MINUTE,
} from "./readingTime.ts";

const t = (value: string) => ({ nodeType: "text", value, content: [] });
const p = (...content: unknown[]) => ({ nodeType: "paragraph", content });
const doc = (...content: unknown[]) => ({ nodeType: "document", content });

test("countWords: whitespace-separated words", () => {
  assert.equal(countWords("one two  three\nfour"), 4);
});

test("countWords: empty and blank strings count zero", () => {
  assert.equal(countWords(""), 0);
  assert.equal(countWords("   \n "), 0);
});

test("countWords: CJK fallback estimates by characters", () => {
  // No whitespace word boundaries — falls back to ceil(chars / 5).
  assert.equal(countWords("这是一段没有空格的中文文本"), Math.ceil(13 / 5));
});

test("richTextToPlainText: flattens nested blocks", () => {
  const d = doc(p(t("Hello "), t("world")), p(t("second paragraph")));
  const text = richTextToPlainText(d as never);
  assert.ok(text.includes("Hello world"));
  assert.ok(text.includes("second paragraph"));
});

test("richTextToPlainText: null and non-document input give empty string", () => {
  assert.equal(richTextToPlainText(null), "");
  assert.equal(richTextToPlainText({ nodeType: "text", value: "x" } as never), "");
});

test("calcReadingMinutes: empty body is 0, short body rounds up to 1", () => {
  assert.equal(calcReadingMinutes(doc() as never), 0);
  assert.equal(calcReadingMinutes(doc(p(t("just a few words"))) as never), 1);
});

test("calcReadingMinutes: matches the webhook formula max(1, round(words/WPM))", () => {
  const words = Array.from({ length: WORDS_PER_MINUTE * 2 }, (_, i) => `w${i}`).join(" ");
  assert.equal(calcReadingMinutes(doc(p(t(words))) as never), 2);
});
