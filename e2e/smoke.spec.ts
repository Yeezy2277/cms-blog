import { test, expect } from "@playwright/test";

/**
 * Smoke tests — the top of the testing pyramid. Not exhaustive; they prove the
 * critical paths render and connect: home loads with the CMS-driven listing, an
 * article opens, the RSS feed is served, and 404s are handled. They run against
 * a local build in CI, or any BASE_URL (e.g. the live deployment).
 */

test("home page renders the masthead and hero", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Lumen/i }).first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Writing on craft, systems/i }),
  ).toBeVisible();
});

test("home lists articles and an article page opens", async ({ page }) => {
  await page.goto("/");

  const posts = page.locator('a[href^="/posts/"]');
  // In environments without CMS credentials (e.g. CI missing the Contentful
  // token) the listing is empty — skip rather than fail. With content present
  // this exercises the real article-open path.
  const count = await posts.count();
  test.skip(count === 0, "No published articles available (Contentful credentials absent)");

  const firstPost = posts.first();
  await expect(firstPost).toBeVisible();
  await firstPost.click();

  await expect(page).toHaveURL(/\/posts\/.+/);
  await expect(page.getByRole("article").or(page.locator("h1")).first()).toBeVisible();
});

test("theme toggle switches the color scheme", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: /theme|dark|light/i }).first();
  if (await toggle.count()) {
    const before = await page.locator("html").getAttribute("data-theme");
    await toggle.click();
    await expect
      .poll(() => page.locator("html").getAttribute("data-theme"))
      .not.toBe(before);
  }
});

test("RSS feed is served as XML", async ({ request }) => {
  const res = await request.get("/feed.xml");
  expect(res.ok()).toBeTruthy();
  expect(res.headers()["content-type"]).toMatch(/xml/);
  expect(await res.text()).toContain("<rss");
});

test("unknown route returns the not-found page", async ({ page }) => {
  const res = await page.goto("/posts/this-slug-does-not-exist-42");
  expect(res?.status()).toBe(404);
});
