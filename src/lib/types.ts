import type { Document } from "@contentful/rich-text-types";
import type { Asset, Entry, EntrySkeletonType } from "contentful";

/**
 * Content model as defined in Contentful.
 *
 * These mirror the "Blog Post" and "Author" content types. Keeping the
 * skeleton types here (rather than inline) gives us one source of truth and
 * lets the typed client (`lib/contentful.ts`) return fully-typed entries.
 */

export interface AuthorFields {
  name: string;
  title?: string;
  avatar?: Asset;
}

export type AuthorSkeleton = EntrySkeletonType<AuthorFields, "author">;
export type AuthorEntry = Entry<AuthorSkeleton, undefined, string>;

export interface BlogPostFields {
  title: string;
  slug: string;
  excerpt: string;
  body: Document;
  coverImage?: Asset;
  publishedDate: string;
  tags?: string[];
  author?: AuthorEntry;
  estimatedReadingTime?: number;
  isSponsored?: boolean;
  sponsorName?: string;
  relatedPosts?: BlogPostEntry[];
}

export type BlogPostSkeleton = EntrySkeletonType<BlogPostFields, "blogPost">;
export type BlogPostEntry = Entry<BlogPostSkeleton, undefined, string>;

/**
 * The shape our UI actually consumes. We deliberately map the raw Contentful
 * entry into this flat, presentation-friendly view model so that components
 * never depend on the CMS's nested entry structure — if the content model
 * changes, the mapping in `lib/contentful.ts` absorbs it, not every component.
 */
export interface PostSummary {
  title: string;
  slug: string;
  excerpt: string;
  publishedDate: string;
  tags: string[];
  coverImage: ImageView | null;
  authorName: string | null;
  readingTime: number | null;
  isSponsored: boolean;
  sponsorName: string | null;
}

export interface PostDetail extends PostSummary {
  body: Document;
  authorTitle: string | null;
  authorAvatar: ImageView | null;
  relatedPosts: PostSummary[];
}

export interface ImageView {
  url: string;
  width: number;
  height: number;
  alt: string;
}
