# Pinglide Maps for WordPress

`pinglide/` is the plugin exactly as it ships — no build step. How it works, and the rules
it keeps: `docs/notes/distribution.md`.

## Run it locally (no WordPress account, no Docker)

Two terminals, from the repo root:

```
npm run dev
MSYS_NO_PATHCONV=1 npx @wp-playground/cli@latest server --port=9400 --login \
  --mount-dir ./distribution/wordpress/pinglide /wordpress/wp-content/plugins/pinglide \
  --blueprint=./distribution/wordpress/playground/blueprint.json
```

Two Windows traps in that line, both measured: `--mount=host:vfs` splits on the drive
letter's colon (`Host path does not exist: …;C`), so use the two-argument `--mount-dir`;
and Git Bash rewrites `/wordpress/...` into a Windows path unless `MSYS_NO_PATHCONV=1`.

Open http://127.0.0.1:9400/wp-admin — the plugin is active and `PINGLIDE_APP_URL` points
at `http://localhost:3000` (`playground/blueprint.json`). Auto-login did not fire in
testing (CLI, October 2026); Playground's own default admin login works. Edits to the
plugin's files show on the next reload. Playground keeps nothing between runs.

Then: add the **Pinglide map** block → **Set up this map** → sign in on the tab that opens
→ choose or create a map → you land on Settings → Pinglide → back in the editor tab the
block shows the map's name → publish the page and view it.

On any other WordPress (LocalWP, a staging site), upload the zip from
`npm run build:wordpress` and add to `wp-config.php`:

```php
define( 'PINGLIDE_APP_URL', 'http://localhost:3000' );
```

## What to check before a release

- Two blocks on one page, connected to two maps: each shows its own.
- Change `state` on the return URL by hand: refused, nothing stored.
- `return` pointing at a different host: `/connect/wordpress` refuses before sign-in.
- A brand-new account through the flow: waits on "Check your inbox", carries on by itself
  once the link is opened.
- The page's network panel: `map.js`, MapLibre and `live.json` from the CDN, and nothing
  from the dashboard's origin.
- A visitor (logged out) on a page whose block is not connected sees nothing at all.

## Releasing

1. Bump `Version:` in `pinglide.php`, `PINGLIDE_VERSION`, `version` in `blocks/map/block.json`,
   `version` in `blocks/map/index.asset.php`, and `Stable tag:` + Changelog in `readme.txt`.
   The zip build refuses if `Stable tag` and `Version` differ.
2. `npm run build:wordpress` → `public/downloads/pinglide-wordpress.zip`. Every deploy runs
   it too (`prebuild`), so the Publish tab's download link always serves the tree's copy.

## Listing on wordpress.org (needs an account — not done yet)

1. Create a wordpress.org account, then submit the zip at
   https://wordpress.org/plugins/developers/add/. Review is manual and takes days to weeks.
2. Before submitting: run the Plugin Check plugin on a test site and fix what it reports;
   make sure `readme.txt`'s **External services** section still matches what the plugin
   and the embed actually contact; and confirm `/terms` and `/privacy` are live, because
   that section links them.
3. Once approved, releases go through the SVN repository they give you (`trunk/` plus a
   `tags/<version>/` copy). The slug is fixed at approval — `pinglide` is what the code
   assumes (text domain, folder name).
