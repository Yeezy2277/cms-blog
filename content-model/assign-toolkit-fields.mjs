/**
 * Assign the Editorial Toolkit app as the field editor / sidebar widget for the
 * relevant blogPost fields, and install the app (with its Page location) in the
 * environment. Run once, after the app bundle is uploaded to Contentful Hosting.
 *
 * Usage:
 *   CONTENTFUL_SPACE_ID=... \
 *   CONTENTFUL_MANAGEMENT_TOKEN=... \
 *   EDITORIAL_TOOLKIT_APP_ID=<AppDefinition id> \
 *   node content-model/assign-toolkit-fields.mjs
 *
 * The AppDefinition id is printed by `contentful-app-scripts` after `create-app-definition`,
 * and is visible under Apps → (your app) → Definition in the Contentful web UI.
 *
 * This replaces what was done by hand in the Contentful UI in the source
 * platform — scripted so it is reproducible across environments.
 */
import contentfulManagement from "contentful-management";

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT ?? "master";
const APP_ID = process.env.EDITORIAL_TOOLKIT_APP_ID;

if (!SPACE_ID || !TOKEN || !APP_ID) {
  console.error(
    "Set CONTENTFUL_SPACE_ID, CONTENTFUL_MANAGEMENT_TOKEN and EDITORIAL_TOOLKIT_APP_ID.",
  );
  process.exit(1);
}

// fieldId -> the toolkit "tool" it should render (passed as instance parameter).
// NOTE: coverImage needs the AppDefinition's entry-field location to include the
// "Media" field type. Definitions created before the Media importer existed must
// tick that box once: Apps → Editorial Toolkit → Definition → Entry field → Media.
const FIELD_WIDGETS = {
  slug: "slug",
  estimatedReadingTime: "reading-time",
  sponsorName: "sponsored",
  relatedPosts: "related",
  coverImage: "media",
};

async function run() {
  const client = contentfulManagement.createClient({ accessToken: TOKEN });
  const space = await client.getSpace(SPACE_ID);
  const env = await space.getEnvironment(ENVIRONMENT);

  // 1. Install the app in the environment (idempotent).
  try {
    await env.createAppInstallation(APP_ID, {}, { acceptAllScopes: true });
    console.log("Installed Editorial Toolkit app.");
  } catch (err) {
    if (err?.name === "VersionMismatch" || err?.status === 409) {
      console.log("App already installed — continuing.");
    } else if (String(err).includes("already")) {
      console.log("App already installed — continuing.");
    } else {
      throw err;
    }
  }

  // 2. Point the blogPost editor interface at the app for each field.
  const editorInterface = await env.getEditorInterfaceForContentType("blogPost");

  for (const [fieldId, tool] of Object.entries(FIELD_WIDGETS)) {
    const control = editorInterface.controls?.find((c) => c.fieldId === fieldId);
    if (!control) {
      console.warn(`Field "${fieldId}" not found on blogPost — run migration 001 first.`);
      continue;
    }
    control.widgetNamespace = "app";
    control.widgetId = APP_ID;
    control.settings = { tool };
    console.log(`Assigned toolkit (${tool}) to field "${fieldId}".`);
  }

  // 3. Put the Author sidebar tool at the top of the entry sidebar.
  // If the sidebar was never customised it is undefined and Contentful renders
  // the default set — replicate that set so Publish & friends survive.
  const DEFAULT_SIDEBAR = [
    "publication-widget",
    "content-preview-widget",
    "incoming-links-widget",
    "translation-widget",
    "versions-widget",
  ].map((widgetId) => ({ widgetNamespace: "sidebar-builtin", widgetId }));

  const sidebar = editorInterface.sidebar ?? DEFAULT_SIDEBAR;
  if (!sidebar.some((w) => w.widgetNamespace === "app" && w.widgetId === APP_ID)) {
    editorInterface.sidebar = [
      { widgetNamespace: "app", widgetId: APP_ID, settings: { tool: "author" } },
      ...sidebar,
    ];
    console.log("Added toolkit (author) to the entry sidebar.");
  } else {
    editorInterface.sidebar = sidebar;
    console.log("Toolkit already in the sidebar — leaving as is.");
  }

  await editorInterface.update();
  console.log("Editor interface updated. Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
