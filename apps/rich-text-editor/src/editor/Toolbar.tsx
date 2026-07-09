import { useEffect, useReducer, useRef, useState } from "react";
import {
  Editor,
  Element as SlateElement,
  Transforms,
  Range,
  type Editor as SlateEditor,
  type Node as SlateNode,
} from "slate";
import type { FieldAppSDK } from "@contentful/app-sdk";

/**
 * Formatting toolbar. The Plate editor is a Slate editor under the hood, so we
 * drive it with stable `slate`-core transforms rather than Plate's
 * faster-moving transform helpers — fewer surprises across minor versions.
 * Node shapes are typed via the CustomTypes augmentation in src/slate.d.ts.
 */

type Ed = SlateEditor;

const MARKS = ["bold", "italic", "underline", "code"] as const;
type Mark = (typeof MARKS)[number];

/* ----- active-state queries ---------------------------------------------- */

function isMarkActive(editor: Ed, mark: Mark): boolean {
  if (!editor.selection) return false;
  const marks = Editor.marks(editor);
  return marks ? marks[mark] === true : false;
}

function isBlockActive(editor: Ed, type: string): boolean {
  if (!editor.selection) return false;
  const [match] = Editor.nodes(editor, {
    match: (n) => SlateElement.isElement(n) && n.type === type,
  });
  return Boolean(match);
}

/* ----- mutations ---------------------------------------------------------- */

function toggleMark(editor: Ed, mark: Mark) {
  if (isMarkActive(editor, mark)) Editor.removeMark(editor, mark);
  else Editor.addMark(editor, mark, true);
}

const isTopBlock = (editor: Ed) => (n: SlateNode) =>
  SlateElement.isElement(n) && Editor.isBlock(editor, n) && !editor.isInline(n);

export const isListEl = (n: SlateNode) =>
  SlateElement.isElement(n) && (n.type === "ul" || n.type === "ol");

export const isLi = (n: SlateNode) => SlateElement.isElement(n) && n.type === "li";

/** Unwrap the selection out of any list structure back to paragraphs. */
export function unwrapList(editor: Ed) {
  Transforms.unwrapNodes(editor, { match: isListEl, split: true });
  Transforms.unwrapNodes(editor, { match: isLi, split: true });
  // Whatever is left becomes a normal paragraph.
  Transforms.setNodes(editor, { type: "p" }, { match: isTopBlock(editor) });
}

function setBlockType(editor: Ed, type: string) {
  if (isBlockActive(editor, "ul") || isBlockActive(editor, "ol")) unwrapList(editor);
  Transforms.setNodes(editor, { type }, { match: isTopBlock(editor), mode: "highest" });
}

function toggleList(editor: Ed, listType: "ul" | "ol") {
  const inThis = isBlockActive(editor, listType);
  const inOther = isBlockActive(editor, listType === "ul" ? "ol" : "ul");

  if (inThis) {
    unwrapList(editor);
    return;
  }
  if (inOther) {
    // Same structure, just flip the list container's type.
    Transforms.setNodes(editor, { type: listType }, { match: isListEl });
    return;
  }
  // Not in a list yet: paragraph(s) -> list > li > p (single level, no nesting).
  Transforms.setNodes(editor, { type: "p" }, { match: isTopBlock(editor) });
  Transforms.wrapNodes(editor, { type: "li", children: [] }, { match: isTopBlock(editor) });
  Transforms.wrapNodes(editor, { type: listType, children: [] }, { match: isLi });
}

function insertHr(editor: Ed) {
  Transforms.insertNodes(editor, { type: "hr", children: [{ text: "" }] });
}

/**
 * Insert or wrap a link at the given (previously saved) selection. The URL
 * comes from the toolbar's inline popover — window.prompt() is silently
 * blocked inside sandboxed iframes (Contentful, the portfolio hub), so a
 * native dialog can never be relied on here.
 */
function applyLink(editor: Ed, url: string, at: Range | null) {
  if (!url.trim()) return;
  if (at) Transforms.select(editor, at);
  const { selection } = editor;
  const isCollapsed = selection && Range.isCollapsed(selection);
  if (isCollapsed) {
    Transforms.insertNodes(editor, { type: "a", url, children: [{ text: url }] });
  } else {
    Transforms.wrapNodes(editor, { type: "a", url, children: [] }, { split: true });
    Transforms.collapse(editor, { edge: "end" });
  }
}

