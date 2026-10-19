# Distribution — getting the map onto other platforms

Started 2026-10-10 with WordPress. The code lives in `/distribution` (one folder per
platform, shipped as that platform expects) plus a small connect flow on our side.
Each platform also gets a public page at `/for/<platform>` (`/for/wordpress`), listed
in the navbar's Integrations menu from `lib/marketing/integrations.ts` —
`docs/notes/marketing.md`.

## Invariants

- **Nothing a platform plugin does runs per visitor.** The plugin stores a map's live
  snapshot URL and the page loads `map.js` and that snapshot from the CDN, exactly as a
  pasted snippet does (§2). The plugin never calls our API on a page view, and it must not
  start to — not for "freshness", not for a status check.
- **No secret lives in a plugin.** The snapshot URL is public already, so the connection
  stores which map a block shows, never a key. What protects the return trip into wp-admin
  is the plugin's own nonce (`state`), checked against the logged-in user and the slot.
  If a future feature needs the plugin to *act* on the account (list maps from wp-admin,
  say), that is a site-scoped token minted then, and it is a new decision — not something
  to retrofit into this flow.
- **`return` is held to the site it names.** `connectRequestSchema` accepts only
  `…/wp-admin/admin-post.php` on the same host as `site` (or its `www.` twin), with no
  userinfo or fragment. Loosen it and `/connect/wordpress` becomes a way to bounce a
  signed-in owner, carrying a map id, anywhere.
- **The connect page reads the session from the client.** It arrives cross-site from
  wp-admin, so our Strict cookie is withheld from the page request; `ConnectFlow` asks
  `/api/auth/me` with a same-origin `fetch`. The SameSite trap, fourth arrival
  (`docs/notes/auth.md`).
- **`script` and `snapshot` are held to our own hosts.** Both arrive in the return trip's
  query string, and `script` runs on every visitor's page. The nonce is no defence here:
  anyone with `edit_posts` — a Contributor — can mint one, and Settings → Pinglide lists
  every slot id. `Pinglide_Slots::is_allowed_url` accepts only `PINGLIDE_APP_URL`'s and
  `PINGLIDE_EMBED_URL`'s hosts (plus `PINGLIDE_EXTRA_HOSTS`), and re-checks at render; a
  slot someone else connected needs `edit_others_posts` to change.
- **The Plugin Name header is "Pinglide", not "Pinglide Maps".** wordpress.org derives the
  slug from it once, permanently, and the code (text domain, folder) is `pinglide`. The
  display name can go back to "Pinglide Maps" after approval; before it, it cannot.
- **An empty allowlist stays empty.** Empty means every site; adding the WordPress host to
  it would switch the map off everywhere else it is pasted (`allowSite`).
- **A block holds a slot, not a map id.** The answer arrives in wp-admin, which cannot
  write into a post's content, so the plugin keeps `slot → map` in one option. Two blocks
  are two slots; a copied block shares its slot and so its map.
- **The plugin has no build step.** `blocks/map/index.js` is plain JS against WordPress's
  globals and `index.asset.php` lists them by hand. Adding `@wordpress/scripts` would be a
  new dependency (§3) for one small block — ask first.
- **`readme.txt`'s Stable tag equals `pinglide.php`'s Version.** wordpress.org installs the
  version the readme names; `npm run build:wordpress` refuses to zip when they differ.
- **The embed script is enqueued with a null version.** WordPress appends `?ver=` to
  anything else.
- **Sizing is a scoped `!important` rule, never an embed change.** The embed gives a
  `data-target` an inline `height` from `data-height`; `Pinglide_Embed::css()` prints a rule
  per map id that outranks it, which is how a map has a phone height while the embed knows one
  number. `sizeCss()` in `blocks/map/index.js` is its twin for the editor preview — change
  both or neither.
