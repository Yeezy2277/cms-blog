import { useEffect, useState } from "react";
import { useSDK } from "@contentful/react-apps-toolkit";
import type { FieldAppSDK } from "@contentful/app-sdk";
import { Box, Text, Badge } from "@contentful/f36-components";
import tokens from "@contentful/f36-tokens";
import { calcReadingMinutes } from "../utils/readingTime";

const BODY_FIELD_ID = "body";

/**
 * Read-only display of the estimated reading time.
 *
 * The authoritative value is written by the webhook on publish; this widget
 * shows a *live* preview recomputed from the body as the editor types, and
 * flags when the preview has drifted from the saved value (i.e. it will change
 * on the next publish). Both use the same formula in utils/readingTime.
 */
export function ReadingTimeField() {
  const sdk = useSDK<FieldAppSDK>();

  const [savedMinutes, setSavedMinutes] = useState<number | null>(() => {
    const v = sdk.field.getValue();
    return typeof v === "number" && v > 0 ? v : null;
  });
  const [liveMinutes, setLiveMinutes] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    sdk.window.startAutoResizer();
    return () => sdk.window.stopAutoResizer();
  }, [sdk.window]);

  // External updates to our own field (e.g. the webhook after publish).
  useEffect(() => {
    return sdk.field.onValueChanged((val: unknown) => {
      setSavedMinutes(typeof val === "number" && val > 0 ? val : null);
      setIsDirty(false);
    });
  }, [sdk.field]);

  // Live recompute from the body field on the same entry.
  useEffect(() => {
    const locale = sdk.field.locale;
    const bodyField = sdk.entry.fields[BODY_FIELD_ID];
    if (!bodyField) return;

    const recalc = (doc: unknown) => {
      if (!doc) {
        setLiveMinutes(null);
        setIsDirty(false);
        return;
      }
      const mins = calcReadingMinutes(doc as never);
      setLiveMinutes(mins);
      setSavedMinutes((prev) => {
        setIsDirty(mins !== prev);
        return prev;
      });
    };

    recalc(bodyField.getValue(locale));
    return bodyField.onValueChanged(locale, recalc);
  }, [sdk.entry.fields, sdk.field.locale]);

  const displayMinutes = liveMinutes ?? savedMinutes;

  return (
    <Box
      style={{
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingS,
        padding: `${tokens.spacingXs} 0`,
        minHeight: "36px",
      }}
    >
      {displayMinutes !== null ? (
        <>
          <Badge variant="secondary">{displayMinutes} min read</Badge>
          <Text fontSize="fontSizeS" fontColor="gray500" style={{ fontStyle: "italic" }}>
            {isDirty
              ? "Updated · will be saved on next publish"
              : "Calculated automatically · read-only"}
          </Text>
        </>
      ) : (
        <Text fontSize="fontSizeS" fontColor="gray500" style={{ fontStyle: "italic" }}>
          Will be calculated automatically once the body has content
        </Text>
      )}
    </Box>
  );
}
