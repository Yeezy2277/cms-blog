import { useEffect, useState, type ComponentProps } from "react";
import { PlateElement } from "platejs/react";
import { useFieldSdk } from "../sdkContext";

type ElProps = ComponentProps<typeof PlateElement>;

/* Block elements — Plate node types named to mirror the Contentful model.
 * Headings, blockquote and marks come from @platejs/basic-nodes defaults; the
 * elements below are the ones we define ourselves (lists, hr, link, embeds). */

export const UlElement = (props: ElProps) => <PlateElement as="ul" {...props} />;
export const OlElement = (props: ElProps) => <PlateElement as="ol" {...props} />;
export const LiElement = (props: ElProps) => <PlateElement as="li" {...props} />;

export const HrElement = (props: ElProps) => (
  <PlateElement {...props}>
    <div contentEditable={false}>
      <hr className="rte-hr" />
    </div>
    {props.children}
  </PlateElement>
);

export const LinkElement = (props: ElProps) => {
  const url = (props.element as { url?: string }).url ?? "";
  return (
    <PlateElement
      as="a"
      {...props}
      // eslint-disable-next-line react/jsx-no-target-blank
      attributes={{ ...props.attributes, href: url } as ElProps["attributes"]}
    />
  );
};

/* ----- Void embed blocks -------------------------------------------------- */

function EmbedCard({
  label,
  title,
  loading,
}: {
  label: string;
  title: string;
  loading: boolean;
}) {
  return (
    <div className="rte-embed">
      <span className="rte-embed__label">{label}</span>
      <span className={loading ? "rte-embed__title rte-embed__title--loading" : "rte-embed__title"}>
        {loading ? "Loading…" : title}
      </span>
    </div>
  );
}

function useEntityTitle(kind: "Entry" | "Asset", id: string | undefined) {
  const sdk = useFieldSdk();
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!sdk || !id) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        if (kind === "Entry") {
          const entry = await sdk.cma.entry.get({ entryId: id });
          const fields = entry.fields as Record<string, Record<string, unknown>>;
          const titleField = fields.title ?? fields.name ?? fields.internalName;
          const value = titleField ? Object.values(titleField)[0] : undefined;
          if (active) setTitle(typeof value === "string" ? value : id);
        } else {
          const asset = await sdk.cma.asset.get({ assetId: id });
          const fields = asset.fields as Record<string, Record<string, unknown>>;
          const value = fields.title ? Object.values(fields.title)[0] : undefined;
          if (active) setTitle(typeof value === "string" ? value : id);
        }
      } catch {
        if (active) setTitle(id);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [sdk, kind, id]);

  return { title, loading };
}

export const EmbeddedEntryBlockElement = (props: ElProps) => {
  const id = (props.element as { entryId?: string }).entryId;
  const { title, loading } = useEntityTitle("Entry", id);
  return (
    <PlateElement {...props} style={{ margin: "8px 0" }}>
      <div contentEditable={false}>
        <EmbedCard label="Embedded entry" title={title} loading={loading} />
      </div>
      {props.children}
    </PlateElement>
  );
};

export const EmbeddedAssetBlockElement = (props: ElProps) => {
  const id = (props.element as { assetId?: string }).assetId;
  const { title, loading } = useEntityTitle("Asset", id);
  return (
    <PlateElement {...props} style={{ margin: "8px 0" }}>
      <div contentEditable={false}>
        <EmbedCard label="Embedded asset" title={title} loading={loading} />
      </div>
      {props.children}
    </PlateElement>
  );
};
