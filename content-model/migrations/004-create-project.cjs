/**
 * Migration 004 — a `project` content type: the portfolio-hub project cards,
 * editable in Contentful. The hub keeps a local seed (config/projects.local.ts)
 * and, when a matching entry exists here (by `slug`), overlays the CMS fields on
 * top — same "local seed + remote enrich" pattern as the profile. Any field left
 * blank in Contentful falls back to the seed, so a half-filled entry is safe.
 *
 *   npm run migrate:projects
 *   npm run seed:projects
 */
module.exports = function (migration) {
  const project = migration
    .createContentType("project")
    .name("Project")
    .displayField("title")
    .description("A portfolio-hub project card (overlays the hub's local seed by slug).");

  // Stable id matching the seed's `id` (repo name / manifest slug) — the join key.
  project
    .createField("slug")
    .name("Slug (matches repo / seed id)")
    .type("Symbol")
    .required(true);

  project.createField("title").name("Title").type("Symbol");
  project.createField("summary").name("Summary").type("Text");
  project.createField("liveUrl").name("Live URL").type("Symbol");
  project.createField("repoUrl").name("Repo URL").type("Symbol");
  project.createField("image").name("Preview image").type("Link").linkType("Asset");
  project.createField("tags").name("Tags").type("Array").items({ type: "Symbol" });
  project.createField("embeddable").name("Embeddable in iframe").type("Boolean");
  project.createField("featured").name("Featured").type("Boolean");
  project.createField("hidden").name("Hidden").type("Boolean");
  project.createField("order").name("Sort order (lower = first)").type("Integer");

  project.changeFieldControl("summary", "builtin", "multipleLine");
};
