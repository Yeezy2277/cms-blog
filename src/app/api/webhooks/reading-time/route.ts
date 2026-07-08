import { NextResponse } from "next/server";
import { createClient } from "contentful-management";
import { documentToPlainTextString } from "@contentful/rich-text-plain-text-renderer";

/**
 * Reading-time webhook — the free-tier replacement for the source platform's
 * Cloud Run webhook receiver. On Vercel the "always-on Express service on Cloud
 * Run" collapses into a single serverless Route Handler in the same app.
 *
 * Contentful calls this on blogPost publish; we recompute estimatedReadingTime
 * from the body and write it back (re-publishing so the value goes live).
 *
 * We ONLY act on publish events. A save/auto-save would trigger our own
 * update(), which fires another save webhook — an infinite loop. Mirrors the
 * guard in the original handler.
 */

export const runtime = "nodejs";

const WORDS_PER_MINUTE = 200;
const BODY_FIELD_ID = process.env.READING_TIME_BODY_FIELD ?? "body";
const TARGET_FIELD_ID = process.env.READING_TIME_TARGET_FIELD ?? "estimatedReadingTime";
const CONTENT_TYPE_ID = process.env.READING_TIME_CONTENT_TYPE ?? "blogPost";

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID ?? "";
const ENVIRONMENT_ID = process.env.CONTENTFUL_ENVIRONMENT ?? "master";
const CMA_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN ?? "";
const WEBHOOK_SECRET = process.env.CONTENTFUL_WEBHOOK_SECRET ?? "";

type Doc = { nodeType?: string; content?: unknown };

function isRichTextDocument(value: unknown): value is Doc {
  return (
    !!value &&
    typeof value === "object" &&
    (value as Doc).nodeType === "document" &&
    Array.isArray((value as Doc).content)
  );
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  if (words > 1) return words;
  const chars = trimmed.replace(/\s+/g, "").length;
  return Math.max(words, chars ? Math.ceil(chars / 5) : 0);
}

function minutesFor(value: unknown): number {
  const text = isRichTextDocument(value)
    ? documentToPlainTextString(value as never)
    : typeof value === "string"
      ? value
      : "";
  const words = countWords(text);
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export async function POST(req: Request) {
  if (!SPACE_ID || !CMA_TOKEN) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }
  if (WEBHOOK_SECRET && req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const topic = req.headers.get("x-contentful-topic") ?? "";
  if (!topic.toLowerCase().includes("entry.publish")) {
    return NextResponse.json({ skipped: true, reason: "Not a publish event", topic });
  }

  let payload: { sys?: { id?: string; type?: string; contentType?: { sys?: { id?: string } } } };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload?.sys?.type !== "Entry" || !payload.sys.id) {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }
  if (payload.sys.contentType?.sys?.id !== CONTENT_TYPE_ID) {
    return NextResponse.json({ skipped: true, reason: "Not target content type" });
  }

  try {
    const client = createClient({ accessToken: CMA_TOKEN });
    const space = await client.getSpace(SPACE_ID);
    const environment = await space.getEnvironment(ENVIRONMENT_ID);
    const entry = await environment.getEntry(payload.sys.id);

    const body = entry.fields[BODY_FIELD_ID] as Record<string, unknown> | undefined;
    if (!body) {
      return NextResponse.json({ skipped: true, reason: "No body field" });
    }

    const current = (entry.fields[TARGET_FIELD_ID] as Record<string, number>) ?? {};
    const next: Record<string, number> = { ...current };
    let changed = false;

    for (const locale of Object.keys(body)) {
      const minutes = minutesFor(body[locale]);
      if (current[locale] !== minutes) {
        next[locale] = minutes;
        changed = true;
      }
    }

    if (!changed) {
      return NextResponse.json({ updated: false, computed: current });
    }

    entry.fields[TARGET_FIELD_ID] = next;
    const updated = await entry.update();
    await updated.publish();

    return NextResponse.json({ updated: true, published: true, computed: next });
  } catch (err) {
    const status = (err as { status?: number })?.status ?? 500;
    console.error("reading-time webhook error", err);
    return NextResponse.json({ error: "Internal error" }, { status });
  }
}
