import { useEffect, useMemo, useRef, useState } from "react";
import { GlobalStyles } from "@contentful/f36-components";
import { SDKContext } from "@contentful/react-apps-toolkit";
import type { KnownSDK } from "@contentful/app-sdk";

import { SlugField } from "../locations/SlugField";
import { ReadingTimeField } from "../locations/ReadingTimeField";
import { SponsoredField } from "../locations/SponsoredField";
import { RelatedContentField } from "../locations/RelatedContentField";
import { DuplicateScannerPage } from "../locations/DuplicateScannerPage";
import { createDemoSpace, LOCALE } from "./mockSdk";
import { richTextToPlainText } from "../utils/readingTime";
import "./demo.css";

/** Wraps a real widget in an SDKContext carrying a field-scoped mock SDK. */
function Widget({ sdk, children }: { sdk: unknown; children: React.ReactNode }) {
  const value = useMemo(() => ({ sdk: sdk as KnownSDK }), [sdk]);
  return <SDKContext.Provider value={value}>{children}</SDKContext.Provider>;
}

export function StandaloneDemo() {
  const space = useMemo(() => createDemoSpace(), []);
  const [tab, setTab] = useState<"editor" | "qa">("editor");
  const [notice, setNotice] = useState<{ kind: string; message: string } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local mirrors of the mock entry, so plain inputs re-render on change.
  const [title, setTitle] = useState(space.getField("title") as string);
  const [body, setBody] = useState(() =>
    richTextToPlainText(space.getField("body") as never),
  );
  const [sponsored, setSponsored] = useState(Boolean(space.getField("isSponsored")));

  useEffect(() => {
    space.onNotice((n) => {
      setNotice(n);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(null), 4000);
    });
  }, [space]);

  const sdks = useMemo(
    () => ({
      slug: space.fieldSdk("slug", "slug"),
      readingTime: space.fieldSdk("estimatedReadingTime", "reading-time"),
      sponsor: space.fieldSdk("sponsorName", "sponsored"),
      related: space.fieldSdk("relatedPosts", "related"),
      page: space.pageSdk,
    }),
    [space],
  );

  const updateTitle = (next: string) => {
    setTitle(next);
    space.setField("title", next);
  };

  const updateBody = (next: string) => {
    setBody(next);
    space.setField("body", {
      nodeType: "document",
      data: {},
      content: [
        {
          nodeType: "paragraph",
          data: {},
          content: [{ nodeType: "text", value: next, marks: [], data: {} }],
        },
      ],
    });
  };

  const updateSponsored = (next: boolean) => {
    setSponsored(next);
    space.setField("isSponsored", next);
  };

  const tags = (space.getField("tags") as string[]) ?? [];

  return (
    <div className="demo-page">
      <GlobalStyles />

      <header className="demo-hero">
        <span className="demo-badge">Live demo · no login</span>
        <h1>Editorial Toolkit</h1>
        <p>
          One Contentful App, five editor tools. Everything below is the <em>real</em>{" "}
          production widget code running against an in-memory mock of the Contentful App
          SDK — type in the entry fields and watch the tools react, exactly as editors see
          them inside the CMS.
        </p>
        <nav className="demo-tabs" aria-label="Demo sections">
          <button
            className={tab === "editor" ? "demo-tab demo-tab--active" : "demo-tab"}
            onClick={() => setTab("editor")}
          >
            Entry editor
          </button>
          <button
            className={tab === "qa" ? "demo-tab demo-tab--active" : "demo-tab"}
            onClick={() => setTab("qa")}
          >
            Content QA (page location)
          </button>
        </nav>
      </header>

      {notice && <div className={`demo-notice demo-notice--${notice.kind}`}>{notice.message}</div>}

      {tab === "editor" ? (
        <main className="demo-entry">
          <section className="demo-field">
            <label className="demo-label" htmlFor="demo-title">
              Title <span className="demo-hint">plain Contentful field — type here</span>
            </label>
            <input
              id="demo-title"
              className="demo-input"
              value={title}
              onChange={(e) => updateTitle(e.target.value)}
            />
          </section>

          <section className="demo-field">
            <div className="demo-label">
              Slug <span className="demo-widget-tag">app widget</span>
              <span className="demo-hint">
                follows the title while draft · validates format + uniqueness
              </span>
            </div>
            <div className="demo-widget">
              <Widget sdk={sdks.slug}>
                <SlugField />
              </Widget>
            </div>
          </section>

          <section className="demo-field">
            <label className="demo-label" htmlFor="demo-body">
              Body <span className="demo-hint">the reading-time widget watches this</span>
            </label>
            <textarea
              id="demo-body"
              className="demo-input demo-textarea"
              rows={4}
              value={body}
              onChange={(e) => updateBody(e.target.value)}
            />
          </section>

          <section className="demo-field">
            <div className="demo-label">
              Estimated reading time <span className="demo-widget-tag">app widget</span>
            </div>
            <div className="demo-widget">
              <Widget sdk={sdks.readingTime}>
                <ReadingTimeField />
              </Widget>
            </div>
          </section>

          <section className="demo-field">
            <label className="demo-label" htmlFor="demo-sponsored">
              Sponsored article{" "}
              <span className="demo-hint">gates the sponsor-name widget below</span>
            </label>
            <label className="demo-switch">
              <input
                id="demo-sponsored"
                type="checkbox"
                checked={sponsored}
                onChange={(e) => updateSponsored(e.target.checked)}
              />
              <span>{sponsored ? "Yes — sponsor name required" : "No"}</span>
            </label>
          </section>

          <section className="demo-field">
            <div className="demo-label">
              Sponsor name <span className="demo-widget-tag">app widget</span>
              <span className="demo-hint">cross-field rule the content model can't express</span>
            </div>
            <div className="demo-widget">
              <Widget sdk={sdks.sponsor}>
                <SponsoredField />
              </Widget>
            </div>
          </section>

          <section className="demo-field">
            <div className="demo-label">
              Tags <span className="demo-hint">drives related-post suggestions</span>
            </div>
            <div className="demo-chips">
              {tags.map((t) => (
                <span key={t} className="demo-chip">
                  {t}
                </span>
              ))}
            </div>
          </section>

          <section className="demo-field">
            <div className="demo-label">
              Related posts <span className="demo-widget-tag">app widget</span>
              <span className="demo-hint">suggests by shared tags · picker uses the native dialog</span>
            </div>
            <div className="demo-widget">
              <Widget sdk={sdks.related}>
                <RelatedContentField />
              </Widget>
            </div>
          </section>
        </main>
      ) : (
        <main className="demo-qa">
          <p className="demo-qa-note">
            The same bundle also ships a full-page location — an editorial QA tool that
            scans every post for duplicate slugs. The demo space contains one deliberate
            collision; hit <strong>Scan</strong> to find it.
          </p>
          <div className="demo-widget demo-widget--page">
            <Widget sdk={sdks.page}>
              <DuplicateScannerPage />
            </Widget>
          </div>
        </main>
      )}

      <footer className="demo-footer">
        <a href="https://github.com/Yeezy2277/cms-blog/tree/main/apps/editorial-toolkit">
          Source on GitHub
        </a>
        <span>·</span>
        <span>Locale {LOCALE}</span>
        <span>·</span>
        <span>React + Forma 36 + Contentful App SDK</span>
      </footer>
    </div>
  );
}
