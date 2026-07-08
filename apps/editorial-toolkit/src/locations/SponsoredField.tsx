import { useEffect, useMemo, useState } from "react";
import type { FieldAppSDK } from "@contentful/app-sdk";
import { useSDK } from "@contentful/react-apps-toolkit";
import { FormControl, TextInput } from "@contentful/f36-components";

/**
 * Sponsor name field, gated on the `isSponsored` boolean on the same entry.
 *
 * When the article is not sponsored the field is disabled and any stored value
 * is cleared, so a post can never be published with a stale sponsor name. This
 * is a cross-field rule Contentful can't express in the content model, which is
 * exactly why it lives in a custom field app.
 */
export function SponsoredField() {
  const sdk = useSDK<FieldAppSDK>();
  const locale = useMemo(() => sdk.field.locale || sdk.locales.default, [sdk]);

  const [sponsorName, setSponsorName] = useState<string>(sdk.field.getValue() || "");
  const [isSponsored, setIsSponsored] = useState<boolean>(
    Boolean(sdk.entry.fields.isSponsored?.getValue(locale)),
  );

  useEffect(() => {
    sdk.window.startAutoResizer();
    return () => sdk.window.stopAutoResizer();
  }, [sdk.window]);

  // React to the gating boolean.
  useEffect(() => {
    const field = sdk.entry.fields.isSponsored;
    if (!field) return;

    const onChange = (value?: boolean) => {
      const next = Boolean(value);
      setIsSponsored(next);
      if (!next) {
        setSponsorName("");
        void sdk.field.setValue("");
      }
    };

    onChange(field.getValue(locale));
    return field.onValueChanged(locale, onChange);
  }, [sdk, locale]);

  useEffect(
    () => sdk.field.onValueChanged((value?: string) => setSponsorName(value || "")),
    [sdk.field],
  );

  const handleChange = async (value: string) => {
    setSponsorName(value);
    await sdk.field.setValue(value);
    sdk.field.setInvalid(isSponsored && value.trim().length === 0);
  };

  return (
    <FormControl isInvalid={isSponsored && sponsorName.trim().length === 0}>
      <TextInput
        value={sponsorName}
        onChange={(e) => void handleChange(e.target.value)}
        isDisabled={!isSponsored}
        isReadOnly={!isSponsored}
        placeholder="Sponsor name"
      />
      {!isSponsored ? (
        <FormControl.HelpText>
          Enable “Sponsored article” to fill in this field.
        </FormControl.HelpText>
      ) : (
        sponsorName.trim().length === 0 && (
          <FormControl.ValidationMessage>
            A sponsored article needs a sponsor name.
          </FormControl.ValidationMessage>
        )
      )}
    </FormControl>
  );
}
