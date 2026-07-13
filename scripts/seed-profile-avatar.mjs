/**
 * Upload a local image as the profile avatar and link it to the profile entry.
 *
 *   set -a; source .env.local; set +a
 *   npm run seed:profile-avatar -- /path/to/photo.jpg
 *
 * Run after migration 003. Idempotent-ish: replaces the avatar link each run.
 */
import fs from "node:fs";
import path from "node:path";
import contentfulManagement from "contentful-management";

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID;
const TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT ?? "master";
const LOCALE = process.env.CONTENTFUL_LOCALE ?? "en-US";

const filePath = process.argv[2];
if (!SPACE_ID || !TOKEN || !filePath) {
  console.error("Usage: npm run seed:profile-avatar -- /path/to/photo.jpg");
  process.exit(1);
}
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const ext = path.extname(filePath).toLowerCase();
const contentType =
  ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

const f = (value) => ({ [LOCALE]: value });

async function run() {
  const client = contentfulManagement.createClient({ accessToken: TOKEN });
  const space = await client.getSpace(SPACE_ID);
  const env = await space.getEnvironment(ENVIRONMENT);

  console.log("Uploading photo…");
  let asset = await env.createAssetFromFiles({
    fields: {
      title: f("Vitalii Popov — photo"),
      description: f("Portfolio hero avatar"),
      file: f({
        contentType,
        fileName: `avatar${ext}`,
        file: fs.readFileSync(filePath),
      }),
    },
  });
  asset = await asset.processForAllLocales();
  // processing is async server-side; poll until the file URL exists
  for (let i = 0; i < 20 && !asset.fields.file?.[LOCALE]?.url; i++) {
    await new Promise((r) => setTimeout(r, 800));
    asset = await env.getAsset(asset.sys.id);
  }
  asset = await asset.publish();
  console.log("Asset published:", asset.sys.id);

  const found = await env.getEntries({ content_type: "profile", limit: 1 });
  const entry = found.items[0];
  if (!entry) {
    console.error("No profile entry — run npm run seed:profile first.");
    process.exit(1);
  }
  entry.fields.avatar = f({ sys: { type: "Link", linkType: "Asset", id: asset.sys.id } });
  const updated = await entry.update();
  await updated.publish();
  console.log("Linked avatar to profile and published. The hub will pick it up.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
