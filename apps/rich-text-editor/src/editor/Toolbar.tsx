import { useEffect, useReducer } from "react";
import { Editor, Element as SlateElement, Transforms, Range, type BaseEditor } from "slate";
import type { FieldAppSDK } from "@contentful/app-sdk";

/**
 * Formatting toolbar. The Plate editor is a Slate editor under the hood, so we
 * drive it with stable `slate`-core transforms rather than Plate's
 * faster-moving transform helpers — fewer surprises across minor versions.
 */

type Ed = BaseEditor & { insertNode: (n: unknown) => void };

const MARKS = ["bold", "italic", "underline", "code"] as const;
type Mark = (typeof MARKS)[number];

/* ----- active-state queries ---------------------------------------------- */

function isMarkActive(editor: Ed, mark: Mark): boolean {
  if (!(editor as { selection?: unknown }).selection) return false;
  const marks = Editor.marks(editor as never) as Record<string, unknown> | null;
  return marks ? marks[mark] === true : false;
}

function isBlockActive(editor: Ed, type: string): boolean {
  if (!(editor as { selection?: unknown }).selection) return false;
  const [match] = Editor.nodes(editor as never, {
    match: (n) => SlateElement.isElement(n) && (n as { type?: string }).type === type,
  });
  return Boolean(match);
}

/* ----- mutations ---------------------------------------------------------- */

function toggleMark(editor: Ed, mark: Mark) {
  if (isMarkActive(editor, mark)) Editor.removeMark(editor as never, mark);
  else Editor.addMark(editor as never, mark, true);
}

const isTopBlock = (editor: Ed) => (n: unknown) =>
  SlateElement.isElement(n) && Editor.isBlock(editor as never, n as never) && !editor.isInline(n as never);

const isListEl = (n: unknown) =>
  SlateElement.isElement(n) && ((n as { type?: string }).type === "ul" || (n as { type?: string }).type === "ol");

function unwrapList(editor: Ed) {
  Transforms.unwrapNodes(editor as never, { match: isListEl, split: true });
  Transforms.unwrapNodes(editor as never, {
    match: (n) => SlateElement.isElement(n) && (n as { type?: string }).type === "li",
    split: true,
  });
  // Whatever is left becomes a normal paragraph.
  Transforms.setNodes(editor as never, { type: "p" } as never, { match: isTopBlock(editor) });
}

function setBlockType(editor: Ed, type: string) {
  if (isBlockActive(editor, "ul") || isBlockActive(editor, "ol")) unwrapList(editor);
  Transforms.setNodes(editor as never, { type } as never, {
    match: isTopBlock(editor),
    mode: "highest",
  });
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
    Transforms.setNodes(editor as never, { type: listType } as never, { match: isListEl });
    return;
  }
  // Not in a list yet: paragraph(s) -> list > li > p (single level, no nesting).
  Transforms.setNodes(editor as never, { type: "p" } as never, { match: isTopBlock(editor) });
  Transforms.wrapNodes(editor as never, { type: "li", children: [] } as never, { match: isTopBlock(editor) });
  Transforms.wrapNodes(editor as never, { type: listType, children: [] } as never, {
    match: (n) => SlateElement.isElement(n) && (n as { type?: string }).type === "li",
  });
}

function insertHr(editor: Ed) {
  Transforms.insertNodes(editor as never, { type: "hr", children: [{ text: "" }] } as never);
}

function insertLink(editor: Ed) {
  const url = window.prompt("Link URL");
  if (!url) return;
  const { selection } = editor as never as { selection: Range | null };
  const isCollapsed = selection && Range.isCollapsed(selection);
  const link = { type: "a", url, children: isCollapsed ? [{ text: url }] : [] };
  if (isCollapsed) {
    Transforms.insertNodes(editor as never, link as never);
  } else {
    Transforms.wrapNodes(editor as never, link as never, { split: true });
    Transforms.collapse(editor as never, { edge: "end" });
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
    Transforms.insertNodes(editor as never, node as never);
  } catch {
    sdk.notifier.error("Could not insert embed.");
  }
}

/* ----- UI ----------------------------------------------------------------- */

function Btn({
  active,
  title,
  onDown,
  children,
  style,
}: {
  active?: boolean;
  title: string;
  onDown: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onMouseDown={(e) => {
        e.preventDefault(); // keep the editor selection
        onDown();
      }}
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

  return (
    <div className="rte-tb">
      <Btn title="Bold (⌘B)" active={isMarkActive(editor, "bold")} onDown={() => toggleMark(editor, "bold")} style={{ fontWeight: 700 }}>B</Btn>
      <Btn title="Italic" active={isMarkActive(editor, "italic")} onDown={() => toggleMark(editor, "italic")} style={{ fontStyle: "italic" }}>i</Btn>
      <Btn title="Underline" active={isMarkActive(editor, "underline")} onDown={() => toggleMark(editor, "underline")} style={{ textDecoration: "underline" }}>U</Btn>
      <Btn title="Inline code" active={isMarkActive(editor, "code")} onDown={() => toggleMark(editor, "code")} style={{ fontFamily: "ui-monospace, monospace" }}>{"</>"}</Btn>
      <Sep />
      <Btn title="Paragraph" active={isBlockActive(editor, "p")} onDown={() => setBlockType(editor, "p")}>P</Btn>
      <Btn title="Heading 1" active={isBlockActive(editor, "h1")} onDown={() => setBlockType(editor, "h1")}>H1</Btn>
      <Btn title="Heading 2" active={isBlockActive(editor, "h2")} onDown={() => setBlockType(editor, "h2")}>H2</Btn>
      <Btn title="Heading 3" active={isBlockActive(editor, "h3")} onDown={() => setBlockType(editor, "h3")}>H3</Btn>
      <Btn title="Quote" active={isBlockActive(editor, "blockquote")} onDown={() => setBlockType(editor, "blockquote")}>❝</Btn>
      <Sep />
      <Btn title="Bullet list" active={isBlockActive(editor, "ul")} onDown={() => toggleList(editor, "ul")}>• List</Btn>
      <Btn title="Numbered list" active={isBlockActive(editor, "ol")} onDown={() => toggleList(editor, "ol")}>1. List</Btn>
      <Btn title="Link" onDown={() => insertLink(editor)}>Link</Btn>
      <Btn title="Divider" onDown={() => insertHr(editor)}>―</Btn>
      <Sep />
      <Btn title="Embed entry" onDown={() => void insertEmbed(editor, sdk, "Entry")}>+ Entry</Btn>
      <Btn title="Embed asset" onDown={() => void insertEmbed(editor, sdk, "Asset")}>+ Asset</Btn>
    </div>
  );
}

export { insertEmbed, setBlockType, insertHr, toggleList, type Ed };
