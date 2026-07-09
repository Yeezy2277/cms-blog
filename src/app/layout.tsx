import type { Metadata } from "next";

import { SiteHeader } from "@/components/SiteHeader";
import "@/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://lumen-cms-blog.vercel.app"),
  title: {
    default: "Lumen — a headless-CMS content platform",
    template: "%s · Lumen",
  },
  description:
    "A demo content platform built with Next.js (App Router), TypeScript and Contentful.",
  openGraph: {
    title: "Lumen",
    description: "A headless-CMS content platform built with Next.js and Contentful.",
    type: "website",
  },
};

// Runs before paint so the stored theme applies with no flash. Dark is the default.
const themeInit = `try{var t=localStorage.getItem("lumen-theme");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
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
