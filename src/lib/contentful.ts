import { createClient, type Asset, type ContentfulClientApi } from "contentful";

import type {
  AuthorFields,
  BlogPostEntry,
  BlogPostFields,
  BlogPostSkeleton,
  ImageView,
  PostDetail,
  PostSummary,
} from "./types";

/**
 * Single source for the Contentful client.
 *
 * We pick the delivery vs preview token at module load based on
 * CONTENTFUL_PREVIEW. Preview lets us render unpublished drafts locally
 * without touching production content — the same pattern used for a real
 * editorial "preview" environment.
 */
function getClient(): ContentfulClientApi<undefined> | null {
  const space = process.env.CONTENTFUL_SPACE_ID;
  const usePreview = process.env.CONTENTFUL_PREVIEW === "true";
  const accessToken = usePreview
    ? process.env.CONTENTFUL_PREVIEW_ACCESS_TOKEN
    : process.env.CONTENTFUL_ACCESS_TOKEN;

  // Allow `npm run build` / clone-and-go without credentials: we warn and let
  // the data functions return empty results, so the site builds and renders
  // its empty states instead of hard-crashing. Real creds light it up.
  if (!space || !accessToken || space === "your_space_id") {
    console.warn(
      "[contentful] No credentials set — returning empty content. Add them to .env.local.",
    );
    return null;
  }

  return createClient({
    space,
    accessToken,
    host: usePreview ? "preview.contentful.com" : "cdn.contentful.com",
  });
}

const client = getClient();

/* -------------------------------------------------------------------------- */
/*  Mappers: raw Contentful entry  ->  flat UI view model                      */
/* -------------------------------------------------------------------------- */

function mapImage(asset: Asset | undefined, fallbackAlt: string): ImageView | null {
  if (!asset?.fields?.file?.url) return null;
  const file = asset.fields.file;
  const details = file.details;
  const dimensions =
    details && "image" in details && details.image
      ? details.image
      : { width: 1200, height: 630 };

  return {
    url: `https:${file.url}`,
    width: dimensions.width,
    height: dimensions.height,
    alt:
      typeof asset.fields.title === "string" && asset.fields.title.length > 0
        ? asset.fields.title
        : fallbackAlt,
  };
}

/**
 * Linked entries (the post's author) come back resolved when we request them
 * with `include`. The SDK types them as a union of "resolved entry" | "link",
 * so we read the resolved fields defensively via a small helper.
 */
function resolveAuthor(
  author: BlogPostFields["author"],
): AuthorFields | null {
  if (author && "fields" in author) {
    return author.fields as AuthorFields;
  }
  return null;
}

function toSummary(entry: BlogPostEntry): PostSummary {
  const { fields } = entry;
  const author = resolveAuthor(fields.author);

  const isSponsored = fields.isSponsored === true;

  return {
    title: fields.title,
    slug: fields.slug,
    excerpt: fields.excerpt,
    publishedDate: fields.publishedDate,
    tags: fields.tags ?? [],
    coverImage: mapImage(fields.coverImage, fields.title),
    authorName: author?.name ?? null,
    readingTime:
      typeof fields.estimatedReadingTime === "number" && fields.estimatedReadingTime > 0
        ? fields.estimatedReadingTime
        : null,
    isSponsored,
    // Only surface the sponsor when the post is actually flagged sponsored —
    // mirrors the gated sponsor field in the CMS.
    sponsorName: isSponsored ? fields.sponsorName ?? null : null,
  };
}

function toDetail(entry: BlogPostEntry): PostDetail {
  const { fields } = entry;
  const author = resolveAuthor(fields.author);

  // Linked entries resolve when fetched with `include`; defensively keep only
  // those that came back as full entries (not unresolved links).
  const related = ((fields.relatedPosts ?? []) as unknown as BlogPostEntry[])
    .filter((ref) => !!ref && typeof ref === "object" && "fields" in ref)
    .map(toSummary);

  return {
    ...toSummary(entry),
    body: fields.body,
    authorTitle: author?.title ?? null,
    authorAvatar: author ? mapImage(author.avatar, author.name) : null,
    relatedPosts: related,
  };
}

/* -------------------------------------------------------------------------- */
/*  Public data-access API                                                     */
/* -------------------------------------------------------------------------- */

export async function getAllPosts(): Promise<PostSummary[]> {
  if (!client) return [];
  try {
    const entries = await client.getEntries<BlogPostSkeleton>({
      content_type: "blogPost",
      order: ["-fields.publishedDate"] as unknown as ["sys.createdAt"],
      include: 2,
    });
    return entries.items.map(toSummary);
  } catch (error) {
    console.error("[contentful] Failed to fetch posts:", error);
    return [];
  }
}

export async function getPostBySlug(slug: string): Promise<PostDetail | null> {
  if (!client) return null;
  try {
    const entries = await client.getEntries<BlogPostSkeleton>({
      content_type: "blogPost",
      "fields.slug": slug,
      include: 2,
      limit: 1,
    } as Record<string, unknown>);
    const entry = entries.items[0];
    return entry ? toDetail(entry) : null;
  } catch (error) {
    console.error(`[contentful] Failed to fetch post "${slug}":`, error);
    return null;
  }
}

export async function getAllSlugs(): Promise<string[]> {
  if (!client) return [];
  try {
    const entries = await client.getEntries<BlogPostSkeleton>({
      content_type: "blogPost",
      select: ["fields.slug"],
      limit: 1000,
    });
    return entries.items
      .map((item) => item.fields.slug as string | undefined)
      .filter((slug): slug is string => typeof slug === "string");
  } catch (error) {
    console.error("[contentful] Failed to fetch slugs:", error);
    return [];
  }
}

export function getAllTags(posts: PostSummary[]): string[] {
  const tagSet = new Set<string>();
  for (const post of posts) {
    for (const tag of post.tags) tagSet.add(tag);
  }
  return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
}
