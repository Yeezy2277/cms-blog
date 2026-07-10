import { useMemo } from "react";
import { useSDK } from "@contentful/react-apps-toolkit";
import { locations, type FieldAppSDK } from "@contentful/app-sdk";

import { ConfigScreen } from "./locations/ConfigScreen";
import { ValidationHubPage } from "./locations/ValidationHubPage";
import { SlugField } from "./locations/SlugField";
import { ReadingTimeField } from "./locations/ReadingTimeField";
import { SponsoredField } from "./locations/SponsoredField";
import { RelatedContentField } from "./locations/RelatedContentField";
import { MediaField } from "./locations/MediaField";
import { AuthorSidebar } from "./locations/AuthorSidebar";

/**
 * One app, many locations.
 *
 * Rather than ship five separate Contentful apps (five bundles, five CI jobs,
 * five lots of boilerplate), this is a single App Framework bundle that routes
 * to the right component based on `sdk.location`. For the entry-field location
 * we further route on a `tool` instance parameter (set per field by
 * content-model/assign-toolkit-fields.mjs), falling back to the field id so the
 * app is still usable if assigned manually in the UI.
 *
 * This is the consolidation pattern used by mature App Framework setups and is
 * the free-tier reproduction of the source platform's editorial field apps.
 */

type Tool = "slug" | "reading-time" | "sponsored" | "related" | "media";

function resolveTool(sdk: FieldAppSDK): Tool {
  const explicit = sdk.parameters.instance?.tool as Tool | undefined;
  if (explicit) return explicit;

  // Fall back to the field id so manual assignment still works.
  switch (sdk.field.id) {
    case "slug":
      return "slug";
    case "estimatedReadingTime":
      return "reading-time";
    case "sponsorName":
      return "sponsored";
    case "relatedPosts":
      return "related";
    case "coverImage":
      return "media";
    default:
      return "slug";
  }
}

function FieldRouter() {
  const sdk = useSDK<FieldAppSDK>();
  const tool = useMemo(() => resolveTool(sdk), [sdk]);

  switch (tool) {
    case "reading-time":
      return <ReadingTimeField />;
    case "sponsored":
      return <SponsoredField />;
    case "related":
      return <RelatedContentField />;
    case "media":
      return <MediaField />;
    case "slug":
    default:
      return <SlugField />;
  }
}

export default function App() {
  const sdk = useSDK();

  const component = useMemo(() => {
    if (sdk.location.is(locations.LOCATION_APP_CONFIG)) return <ConfigScreen />;
    if (sdk.location.is(locations.LOCATION_PAGE)) return <ValidationHubPage />;
    if (sdk.location.is(locations.LOCATION_ENTRY_SIDEBAR)) return <AuthorSidebar />;
    if (sdk.location.is(locations.LOCATION_ENTRY_FIELD)) return <FieldRouter />;
    return null;
  }, [sdk.location]);

  return component;
}
