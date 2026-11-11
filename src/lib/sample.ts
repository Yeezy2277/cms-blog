import { BLOCKS, type Document } from "@contentful/rich-text-types";
import type { PostDetail, PostSummary } from "./types";

/**
 * Stand-in content for running without Contentful credentials, so a fresh
 * clone renders a real front page (scope rule: zero-config demo mode). Fixed
 * dates keep the output identical on every run.
 */
const doc = (...paragraphs: string[]): Document => ({
  nodeType: BLOCKS.DOCUMENT,
  data: {},
  content: paragraphs.map((value) => ({
    nodeType: BLOCKS.PARAGRAPH,
    data: {},
    content: [{ nodeType: "text", value, marks: [], data: {} }],
  })),
});

type Sample = Omit<PostDetail, "relatedPosts">;

const POSTS: Sample[] = [
  {
    title: "When a webhook calls itself",
    slug: "demo-webhook-loops",
    excerpt: "A sync job writes back to the CMS, the CMS fires the webhook that started it, and the loop runs all night. How to design it out.",
    publishedDate: "2026-10-28T09:00:00.000Z",
    tags: ["systems", "webhooks"],
    coverImage: null,
    authorName: "Lumen Desk",
    authorTitle: "Sample content",
    authorAvatar: null,
    readingTime: 6,
    isSponsored: false,
    sponsorName: null,
    body: doc(
      "Every integration that writes back to the system that notifies it is a loop waiting for a trigger. The fix is rarely a flag; it is a design where repeating the work is harmless.",
      "Filter at the edge, collapse duplicates inside a short window, and make the worker idempotent by rebuilding from current state and writing only what changed.",
    ),
  },
  {
    title: "Editors are users too",
    slug: "demo-editors-are-users",
    excerpt: "The content model is a product surface. Field names, validations and help text decide whether a newsroom ships at 6pm or at midnight.",
    publishedDate: "2026-10-14T09:00:00.000Z",
    tags: ["craft", "cms"],
    coverImage: null,
    authorName: "Lumen Desk",
    authorTitle: "Sample content",
    authorAvatar: null,
    readingTime: 4,
    isSponsored: false,
    sponsorName: null,
    body: doc(
      "A field called “body2” is a bug report waiting to happen. Name fields for the editor's task, validate what can be validated, and put the rule in the help text.",
      "Most editorial mistakes are interface mistakes that were never designed out.",
    ),
  },
  {
    title: "Static by default, fresh on publish",
    slug: "demo-static-fresh",
    excerpt: "Incremental regeneration gives a publication CDN speed without stale pages, as long as the publish event reaches the cache.",
    publishedDate: "2026-09-30T09:00:00.000Z",
    tags: ["systems", "frontend"],
    coverImage: null,
    authorName: "Lumen Desk",
    authorTitle: "Sample content",
    authorAvatar: null,
    readingTime: 5,
    isSponsored: false,
    sponsorName: null,
    body: doc(
      "Render once, serve from the edge, and let a webhook tell the cache when a story changed. Readers get static speed; editors get their correction live in seconds.",
    ),
  },
  {
    title: "A field guide to rich text",
    slug: "demo-rich-text",
    excerpt: "Structured rich text survives redesigns that HTML blobs don't. What to model as nodes, and what to leave as marks.",
    publishedDate: "2026-09-12T09:00:00.000Z",
    tags: ["craft", "frontend"],
    coverImage: null,
    authorName: "Lumen Desk",
    authorTitle: "Sample content",
    authorAvatar: null,
    readingTime: 7,
    isSponsored: true,
    sponsorName: "Sample sponsor",
    body: doc(
      "Store meaning, not markup. A pull quote is a node with a type, not a paragraph that happens to be italic, and the renderer decides how it looks this year.",
    ),
  },
];

const summary = ({ body: _b, authorTitle: _t, authorAvatar: _a, ...s }: Sample): PostSummary => s;

export const samplePosts = (): PostSummary[] => POSTS.map(summary);

export function samplePost(slug: string): PostDetail | null {
  const post = POSTS.find((p) => p.slug === slug);
  if (!post) return null;
  const related = POSTS.filter((p) => p.slug !== slug && p.tags.some((t) => post.tags.includes(t))).map(summary);
  return { ...post, relatedPosts: related.slice(0, 3) };
}
