/**
 * Migration 002 — a `profile` content type: the "about me" the portfolio hub
 * renders in its hero. A singleton (one entry), edited in Contentful; the hub
 * fetches it via the Delivery API and falls back to a local default.
 *
 *   npm run migrate:profile
 *   npm run seed:profile
 */
module.exports = function (migration) {
  const profile = migration
    .createContentType("profile")
    .name("Profile")
    .displayField("name")
    .description("Personal profile shown in the portfolio hub hero (singleton).");

  profile.createField("name").name("Name").type("Symbol").required(true);
  profile.createField("headline").name("Headline").type("Symbol");
  profile.createField("tagline").name("Tagline").type("Symbol");
  profile.createField("location").name("Location").type("Symbol");
  profile.createField("timezone").name("Timezone / hours").type("Symbol");
  profile.createField("available").name("Available for work").type("Boolean");
  profile.createField("availability").name("Availability line").type("Symbol");

  // Blank-line-separated paragraphs; the hub splits them.
  profile.createField("bio").name("Bio").type("Text");

  profile.createField("stack").name("Stack").type("Array").items({ type: "Symbol" });
  profile
    .createField("certifications")
    .name("Certifications")
    .type("Array")
    .items({ type: "Symbol" });

  // Structured lists edited as JSON (shape matches config/profile.ts).
  profile.createField("languages").name("Languages").type("Object");
  profile.createField("experience").name("Experience").type("Object");
  profile.createField("links").name("Links").type("Object");
};
