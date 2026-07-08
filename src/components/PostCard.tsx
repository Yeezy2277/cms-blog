import Image from "next/image";
import Link from "next/link";

import type { PostSummary } from "@/lib/types";

import styles from "./PostCard.module.css";

interface PostCardProps {
  post: PostSummary;
  /** The first card on the listing page gets priority image loading + larger layout. */
  featured?: boolean;
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

export function PostCard({ post, featured = false }: PostCardProps) {
  return (
    <article className={`${styles.card} ${featured ? styles.featured : ""}`}>
      <Link href={`/posts/${post.slug}`} className={styles.link}>
        {post.coverImage ? (
          <div className={styles.media}>
            <Image
              src={post.coverImage.url}
              alt={post.coverImage.alt}
              fill
              sizes={
                featured
                  ? "(max-width: 700px) 100vw, 700px"
                  : "(max-width: 700px) 100vw, 350px"
              }
              priority={featured}
              className={styles.image}
            />
          </div>
        ) : (
          <div className={`${styles.media} ${styles.mediaEmpty}`} aria-hidden="true">
            <span>{post.title.charAt(0)}</span>
          </div>
        )}

        <div className={styles.body}>
          {post.isSponsored ? (
            <span className={styles.eyebrow}>Sponsored</span>
          ) : post.tags[0] ? (
            <span className={styles.eyebrow}>{post.tags[0]}</span>
          ) : null}
          <h2 className={styles.title}>{post.title}</h2>
          <p className={styles.excerpt}>{post.excerpt}</p>
          <div className={styles.meta}>
            {post.authorName ? <span>{post.authorName}</span> : null}
            {post.authorName && post.publishedDate ? (
              <span className={styles.dot} aria-hidden="true">
                ·
              </span>
            ) : null}
            {post.publishedDate ? (
              <time dateTime={post.publishedDate}>{formatDate(post.publishedDate)}</time>
            ) : null}
            {post.readingTime ? (
              <>
                <span className={styles.dot} aria-hidden="true">
                  ·
                </span>
                <span>{post.readingTime} min read</span>
              </>
            ) : null}
          </div>
        </div>
      </Link>
    </article>
  );
}
