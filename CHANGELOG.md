# Changelog

Every release of the app and the embed, newest first. `npm run release` writes
each section. Notes written by hand under "## Unreleased" are carried into the
next release above its commit list. Versioning rules: docs/notes/versioning.md.

## Unreleased

## 0.9.0 — 2026-10-05

First versioned release, the baseline every later one is measured against.
It covers everything built before versioning existed: the editor, import, cards,
the publish designer and embed, analytics, Google Sheets sync, auth, billing,
settings and the admin console.

- The embed now ships under the `v1` channel (`/embed/v1/map.js` on the CDN),
  with MapLibre in a folder named after its own version so an upgrade never
  overwrites files a cached older bundle still imports.
- Each build records its release and commit: `/api/version`, the foot of the
  admin rail, and `version.json` beside the embed.

### Features

- newsroom, signup hardening, sheet-sync function, and visitor-session retention

### Other

- Initial commit from Create Next App
- first push
- improvments on geolocation and UI improvments
- added shapes, drag in Location, groups
- map themes
- improved public facing map
- updates on map, card creation tool
- updated script to sync between varios claude code pro accounts
- improved card creation tool
- added new OSRM provider and routing
- vaios ui improvments
- changes to ui
- added analytics
- new login, signup, integrated Resend, changed ui bugs
- added sub categorys for routes
- varios ui improvments
- improvments to card builder
- improved card creation tool dropzones
- imprvments to ui
- improved card ui
- ui improvments and landing page design
- claude flare R2 integration
- added lemo payment provider(integration not the plans), improved ui
- updated lemon
- added varios improvment
- improved map routing and documentation
- improved /map visual ui
- added languages to snapshots, improved ui
- configured support email to redirect to pinglide.company@gmail.com
- renewed claudeflare api key, and configured support email
- improved landing page, created social profiles
- added tutorial everlay
- tags improved, removed groups
- admin panel and notifications
- optimized performence
- updated ui and  billing
- added versioning
