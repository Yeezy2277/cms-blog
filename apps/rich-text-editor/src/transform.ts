/**
 * The bridge between PlateJS's editor value and Contentful's Rich Text document.
 *
 * Contentful Rich Text is a fixed JSON schema (`@contentful/rich-text-types`):
 * a `document` whose `content` is a tree of blocks/inlines/text, where text
 * carries `marks`. PlateJS (Slate) uses `{ type, children }` elements and text
 * nodes with boolean mark props. This module converts losslessly between the
 * two for every node type the editor supports.
 *
 *   deserialize(): Contentful document  -> Plate value (load into the editor)
 *   serialize():   Plate value          -> Contentful document (save to the field)
 *
 * This is the heart of a custom Contentful editor: keep this correct and the
 * editor can render whatever UI it likes while always storing valid CDA content.
 */
import {
  BLOCKS,
  INLINES,
  MARKS,
  type Block,
  type Document,
  type Inline,
  type Text as CfText,
  type TopLevelBlock,
} from "@contentful/rich-text-types";

/* ----- Plate node shapes (kept minimal & local) --------------------------- */

export type PlateText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
};

export type PlateElement = {
  type: string;
  children: PlateNode[];
  url?: string; // hyperlink
  entryId?: string; // embedded-entry-block
  assetId?: string; // embedded-asset-block
};

export type PlateNode = PlateElement | PlateText;
export type PlateValue = PlateElement[];

const isText = (node: PlateNode): node is PlateText =>
  typeof (node as PlateText).text === "string";

/* ----- type maps ---------------------------------------------------------- */

// Plate element type  <->  Contentful blockquote/heading/list/etc. nodeType
const BLOCK_TO_CF: Record<string, string> = {
  p: BLOCKS.PARAGRAPH,
  h1: BLOCKS.HEADING_1,
  h2: BLOCKS.HEADING_2,
  h3: BLOCKS.HEADING_3,
  blockquote: BLOCKS.QUOTE,
  hr: BLOCKS.HR,
  ul: BLOCKS.UL_LIST,
  ol: BLOCKS.OL_LIST,
  li: BLOCKS.LIST_ITEM,
};
const CF_TO_BLOCK: Record<string, string> = Object.fromEntries(
  Object.entries(BLOCK_TO_CF).map(([k, v]) => [v, k]),
);

const MARK_PROPS = ["bold", "italic", "underline", "code"] as const;
const MARK_TO_CF: Record<(typeof MARK_PROPS)[number], string> = {
  bold: MARKS.BOLD,
  italic: MARKS.ITALIC,
  underline: MARKS.UNDERLINE,
  code: MARKS.CODE,
};
const CF_TO_MARK = Object.fromEntries(
  Object.entries(MARK_TO_CF).map(([k, v]) => [v, k]),
) as Record<string, (typeof MARK_PROPS)[number]>;

/* ----- deserialize: Contentful -> Plate ----------------------------------- */

function cfTextToPlate(node: CfText): PlateText {
  const leaf: PlateText = { text: node.value ?? "" };
  for (const mark of node.marks ?? []) {
    const prop = CF_TO_MARK[mark.type];
    if (prop) leaf[prop] = true;
  }
  return leaf;
}

function cfNodeToPlate(node: Block | Inline | CfText): PlateNode | null {
  if (node.nodeType === "text") return cfTextToPlate(node as CfText);

  const children = (node as Block).content.map(cfNodeToPlate).filter(Boolean) as PlateNode[];
  const ensureChildren = children.length ? children : [{ text: "" }];

  switch (node.nodeType) {
    case INLINES.HYPERLINK:
      return { type: "a", url: (node as Inline).data?.uri ?? "", children: ensureChildren };
    case BLOCKS.EMBEDDED_ENTRY:
      return {
        type: "embedded-entry-block",
        entryId: (node as Block).data?.target?.sys?.id,
        children: [{ text: "" }],
      };
    case BLOCKS.EMBEDDED_ASSET:
      return {
        type: "embedded-asset-block",
        assetId: (node as Block).data?.target?.sys?.id,
        children: [{ text: "" }],
      };
    default: {
      const plateType = CF_TO_BLOCK[node.nodeType];
      if (!plateType) return null; // unsupported node type — skip gracefully
      if (plateType === "hr") return { type: "hr", children: [{ text: "" }] };
      return { type: plateType, children: ensureChildren };
    }
  }
}

const EMPTY_PARAGRAPH: PlateElement = { type: "p", children: [{ text: "" }] };

export function deserialize(doc: Document | null | undefined): PlateValue {
  if (!doc || doc.nodeType !== "document" || !Array.isArray(doc.content)) {
    return [EMPTY_PARAGRAPH];
  }
  const value = doc.content.map(cfNodeToPlate).filter(Boolean) as PlateElement[];
  return value.length ? value : [EMPTY_PARAGRAPH];
}

/* ----- serialize: Plate -> Contentful ------------------------------------- */

function plateTextToCf(leaf: PlateText): CfText {
  const marks = MARK_PROPS.filter((m) => leaf[m]).map((m) => ({ type: MARK_TO_CF[m] }));
  return { nodeType: "text", value: leaf.text ?? "", marks, data: {} };
}

function entryLink(id: string, linkType: "Entry" | "Asset") {
  return { target: { sys: { id, type: "Link", linkType } } };
}

function plateNodeToCf(node: PlateNode): Block | Inline | CfText | null {
  if (isText(node)) return plateTextToCf(node);

  switch (node.type) {
    case "a":
      return {
        nodeType: INLINES.HYPERLINK,
        data: { uri: node.url ?? "" },
        content: node.children.map(plateNodeToCf).filter(Boolean) as CfText[],
      } as Inline;
    case "embedded-entry-block":
      return node.entryId
        ? ({ nodeType: BLOCKS.EMBEDDED_ENTRY, data: entryLink(node.entryId, "Entry"), content: [] } as Block)
        : null;
    case "embedded-asset-block":
      return node.assetId
        ? ({ nodeType: BLOCKS.EMBEDDED_ASSET, data: entryLink(node.assetId, "Asset"), content: [] } as Block)
        : null;
    case "hr":
      return { nodeType: BLOCKS.HR, data: {}, content: [] } as Block;
    default: {
      const cfType = BLOCK_TO_CF[node.type];
      if (!cfType) return null;
      return {
        nodeType: cfType,
        data: {},
        content: node.children.map(plateNodeToCf).filter(Boolean) as (Block | Inline | CfText)[],
      } as Block;
    }
  }
}

export function serialize(value: PlateValue): Document {
  const content = value.map(plateNodeToCf).filter(Boolean) as TopLevelBlock[];
  return {
    nodeType: BLOCKS.DOCUMENT,
    data: {},
    content: content.length ? content : [{ ...EMPTY_PARAGRAPH, nodeType: BLOCKS.PARAGRAPH } as never],
  };
}

/* ----- helpers ------------------------------------------------------------ */

export function isEmptyValue(value: PlateValue): boolean {
  if (value.length === 0) return true;
  if (value.length > 1) return false;
  const only = value[0];
  return (
    only.type === "p" &&
    only.children.length === 1 &&
    isText(only.children[0]!) &&
    (only.children[0] as PlateText).text.trim() === ""
  );
}
