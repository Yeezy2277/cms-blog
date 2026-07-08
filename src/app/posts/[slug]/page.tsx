import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RichText } from "@/components/RichText";
import { getAllSlugs, getPostBySlug } from "@/lib/contentful";

import styles from "./post.module.css";

export const revalidate = 3600;

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Pre-render every post at build time. New posts get generated on first
 * request and then cached (ISR), so we don't need a redeploy for new content.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Article not found" };

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      images: post.coverImage ? [{ url: post.coverImage.url }] : undefined,
    },
  };
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) notFound();

  return (
    <article className={styles.article}>
      <div className={styles.header}>
        <Link href="/" className={styles.back}>
          ← All articles
        </Link>
        {post.tags.length > 0 ? (
          <div className={styles.tags}>
            {post.tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <h1 className={styles.title}>{post.title}</h1>
        <div className={styles.byline}>
          {post.authorAvatar ? (
            <Image
              src={post.authorAvatar.url}
              alt={post.authorAvatar.alt}
              width={40}
              height={40}
              className={styles.avatar}
            />
          ) : null}
          <div>
            {post.authorName ? <p className={styles.authorName}>{post.authorName}</p> : null}
            <p className={styles.authorMeta}>
              {post.authorTitle ? <span>{post.authorTitle}</span> : null}
              {post.authorTitle && post.publishedDate ? " · " : null}
              {post.publishedDate ? (
                <time dateTime={post.publishedDate}>{formatDate(post.publishedDate)}</time>
              ) : null}
              {post.readingTime ? <span> · {post.readingTime} min read</span> : null}
            </p>
          </div>
        </div>
        {post.isSponsored ? (
          <p className={styles.sponsored}>
            Sponsored{post.sponsorName ? ` by ${post.sponsorName}` : ""}
          </p>
        ) : null}
      </div>

      {post.coverImage ? (
        <div className={styles.cover}>
          <Image
            src={post.coverImage.url}
            alt={post.coverImage.alt}
            width={post.coverImage.width}
            height={post.coverImage.height}
            priority
            sizes="(max-width: 800px) 100vw, 800px"
            className={styles.coverImage}
          />
        </div>
      ) : null}

      <div className={styles.content}>
        <RichText document={post.body} />
      </div>

      {post.relatedPosts.length > 0 ? (
        <aside className={styles.related} aria-labelledby="related-heading">
          <h2 id="related-heading" className={styles.relatedHeading}>
            Related reading
          </h2>
          <ul className={styles.relatedList}>
            {post.relatedPosts.map((related) => (
              <li key={related.slug}>
                <Link href={`/posts/${related.slug}`} className={styles.relatedLink}>
                  <span className={styles.relatedTitle}>{related.title}</span>
                  {related.readingTime ? (
                    <span className={styles.relatedMeta}>{related.readingTime} min read</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </article>
  );
}
