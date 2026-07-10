import { useCallback, useEffect, useState } from "react";
import { useSDK } from "@contentful/react-apps-toolkit";
import type { FieldAppSDK } from "@contentful/app-sdk";
import {
  Button,
  Flex,
  FormControl,
  Note,
  Spinner,
  Text,
  TextInput,
} from "@contentful/f36-components";

import { parseImageUrl, assetTitleFromFileName } from "../utils/mediaImport";

type AssetLink = { sys: { type: "Link"; linkType: "Asset"; id: string } };
type AssetInfo = { id: string; title: string; url?: string };

const assetLink = (id: string): AssetLink => ({ sys: { type: "Link", linkType: "Asset", id } });

const firstLocaleValue = (byLocale: Record<string, unknown> | undefined): unknown =>
  byLocale ? Object.values(byLocale)[0] : undefined;

/**
 * Media importer — paste an https image URL, get a processed + published
 * Contentful asset linked into the field. The heavy lifting is the CMA's
 * create-from-URL flow (create → process → poll → publish); the native asset
 * picker stays available for everything already in the library.
 */
export function MediaField() {
  const sdk = useSDK<FieldAppSDK>();
  const locale = sdk.field.locale || sdk.locales.default;

  const [current, setCurrent] = useState<AssetInfo | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sdk.window.startAutoResizer();
    return () => sdk.window.stopAutoResizer();
  }, [sdk.window]);

  const loadCurrent = useCallback(async () => {
    const value = sdk.field.getValue() as AssetLink | undefined;
    if (!value?.sys?.id) {
      setCurrent(null);
      return;
    }
    try {
      const asset = await sdk.cma.asset.get({ assetId: value.sys.id });
      const fields = asset.fields as Record<string, Record<string, unknown>>;
      const file = firstLocaleValue(fields.file) as { url?: string } | undefined;
      const title = firstLocaleValue(fields.title);
      setCurrent({
        id: value.sys.id,
        title: typeof title === "string" ? title : value.sys.id,
        url: file?.url ? String(file.url).replace(/^\/\//, "https://") : undefined,
      });
    } catch {
      setCurrent({ id: value.sys.id, title: value.sys.id });
    }
  }, [sdk]);

  useEffect(() => {
    void loadCurrent();
    return sdk.field.onValueChanged(() => void loadCurrent());
  }, [sdk.field, loadCurrent]);

  /** Poll until Contentful has downloaded + processed the file. */
  const waitForProcessing = useCallback(
    async (assetId: string) => {
      for (let attempt = 0; attempt < 20; attempt++) {
        const asset = await sdk.cma.asset.get({ assetId });
        const file = firstLocaleValue(
          asset.fields.file as Record<string, unknown> | undefined,
        ) as { url?: string } | undefined;
        if (file?.url) return asset;
        await new Promise((r) => setTimeout(r, 700));
      }
      throw new Error("Processing timed out");
    },
    [sdk],
  );

  const importFromUrl = useCallback(async () => {
    const parsed = parseImageUrl(url);
    if (!parsed.ok) {
      setError(parsed.error ?? "Invalid URL.");
      return;
    }
    setError(null);

    try {
      setBusy("Creating asset…");
      const created = await sdk.cma.asset.create(
        {},
        {
          fields: {
            title: { [locale]: assetTitleFromFileName(parsed.fileName!) },
            description: { [locale]: `Imported from ${parsed.url}` },
            file: {
              [locale]: {
                contentType: parsed.contentType!,
                fileName: parsed.fileName!,
                upload: parsed.url!,
              },
            },
          },
        },
      );

      setBusy("Processing…");
      await sdk.cma.asset.processForAllLocales({}, created);
      const processed = await waitForProcessing(created.sys.id);

      setBusy("Publishing…");
      await sdk.cma.asset.publish({ assetId: created.sys.id }, processed);

      await sdk.field.setValue(assetLink(created.sys.id));
      setUrl("");
      sdk.notifier.success("Image imported and linked.");
    } catch {
      setError("Import failed — check the URL is publicly reachable and try again.");
    } finally {
      setBusy(null);
    }
  }, [sdk, url, locale, waitForProcessing]);

  const pickExisting = useCallback(async () => {
    try {
      const picked = await sdk.dialogs.selectSingleAsset();
      const id = (picked as { sys?: { id?: string } } | null)?.sys?.id;
      if (id) await sdk.field.setValue(assetLink(id));
    } catch {
      sdk.notifier.error("Could not select an asset.");
    }
  }, [sdk]);

  const clear = useCallback(async () => {
    await sdk.field.setValue(undefined);
  }, [sdk]);

  return (
    <Flex flexDirection="column" gap="spacingS">
      {current && (
        <Flex alignItems="center" gap="spacingM">
          {current.url ? (
            // eslint-disable-next-line jsx-a11y/img-redundant-alt
            <img
              src={current.url}
              alt={current.title}
              style={{ width: 96, height: 64, objectFit: "cover", borderRadius: 6, border: "1px solid #d3dce0" }}
            />
          ) : (
            <Spinner size="small" />
          )}
          <Flex flexDirection="column" gap="spacing2Xs" style={{ minWidth: 0 }}>
            <Text fontWeight="fontWeightDemiBold">{current.title}</Text>
            <Button variant="transparent" size="small" onClick={() => void clear()} style={{ justifyContent: "flex-start", padding: 0 }}>
              Remove
            </Button>
          </Flex>
        </Flex>
      )}

      <FormControl marginBottom="none">
        <FormControl.Label>Import from URL</FormControl.Label>
        <Flex gap="spacingXs">
          <TextInput
            value={url}
            placeholder="https://…/image.jpg"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void importFromUrl();
            }}
            isDisabled={Boolean(busy)}
          />
          <Button variant="primary" onClick={() => void importFromUrl()} isLoading={Boolean(busy)}>
            {busy ?? "Import"}
          </Button>
        </Flex>
        <FormControl.HelpText>
          Creates a processed, published asset from the URL and links it here — or{" "}
          <Button variant="transparent" size="small" onClick={() => void pickExisting()} style={{ padding: 0, minHeight: "auto" }}>
            browse existing assets
          </Button>
          .
        </FormControl.HelpText>
      </FormControl>

      {error && <Note variant="negative">{error}</Note>}
    </Flex>
  );
}
