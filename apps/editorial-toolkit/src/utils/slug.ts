/**
 * Slug generation, validation and uniqueness — generalised from the source
 * platform's slug-field-editor, trimmed to the Lumen blogPost model (no
 * category trees / tag-type prefixes).
 */

const DEFAULT_STOP_WORDS = [
  "a", "an", "and", "the", "of", "to", "in", "on", "for", "with", "at", "by",
  "from", "as", "is", "it", "or", "this", "that",
];

export const MAX_SLUG_LENGTH = 120;

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function generateSlug(
  title: string,
  stopWords: string[] = DEFAULT_STOP_WORDS,
  maxLength: number = MAX_SLUG_LENGTH,
): string {
  if (!title || !title.trim()) return "";

  const stop = new Set(stopWords.map((w) => w.toLowerCase()));

  let slug = stripAccents(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 0 && !stop.has(word))
    .join("-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length > maxLength) {
    slug = slug.substring(0, maxLength).replace(/-+$/, "");
  }
  return slug;
}

export function validateSlug(
  slug: string,
  maxLength: number = MAX_SLUG_LENGTH,
): { isValid: boolean; error?: string } {
  if (!slug || !slug.trim()) {
    return { isValid: false, error: "Slug cannot be empty" };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return {
      isValid: false,
      error: "Use lowercase letters, numbers and single hyphens only",
    };
  }
  if (slug.length > maxLength) {
    return { isValid: false, error: `Maximum length is ${maxLength} characters` };
  }
  return { isValid: true };
}

/**
 * Check the slug is unique across published + draft blogPost entries, excluding
 * the current entry. Uses the App SDK's scoped CMA client.
 */
export async function checkSlugUniqueness(
  slug: string,
  contentTypeId: string,
  currentEntryId: string,
  cma: {
    entry: {
      getMany: (args: { query: Record<string, unknown> }) => Promise<{
        items: Array<{ sys: { id: string } }>;
      }>;
    };
  },
): Promise<{ isUnique: boolean; error?: string }> {
  if (!slug.trim()) return { isUnique: true };

  try {
    const entries = await cma.entry.getMany({
      query: {
        content_type: contentTypeId,
        "fields.slug": slug,
        limit: 10,
      },
    });

    const collisions = entries.items.filter((item) => item.sys.id !== currentEntryId);
    if (collisions.length > 0) {
      return {
        isUnique: false,
        error: `This slug is already used by ${collisions.length} other ${
          collisions.length === 1 ? "entry" : "entries"
        }`,
      };
    }
    return { isUnique: true };
  } catch {
    // Don't block saving if the check itself fails — surface a soft warning.
    return { isUnique: true, error: "Could not verify uniqueness — check manually" };
  }
}
