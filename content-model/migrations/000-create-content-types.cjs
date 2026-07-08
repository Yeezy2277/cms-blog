/**
 * Migration 000 — create the base content types the app expects.
 *
 * Run this ONCE on a fresh space, before migration 001 (which adds the editorial
 * fields) and before `npm run seed`. Both of those assume `blogPost` and
 * `author` already exist.
 *
 *   npm run bootstrap        # this file
 *   npm run migrate          # 001-add-editorial-fields
 *   npm run seed             # demo content
 *
 * Creating content types as code (rather than clicking fields in the UI) keeps
 * the model reproducible across environments and reviewable in PRs.
 */
module.exports = function (migration) {
  // --- author ---------------------------------------------------------------
  const author = migration
    .createContentType("author")
    .name("Author")
    .displayField("name")
    .description("A post author.");

  author.createField("name").name("Name").type("Symbol").required(true);
  author.createField("title").name("Title").type("Symbol");
  author.createField("avatar").name("Avatar").type("Link").linkType("Asset");

  // --- blogPost -------------------------------------------------------------
  const blogPost = migration
    .createContentType("blogPost")
    .name("Blog Post")
    .displayField("title")
    .description("A blog article.");

  blogPost.createField("title").name("Title").type("Symbol").required(true);

  blogPost
    .createField("slug")
    .name("Slug")
    .type("Symbol")
    .required(true)
    .validations([{ unique: true }]);

  blogPost.createField("excerpt").name("Excerpt").type("Text");

  blogPost.createField("body").name("Body").type("RichText");

  blogPost.createField("coverImage").name("Cover image").type("Link").linkType("Asset");

  blogPost.createField("publishedDate").name("Published date").type("Date");

  blogPost
    .createField("tags")
    .name("Tags")
    .type("Array")
    .items({ type: "Symbol" });

  blogPost
    .createField("author")
    .name("Author")
    .type("Link")
    .linkType("Entry")
    .validations([{ linkContentType: ["author"] }]);
};
