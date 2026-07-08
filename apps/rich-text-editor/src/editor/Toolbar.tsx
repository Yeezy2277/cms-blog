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

function isMarkActive(editor: Ed, mark: Mark): boolean {
  const marks = Editor.marks(editor as never) as Record<string, unknown> | null;
  return marks ? marks[mark] === true : false;
}

function toggleMark(editor: Ed, mark: Mark) {
  if (isMarkActive(editor, mark)) Editor.removeMark(editor as never, mark);
  else Editor.addMark(editor as never, mark, true);
}

const isTopBlock = (editor: Ed) => (n: unknown) =>
  SlateElement.isElement(n) && Editor.isBlock(editor as never, n as never) && !editor.isInline(n as never);

function setBlockType(editor: Ed, type: string) {
  Transforms.setNodes(
    editor as never,
    { type } as never,
    { match: isTopBlock(editor), mode: "highest" },
  );
}

function toggleList(editor: Ed, listType: "ul" | "ol") {
  // Wrap the current paragraph(s) as ul > li > p (Contentful-valid nesting).
  Transforms.wrapNodes(
    editor as never,
    { type: "li", children: [] } as never,
    { match: isTopBlock(editor) },
  );
  Transforms.wrapNodes(
    editor as never,
    { type: listType, children: [] } as never,
    { match: (n) => SlateElement.isElement(n) && (n as { type?: string }).type === "li" },
  );
}

function insertHr(editor: Ed) {
  Transforms.insertNodes(editor as never, {
    type: "hr",
    children: [{ text: "" }],
  } as never);
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

const btn: React.CSSProperties = {
  border: "1px solid #cdd5e0",
  background: "white",
  borderRadius: 4,
  minWidth: 30,
  height: 28,
  padding: "0 8px",
  fontSize: 13,
  cursor: "pointer",
};

export function Toolbar({ editor, sdk }: { editor: Ed; sdk: FieldAppSDK | null }) {
  const press = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault(); // keep editor selection
    fn();
  };

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 2,
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        padding: 8,
        background: "#fff",
        borderBottom: "1px solid #e7ebee",
      }}
    >
      <button style={{ ...btn, fontWeight: 700 }} onMouseDown={press(() => toggleMark(editor, "bold"))}>B</button>
      <button style={{ ...btn, fontStyle: "italic" }} onMouseDown={press(() => toggleMark(editor, "italic"))}>I</button>
      <button style={{ ...btn, textDecoration: "underline" }} onMouseDown={press(() => toggleMark(editor, "underline"))}>U</button>
      <button style={{ ...btn, fontFamily: "monospace" }} onMouseDown={press(() => toggleMark(editor, "code"))}>{"</>"}</button>
      <span style={{ width: 1, background: "#e7ebee", margin: "0 2px" }} />
      <button style={btn} onMouseDown={press(() => setBlockType(editor, "p"))}>P</button>
      <button style={btn} onMouseDown={press(() => setBlockType(editor, "h1"))}>H1</button>
      <button style={btn} onMouseDown={press(() => setBlockType(editor, "h2"))}>H2</button>
      <button style={btn} onMouseDown={press(() => setBlockType(editor, "h3"))}>H3</button>
      <button style={btn} onMouseDown={press(() => setBlockType(editor, "blockquote"))}>❝</button>
      <span style={{ width: 1, background: "#e7ebee", margin: "0 2px" }} />
      <button style={btn} onMouseDown={press(() => toggleList(editor, "ul"))}>• List</button>
      <button style={btn} onMouseDown={press(() => toggleList(editor, "ol"))}>1. List</button>
      <button style={btn} onMouseDown={press(() => insertLink(editor))}>Link</button>
      <button style={btn} onMouseDown={press(() => insertHr(editor))}>―</button>
      <span style={{ width: 1, background: "#e7ebee", margin: "0 2px" }} />
      <button style={btn} onMouseDown={press(() => void insertEmbed(editor, sdk, "Entry"))}>+ Entry</button>
      <button style={btn} onMouseDown={press(() => void insertEmbed(editor, sdk, "Asset"))}>+ Asset</button>
    </div>
  );
}

export { insertEmbed, setBlockType, insertHr, toggleList, type Ed };
