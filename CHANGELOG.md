# Changelog

Every release of the app and the embed, newest first. `npm run release` writes
each section. Notes written by hand under "## Unreleased" are carried into the
next release above its commit list. Versioning rules: docs/notes/versioning.md.

## Unreleased

First versioned release, the baseline every later one is measured against.
It covers everything built before versioning existed: the editor, import, cards,
the publish designer and embed, analytics, Google Sheets sync, auth, billing,
settings and the admin console.

- The embed now ships under the `v1` channel (`/embed/v1/map.js` on the CDN),
  with MapLibre in a folder named after its own version so an upgrade never
  overwrites files a cached older bundle still imports.
- Each build records its release and commit: `/api/version`, the foot of the
  admin rail, and `version.json` beside the embed.
