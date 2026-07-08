import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/**
 * On-demand ISR — turns the homepage's hourly `revalidate = 3600` into instant
 * updates. Point a Contentful publish/unpublish webhook here; we revalidate the
 * listing and the affected post path so changes are live within seconds without
 * a redeploy.
 *
 * This is the "webhook → on-demand revalidation" next-step the original Lumen
 * README flagged, implemented.
 */

export const runtime = "nodejs";

const WEBHOOK_SECRET = process.env.CONTENTFUL_WEBHOOK_SECRET ?? "";

export async function POST(req: Request) {
  if (WEBHOOK_SECRET && req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: {
    sys?: { contentType?: { sys?: { id?: string } } };
    fields?: { slug?: Record<string, string> };
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const revalidated: string[] = [];

  // Always refresh the listing.
  revalidatePath("/");
  revalidated.push("/");

  // Refresh the specific post if we can resolve its slug from the payload.
  const slugByLocale = payload?.fields?.slug;
  const slug = slugByLocale ? Object.values(slugByLocale)[0] : undefined;
  if (typeof slug === "string" && slug) {
    revalidatePath(`/posts/${slug}`);
    revalidated.push(`/posts/${slug}`);
  }

  return NextResponse.json({ revalidated, now: Date.now() });
}
