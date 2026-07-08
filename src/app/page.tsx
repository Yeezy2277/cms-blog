import { getAllPosts, getAllTags } from "@/lib/contentful";
import { PostList } from "@/components/PostList";

import styles from "./page.module.css";

/**
 * Incremental Static Regeneration.
 *
 * The listing is statically generated at build time and re-generated at most
 * once an hour. Editorial content changes infrequently relative to traffic, so
 * ISR gives us static-CDN performance while still picking up new posts without
 * a redeploy. (A Contentful webhook hitting on-demand revalidation would make
 * this instant — noted as a next step in the README.)
 */
export const revalidate = 3600;

export default async function HomePage() {
  const posts = await getAllPosts();
  const tags = getAllTags(posts);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.kicker}>The Lumen Review</p>
        <h1 className={styles.headline}>
          Writing on craft, systems, and the work behind the screen.
        </h1>
        <p className={styles.sub}>
          A demo publication powered by a headless CMS — every word here is
          modelled and edited in Contentful, then rendered statically by Next.js.
        </p>
      </section>

      {posts.length > 0 ? (
        <PostList posts={posts} tags={tags} />
      ) : (
        <p className={styles.empty}>
          No posts found. Connect your Contentful space and publish a “blogPost”
          entry to see it here.
        </p>
      )}
    </div>
  );
}
