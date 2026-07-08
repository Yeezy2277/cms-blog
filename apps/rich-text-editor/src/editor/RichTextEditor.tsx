import { useCallback, useMemo, useRef, useState } from "react";
import { Plate, PlateContent, usePlateEditor, ParagraphPlugin, createPlatePlugin } from "platejs/react";
import {
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  CodePlugin,
  BlockquotePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
} from "@platejs/basic-nodes/react";
import { LinkPlugin } from "@platejs/link/react";
import type { FieldAppSDK } from "@contentful/app-sdk";

import { deserialize, serialize, type PlateValue } from "../transform";
import { SdkContext } from "../sdkContext";
import {
  UlElement,
  OlElement,
  LiElement,
  HrElement,
  LinkElement,
  EmbeddedEntryBlockElement,
  EmbeddedAssetBlockElement,
} from "./elements";
import { Toolbar, setBlockType, insertHr, toggleList, insertEmbed, type Ed } from "./Toolbar";
import { SlashMenu, type SlashItem } from "./SlashMenu";

const element = (key: string, type: string, isVoid = false) =>
  createPlatePlugin({ key, node: { isElement: true, isVoid, type } });

export function RichTextEditor({
  sdk,
  initialValue,
  isDisabled,
}: {
  sdk: FieldAppSDK | null;
  initialValue: PlateValue;
  isDisabled: boolean;
}) {
  const editor = usePlateEditor({
    plugins: [
      ParagraphPlugin,
      H1Plugin,
      H2Plugin,
      H3Plugin,
      BlockquotePlugin,
      BoldPlugin,
      ItalicPlugin,
      UnderlinePlugin,
      CodePlugin,
      LinkPlugin.withComponent(LinkElement),
      element("ul", "ul").withComponent(UlElement),
      element("ol", "ol").withComponent(OlElement),
      element("li", "li").withComponent(LiElement),
      element("hr", "hr", true).withComponent(HrElement),
      element("embedded-entry-block", "embedded-entry-block", true).withComponent(EmbeddedEntryBlockElement),
      element("embedded-asset-block", "embedded-asset-block", true).withComponent(EmbeddedAssetBlockElement),
    ],
    value: initialValue as never,
  });

  const ed = editor as unknown as Ed;
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced write-back to the Contentful field.
  const handleChange = useCallback(() => {
    if (!sdk) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const doc = serialize((editor.children as unknown as PlateValue) ?? []);
      void sdk.field.setValue(doc);
    }, 400);
  }, [sdk, editor]);

  /* ----- slash menu ----- */
  const [slash, setSlash] = useState<{ top: number; left: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const items = useMemo<SlashItem[]>(
    () => [
      { label: "Heading 1", hint: "H1", run: () => setBlockType(ed, "h1") },
      { label: "Heading 2", hint: "H2", run: () => setBlockType(ed, "h2") },
      { label: "Heading 3", hint: "H3", run: () => setBlockType(ed, "h3") },
      { label: "Quote", hint: "❝", run: () => setBlockType(ed, "blockquote") },
      { label: "Bullet list", hint: "•", run: () => toggleList(ed, "ul") },
      { label: "Numbered list", hint: "1.", run: () => toggleList(ed, "ol") },
      { label: "Divider", hint: "―", run: () => insertHr(ed) },
      { label: "Embed entry", run: () => void insertEmbed(ed, sdk, "Entry") },
      { label: "Embed asset", run: () => void insertEmbed(ed, sdk, "Asset") },
    ],
    [ed, sdk],
  );

  const openSlash = () => {
    const sel = window.getSelection();
    const rect = sel && sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
    const box = containerRef.current?.getBoundingClientRect();
    if (rect && box) {
      setSlash({ top: rect.bottom - box.top + 4, left: rect.left - box.left });
    } else {
      setSlash({ top: 44, left: 12 });
    }
    setActiveIndex(0);
  };

  const pick = (index: number) => {
    items[index]?.run();
    setSlash(null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (slash) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % items.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + items.length) % items.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        pick(activeIndex);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSlash(null);
      }
      return;
    }
    // Open the menu on "/" at the start of an empty-ish block.
    if (e.key === "/") {
      const text = (editor.api?.string?.(editor.selection?.focus.path.slice(0, 1)) as string) ?? "";
      if (!text) {
        e.preventDefault();
        openSlash();
      }
    }
  };

  return (
    <SdkContext.Provider value={sdk}>
      <div
        ref={containerRef}
        style={{
          position: "relative",
          border: "1px solid #cdd5e0",
          borderRadius: 6,
          background: "white",
          opacity: isDisabled ? 0.6 : 1,
        }}
      >
        <Plate editor={editor} onValueChange={handleChange}>
          <Toolbar editor={ed} sdk={sdk} />
          <PlateContent
            readOnly={isDisabled}
            onKeyDown={onKeyDown}
            placeholder="Write something, or press / for blocks…"
            style={{
              minHeight: 240,
              padding: "12px 16px",
              outline: "none",
              fontSize: 15,
              lineHeight: 1.6,
            }}
          />
        </Plate>
        {slash && (
          <SlashMenu items={items} activeIndex={activeIndex} position={slash} onPick={pick} />
        )}
      </div>
    </SdkContext.Provider>
  );
}

export { deserialize };
