import {
  documentToReactComponents,
  type Options,
} from "@contentful/rich-text-react-renderer";
import { BLOCKS, INLINES, MARKS, type Document } from "@contentful/rich-text-types";

import styles from "./RichText.module.css";

interface RichTextProps {
  document: Document;
}

const options: Options = {
  renderMark: {
    [MARKS.CODE]: (text) => <code className={styles.code}>{text}</code>,
  },
  renderNode: {
    [BLOCKS.HEADING_2]: (_node, children) => <h2 className={styles.h2}>{children}</h2>,
    [BLOCKS.HEADING_3]: (_node, children) => <h3 className={styles.h3}>{children}</h3>,
    [BLOCKS.QUOTE]: (_node, children) => (
      <blockquote className={styles.quote}>{children}</blockquote>
    ),
    [INLINES.HYPERLINK]: (node, children) => {
      const uri = typeof node.data.uri === "string" ? node.data.uri : "#";
      const isExternal = /^https?:\/\//.test(uri);
      // Links inside rich text come from editorial content, so the targets are
      // arbitrary strings rather than known app routes — a plain anchor is the
      // correct element here (typed <Link> expects routes from the route map).
      return (
        <a
          href={uri}
          className={styles.link}
          {...(isExternal ? { target: "_blank", rel: "noreferrer" } : {})}
        >
          {children}
        </a>
      );
    },
  },
};

export function RichText({ document }: RichTextProps) {
  return <div className={styles.prose}>{documentToReactComponents(document, options)}</div>;
}
