import Link from "next/link";

import { ThemeToggle } from "./ThemeToggle";
import styles from "./SiteHeader.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="Lumen — home">
          <span className={styles.mark}>L</span>
          <span className={styles.wordmark}>Lumen</span>
        </Link>
        <nav className={styles.nav} aria-label="Primary">
          <Link href="/" className={styles.navLink}>
            Articles
          </Link>
          <a
            href="https://www.contentful.com"
            className={styles.navLink}
            target="_blank"
            rel="noreferrer"
          >
            Built on Contentful
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
