# Shopify — the app on the Shopify App Store

Started 2026-11-01. The owner chose a real App Store app over a WordPress-style thin
wrapper, for App Store discovery, and the App Store's rules decide its shape:

| Requirement | What it forced |
|---|---|
| 1.2.1 — bill through Shopify | Shopify App Pricing, not Lemon Squeezy, for every shop |
| 2.2 / 2.2.2 — embedded in the admin, off-platform features inside it | The existing editor runs **inside the Shopify admin's iframe** |
| 1.1.1 — session tokens, no third-party cookies | A second credential: the Shopify ID token |
| 2.3.x — install from Shopify, OAuth at once, no typed shop domain | Install happens on the first load of the App Home |
| 5.1.1 — theme changes through a theme app extension | The "Pinglide map" app block |

Decided with the owner: **Free / Starter $19 / Pro $39 a month, $190 / $390 a year**, in
USD (App Pricing is USD only); **each installed shop is its own workspace**, created at
install, with no signup; **no second app** — Shopify's React Router template was deleted
and the admin side is the Next.js site.

## Invariants

- **The ID token never becomes a cookie, and never creates anything.** `lib/auth/shopify-user.ts`
  resolves a verified token to an existing shop row; only the App Home (`app/shopify/route.ts`)
  creates one. An unknown shop is a 401.
- **The workspace comes from the token's shop, never from a parameter.** `?shop=` is read only
  to pick where to bounce and to frame the bounce page, after `parseShopDomain`.
- **`proxy.ts` handles Shopify first and makes no network call doing it** — the token is an
  HMAC checked locally. A bad `Authorization` header is a 401 with
  `X-Shopify-Retry-Invalid-Session-Request: 1`, **never a 307**: a soft navigation's flight
  request must not be redirected (docs/notes/auth.md, "The proxy cannot redirect a navigation").
