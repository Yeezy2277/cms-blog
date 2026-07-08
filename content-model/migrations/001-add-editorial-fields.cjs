/**
 * Migration 001 — add the editorial fields that the Editorial Toolkit app and
 * the webhooks operate on.
 *
 * Run against any environment with the Contentful CLI:
 *
 *   npx contentful space migration \
 *     --space-id "$CONTENTFUL_SPACE_ID" \
 *     --environment-id "${CONTENTFUL_ENVIRONMENT:-master}" \
 *     --management-token "$CONTENTFUL_MANAGEMENT_TOKEN" \
 *     content-model/migrations/001-add-editorial-fields.cjs
 *
 * Migrations are the same pattern used in the source platform's
 * `content-model/migrations` folder — code-as-content-model, reviewable in PRs,
 * replayable per environment. This is the free-tier equivalent of the original
 * Terraform/CI content-model pipeline.
 */
module.exports = function (migration) {
  const blogPost = migration.editContentType("blogPost");

  // Written by the Editorial Toolkit field app (live preview) and the
  // reading-time webhook (authoritative value on publish). Disabled for manual
  // editing in the UI — the app/webhook own it.
  blogPost
    .createField("estimatedReadingTime")
    .name("Estimated reading time (min)")
    .type("Integer")
    .required(false)
    .disabled(true);

  // Sponsored-content workflow: the boolean gates the sponsor name field, which
  // is validated/cleared by the toolkit's Sponsored field component.
  blogPost
    .createField("isSponsored")
    .name("Sponsored article")
    .type("Boolean")
    .required(false);

  blogPost
    .createField("sponsorName")
    .name("Sponsor name")
    .type("Symbol")
    .required(false)
    .validations([{ size: { max: 120 } }]);

  // Related content — auto-suggested by the toolkit from shared tags, editable
  // by hand. References other blog posts only.
  blogPost
    .createField("relatedPosts")
    .name("Related posts")
    .type("Array")
    .required(false)
    .items({
      type: "Link",
      linkType: "Entry",
      validations: [{ linkContentType: ["blogPost"] }],
    });

  // NOTE: assigning these fields to the Editorial Toolkit app (the custom field
  // widgets) needs the AppDefinition id, which only exists after the app is
  // created. That step lives in `content-model/assign-toolkit-fields.mjs`, run
  // once after `npm run upload` in apps/editorial-toolkit. Keeping it out of the
  // migration keeps the migration idempotent and environment-independent.
  blogPost.moveField("isSponsored").afterField("tags");
  blogPost.moveField("sponsorName").afterField("isSponsored");
  blogPost.moveField("relatedPosts").afterField("sponsorName");
  blogPost.moveField("estimatedReadingTime").afterField("publishedDate");
};
