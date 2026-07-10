/**
 * In-memory mock of the Contentful App SDK, just deep enough for the demo.
 *
 * The real widgets (SlugField, ReadingTimeField, SponsoredField,
 * RelatedContentField, DuplicateScannerPage) are rendered UNCHANGED — they
 * talk to this object exactly as they talk to Contentful: field get/set,
 * entry-field subscriptions, scoped CMA queries, dialogs. The demo page seeds
 * a small "space" of blog posts (including a deliberate duplicate slug so the
 * QA scanner has something to find).
 */

export const LOCALE = "en-US";
const CURRENT_ID = "entry-current";

type Fields = Record<string, unknown>;
type MockEntry = {
  sys: {
    id: string;
    updatedAt: string;
    publishedAt?: string;
    contentType: { sys: { id: string } };
  };
  fields: Record<string, Record<string, unknown>>;
};

const doc = (text: string) => ({
  nodeType: "document",
  data: {},
  content: [
    {
      nodeType: "paragraph",
      data: {},
      content: [{ nodeType: "text", value: text, marks: [], data: {} }],
    },
  ],
});

const entry = (
  id: string,
  fields: Fields,
  sys: { updatedAt?: string; publishedAt?: string; contentType?: string } = {},
): MockEntry => ({
  sys: {
    id,
    updatedAt: sys.updatedAt ?? "2026-06-01T09:00:00Z",
    ...(sys.publishedAt ? { publishedAt: sys.publishedAt } : {}),
    contentType: { sys: { id: sys.contentType ?? "blogPost" } },
  },
  fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { [LOCALE]: v }])),
});

// Complete editorial metadata for "healthy" demo posts.
const healthy = {
  excerpt: "A short standfirst so the completeness check passes.",
  coverImage: { sys: { type: "Link", linkType: "Asset", id: "asset-cover" } },
  estimatedReadingTime: 2,
};

/* ----- the demo "space" ---------------------------------------------------- */

