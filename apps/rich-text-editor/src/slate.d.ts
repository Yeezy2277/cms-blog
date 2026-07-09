/**
 * Slate module augmentation: teach `slate`'s Transforms/Editor generics our
 * concrete node shapes so editor operations are type-checked at every call
 * site (previously each call was silenced with `as never`).
 */
import type { BaseEditor } from "slate";
import type { ReactEditor } from "slate-react";

type CustomElement = {
  type: string;
  url?: string;
  entryId?: string;
  assetId?: string;
  children: (CustomElement | CustomText)[];
};

type CustomText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
};

declare module "slate" {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}
