/**
 * Migration 003 — add an `avatar` media field to the profile content type so
 * the portfolio hero photo is editable in Contentful.
 *
 *   npm run migrate:profile-avatar
 *   npm run seed:profile-avatar -- /path/to/photo.jpg
 */
module.exports = function (migration) {
  const profile = migration.editContentType("profile");
  profile.createField("avatar").name("Avatar").type("Link").linkType("Asset");
  profile.moveField("avatar").afterField("name");
};
