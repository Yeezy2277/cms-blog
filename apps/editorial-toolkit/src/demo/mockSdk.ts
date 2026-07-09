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
  sys: { id: string; updatedAt: string; contentType: { sys: { id: string } } };
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

const entry = (id: string, fields: Fields): MockEntry => ({
  sys: { id, updatedAt: "2026-06-01T09:00:00Z", contentType: { sys: { id: "blogPost" } } },
  fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { [LOCALE]: v }])),
});

/* ----- the demo "space" ---------------------------------------------------- */

export function createDemoSpace() {
  const entries: MockEntry[] = [
    entry(CURRENT_ID, {
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
    }),
    entry("entry-isr", {
      title: "ISR in practice: static speed without the redeploys",
      slug: "isr-in-practice",
      tags: ["Next.js", "Performance"],
      body: doc("Incremental Static Regeneration is the quiet workhorse of content sites."),
    }),
    entry("entry-rsc", {
      title: "Server Components changed how I structure a frontend",
      slug: "server-components-structure",
      tags: ["React", "Performance"],
      body: doc("Moving data fetching to the server made our pages faster and calmer."),
    }),
    entry("entry-webhooks", {
      title: "Webhooks that don't loop: lessons from a reading-time pipeline",
      slug: "webhooks-that-dont-loop",
      tags: ["CMS", "Architecture"],
      body: doc("A webhook that writes to the entry that triggered it is a loop waiting to happen."),
    }),
    // Deliberate duplicate slug pair — food for the Content QA scanner.
    entry("entry-dup-a", {
      title: "Typed CMS access with view models",
      slug: "typed-cms-access",
      tags: ["TypeScript", "CMS"],
      body: doc("Components never touch raw entries."),
    }),
    entry("entry-dup-b", {
      title: "Typed CMS access with view models (draft rewrite)",
      slug: "typed-cms-access",
      tags: ["TypeScript"],
      body: doc("A rewrite that accidentally kept the old slug."),
    }),
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

  /* ----- scoped CMA over the in-memory entries ----- */

  const cma = {
    entry: {
      get: async ({ entryId }: { entryId: string }) => {
        const found = entries.find((e) => e.sys.id === entryId);
        if (!found) throw new Error("NotFound");
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

  const entryFields = new Proxy(
    {},
    {
      get: (_t, fieldId: string) => ({
        getValue: (_locale?: string) => getField(fieldId),
        setValue: (value: unknown) => {
          setField(fieldId, value);
          return Promise.resolve();
        },
        onValueChanged: (localeOrCb: unknown, maybeCb?: Listener) => {
          const cb = (typeof localeOrCb === "function" ? localeOrCb : maybeCb) as Listener;
          return subscribe(fieldId, cb);
        },
      }),
    },
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
      id: fieldId,
      locale: LOCALE,
      getValue: () => getField(fieldId),
      setValue: (value: unknown) => {
        setField(fieldId, value);
        return Promise.resolve();
      },
      onValueChanged: (localeOrCb: unknown, maybeCb?: Listener) => {
        const cb = (typeof localeOrCb === "function" ? localeOrCb : maybeCb) as Listener;
        return subscribe(fieldId, cb);
      },
      setInvalid: () => {},
    },
  });

  const pageSdk = { ...base, parameters: { instance: {}, installation: {} } };

  return { entries, current, getField, setField, subscribe, fieldSdk, pageSdk, onNotice };
}

export type DemoSpace = ReturnType<typeof createDemoSpace>;
