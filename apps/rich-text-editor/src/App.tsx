import { useEffect, useMemo, useState } from "react";
import { useSDK } from "@contentful/react-apps-toolkit";
import { locations, type FieldAppSDK, type ConfigAppSDK } from "@contentful/app-sdk";
import { Flex, Heading, Paragraph, Text } from "@contentful/f36-components";

import { RichTextEditor, deserialize } from "./editor/RichTextEditor";

function ConfigScreen() {
  const sdk = useSDK<ConfigAppSDK>();
  useEffect(() => {
    sdk.app.onConfigure(async () => ({
      parameters: {},
      targetState: await sdk.app.getCurrentState(),
    }));
    sdk.app.setReady();
  }, [sdk]);

  return (
    <Flex flexDirection="column" gap="spacingM" style={{ maxWidth: 640, margin: "40px auto", padding: "0 20px" }}>
      <Heading>Rich Text Editor</Heading>
      <Paragraph>
        A custom PlateJS editor for Rich Text fields that serialises to the
        Contentful Rich Text document model. Assign it under a Rich Text field&apos;s
        <Text fontWeight="fontWeightDemiBold"> Appearance</Text> settings.
      </Paragraph>
    </Flex>
  );
}

function FieldEditor() {
  const sdk = useSDK<FieldAppSDK>();
  const initialValue = useMemo(() => deserialize(sdk.field.getValue()), [sdk.field]);
  const [disabled, setDisabled] = useState(() => sdk.field.getIsDisabled?.() ?? false);

  // Cap the iframe height so a long body scrolls internally and the sticky
  // toolbar stays visible, while short content stays compact (native feel).
  useEffect(() => {
    const MAX = Math.max(560, window.innerHeight - 60);
    const MIN = 320;
    const apply = () => {
      const h = Math.max(
        document.documentElement?.scrollHeight ?? 0,
        document.body?.scrollHeight ?? 0,
      );
      sdk.window.updateHeight(Math.max(MIN, Math.min(h, MAX)));
    };
    apply();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    ro?.observe(document.body);
    return () => ro?.disconnect();
  }, [sdk.window]);

  useEffect(() => {
    return sdk.field.onIsDisabledChanged?.((v: boolean) => setDisabled(v));
  }, [sdk.field]);

  return <RichTextEditor sdk={sdk} initialValue={initialValue} isDisabled={disabled} />;
}

export default function App() {
  const sdk = useSDK();
  if (sdk.location.is(locations.LOCATION_APP_CONFIG)) return <ConfigScreen />;
  if (sdk.location.is(locations.LOCATION_ENTRY_FIELD)) return <FieldEditor />;
  return null;
}