async function insertEmbed(editor: Ed, sdk: FieldAppSDK | null, kind: "Entry" | "Asset") {
  if (!sdk) return;
  try {
    const picked =
      kind === "Entry"
        ? await sdk.dialogs.selectSingleEntry()
        : await sdk.dialogs.selectSingleAsset();
    const id = (picked as { sys?: { id?: string } } | null)?.sys?.id;
    if (!id) return;
    const node =
      kind === "Entry"
        ? { type: "embedded-entry-block", entryId: id, children: [{ text: "" }] }
        : { type: "embedded-asset-block", assetId: id, children: [{ text: "" }] };
    Transforms.insertNodes(editor, node);
  } catch {
    sdk.notifier.error("Could not insert embed.");
  }
}

/* ----- UI ----------------------------------------------------------------- */

function Btn({
  active,
  title,
  run,
  children,
  style,
}: {
  active?: boolean;
  title: string;
  run: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      // preventDefault on mousedown keeps the editor selection; the action
      // itself runs on click so keyboard activation (Enter/Space) works too.
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      className={active ? "rte-tb__btn rte-tb__btn--on" : "rte-tb__btn"}
      style={style}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="rte-tb__sep" aria-hidden="true" />;

export function Toolbar({ editor, sdk }: { editor: Ed; sdk: FieldAppSDK | null }) {
  // Re-render on caret/selection moves so active states stay in sync.
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const h = () => force();
    document.addEventListener("selectionchange", h);
    return () => document.removeEventListener("selectionchange", h);
  }, []);

  /* Inline link popover (replaces window.prompt — see applyLink). */
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const savedSelection = useRef<Range | null>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  const openLink = () => {
    savedSelection.current = editor.selection;
    setLinkUrl("");
    setLinkOpen(true);
  };

  useEffect(() => {
    if (linkOpen) linkInputRef.current?.focus();
  }, [linkOpen]);

  const confirmLink = () => {
    applyLink(editor, linkUrl, savedSelection.current);
    setLinkOpen(false);
  };

  return (
    <div className="rte-tb">
      <Btn title="Bold (⌘B)" active={isMarkActive(editor, "bold")} run={() => toggleMark(editor, "bold")} style={{ fontWeight: 700 }}>B</Btn>
      <Btn title="Italic" active={isMarkActive(editor, "italic")} run={() => toggleMark(editor, "italic")} style={{ fontStyle: "italic" }}>i</Btn>
      <Btn title="Underline" active={isMarkActive(editor, "underline")} run={() => toggleMark(editor, "underline")} style={{ textDecoration: "underline" }}>U</Btn>
      <Btn title="Inline code" active={isMarkActive(editor, "code")} run={() => toggleMark(editor, "code")} style={{ fontFamily: "ui-monospace, monospace" }}>{"</>"}</Btn>
      <Sep />
      <Btn title="Paragraph" active={isBlockActive(editor, "p")} run={() => setBlockType(editor, "p")}>P</Btn>
      <Btn title="Heading 1" active={isBlockActive(editor, "h1")} run={() => setBlockType(editor, "h1")}>H1</Btn>
      <Btn title="Heading 2" active={isBlockActive(editor, "h2")} run={() => setBlockType(editor, "h2")}>H2</Btn>
      <Btn title="Heading 3" active={isBlockActive(editor, "h3")} run={() => setBlockType(editor, "h3")}>H3</Btn>
      <Btn title="Quote" active={isBlockActive(editor, "blockquote")} run={() => setBlockType(editor, "blockquote")}>❝</Btn>
      <Sep />
      <Btn title="Bullet list" active={isBlockActive(editor, "ul")} run={() => toggleList(editor, "ul")}>• List</Btn>
      <Btn title="Numbered list" active={isBlockActive(editor, "ol")} run={() => toggleList(editor, "ol")}>1. List</Btn>
      <Btn title="Link" active={linkOpen} run={openLink}>Link</Btn>
      <Btn title="Divider" run={() => insertHr(editor)}>―</Btn>
      <Sep />
      <Btn title="Embed entry" run={() => void insertEmbed(editor, sdk, "Entry")}>+ Entry</Btn>
      <Btn title="Embed asset" run={() => void insertEmbed(editor, sdk, "Asset")}>+ Asset</Btn>

      {linkOpen && (
        <div className="rte-tb__linkpop">
          <input
            ref={linkInputRef}
            className="rte-tb__linkinput"
            type="url"
            placeholder="https://…"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmLink();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setLinkOpen(false);
              }
            }}
          />
          <button type="button" className="rte-tb__btn" onClick={confirmLink}>
            Add
          </button>
          <button type="button" className="rte-tb__btn" onClick={() => setLinkOpen(false)}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export { insertEmbed, setBlockType, insertHr, toggleList, type Ed };
