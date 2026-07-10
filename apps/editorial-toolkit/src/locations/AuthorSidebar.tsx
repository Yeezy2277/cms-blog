import { useCallback, useEffect, useState } from "react";
import { useSDK } from "@contentful/react-apps-toolkit";
import type { SidebarAppSDK } from "@contentful/app-sdk";
import {
  Button,
  Flex,
  FormControl,
  Note,
  Select,
  Text,
  TextInput,
} from "@contentful/f36-components";

import { initials, validateAuthorName } from "../utils/author";

type EntryLink = { sys: { type: "Link"; linkType: "Entry"; id: string } };
type Author = { id: string; name: string; title: string };

const entryLink = (id: string): EntryLink => ({ sys: { type: "Link", linkType: "Entry", id } });

const firstLocaleValue = (byLocale: Record<string, unknown> | undefined): unknown =>
  byLocale ? Object.values(byLocale)[0] : undefined;

/**
 * Author manager — an entry-sidebar tool. Shows the post's author, switches it
 * from a dropdown of all `author` entries, or creates (and publishes) a new
 * author without leaving the entry. Generalised from the source platform's
 * article-authors app.
 */
export function AuthorSidebar() {
  const sdk = useSDK<SidebarAppSDK>();
  const locale = sdk.locales.default;

  const [authors, setAuthors] = useState<Author[]>([]);
  const [currentId, setCurrentId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sdk.window.startAutoResizer();
    return () => sdk.window.stopAutoResizer();
  }, [sdk.window]);

  const loadAuthors = useCallback(async () => {
    try {
      const resp = await sdk.cma.entry.getMany({
        query: { content_type: "author", limit: 100, order: "fields.name" },
      });
      setAuthors(
        resp.items.map((item) => {
          const fields = item.fields as Record<string, Record<string, unknown>>;
          const name = firstLocaleValue(fields.name);
          const title = firstLocaleValue(fields.title);
          return {
            id: item.sys.id,
            name: typeof name === "string" ? name : "Unnamed",
            title: typeof title === "string" ? title : "",
          };
        }),
      );
    } catch {
      setError("Could not load authors.");
    }
  }, [sdk]);

  useEffect(() => {
    void loadAuthors();
    const value = sdk.entry.fields.author?.getValue(locale) as EntryLink | undefined;
    setCurrentId(value?.sys?.id ?? "");
    return sdk.entry.fields.author?.onValueChanged(locale, (value?: EntryLink) => {
      setCurrentId(value?.sys?.id ?? "");
    });
  }, [sdk, locale, loadAuthors]);

  const assign = useCallback(
    async (id: string) => {
      setError(null);
      try {
        if (id) await sdk.entry.fields.author.setValue(entryLink(id), locale);
        else await sdk.entry.fields.author.setValue(undefined, locale);
      } catch {
        setError("Could not update the author field.");
      }
    },
    [sdk, locale],
  );

  const createAuthor = useCallback(async () => {
    const valid = validateAuthorName(newName);
    if (!valid.ok) {
      setError(valid.error ?? "Invalid name.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const created = await sdk.cma.entry.create(
        { contentTypeId: "author" },
        {
          fields: {
            name: { [locale]: newName.trim() },
            title: { [locale]: newTitle.trim() },
          },
        },
      );
      await sdk.cma.entry.publish({ entryId: created.sys.id }, created);
      await sdk.entry.fields.author.setValue(entryLink(created.sys.id), locale);
      setNewName("");
      setNewTitle("");
      setCreating(false);
      await loadAuthors();
      sdk.notifier.success("Author created and assigned.");
    } catch {
      setError("Could not create the author.");
    } finally {
      setBusy(false);
    }
  }, [sdk, locale, newName, newTitle, loadAuthors]);

  const current = authors.find((a) => a.id === currentId);

  return (
    <Flex flexDirection="column" gap="spacingS">
      {current ? (
        <Flex alignItems="center" gap="spacingS">
          <Flex
            alignItems="center"
            justifyContent="center"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#0059c8",
              color: "#fff",
              fontWeight: 600,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            {initials(current.name)}
          </Flex>
          <Flex flexDirection="column" style={{ minWidth: 0 }}>
            <Text fontWeight="fontWeightDemiBold">{current.name}</Text>
            {current.title && (
              <Text fontColor="gray600" fontSize="fontSizeS">
                {current.title}
              </Text>
            )}
          </Flex>
        </Flex>
      ) : (
        <Text fontColor="gray600" fontSize="fontSizeS">
          No author assigned yet.
        </Text>
      )}

      <FormControl marginBottom="none">
        <FormControl.Label>Author</FormControl.Label>
        <Select
          value={currentId}
          onChange={(e) => void assign(e.target.value)}
        >
          <Select.Option value="">— none —</Select.Option>
          {authors.map((a) => (
            <Select.Option key={a.id} value={a.id}>
              {a.name}
            </Select.Option>
          ))}
        </Select>
      </FormControl>

      {creating ? (
        <Flex flexDirection="column" gap="spacingXs">
          <TextInput
            value={newName}
            placeholder="Full name"
            onChange={(e) => setNewName(e.target.value)}
            isDisabled={busy}
          />
          <TextInput
            value={newTitle}
            placeholder="Role / title (optional)"
            onChange={(e) => setNewTitle(e.target.value)}
            isDisabled={busy}
          />
          <Flex gap="spacingXs">
            <Button variant="primary" size="small" onClick={() => void createAuthor()} isLoading={busy}>
              Create &amp; assign
            </Button>
            <Button variant="transparent" size="small" onClick={() => setCreating(false)} isDisabled={busy}>
              Cancel
            </Button>
          </Flex>
        </Flex>
      ) : (
        <Button variant="secondary" size="small" onClick={() => setCreating(true)}>
          + New author
        </Button>
      )}

      {error && <Note variant="negative">{error}</Note>}
    </Flex>
  );
}
