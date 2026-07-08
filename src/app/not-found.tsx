import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        maxWidth: "42rem",
        margin: "0 auto",
        padding: "4.5rem 1.25rem",
        textAlign: "center",
      }}
    >
      <p
        style={{
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          fontWeight: 600,
          color: "var(--color-accent)",
          fontSize: "0.85rem",
        }}
      >
        404
      </p>
      <h1 style={{ fontSize: "var(--step-3)", margin: "0.5rem 0 1rem" }}>
        That page isn’t here
      </h1>
      <p style={{ color: "var(--color-ink-soft)", marginBottom: "2rem" }}>
        The article may have been unpublished or the link is out of date.
      </p>
      <Link
        href="/"
        style={{
          color: "var(--color-accent)",
          textDecoration: "underline",
          textUnderlineOffset: "3px",
        }}
      >
        Back to all articles
      </Link>
    </div>
  );
}
