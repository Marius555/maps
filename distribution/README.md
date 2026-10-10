# Distribution

Ways onto other platforms, one folder per platform, each shaped the way that platform
installs things. Every one of them ends in the same place a pasted snippet does: the
platform's page loads `map.js` and a published snapshot from the CDN, and nothing calls
us per visitor (CLAUDE.md §2).

| Folder | What | Ships as |
|---|---|---|
| `wordpress/` | The Pinglide Maps plugin: a map block, a shortcode, one-button setup | A zip at `/downloads/pinglide-wordpress.zip` (`npm run build:wordpress`); wordpress.org later |

Each platform also has a public page at `/for/<platform>`, listed in the site's
Integrations menu: add an entry to `lib/marketing/integrations.ts` and a folder under
`app/(marketing)/for/`.

Design and invariants: `docs/notes/distribution.md`. Read it before adding a platform —
the connect flow on our side (`/connect/wordpress`, `POST /api/connect/wordpress`) is
written for WordPress, and a second platform should reuse its shape, not copy it.
