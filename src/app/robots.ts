import { siteUrl } from "@/lib/site";
import type { MetadataRoute } from "next";

const SITE_URL = siteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
