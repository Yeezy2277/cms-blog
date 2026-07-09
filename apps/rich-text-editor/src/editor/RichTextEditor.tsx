import { useCallback, useMemo, useRef, useState } from "react";
import { Editor, Element as SlateElement, Node as SlateNode, Range as SlateRange, Transforms } from "slate";
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

import type { Document } from "@contentful/rich-text-types";
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
import "./editor.css";

const element = (key: string, type: string, isVoid = false) =>
  createPlatePlugin({ key, node: { isElement: true, isVoid, type } });

const isListEl = (n: unknown) =>
  SlateElement.isElement(n) && ((n as { type?: string }).type === "ul" || (n as { type?: string }).type === "ol");
const isLi = (n: unknown) => SlateElement.isElement(n) && (n as { type?: string }).type === "li";

// Enter in a list item splits into a new item; Enter in an empty item exits the
// list. Everything else falls through to Plate's default behaviour.
const ListBehaviorPlugin = createPlatePlugin({ key: "list-behavior" }).overrideEditor(
  ({ editor }) => {
    const e = editor as unknown as {
      selection: unknown;
      insertBreak: () => void;
    };
    const original = e.insertBreak.bind(e);
    e.insertBreak = () => {
      const sel = (e as { selection: SlateRange | null }).selection;
      if (sel && SlateRange.isCollapsed(sel)) {
        const [li] = Editor.nodes(e as never, { match: isLi });
        if (li) {
          const [liNode] = li;
          if (SlateNode.string(liNode as never).trim() === "") {
            Transforms.unwrapNodes(e as never, { match: isListEl, split: true });
            Transforms.unwrapNodes(e as never, { match: isLi, split: true });
            Transforms.setNodes(e as never, { type: "p" } as never);
            return;
          }
          Transforms.splitNodes(e as never, { match: isLi, always: true });
          return;
        }
      }
      original();
    };
    return {};
  },
);

export function RichTextEditor({
  sdk,
  initialValue,
  isDisabled,
  onDocChange,
}: {
  sdk: FieldAppSDK | null;
  initialValue: PlateValue;
  isDisabled: boolean;
  onDocChange?: (doc: Document) => void;
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
      ListBehaviorPlugin,
    ],
    value: initialValue as never,
  });

  const ed = editor as unknown as Ed;
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced write-back to the Contentful field (and the standalone JSON panel).
  const handleChange = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const doc = serialize((editor.children as unknown as PlateValue) ?? []);
      onDocChange?.(doc);
      if (sdk) void sdk.field.setValue(doc);
    }, 300);
  }, [sdk, editor, onDocChange]);

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
      <div ref={containerRef} className={isDisabled ? "rte-shell rte-shell--disabled" : "rte-shell"}>
        <Plate editor={editor} onValueChange={handleChange}>
          <Toolbar editor={ed} sdk={sdk} />
          <PlateContent
            className="rte-content"
            readOnly={isDisabled}
            onKeyDown={onKeyDown}
            placeholder="Write something, or press / for blocks…"
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
