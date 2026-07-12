import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/contentful";

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lumen.vitaliipopov.dev";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts();

  return [
    {
      url: SITE_URL,
      changeFrequency: "daily",
      priority: 1,
    },
    ...posts.map((post) => ({
      url: `${SITE_URL}/posts/${post.slug}`,
      lastModified: post.publishedDate ? new Date(post.publishedDate) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
