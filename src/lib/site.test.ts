import { describe, expect, it } from "vitest";
import { siteUrl } from "./site";

describe("siteUrl", () => {
  it("uses a valid absolute URL, without a trailing path", () => {
    expect(siteUrl("https://example.com/")).toBe("https://example.com");
  });

  // Regression: a blank or scheme-less value crashed every page through new URL().
  it.each([undefined, "", "   ", "lumen.example.com", '"https://example.com"', "ftp://example.com"])(
    "falls back to production for %j",
    (raw) => {
      const url = siteUrl(raw);
      expect(url === "https://lumen.vitaliipopov.dev" || url === "https://example.com").toBe(true);
      expect(() => new URL(url)).not.toThrow();
    },
  );
});

describe("sample content", async () => {
  const { samplePost, samplePosts } = await import("./sample");
  it("is deterministic and newest first", () => {
    const dates = samplePosts().map((p) => p.publishedDate);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(samplePosts()).toEqual(samplePosts());
  });
  it("resolves every listed slug to a post with related posts", () => {
    for (const p of samplePosts()) expect(samplePost(p.slug)?.relatedPosts.length).toBeGreaterThan(0);
    expect(samplePost("nope")).toBeNull();
  });
});
