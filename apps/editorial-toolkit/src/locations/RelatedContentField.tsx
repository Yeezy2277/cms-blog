import { useCallback, useEffect, useState } from "react";
import { useSDK } from "@contentful/react-apps-toolkit";
import type { FieldAppSDK } from "@contentful/app-sdk";
import {
  Button,
  Flex,
  IconButton,
  Note,
  Spinner,
  Stack,
  Text,
} from "@contentful/f36-components";

const CONTENT_TYPE_ID = "blogPost";

type EntryLink = { sys: { type: "Link"; linkType: "Entry"; id: string } };
type RelatedPost = { id: string; title: string };

function toLinks(posts: RelatedPost[]): EntryLink[] {
  return posts.map((p) => ({ sys: { type: "Link", linkType: "Entry", id: p.id } }));
}

/**
 * Related-posts field widget.
 *
 * Suggests other blogPost entries that share at least one tag with the current
 * one (most-recently-updated first), lets the editor accept all, add specific
 * posts via the native entry picker, or remove any. Selection is written to the
 * field as entry links and persisted on save.
 *
 * Generalised from the source platform's related-articles app — same auto-sync
 * + manual-override model, simplified to tag overlap (Lumen tags are plain
 * symbols rather than reference entries).
 */
export function RelatedContentField() {
  const sdk = useSDK<FieldAppSDK>();
  const locale = sdk.field.locale;
  const entryId = sdk.entry.getSys().id;

  const [selected, setSelected] = useState<RelatedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sdk.window.startAutoResizer();
    return () => sdk.window.stopAutoResizer();
  }, [sdk.window]);

  const titleOf = useCallback(
    (fields: Record<string, Record<string, unknown>>): string => {
      const byLocale = fields?.title;
      const value = byLocale?.[locale] ?? (byLocale ? Object.values(byLocale)[0] : undefined);
      return typeof value === "string" && value ? value : "Untitled";
    },
    [locale],
  );

  // Hydrate the current selection from saved links.
  useEffect(() => {
    const load = async () => {
      const current = (sdk.field.getValue() as EntryLink[] | undefined) ?? [];
      if (current.length === 0) {
        setLoading(false);
        return;
      }
      try {
        const results = await Promise.allSettled(
          current.map((ref) => sdk.cma.entry.get({ entryId: ref.sys.id })),
        );
        const loaded: RelatedPost[] = [];
        for (const r of results) {
          if (r.status === "fulfilled") {
            loaded.push({
              id: r.value.sys.id,
              title: titleOf(r.value.fields as Record<string, Record<string, unknown>>),
            });
          }
        }
        setSelected(loaded);
      } catch {
        setError("Could not load the saved related posts.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [sdk, titleOf]);

  const persist = useCallback(
    (posts: RelatedPost[]) => {
      setSelected(posts);
      sdk.field.setValue(toLinks(posts)).catch(() => setError("Failed to save selection."));
    },
    [sdk.field],
  );

  const suggestFromTags = useCallback(async () => {
    setSuggesting(true);
    setError(null);
    try {
      const tags = (sdk.entry.fields.tags?.getValue(locale) as string[] | undefined) ?? [];
      if (tags.length === 0) {
        setError("Add some tags to this post first to get suggestions.");
        return;
      }
      const resp = await sdk.cma.entry.getMany({
        query: {
          content_type: CONTENT_TYPE_ID,
          "fields.tags[in]": tags.join(","),
          order: "-sys.updatedAt",
          limit: 10,
        },
      });
      const existing = new Set(selected.map((p) => p.id));
      const suggestions = resp.items
        .filter((item) => item.sys.id !== entryId && !existing.has(item.sys.id))
        .map((item) => ({
          id: item.sys.id,
          title: titleOf(item.fields as Record<string, Record<string, unknown>>),
        }));
      if (suggestions.length === 0) {
        setError("No further posts share these tags.");
        return;
      }
      persist([...selected, ...suggestions].slice(0, 10));
    } catch {
      setError("Suggestion lookup failed.");
    } finally {
      setSuggesting(false);
    }
  }, [sdk, locale, entryId, selected, persist, titleOf]);

  const addManually = useCallback(async () => {
    try {
      const picked = (await sdk.dialogs.selectMultipleEntries({
        locale,
        contentTypes: [CONTENT_TYPE_ID],
      })) as Array<{ sys: { id: string }; fields: Record<string, Record<string, unknown>> }> | null;
      if (!Array.isArray(picked) || picked.length === 0) return;
      const existing = new Set(selected.map((p) => p.id));
      const added = picked
        .filter((p) => p.sys.id !== entryId && !existing.has(p.sys.id))
        .map((p) => ({
          id: p.sys.id,
          title: titleOf(p.fields),
        }));
      if (added.length > 0) persist([...selected, ...added]);
    } catch {
      sdk.notifier.error("Failed to add posts.");
    }
  }, [sdk, locale, entryId, selected, persist, titleOf]);

  const remove = useCallback(
    (id: string) => persist(selected.filter((p) => p.id !== id)),
    [selected, persist],
  );

  if (loading) return <Spinner />;

  return (
    <Stack flexDirection="column" spacing="spacingM" alignItems="flex-start">
      <Flex gap="spacingS">
        <Button size="small" onClick={suggestFromTags} isLoading={suggesting}>
          Suggest from tags
        </Button>
        <Button size="small" variant="secondary" onClick={addManually}>
          Add posts…
        </Button>
      </Flex>

      {error && <Note variant="warning">{error}</Note>}

      {selected.length === 0 ? (
        <Text fontColor="gray500">No related posts yet.</Text>
      ) : (
        <Stack flexDirection="column" spacing="spacingXs" style={{ width: "100%" }}>
          {selected.map((post) => (
            <Flex
              key={post.id}
              justifyContent="space-between"
              alignItems="center"
              style={{
                width: "100%",
                border: "1px solid #e7ebee",
                borderRadius: 6,
                padding: "6px 10px",
              }}
            >
              <Text>{post.title}</Text>
              <IconButton
                aria-label={`Remove ${post.title}`}
                size="small"
                variant="transparent"
                onClick={() => remove(post.id)}
                icon={<span aria-hidden>✕</span>}
              />
            </Flex>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