export function createDemoSpace() {
  // Each Validation Hub check has something planted to find; the rest of the
  // entries are deliberately "healthy" so the summary isn't all red.
  const entries: MockEntry[] = [
    entry(
      CURRENT_ID,
      {
        title: "Designing a content model that survives change",
        slug: "designing-content-model-survives-change",
        tags: ["Architecture", "CMS"],
        isSponsored: false,
        sponsorName: "",
        body: doc(
          "The fields you choose on day one quietly decide how painful year two will be. " +
            "A content model is an API contract with your future self: every shortcut you " +
            "take in modelling becomes a migration later. Start from the queries your " +
            "frontend needs, not from the shape of the source data.",
        ),
        relatedPosts: [],
        author: { sys: { type: "Link", linkType: "Entry", id: "author-vp" } },
        ...healthy,
      },
      { publishedAt: "2026-06-01T10:00:00Z" },
    ),
    // Author entries — the sidebar tool lists, assigns and creates these.
    entry(
      "author-vp",
      { name: "Vitaly Popov", title: "Frontend Engineer" },
      { publishedAt: "2026-05-01T10:00:00Z", contentType: "author" },
    ),
    entry(
      "author-guest",
      { name: "Guest Writer", title: "Contributor" },
      { publishedAt: "2026-05-01T10:00:00Z", contentType: "author" },
    ),
    entry(
      "entry-isr",
      {
        title: "ISR in practice: static speed without the redeploys",
        slug: "isr-in-practice",
        tags: ["Next.js", "Performance"],
        body: doc("Incremental Static Regeneration is the quiet workhorse of content sites."),
        ...healthy,
      },
      { publishedAt: "2026-05-20T10:00:00Z" },
    ),
    // Planted: published but missing cover image + excerpt.
    entry(
      "entry-rsc",
      {
        title: "Server Components changed how I structure a frontend",
        slug: "server-components-structure",
        tags: ["React", "Performance"],
        body: doc("Moving data fetching to the server made our pages faster and calmer."),
        estimatedReadingTime: 1,
      },
      { publishedAt: "2026-05-12T10:00:00Z" },
    ),
    // Planted: relatedPosts link to an entry that no longer exists.
    entry(
      "entry-webhooks",
      {
        title: "Webhooks that don't loop: lessons from a reading-time pipeline",
        slug: "webhooks-that-dont-loop",
        tags: ["CMS", "Architecture"],
        body: doc("A webhook that writes to the entry that triggered it is a loop waiting to happen."),
        relatedPosts: [{ sys: { type: "Link", linkType: "Entry", id: "entry-deleted-long-ago" } }],
        ...healthy,
      },
      { publishedAt: "2026-06-10T10:00:00Z" },
    ),
    // Planted: duplicate slug pair — the second one is also a stale draft.
    entry(
      "entry-dup-a",
      {
        title: "Typed CMS access with view models",
        slug: "typed-cms-access",
        tags: ["TypeScript", "CMS"],
        body: doc("Components never touch raw entries."),
        ...healthy,
      },
      { publishedAt: "2026-04-28T10:00:00Z" },
    ),
    entry(
      "entry-dup-b",
      {
        title: "Typed CMS access with view models (draft rewrite)",
        slug: "typed-cms-access",
        tags: ["TypeScript"],
        body: doc("A rewrite that accidentally kept the old slug."),
        ...healthy,
      },
      { updatedAt: "2026-04-02T10:00:00Z" }, // draft, untouched for months
    ),
  ];

  /* ----- field-level store + subscriptions on the current entry ----- */

  const current = entries[0];
  type Listener = (value: unknown) => void;
  const listeners = new Map<string, Set<Listener>>();

  const getField = (fieldId: string) => current.fields[fieldId]?.[LOCALE];
  const setField = (fieldId: string, value: unknown) => {
    current.fields[fieldId] = { [LOCALE]: value };
    listeners.get(fieldId)?.forEach((cb) => cb(value));
  };
  const subscribe = (fieldId: string, cb: Listener) => {
    if (!listeners.has(fieldId)) listeners.set(fieldId, new Set());
    listeners.get(fieldId)!.add(cb);
    return () => listeners.get(fieldId)?.delete(cb);
  };

  /* ----- in-memory asset library (for the Media importer tool) ----- */

  type MockAsset = {
    sys: { id: string; version: number; publishedVersion?: number };
    fields: Record<string, Record<string, unknown>>;
  };

  const assets: MockAsset[] = [
    {
      sys: { id: "asset-cover", version: 2, publishedVersion: 2 },
      fields: {
        title: { [LOCALE]: "Existing library image" },
        file: {
          [LOCALE]: {
            contentType: "image/svg+xml",
            fileName: "cover.svg",
            url: "https://images.ctfassets.net/demo/cover.svg",
          },
        },
      },
    },
  ];
  let assetSeq = 0;

  /* ----- scoped CMA over the in-memory entries ----- */

  const cma = {
    asset: {
      get: async ({ assetId }: { assetId: string }) => {
        const found = assets.find((a) => a.sys.id === assetId);
        if (!found) throw new Error("NotFound");
        return found;
      },
      create: async (_params: unknown, data: { fields: Record<string, Record<string, unknown>> }) => {
        const asset: MockAsset = {
          sys: { id: `asset-imported-${++assetSeq}`, version: 1 },
          fields: data.fields,
        };
        assets.push(asset);
        return asset;
      },
      // "Processing" in the mock: the pasted URL becomes the file URL directly,
      // so the widget's preview shows the actual remote image. Mirrors the real
      // plain-CMA signature: the asset id comes from the rawData argument.
      processForAllLocales: async (
        _params: unknown,
        data: { sys: { id: string } },
      ) => {
        const asset = assets.find((a) => a.sys.id === data.sys.id);
        if (!asset) throw new Error("NotFound");
        const file = asset.fields.file?.[LOCALE] as { upload?: string; url?: string } | undefined;
        if (file?.upload && !file.url) {
          file.url = file.upload;
          delete file.upload;
        }
        asset.sys.version += 1;
        return asset;
      },
      publish: async ({ assetId }: { assetId: string }) => {
        const asset = assets.find((a) => a.sys.id === assetId);
        if (!asset) throw new Error("NotFound");
        asset.sys.publishedVersion = asset.sys.version;
        return asset;
      },
    },
    entry: {
      get: async ({ entryId }: { entryId: string }) => {
        const found = entries.find((e) => e.sys.id === entryId);
        if (!found) throw new Error("NotFound");
        return found;
      },
      create: async (
        { contentTypeId }: { contentTypeId: string },
        data: { fields: Record<string, Record<string, unknown>> },
      ) => {
        const created = {
          sys: {
            id: `${contentTypeId}-${entries.length + 1}`,
            updatedAt: new Date().toISOString(),
            contentType: { sys: { id: contentTypeId } },
          },
          fields: data.fields,
        } as MockEntry;
        entries.push(created);
        return created;
      },
      publish: async ({ entryId }: { entryId: string }) => {
        const found = entries.find((e) => e.sys.id === entryId);
        if (!found) throw new Error("NotFound");
        (found.sys as { publishedAt?: string }).publishedAt = new Date().toISOString();
        return found;
      },
      getMany: async ({ query }: { query: Record<string, unknown> }) => {
        let items = entries.filter((e) => e.sys.contentType.sys.id === (query.content_type ?? "blogPost"));
        if (typeof query["fields.slug"] === "string") {
          items = items.filter((e) => e.fields.slug?.[LOCALE] === query["fields.slug"]);
        }
        if (typeof query["fields.tags[in]"] === "string") {
          const wanted = (query["fields.tags[in]"] as string).split(",");
          items = items.filter((e) => {
            const tags = (e.fields.tags?.[LOCALE] as string[] | undefined) ?? [];
            return tags.some((t) => wanted.includes(t));
          });
        }
        const skip = Number(query.skip ?? 0);
        const limit = Number(query.limit ?? 100);
        return { items: items.slice(skip, skip + limit), total: items.length };
      },
    },
  };

  /* ----- SDK factories ----- */

  type Notice = { kind: "success" | "error" | "info"; message: string };
  let notify: (n: Notice) => void = () => {};
  const onNotice = (cb: (n: Notice) => void) => {
    notify = cb;
  };

  // Single accessor implementation shared by entry.fields[x] and field.* —
  // the real SDK guarantees those behave identically, so the mock must too.
  const fieldAccessor = (fieldId: string) => ({
    getValue: (_locale?: string) => getField(fieldId),
    setValue: (value: unknown) => {
      setField(fieldId, value);
      return Promise.resolve();
    },
    onValueChanged: (localeOrCb: unknown, maybeCb?: Listener) => {
      const cb = (typeof localeOrCb === "function" ? localeOrCb : maybeCb) as Listener;
      return subscribe(fieldId, cb);
    },
  });

  const entryFields = new Proxy(
    {},
    { get: (_t, fieldId: string) => fieldAccessor(fieldId) },
  );

  const base = {
    locales: { default: LOCALE, available: [LOCALE] },
    window: { startAutoResizer: () => {}, stopAutoResizer: () => {}, updateHeight: () => {} },
    notifier: {
      success: (m: string) => notify({ kind: "success", message: m }),
      error: (m: string) => notify({ kind: "error", message: m }),
    },
    navigator: {
      openEntry: (id: string) =>
        notify({ kind: "info", message: `In Contentful this opens entry “${id}” in a slide-in.` }),
    },
    dialogs: {
      // The native asset picker: hand back the seeded library image.
      selectSingleAsset: async () => assets[0],
      // The native multi-picker: hand back posts that aren't selected yet.
      selectMultipleEntries: async () => {
        const selected = new Set(
          ((getField("relatedPosts") as { sys: { id: string } }[] | undefined) ?? []).map(
            (l) => l.sys.id,
          ),
        );
        return entries
          .filter((e) => e.sys.id !== CURRENT_ID && !selected.has(e.sys.id))
          .slice(0, 2);
      },
    },
    cma,
    location: { is: () => false },
  };

  const fieldSdk = (fieldId: string, tool: string) => ({
    ...base,
    parameters: { instance: { tool }, installation: {} },
    entry: {
      getSys: () => current.sys,
      fields: entryFields as Record<string, never>,
    },
    field: {
      ...fieldAccessor(fieldId),
      id: fieldId,
      locale: LOCALE,
      setInvalid: () => {},
    },
  });

  const pageSdk = { ...base, parameters: { instance: {}, installation: {} } };

  return { entries, current, getField, setField, subscribe, fieldSdk, pageSdk, onNotice };
}

export type DemoSpace = ReturnType<typeof createDemoSpace>;
