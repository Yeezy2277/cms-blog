import { useMemo, useState } from "react";
import type { Document } from "@contentful/rich-text-types";
import { RichTextEditor } from "./editor/RichTextEditor";
import { deserialize, serialize } from "./transform";
import "./demo.css";

/**
 * Public, Contentful-free playground for the editor. Rendered when the bundle is
 * opened directly (not inside Contentful's iframe) — see main.tsx. Lets anyone
 * type in the real editor and watch the Contentful Rich Text document it
 * produces update live. Entry/asset embeds are disabled here (they need
 * Contentful's dialogs); everything else is the same code that runs in the CMS.
 */

const STARTER = {
  nodeType: "document",
  data: {},
  content: [
    { nodeType: "heading-1", data: {}, content: [{ nodeType: "text", value: "Try the editor", marks: [], data: {} }] },
    {
      nodeType: "paragraph",
      data: {},
      content: [
        { nodeType: "text", value: "This is the same PlateJS editor that runs inside Contentful. Make text ", marks: [], data: {} },
        { nodeType: "text", value: "bold", marks: [{ type: "bold" }], data: {} },
        { nodeType: "text", value: " or ", marks: [], data: {} },
        { nodeType: "text", value: "italic", marks: [{ type: "italic" }], data: {} },
        { nodeType: "text", value: ", add a ", marks: [], data: {} },
        { nodeType: "hyperlink", data: { uri: "https://www.contentful.com/developers/docs/concepts/rich-text/" }, content: [{ nodeType: "text", value: "link", marks: [], data: {} }] },
        { nodeType: "text", value: ", or press ", marks: [], data: {} },
        { nodeType: "text", value: "/", marks: [{ type: "code" }], data: {} },
        { nodeType: "text", value: " on an empty line for blocks.", marks: [], data: {} },
      ],
    },
    {
      nodeType: "unordered-list",
      data: {},
      content: [
        { nodeType: "list-item", data: {}, content: [{ nodeType: "paragraph", data: {}, content: [{ nodeType: "text", value: "Headings, lists and quotes", marks: [], data: {} }] }] },
        { nodeType: "list-item", data: {}, content: [{ nodeType: "paragraph", data: {}, content: [{ nodeType: "text", value: "Every keystroke maps to valid Contentful JSON →", marks: [], data: {} }] }] },
      ],
    },
    { nodeType: "blockquote", data: {}, content: [{ nodeType: "paragraph", data: {}, content: [{ nodeType: "text", value: "The editor owns the UI; the document model stays 100% Contentful.", marks: [], data: {} }] }] },
  ],
} as unknown as Document;

export function StandaloneDemo() {
  const initialValue = useMemo(() => deserialize(STARTER), []);
  const [doc, setDoc] = useState<Document>(() => serialize(initialValue));

  return (
    <div className="rte-demo">
      <header className="rte-demo__head">
        <div className="rte-demo__badge">Live demo · no login</div>
        <h1>Rich Text Editor</h1>
        <p>
          A custom PlateJS editor for Contentful Rich Text fields. Type on the
          left — the Contentful document JSON it produces updates live on the
          right. This is the exact editor that runs inside the CMS.
        </p>
      </header>

      <div className="rte-demo__grid">
        <div className="rte-demo__pane">
          <div className="rte-demo__label">Editor</div>
          <RichTextEditor sdk={null} initialValue={initialValue} isDisabled={false} onDocChange={setDoc} />
          <p className="rte-demo__hint">
            Entry / asset embeds are disabled in this standalone demo (they use
            Contentful&apos;s pickers). Everything else is live.
          </p>
        </div>

        <div className="rte-demo__pane">
          <div className="rte-demo__label">Contentful Rich Text document</div>
          <pre className="rte-demo__json">{JSON.stringify(doc, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
