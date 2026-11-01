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
- **Theme extension assets are `.jpg .jpeg .js .css .png .svg .json .wasm` only**, and only
  the CLI's bundler enforces it — `shopify theme check` passed a `.webp` that `shopify app dev`
  then refused. The block's `assets/placeholder.jpg` is a JPEG (quality 82) of the WordPress
  `placeholder.webp`; re-make it when that one is regenerated or `DEFAULT_MAP_STYLE` changes.
- **The metafield's keys are the Liquid's contract** (`lib/shopify/storefront-maps.ts`):
  `default`, `script`, `maps.<id>.name`, `maps.<id>.snapshot`. Rename one and every block stops
  finding its map.
- **A Shopify shop is never billed by Lemon Squeezy**, and its subscription row says
  `provider: "shopify"`. Absent `provider` is Lemon, which is every row written before this.
- **Frozen is sticky.** `activeSubscription` has no status; a freeze is known only from the
  `SUBSCRIPTION_FROZEN` event, so a re-read with no event keeps a stored freeze.
- **Webhooks: raw body, HMAC, then parse, and answer inside five seconds.** `shop/redact` only
  stamps the row; the hourly sweep deletes in bounded steps.
- **Request no scope the app does not use.** `access_scopes` is empty: the app-data metafield
  needs none. Asking for more fails review.

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
the owner; teams are not offered inside Shopify.

## Billing

Shopify App Pricing: plans defined in the Partner Dashboard with handles `free`, `starter`,
`pro`, each monthly and yearly; Shopify hosts the plan page
(`admin.shopify.com/store/<handle>/charges/<app_handle>/pricing_plans`) and handles upgrades,
downgrades and proration. **It sends no webhooks** (stopped 2026-04-28), so
`lib/shopify/plan-sync.ts` re-reads `activeSubscription` from the Partner API:

1. on the App Home, when the stored answer is older than 6 hours, and always after the
   merchant chose a plan (`plan_handle` on the welcome URL);
2. every hour, for shops with a subscription event in the last 3 hours;
3. every hour, for Shopify plans ending within 2 days — a renewal moves the end date and
   nothing else would say so.

`toShopifyState` (lib/billing/shopify-pricing.ts) grants a renewing plan two days past its
cycle end (`RENEWAL_MARGIN_MS`), so the hour between Shopify renewing and the sweep noticing
never reads as free. A plan set to cancel ends exactly when Shopify says.

The sweep is `POST /api/cron/shopify`, driven by the existing hourly function
(functions/sheet-sync) — **redeploy it with `npm run setup:sheet-sync`** after changing it.

## Storefront

The theme app extension (`distribution/shopify/extensions/pinglide-map`) has one app block,
`map`. It reads `app.metafields.pinglide.maps` — an app-data metafield on the app
installation, which takes any namespace, needs no scope and is readable only by this app.
"Show on storefront" (`/api/maps/[id]/shopify-storefront`) publishes when needed, lets the
shop's domains through a restricted allowlist (`prepareMapForSites`, shared with the WordPress
connect), and adds the map to the list; the first map becomes the default, so a block needs
no settings. A "Map code" setting picks another. The tag filter is not offered: the embed's
`data-tags` takes tag ids, which a merchant typing in the theme editor does not know.

`addBlockUrl` is Shopify's deep link that opens the theme editor with the block added.

Not done yet: a deleted or renamed map is not taken off the list. A deleted map's block
shows nothing to visitors and a "no map with that code" card in the editor.

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
npm run shopify:dev      # shopify app dev on distribution/shopify (CLI 5.0.0 via npx)
npm run shopify:deploy   # push the app config and the theme extension to Shopify
```

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
4. Analytics on storefronts: does review require Shopify's customer-privacy consent before
   the beacon? If so, measurement stays off for Shopify maps in v1.
