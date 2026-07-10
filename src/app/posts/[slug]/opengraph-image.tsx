import { ImageResponse } from "next/og";
import { getPostBySlug } from "@/lib/contentful";

export const revalidate = 3600;
export const alt = "Article cover";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social card per post — generated at request time, cached by ISR. */
export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  // The OG renderer ships base Noto Sans only: ⇄ is tofu and a VS15-forced
  // text arrow drops the glyph entirely, so ↔ (rendered via Satori's Twemoji,
  // which matches the accent blue) is the least-bad spelling here.
  const title = (post?.title ?? "Lumen").replace(/⇄/g, "↔");
  const tag = post?.tags?.[0] ?? "Article";
  const meta = [
    post?.publishedDate &&
      new Date(post.publishedDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    post?.readingTime ? `${post.readingTime} min read` : null,
    post?.authorName,
  ]
    .filter(Boolean)
    .join(" · ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0d1117",
          color: "#e6edf3",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "#4c8dff",
              color: "#0d1117",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            L
          </div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>Lumen</div>
          <div
            style={{
              marginLeft: "auto",
              fontSize: 22,
              color: "#4c8dff",
              background: "rgba(76,141,255,0.14)",
              border: "1px solid rgba(76,141,255,0.4)",
              borderRadius: 999,
              padding: "6px 20px",
            }}
          >
            {tag}
          </div>
        </div>

        <div
          style={{
            fontSize: title.length > 60 ? 56 : 66,
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
            maxWidth: 1000,
          }}
        >
          {title}
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "#9aa7b4" }}>{meta}</div>
      </div>
    ),
    size,
  );
}
