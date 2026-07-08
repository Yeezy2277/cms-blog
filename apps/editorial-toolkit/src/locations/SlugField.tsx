import { useCallback, useEffect, useRef, useState } from "react";
import { useSDK } from "@contentful/react-apps-toolkit";
import type { FieldAppSDK } from "@contentful/app-sdk";
import { FormControl, TextInput, Text } from "@contentful/f36-components";
import {
  MAX_SLUG_LENGTH,
  checkSlugUniqueness,
  generateSlug,
  validateSlug,
} from "../utils/slug";

const TITLE_FIELD_ID = "title";

/**
 * Auto-syncing slug field.
 *
 * - While the entry is a draft, the slug tracks the title automatically.
 * - Once the editor types into the slug, auto-sync stops (manual override).
 * - Every value is validated and checked for uniqueness across blogPost entries.
 *
 * Generalised from the source platform's slug editor; the content-type-specific
 * path prefixes (categories, tag types, author folders) are dropped for the
 * flat Lumen model.
 */
export function SlugField() {
  const sdk = useSDK<FieldAppSDK>();

  const [value, setValue] = useState<string>(sdk.field.getValue() || "");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isManual, setIsManual] = useState(false);

  const slugRef = useRef<string>(sdk.field.getValue() || "");
  const sys = sdk.entry.getSys();
  const isDraft = !sys.publishedAt;
  const canAutoSync = isDraft && !isManual;

  const contentTypeId = sys.contentType.sys.id;
  const entryId = sys.id;

  useEffect(() => {
    sdk.window.startAutoResizer();
    return () => sdk.window.stopAutoResizer();
  }, [sdk.window]);

  const applySlug = useCallback(
    async (next: string, generated: boolean) => {
      slugRef.current = next;
      setValue(next);
      await sdk.field.setValue(next);
      setInfo(generated ? "Auto-generated from the title" : null);

      const validation = validateSlug(next);
      if (!validation.isValid) {
        setError(validation.error ?? "Invalid slug");
        sdk.field.setInvalid(true);
        return;
      }

      const uniqueness = await checkSlugUniqueness(next, contentTypeId, entryId, sdk.cma);
      if (!uniqueness.isUnique) {
        setError(uniqueness.error ?? "Slug already in use");
        sdk.field.setInvalid(true);
      } else {
        setError(uniqueness.error ?? null);
        sdk.field.setInvalid(false);
      }
    },
    [sdk, contentTypeId, entryId],
  );

  // Sync from the title field while in auto mode.
  useEffect(() => {
    const titleField = sdk.entry.fields[TITLE_FIELD_ID];
    if (!titleField) return;
    const locale = sdk.field.locale;

    const onTitleChange = (title?: string) => {
      if (!canAutoSync) return;
      const generated = generateSlug(title || "");
      if (generated && generated !== slugRef.current) {
        void applySlug(generated, true);
      }
    };

    // Seed an empty draft's slug from the existing title on mount.
    if (canAutoSync && !slugRef.current) {
      onTitleChange(titleField.getValue(locale));
    }
    return titleField.onValueChanged(locale, onTitleChange);
  }, [sdk, canAutoSync, applySlug]);

  const handleManualChange = useCallback(
    (next: string) => {
      if (!isManual && next !== slugRef.current) {
        setIsManual(true);
        setInfo(null);
      }
      void applySlug(next, false);
    },
    [isManual, applySlug],
  );

  const atLimit = value.length >= MAX_SLUG_LENGTH;

  return (
    <FormControl isInvalid={!!error} isRequired>
      <TextInput
        value={value}
        onChange={(e) => handleManualChange(e.target.value)}
        maxLength={MAX_SLUG_LENGTH}
        placeholder="post-slug"
      />
      <FormControl.HelpText>
        <span style={{ display: "flex", justifyContent: "space-between" }}>
          <Text as="span" fontColor="gray600" fontSize="fontSizeS">
            {info ?? (isManual ? "Manually edited" : "Tracks the title until you edit it")}
          </Text>
          <Text as="span" fontColor={atLimit ? "red600" : "gray600"} fontSize="fontSizeS">
            {value.length} / {MAX_SLUG_LENGTH}
          </Text>
        </span>
      </FormControl.HelpText>
      {error && <FormControl.ValidationMessage>{error}</FormControl.ValidationMessage>}
    </FormControl>
  );
}
