/**
 * Media-import helpers — pure URL parsing/validation for the Media field tool,
 * kept out of the widget so they are unit-testable. Generalised from the source
 * platform's media-link-upload app: paste a URL, get a Contentful asset.
 */

const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
};

export function parseImageUrl(raw: string): {
  ok: boolean;
  error?: string;
  url?: string;
  fileName?: string;
  contentType?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Paste an image URL first." };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }
  if (url.protocol !== "https:") {
    return { ok: false, error: "Only https:// URLs can be imported." };
  }

  // Derive a file name from the last path segment (query stripped).
  const segment = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "");
  const extension = segment.includes(".") ? segment.split(".").pop()!.toLowerCase() : "";
  const contentType = EXTENSION_TYPES[extension];
  if (!contentType) {
    return {
      ok: false,
      error: `The URL must point to an image file (${Object.keys(EXTENSION_TYPES).join(", ")}).`,
    };
  }

  return { ok: true, url: url.toString(), fileName: segment, contentType };
}

/** Title for the created asset: the file name without its extension, prettified. */
export function assetTitleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[a-z0-9]+$/i, "");
  const words = base.replace(/[-_]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Imported image";
}
