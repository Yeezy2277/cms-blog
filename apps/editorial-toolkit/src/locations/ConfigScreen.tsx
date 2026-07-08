import { useCallback, useEffect, useState } from "react";
import { useSDK } from "@contentful/react-apps-toolkit";
import type { ConfigAppSDK } from "@contentful/app-sdk";
import {
  Flex,
  Form,
  Heading,
  Paragraph,
  Text,
} from "@contentful/f36-components";

/**
 * App configuration screen.
 *
 * The toolkit is largely configured per-field via instance parameters, so the
 * config screen mostly documents the app and lets onAppConfigure complete the
 * install. Any global installation parameters would live here.
 */
export function ConfigScreen() {
  const sdk = useSDK<ConfigAppSDK>();
  const [parameters, setParameters] = useState<Record<string, unknown>>({});

  const onConfigure = useCallback(async () => {
    const currentState = await sdk.app.getCurrentState();
    return { parameters, targetState: currentState };
  }, [parameters, sdk]);

  useEffect(() => {
    sdk.app.onConfigure(() => onConfigure());
  }, [sdk, onConfigure]);

  useEffect(() => {
    (async () => {
      const current = await sdk.app.getParameters();
      if (current) setParameters(current as Record<string, unknown>);
      sdk.app.setReady();
    })();
  }, [sdk]);

  return (
    <Flex
      flexDirection="column"
      gap="spacingM"
      style={{ maxWidth: 720, margin: "40px auto", padding: "0 20px" }}
    >
      <Heading>Editorial Toolkit</Heading>
      <Paragraph>
        One App Framework bundle providing the slug editor, reading-time display,
        sponsor validation and related-content picker for <Text fontWeight="fontWeightDemiBold">blogPost</Text>,
        plus a Content QA page.
      </Paragraph>
      <Form>
        <Text fontColor="gray600">
          Assign each field to this app with the <code>tool</code> instance parameter
          (or run <code>content-model/assign-toolkit-fields.mjs</code>). No global
          configuration is required.
        </Text>
      </Form>
    </Flex>
  );
}
