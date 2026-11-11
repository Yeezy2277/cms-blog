const FALLBACK = "https://lumen.vitaliipopov.dev";

/**
 * The public site URL. A blank or scheme-less NEXT_PUBLIC_SITE_URL (easy to
 * save in a dashboard or .env) used to crash every page via `new URL()`;
 * anything that isn't an absolute http(s) URL falls back to production.
 */
export function siteUrl(raw: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  const value = raw?.trim().replace(/^["']|["']$/g, "");
  if (!value) return FALLBACK;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : FALLBACK;
  } catch {
    return FALLBACK;
  }
}