- **The live preview is a page under `/wp-admin/`, and analytics drops that path.** The
  block editor's canvas is a `blob:` iframe with an empty hostname, so a map whose allowlist
  names the site would refuse to draw there; `admin-post.php?action=pinglide_preview` is on
  the site itself. `isEditorPreview` in `lib/analytics/collect/editor-preview.ts` keeps the
  owner's own previews out of their Analytics tab and session ceiling. Move the preview off
  `/wp-admin/` and both break.
- **Elementor reads a snapshot server-side in the editor only.** `Pinglide_Elementor::tag_options`
  is the plugin's one server HTTP call, gated on `is_admin()` — Elementor registers controls
  on front-end renders too, so without the gate it would run on page views. Cached in one
  transient (`pinglide_tags`), which `uninstall.php` deletes.
- **Every display option means, when absent, what 0.1.0 did.** `Pinglide_Embed::options()` is
  the one normaliser for the block, the shortcode, the preview and Elementor.

## The round trip

```
block inserted → slot minted (crypto.randomUUID), saved with the post
"Set up this map" → new tab: /connect/wordpress?site&return&state&slot&title
  page.tsx validates the link before anyone signs in (refuses early, not at the end)
  ConnectFlow: signed out → /signup?next=… or /login?next=…  (Google: sessionStorage)
               unconfirmed → waits, polling /api/auth/me every 5s and on focus
               signed in → MapChoice: new map (default for an empty account) or existing
  POST /api/connect/wordpress → createMap? → allowSite → publish if never published or
                                the allowlist changed → { mapId, name, snapshotUrl, scriptUrl }
  window.location.replace(admin-post.php?action=pinglide_connect&state&slot&map&…)
plugin: capability + nonce(slot) → option pinglide_slots[slot] → Settings → Pinglide
editor tab: polls /wp-json/pinglide/v1/slots/{slot} every 3s while a setup tab is open,
            and on focus → iframe of admin-post.php?action=pinglide_preview&slot&tags,
            sized by sizeCss(); tags read from the snapshot by the browser
visitor: render.php → <div id=pinglide-N><style/><script type="text/plain" data-snapshot
         data-target="#pinglide-N-canvas" data-height [data-tags] [data-eager]>
         <div class=pinglide-map__canvas></div></div> + map.js module
```

`type="text/plain"` works because `embed/src/boot.ts` mounts after every
`script[data-snapshot]` and `readConfig` reads only `data-*`. **No embed change was
needed**, and none should be — if a platform needs one, it is paid for out of the
own-code budget like anything else.

### Why connecting publishes

A map that has never been published has no live snapshot, so the block would be an empty
box until the owner found the Publish tab. Publishing at connect puts the (empty) basemap
on their page at once, which is the "drop a map, then fill it" promise. The other case —
an existing map whose allowlist had to gain the WordPress host — republishes because the
live snapshot still carries the old list and the embed would refuse to draw. That one
publishes unpublished edits too, and `ConnectNote` says so before Connect is pressed.

### `?next=` through sign-up

Login honoured `?next=` already. Sign-up did not — it always went to
`/verify-email?status=sent` — and Google could not, because Appwrite's success URL is fixed.
Now: `SignupForm` goes to `redirectTo` when one is given (the connect page shows its own
"check your inbox"), `redirectIfSignedIn` takes the target, and Google carries it in
`sessionStorage` (`lib/auth/oauth-next.ts`), read once and re-checked with `safeRedirect`.

## Testing without a WordPress account

A wordpress.org account is needed only to *list* the plugin. Everything else runs on
WordPress Playground (PHP-WASM, no Docker) — `distribution/wordpress/README.md` has the
command. The plugin makes no server-side HTTP calls but one — the Elementor widget's tag list,
in the editor — so Playground's sandboxed networking is otherwise never in the way: the
browser does every hop. `wp_safe_remote_get` refuses `localhost`, so that list is empty
against a dev snapshot and fills only from a snapshot on the CDN.
