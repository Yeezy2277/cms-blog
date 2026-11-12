import { siteUrl } from "@/lib/site";
import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, Newsreader } from "next/font/google";

import { SiteHeader } from "@/components/SiteHeader";
import "@/styles/globals.css";

// Self-hosted by next/font at build time: no layout shift, no runtime request to Google.
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["SOFT", "opsz"], display: "swap" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", style: ["normal", "italic"], display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4efe4" },
    { media: "(prefers-color-scheme: dark)", color: "#16130f" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Lumen — a headless-CMS content platform",
    template: "%s | Lumen",
  },
  description:
    "A demo content platform built with Next.js (App Router), TypeScript and Contentful.",
  openGraph: {
    title: "Lumen",
    description: "A headless-CMS content platform built with Next.js and Contentful.",
    type: "website",
  },
};

// Runs before paint so the stored theme applies with no flash. A publication
// reads on paper, so light is the default; a stored choice wins.
const themeInit = `try{var t=localStorage.getItem("lumen-theme");document.documentElement.dataset.theme=t==="dark"?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${fraunces.variable} ${newsreader.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