- **Every Shopify-side redirect and origin is built on `APP_URL`, never the request's
  origin** (`appOrigin`, lib/shopify/bounce.ts; `env.appUrl` in route handlers). Behind
  `shopify app dev`'s proxy and tunnel, `request.nextUrl.origin` is `https://localhost:<port>`,
  and the App Home's redirect sent the admin's frame there ("localhost sent an invalid
  response", 2026-11-01).
- **Framing is opened per shop and only with a verified token** (`allowFramingBy`). Every other
  response keeps `frame-ancestors 'self'` — from `next.config.ts`, or, on an `embedded=1`
  document (which the config skips), put back by `proxy.ts`. Never leave an `embedded=1`
  document to fall through the proxy without one or the other.
- **No Admin API access token is stored.** Every Admin API call happens with a merchant in the
  app, so one is exchanged from the request's ID token when needed and held in memory
  (`lib/shopify/admin-api.ts`). Storing one is a new decision, with encryption, made here first.
- **Nothing Shopify-side runs per storefront visitor (§2).** The block reads an app-data
  metafield in Liquid and loads `map.js` and the live snapshot from the CDN. No app proxy, no
  Admin API call, no script tag API.
- **The block's markup is the WordPress block's**, so the embed needs no change and its
  own-code budget is untouched. A theme-editor section reload re-boots by importing `map.js`
  under a fresh query string, in `request.design_mode` only.
- **The block's canvas carries an inline `display:block`, and must.** Dawn and every theme
  built on it ship `div:empty{display:none}`; the canvas is empty until the map mounts, a
  hidden element never intersects, so the lazy loader never started the map — blank on the
  storefront and in the theme editor, unless "Load the map straight away" was on (2026-11-02).
- **Theme extension assets are `.jpg .jpeg .js .css .png .svg .json .wasm` only**, and only
  the CLI's bundler enforces it — `shopify theme check` passed a `.webp` that `shopify app dev`
  then refused. The block has no assets now.
- **No picture of a map in the block's setup card.** It had one (a stretched JPEG), and the
  owner read the card as the map drawn in low quality. A plain card cannot be mistaken for it.
- **The Liquid's contract** is the metafield's keys (`lib/shopify/storefront-maps.ts`) —
  `default`, `script`, `maps.<id>.name`, `maps.<id>.snapshot` — and the `$app:map`
  metaobject's fields, `name` and `snapshot` (`shopify.app.toml`). Rename one and every block
  stops finding its map.
- **`shopify app dev` does not reload `shopify.app.toml`, and validates the block in the same
  push that would create a metaobject definition.** A block naming a type the shop does not have
  yet fails that push ("metaobject_type is invalid") and the definition is never made. Add a
  definition in two steps: TOML first with no setting using it, restart, then the setting.
- **The block's schema names the metaobject type in full: `app--<app id>--map`.** Shopify
  refuses `$app:map` in a schema (measured 2026-11-02, with the definition present) — the
  `$app:` prefix works in Liquid only. So **the block is generated**: edit
  `distribution/shopify/block-templates/map.liquid`, never
  `extensions/pinglide-map/blocks/map.liquid` (gitignored, written by
  `scripts/shopify-block.mjs` from `distribution/shopify/apps.json`, which every `shopify:*`
  script runs first). See "The block is generated".
- **One app** (decided 2026-11-02): "pinglide" (client id `9f5f7d…`, app id 442457194497) is the
  App Store app *and* what `shopify app dev` runs. `app dev` applies its config — the tunnel URL
  included — to the dev store only; other stores get what `shopify app deploy` released. The
  Site's `SHOPIFY_CLIENT_ID` / `SHOPIFY_APP_ID` are this app's.
- **`application_url` stays the site's root**, `https://pinglide.com/`. The admin appends its
  own path to it on a deep link or reload (`/apps/pinglide/maps/x` loads `…/maps/x`), so a path
  there (`/shopify`) would break every one; `proxy.ts` sends `/?shop=…` to the App Home instead.
- **Inside the admin the app is light, always.** `theme-script.tsx` locks `<html>` light on an
  `embedded=1` document (`data-theme-lock`) and `applyTheme` honours the lock; there is no theme
  row in the account menu and no General section in Settings for a shop.
- **A shop never meets Lemon Squeezy.** Settings → Billing draws `ShopifyPlan` for a shop and
  reads nothing from Lemon; every Lemon billing route asks `refuseShopifyBilled`
  (`lib/billing/shopify-billed.ts`) before touching the provider; `/upgrade` sends a shop back
  to Settings → Billing. Off-platform billing is an App Store rejection (1.2.1). **Change plan
  is offered on every plan, Pro included** — in Billing and in the account menu — because a
  shop must be able to downgrade without contacting us (1.2.3). Any new upgrade link points at
  `/settings/billing`, never `/pricing` (euros, Lemon checkout).
- **A shop's Settings are Billing and Usage** (`settingsItemsFor`), and `/settings` opens at
  Billing (`settingsHomeFor`) — the admin's own "Settings" link included. General redirects a
  shop to Billing: its profile is "the address you sign in with" (a shop has none, and its name
  is Shopify's) and its other half is the theme, which is locked light. Account (password,
  devices, delete) and Team 404 for a shop: there is no password or session of ours to show,
  `listAccountSessions` throws without a cookie, and deleting the workspace while the app is
  installed would orphan the shop row — the deletion route refuses a shop and points at
  uninstalling, which `shop/redact` follows.
- **The storefront's address is read from Shopify on every storefront request**
  (`readStorefront`'s `storeHost`), never trusted from the shop row, which install alone used
  to write. A map whose restricted site list leaves it out is blank on the store; the Publish
  steps say so (`domainMissing`) and one press re-POSTs, which adds it and republishes.
- **A Shopify shop's first and last funnel steps are sent by the server**
  (`lib/posthog/server.ts`, `lib/shopify/funnel.ts`): `user_signed_up` (`method: "shopify"`)
  once, when `provisionShop` creates the shop, and `checkout_completed`
  (`provider: "shopify"`) when the App Home's return from the plan page shows a paid plan
  started or changed — never from the hourly sweep, so a renewal is not a sale. The browser
  identifies the same workspace id with `platform: "shopify"`.
- **A Shopify shop is never billed by Lemon Squeezy**, and its subscription row says
  `provider: "shopify"`. Absent `provider` is Lemon, which is every row written before this.
- **Frozen is sticky.** `activeSubscription` has no status; a freeze is known only from the
  `SUBSCRIPTION_FROZEN` event, so a re-read with no event keeps a stored freeze.
- **Webhooks: raw body, HMAC, then parse, and answer inside five seconds.** `shop/redact` only
  stamps the row; the hourly sweep deletes in bounded steps.
- **Request no scope the app does not use, and none at install.** `scopes = ""`: the app-data
  metafield and metaobjects need none. Every scope a feature needs is an **optional** scope
  (`optional_scopes`, `lib/shopify/scopes.ts`), asked for in Shopify's own dialog when the
  merchant presses the button that needs it (App Bridge Scopes API,
  `lib/shopify/app-bridge-scopes.ts`), and checked again on the server against the token's real
  grants. Today that is `read_locations`, for "Import from Shopify". Asking for more fails review.

## How a request gets in

```
admin loads  https://pinglide.com/?embedded=1&shop=x.myshopify.com&host=…&id_token=<JWT>
proxy.ts     verify → `/` goes to /shopify (App Home)
/shopify     verify → provisionShop (first time: token exchange, shop{…}, Appwrite user,
             shopifyShops row) → reconcile plan → 307 /maps?<same query>
proxy.ts     verify id_token → copy into `Authorization` → frame-ancestors https://x… admin.shopify.com
layout       getCurrentUser(): cookie? no → bearer → shop row → AuthUser{ id: workspace, shopify }
             renders App Bridge (sync <script>) + <ui-nav-menu>
browser      App Bridge patches fetch: every same-origin request, REST and RSC flight alike,
             carries `Authorization: Bearer <fresh ID token>`
expired doc  embedded=1 without a usable token → /shopify/session-token (bounce) → App Bridge
             reloads `shopify-reload` with a fresh token
```

The ID token lives one minute. `withAuth` adds the retry header to any 401 that came with a
bearer token, so App Bridge fetches a fresh one and repeats the request.

## Accounts

`createShopAccount` (lib/auth/account.ts) makes an Appwrite user with **no email and no
password**, marked verified — nobody signs in as it. Its id is the workspace, so every
repository, limit, publish and analytics path works unchanged (`ownerContext`). The
unconfirmed-account purge keeps any account a shop row names. All of a shop's staff act as
the owner; teams are not offered inside Shopify — Settings shows a shop Billing and Usage
only, General redirects to Billing, and Account and Team 404 (Invariants).

## Import from Shopify

The import wizard's first step offers a shop a third source, **Shopify locations**, first and
selected (`source-step/shopify-locations-panel.tsx`). Pressing **Import from Shopify**:

1. asks for `read_locations` if the shop has not granted it — `shopify.scopes.query()`, then
   `shopify.scopes.request()`, Shopify's own dialog (`lib/shopify/app-bridge-scopes.ts`). A
   decline is an import error that says to press again and choose Allow;
2. `GET /api/maps/[id]/import/shopify-locations` exchanges the ID token for an Admin API token —
   **afresh when the cached one lacks the scope**, because a token cached before the grant
   does not carry it (`adminSession`'s `scopes`) — refuses with a 403 if the grant is still
   missing, and reads every active, non-legacy location (`lib/shopify/locations.ts`, paged at
   250, capped at 5,000);
3. answers a `SourceTable` (`shopifyLocationsTable`): Name, Address, City, Region, Postcode,
   Country, Phone, Latitude, Longitude — headers the detector maps on its own (tested).
   Fulfillment-service locations (an app's warehouse) and ones with no address are left out;
   Shopify's coordinates come along, so those rows cost no lookups, and a 0,0 is treated as
   none.

From there it is the ordinary import — mapping, review, bulk create — so the locations land in
the Locations tab and the editor's list like any file's rows (the bulk create invalidates
`queryKeys.places.all`). Nothing is stored about the source: importing again adds the
locations again, and there is no sync.

## Billing

Shopify App Pricing: plans defined in the Partner Dashboard with handles `free`, `starter`,
`pro`, each monthly and yearly; Shopify hosts the plan page
(`admin.shopify.com/store/<handle>/charges/<app_handle>/pricing_plans`) and handles upgrades,
downgrades and proration. **It sends no webhooks** (stopped 2026-04-28), so
`lib/shopify/plan-sync.ts` re-reads `activeSubscription` from the Partner API:

1. on the App Home: **waited for** right after the merchant chose a plan (`plan_handle` on the
   welcome URL), so the maps list shows what they bought; and, when the stored answer is older
   than 6 hours, **in `after()`**, once the redirect has gone — the Partner API used to sit in
   the way of opening the app, up to its 10s timeout;
2. every hour, for shops with a subscription event in the last 3 hours;
3. every hour, for Shopify plans ending within 2 days — a renewal moves the end date and
   nothing else would say so.

`toShopifyState` (lib/billing/shopify-pricing.ts) grants a renewing plan two days past its
cycle end (`RENEWAL_MARGIN_MS`), so the hour between Shopify renewing and the sweep noticing
never reads as free. A plan set to cancel ends exactly when Shopify says.

The sweep is `POST /api/cron/shopify`, driven by the existing hourly function
(functions/sheet-sync) — **redeploy it with `npm run setup:sheet-sync`** after changing it.

**Inside the app, Settings → Billing is Shopify's** (`components/user-settings/billing/shopify/`):
the plan, Shopify's price for it in USD (`SHOPIFY_PRICES`, which must match the Partner
Dashboard), a paused notice for a frozen subscription, and **Change plan**, which opens the
plan page above in the top window. No renewal date — the stored end carries the renewal
margin, and we cannot tell a renewing plan from one set to cancel. Invoices are Shopify's, in
the merchant's own admin.

## Storefront

The theme app extension (`distribution/shopify/extensions/pinglide-map`) has one app block,
`map`. It reads `app.metafields.pinglide.maps` — an app-data metafield on the app
installation, which takes any namespace, needs no scope and is readable only by this app.
"Show on storefront" (`/api/maps/[id]/shopify-storefront`) publishes when needed, lets the
shop's domains through a restricted allowlist (`prepareMapForSites`, shared with the WordPress
connect), and adds the map to the list; the first map becomes the default, so a block needs
no settings. The tag filter is not offered: the embed's `data-tags` takes tag ids, which a
merchant typing in the theme editor does not know.

**Another map is picked by name, not by code.** Each map on the list is also a `$app:map`
metaobject (handle = map id; `name`, `snapshot`), declared in `shopify.app.toml` and written by
the same route; the block's "Map" setting is a `metaobject` picker of them, naming the type in
full (Invariants). App-owned
metaobjects need no access scope (since 2026-04), so `scopes = ""` stands. An empty picker, or
an entry since removed, shows the default. It replaced a typed "Map code" that the app only
displayed for maps that were *not* the default, so the one map most people have never had a
code anybody could find.

**`GET` heals what the block reads**, writing only what differs: `script` (in development it
is the tunnel, which dies with every `shopify app dev`, and nothing else rewrites the list once
a map is on it) and a missing or misnamed picker entry (maps shown before the picker existed,
maps renamed since).

`addBlockUrl` is Shopify's deep link that opens the theme editor with the block added.

### The Publish footer inside Shopify

Inside the Shopify admin the store is the obvious place for a map. The Publish sidebar's column
opens on two numbered steps, **① Show on storefront** and **② Add to theme**
(`components/shopify/storefront/`). Its footer keeps Publish, then "On another website too? Embed
code and domains" as one quiet line. That line is demoted rather than removed because it also
holds the allowed sites, which a full list sends the merchant to. `isShopify` comes from the
page's server-side user rather than `useMe()`, so the first paint already has this layout.

**The steps sit at the top of the scrolling column, not in the pinned footer.** In the footer,
measured at 390×844, they took 479px of the open sheet's 482px and left the design controls
none (2026-11-01). The footer stays the height it is for everybody else.

**Step 2 is never marked done.** Telling whether the block is in the theme needs `read_themes`,
and the app asks for no scope (above). So one button is filled at a time, decided by
`storefrontPrimary` (`lib/shopify/storefront-step.ts`, tested):

| State | Filled |
|---|---|
| Status loading | none |
| Status failed | Publish |
| Not on the storefront | Show on storefront |
| On it, step 1 pressed on this visit | Add to theme |
| On it, unpublished changes | Publish |
| On it, nothing to publish | Add to theme |

"Pressed on this visit" is local state. Add to theme leaves the app (`window.open(…, "_top")`),
so nothing resets it. The "Ready to publish?" tip has a Shopify wording too (`PUBLISH_SHOPIFY`
in `components/onboarding/callouts.ts`), because the default one promises code to paste.

**A deleted map comes off the storefront** (`lib/shopify/storefront-cleanup.ts`): the map
route's DELETE, inside the admin, schedules the removal from the list and the picker in
`after()`, with the request's ID token read beforehand. Best effort — the map is already gone,
and a failure leaves the block showing the default, or nothing, as before. Deleted from the web
app (no ID token), it stays listed until "Remove" or a delete from inside Shopify. A renamed
map's picker entry follows on the next `GET`.

**A custom domain connected later.** `primaryDomain` used to be read only at install, and the
embed checks a restricted site list against the visitor's host, so a store that connected
`www.brand.com` afterwards showed a blank block. `readStorefront` now reads
`shop { primaryDomain { host } }` on every call (no scope), the route updates the shop row
when it moved, and `domainMissing` drives a warning under step 1 with a button that adds the
host and republishes. An empty site list means every site and never warns.

## Lifecycle (webhooks)

`/api/webhooks/shopify`, subscribed in `shopify.app.toml`:

- `app/uninstalled` — stamp `uninstalledAt`, write the free state, forget the cached token.
  Maps stay, so a reinstall within 48 hours finds them (`provisionShop` reopens the row).
- `shop/redact` — 48 hours after an uninstall. Stamp `redactAfter`; the hourly sweep runs
  `runDeletionStep` on the workspace until done, then deletes the row.
- `customers/data_request`, `customers/redact` — nothing held: storefront visitors in
  Analytics are anonymous and never tied to a Shopify customer.

## Developing

```
npm run shopify:dev      # writes the block, then shopify app dev (CLI 5.0.0 via npx) on the dev store
npm run shopify:deploy   # writes the block, then releases config + extension to every store
```

Without a terminal to answer its prompt, release with
`npx -y @shopify/cli@5.0.0 app deploy --path distribution/shopify --allow-updates` after
`node scripts/shopify-block.mjs`.

### The block is generated

The block's schema has to carry the app's numeric id (Invariants). So its source is
`distribution/shopify/block-templates/map.liquid`, holding two placeholders — the app id and
the app handle (the setup card's "Open Pinglide" link) — and `node scripts/shopify-block.mjs`
writes `blocks/map.liquid` from it with the values in `distribution/shopify/apps.json` (one app
today, so no name is needed; with several, pass its key). The numeric id is the number in the
app's Partner Dashboard URL, not the client id. The script refuses an app with no id, and a
template that holds a placeholder other than exactly once. The output is gitignored, so a fresh
checkout has no block until one of the `shopify:*` scripts (or the script itself) has run — run
it before `shopify theme check` too.

### What the live app needs

1. On the Appwrite Site: `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` (**as a secret**), and
   **all three** of `SHOPIFY_PARTNER_API_TOKEN` (secret) / `SHOPIFY_PARTNER_ID` /
   `SHOPIFY_APP_ID` — without them a shop that pays stays on Free (`reconcileShopPlan` returns
   early). `SHOPIFY_APP_HANDLE` only if the handle stops being `pinglide`. The Site reads them
   on its next deploy.
2. App Pricing in the Partner Dashboard: plans whose handles start `free`, `starter`, `pro`,
   monthly and yearly, at the prices in `SHOPIFY_PRICES`; no trial (Free is the trial).
3. `npm run shopify:deploy` after any change under `distribution/shopify`, and
   `npm run setup:sheet-sync` after any change to the hourly function.
4. Check: `curl -I "https://pinglide.com/shopify/session-token?shop=<shop>.myshopify.com"` is a 200.

`shopify app dev` starts `scripts/shopify-dev.mjs` as the app's web process — `npm run dev`
with `APP_URL` pointed at the CLI's tunnel — and installs the dev app on the dev store.
`allowedDevOrigins` already lets `*.trycloudflare.com` load the dev server's assets.
`shopify theme check --path distribution/shopify/extensions/pinglide-map --config
theme-check:theme-app-extension` checks the block.

## Open questions, to settle on the dev store

1. Does every RSC flight request carry App Bridge's header (the patch must land before
   hydration)? If not, `lib/query/fetcher.ts` awaits `shopify.idToken()` itself.
2. ~~Framing~~ — settled with curl on 2026-11-01, approved by the owner. **A header from
   `next.config.ts` beats the same header from a route handler** (the bounce page's per-shop
   rule came back as `'self'`), so the site-wide framing rule (`framingHeaders`) is not sent
   on `/shopify/**` or on `embedded=1` documents. `proxy.ts` matches every `embedded=1`
   document (except the bounce page and the operator console) and sends the shop's admin
   with a verified token, or puts `'self'` back. Measured: bounce page and `/maps` are framed
   by the shop's admin only, with no `X-Frame-Options`; `/login?embedded=1` keeps `'self'`;
   `/login/admin` keeps `'none'`; ordinary pages are unchanged. Re-run the probe after touching
   either file.
3. ~~Does `users.create` accept no email on Appwrite Cloud?~~ Yes. `pinglide.myshopify.com`'s
   account was made with none and reads `emailVerification: true` (checked 2026-11-01).
5. **A reload loop seen once in development, not reproduced.** The admin's frame reloaded the
   same URL (same ID token) about twice a second, each cycle opened by `✓ Compiled in 1ms`.
   Next's HMR client does a full `location.reload()` on every update once
   `RuntimeErrorHandler.hadRuntimeError` is set (`hot-reloader-app.js`), and a fresh page always
   gets one update. In the App Router that flag is set only by a render error reaching the
   **root** boundary, so something in the dashboard layout's shell (outside
   `app/(dashboard)/error.tsx`) threw inside the frame. It was not the onboarding tips (the
   shop had seen them 7 minutes earlier), and a plain tab never looped. `next.config.ts` now
   forwards browser errors to the terminal (`logging.browserToTerminal: "warn"`), so if it
   recurs, the `[browser]` line just before the reloads in the CLI output names the error.
   In production the same error would show the global error page, not a loop.
4. ~~Analytics on storefronts~~ — settled 2026-11-02: the beacon asks Shopify's Customer
   Privacy API. On a page with `window.Shopify`, `embed/src/track.ts` sends only when
   `customerPrivacy.analyticsProcessingAllowed()` is `true` (region and store settings
   included), sends nothing while the API is missing, and drops what was queued before a yes.
   The block loads the API (`consent-tracking-api` 0.2). Measurement stays a paid feature for
   Shopify shops; Privacy §6 says so.
