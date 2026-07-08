"use client";

import { useMemo, useState } from "react";

import type { PostSummary } from "@/lib/types";

import { PostCard } from "./PostCard";
import styles from "./PostList.module.css";

interface PostListProps {
  posts: PostSummary[];
  tags: string[];
}

const ALL = "All";

/**
 * Client Component: owns the interactive tag filter only.
 *
 * The posts themselves are fetched on the server (see app/page.tsx) and passed
 * down as props, so we ship the data already-rendered and keep client JS to
 * just the filtering logic. This is the Server/Client Component split that the
 * App Router is built around.
 */
export function PostList({ posts, tags }: PostListProps) {
  const [activeTag, setActiveTag] = useState<string>(ALL);

  const filtered = useMemo(() => {
    if (activeTag === ALL) return posts;
    return posts.filter((post) => post.tags.includes(activeTag));
  }, [posts, activeTag]);

  const filterOptions = [ALL, ...tags];

  return (
    <section>
      {tags.length > 0 ? (
        <div className={styles.filters} role="group" aria-label="Filter articles by tag">
          {filterOptions.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`${styles.chip} ${activeTag === tag ? styles.chipActive : ""}`}
              aria-pressed={activeTag === tag}
              onClick={() => setActiveTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}

      {filtered.length > 0 ? (
        <div className={styles.grid}>
          {filtered.map((post, index) => (
            <PostCard key={post.slug} post={post} featured={activeTag === ALL && index === 0} />
          ))}
        </div>
      ) : (
        <p className={styles.empty}>No articles tagged “{activeTag}” yet. Pick another tag.</p>
      )}
    </section>
  );
}
