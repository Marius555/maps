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

That is Git Bash. In PowerShell, drop the `MSYS_NO_PATHCONV=1` prefix (it is bash syntax, and
PowerShell does not rewrite paths anyway), quote the package (a leading `@` is splatting),
and keep it on one line:

```
npx "@wp-playground/cli@latest" server --port=9400 --login --mount-dir ./distribution/wordpress/pinglide /wordpress/wp-content/plugins/pinglide --blueprint=./distribution/wordpress/playground/blueprint.json
```

Two Git Bash traps in the bash line, both measured: `--mount=host:vfs` splits on the drive
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
- Change `script` (or `snapshot`) on the return URL to another host: refused with 400.
- As a Contributor, re-connect a slot an admin connected: refused with 403.
- `return` pointing at a different host: `/connect/wordpress` refuses before sign-in.
- A brand-new account through the flow: waits on "Check your inbox", carries on by itself
  once the link is opened.
- The page's network panel: `map.js`, MapLibre and `live.json` from the CDN, and nothing
  from the dashboard's origin.
- A visitor (logged out) on a page whose block is not connected sees nothing at all.
- The editor shows the live map at the block's height; the editor's Mobile preview shows the
  phone height; width + left/right alignment flows text beside it, and phones go full width.
- Ticking a tag in **Locations shown** leaves only those pins, in the editor and live.
- Settings → Pinglide: **Copy** copies the shortcode; **Create a page with this map** opens a
  draft with the map already connected.
- Elementor (install it from Plugins → Add New): the widget lists connected maps, its
  per-device height shows in Elementor's device preview, and the front end matches.
- With measurement on, using the editor preview adds no session to the map's Analytics tab.

## Releasing

1. Bump `Version:` in `pinglide.php`, `PINGLIDE_VERSION`, `version` in `blocks/map/block.json`,
   `version` in `blocks/map/index.asset.php`, and `Stable tag:` + Changelog in `readme.txt`.
   The zip build refuses if `Stable tag` and `Version` differ.
2. `npm run build:wordpress` → `public/downloads/pinglide-wordpress.zip`. Every deploy runs
   it too (`prebuild`), so the Publish tab's download link always serves the tree's copy.

## Listing on wordpress.org (account `marius536` — not submitted yet)

1. Upload `public/downloads/pinglide-wordpress.zip` at
   https://wordpress.org/plugins/developers/add/ while logged in. There is no CLI for the
   first submission. Review is manual, roughly 1–10 days, and answered by email.
2. Before submitting:
   - Run Plugin Check. The Playground blueprint installs it: Tools → Plugin Check →
     `Pinglide`, every category. Under the Windows CLI its PHPCS checks fail on a temp-file
     lock (`Exclusive locks are not supported`); an mu-plugin doing
     `putenv( 'TMPDIR=/pctmp' )` gets past it. It passed clean on 2026-10-13.
   - Production must serve `/connect/wordpress`, `/terms` and `/privacy`. Reviewers do click
     through, and the readme's **External services** section links the last two. Keep that
     section matching what the plugin and the embed actually contact.
   - The upload page shows the slug it will assign. It must be `pinglide`: the text domain and folder
     assume it, and it can never change after approval.
3. Once approved, releases go through the SVN repository they give you (`trunk/` plus a
   `tags/<version>/` copy). Banner (772×250 and 1544×500), icon (128 and 256) and
   `screenshot-N.png` go in SVN's `assets/`, never in the zip. After approval, the display
   name may go back to "Pinglide Maps".
