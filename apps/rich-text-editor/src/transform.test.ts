import { test } from "node:test";
import assert from "node:assert/strict";
import { deserialize, serialize, isEmptyValue, type PlateValue } from "./transform.ts";

const text = (value: string, marks: string[] = []) => ({
  nodeType: "text",
  value,
  marks: marks.map((type) => ({ type })),
  data: {},
});

/** A document exercising every node type the editor supports. */
const FULL_DOC = {
  nodeType: "document",
  data: {},
  content: [
    { nodeType: "heading-1", data: {}, content: [text("Title")] },
    { nodeType: "heading-2", data: {}, content: [text("Section")] },
    {
      nodeType: "paragraph",
      data: {},
      content: [
        text("Plain "),
        text("bold", ["bold"]),
        text(" and "),
        text("code", ["code"]),
        {
          nodeType: "hyperlink",
          data: { uri: "https://example.com" },
          content: [text("a link")],
        },
      ],
    },
    {
      nodeType: "blockquote",
      data: {},
      content: [{ nodeType: "paragraph", data: {}, content: [text("Quoted")] }],
    },
    {
      nodeType: "unordered-list",
      data: {},
      content: [
        {
          nodeType: "list-item",
          data: {},
          content: [{ nodeType: "paragraph", data: {}, content: [text("item one")] }],
        },
        {
          nodeType: "list-item",
          data: {},
          content: [{ nodeType: "paragraph", data: {}, content: [text("item two")] }],
        },
      ],
    },
    {
      nodeType: "ordered-list",
      data: {},
      content: [
        {
          nodeType: "list-item",
          data: {},
          content: [{ nodeType: "paragraph", data: {}, content: [text("first")] }],
        },
      ],
    },
    {
      nodeType: "embedded-entry-block",
      data: { target: { sys: { id: "entry123", type: "Link", linkType: "Entry" } } },
      content: [],
    },
    {
      nodeType: "embedded-asset-block",
      data: { target: { sys: { id: "asset456", type: "Link", linkType: "Asset" } } },
      content: [],
    },
    { nodeType: "hr", data: {}, content: [] },
  ],
};

test("round trip: serialize(deserialize(doc)) reproduces the document byte for byte", () => {
  const back = serialize(deserialize(FULL_DOC as never));
  assert.deepEqual(back.content, FULL_DOC.content);
});

test("deserialize: null/malformed input degrades to a single empty paragraph", () => {
  for (const input of [null, undefined, {}, { nodeType: "nonsense" }]) {
    const value = deserialize(input as never);
    assert.equal(value.length, 1);
    assert.equal(value[0]!.type, "p");
  }
});

test("deserialize: unsupported node types are skipped, not crashed on", () => {
  const doc = {
    nodeType: "document",
    data: {},
    content: [
      { nodeType: "table", data: {}, content: [] },
      { nodeType: "paragraph", data: {}, content: [text("kept")] },
    ],
  };
  const value = deserialize(doc as never);
  assert.equal(value.length, 1);
  assert.equal(value[0]!.type, "p");
});

test("serialize: embeds without an id are dropped rather than emitted invalid", () => {
  const value: PlateValue = [
    { type: "embedded-entry-block", children: [{ text: "" }] },
    { type: "p", children: [{ text: "kept" }] },
  ];
  const doc = serialize(value);
  assert.equal(doc.content.length, 1);
  assert.equal(doc.content[0]!.nodeType, "paragraph");
});

test("serialize: empty editor value still yields a valid document", () => {
  const doc = serialize([]);
  assert.equal(doc.nodeType, "document");
  assert.ok(doc.content.length >= 1);
});

test("isEmptyValue: true only for a single empty paragraph", () => {
  assert.equal(isEmptyValue([{ type: "p", children: [{ text: "" }] }]), true);
  assert.equal(isEmptyValue([{ type: "p", children: [{ text: "hi" }] }]), false);
  assert.equal(isEmptyValue([]), true);
});
