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

**Its public page is `/for/shopify`** (docs/notes/marketing.md, "Platform pages"). Every claim
on it is taken from this file — re-read the page when a label, a price or the uninstall
behaviour here changes. Its install button waits on `SHOPIFY_APP_STORE_URL`
(lib/marketing/integrations.ts): empty until the App Store listing is live, and while it is
empty the page says "Coming soon to the Shopify App Store" and offers the embed code instead.

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
- **The hourly sweep's erasure never waits on the Partner API.** `shop/redact` is a
  compliance duty; a Partner API failure is logged and counted, then erasure runs ("Billing").
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
  **The dev store also keeps the running session's scopes**: an optional scope added to the TOML
  while `app dev` runs is not declared there, and `shopify.scopes.request` throws "should be a
  subset of the declared optional access scopes: []" (2026-11-02) — even after `app deploy`
  released it to every other store. Restart `npm run shopify:dev`.
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

**Verified end to end on the dev store, 2026-11-09.** Shopify's dialog appeared on the first
press, listing "Locations" and the store owner's phone and address, which is how it describes
`read_locations`. Allow led straight to the table, and the second press asked nothing. Of the
store's two locations, the one with only a country ("Shop location") was left out, and the
other came with Shopify's coordinates. The review step placed it with no lookup spent and
labelled it "Placed by hand", like any row with coordinates, and it was imported onto the map.
**Restart `npm run shopify:dev` first if the TOML changed**: until then the prompt fails
(Invariants).

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
**A Partner API failure must not stop the sweep's second half**, the `shop/redact` erasure:
finding the shops to re-read is caught, logged and counted as `failed`, and erasure runs anyway
(`plan-sync.test.ts`). Before 2026-11-02 one bad events query skipped that hour's erasures.

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
maps renamed since). **Every heal is best effort** (`bestEffort` in the route): a refused write
is logged as `[shopify] couldn't heal …` and the status still answers. So is the POST's picker
entry, written after the map is already on the list. Before 2026-11-03 a heal that threw failed
the whole read, and the Publish footer said "Couldn't check your storefront" on every load.

**That came from the dev store having no `$app:map` definition** (2026-11-03). `app dev` said
"Ready" with no errors, and its bundle carried the `data` module with the definition, yet
GraphiQL (the URL `app dev` prints) answered `metaobjectDefinitionByType(type: "$app:map")` with
`null` and `metaobjectDefinitions` with nothing. The default map works without it; the block's
"Map" picker lists nothing until it exists. Check with that query after restarting `app dev`.

`addBlockUrl` is Shopify's deep link that opens the theme editor with the block added;
`themeEditorUrl` opens it as it is, for "Open theme editor" — the deep link would add another block
on every press.

### The Publish footer inside Shopify

Inside the Shopify admin the store is the obvious place for a map, so the Publish sidebar's
pinned footer is the path onto it: **three fixed steps, read top to bottom**
(`StorefrontStepper`, `components/shopify/storefront/`). Its twin outside Shopify is "Your
website" (docs/notes/publish-and-embed.md, "The Your website stepper"); the step row, the text
links, the remembered flags and the step model are shared, in `components/publish/stepper/` and
`lib/publish/steps.ts`.

```
YOUR STORE                          ● Live · 1 h ago     ← every state, loading and failed too
(✓) Show on your storefront                 Remove   ← done: one line (+ "Not your default map. Make default")
 ┃
(2) Add the block to your theme                       ← current: the only filled button
 │  Your latest changes aren't live yet. Redeploy     ← with edits: Redeploy first, in this step…
 │  first, so your theme shows them.
 │  [               Redeploy               ]
 │  Already added
 │
(3) Up to date                                        ← the status step: grey until ② is done
────────────────────────────────────────
</> Embed on another site
```

**The three steps never change** (the owner's call, 2026-11-07): ① Show on your storefront,
② Add the block to your theme, ③ Up to date. Nothing is added, removed or renumbered.
`storefrontSteps` returns one state per step, and they always come from one number, how far
along the merchant is (`statesAt`), so progress cannot leave a gap.

It replaced an ordered list numbered by position, where Redeploy was a step of its own that came
and went. With edits it sat at ②, with the theme step at ③. Pressing it removed it, so the
theme step slid up into ② and ③ disappeared. The owner read that as the flow going nowhere: "it
sits on 2 step and deletes 3". A test now holds the property directly: for every state, removing
the edits never moves the current step back up (`storefront-step.test.ts`, "never moves back
after a redeploy").

**Add to theme and Redeploy are never offered together, and with edits Redeploy comes first,
inside ②** (the owner's call, 2026-11-07, asked twice). While the theme step is current and
there are edits to send, ② shows Redeploy and "Already added". Once the store is current, ②
turns into **[Add to theme]** and "Already added" in the same place, and ② stays current
throughout. Redeploying first is also the better order, because the theme editor then shows the
latest map.

**③ is a status, not an action.** While ② is undone it is a grey "Up to date". Once ② is done it
has two forms:
- **Redeploy your changes**: shown while the store is behind. It reads "Your store still shows
  the version you last published." and holds the filled Redeploy.
- **Up to date**: a check, "Your store shows your latest changes."

Under both forms is **Open theme editor ↗**, an accent text link (`TextAction tone="accent"`)
that opens the live theme's editor with nothing added (`themeEditorUrl`). It stays put while the
status above it changes. That link replaced a full-width outline "Go to theme" button, which the
owner did not want ("dont show large button like before"). A map never published says Publish,
and "Publish your map". A Redeploy toast says Redeployed.

Only the current step is open and has a filled button. Finished steps fold to a line with a
**white check on a solid accent disc**, and the line under a finished step fills with accent.
The current step's disc is accent with a soft accent halo (`ring-accent-soft`), which is what
tells it from a finished one. Later steps are a grey ring. These colours were the owner's call
(2026-11-07) over a grey disc with a green check (`bg-default text-success`), which read as
washed out. The green "Live" dot on the heading row stays green.

Every move that is not the next step is words, not a button (`TextAction`): Remove, Make default,
Already added, and "Embed on another site". The embed dialog is demoted rather than removed,
because it also holds the allowed sites, and the "site list is full" toasts send the merchant
there by that name.

**A map off the storefront with edits gets Redeploy as words, in ③** (`quietRedeploy`): "Edits
not live yet. Redeploy", drawn by `PublishAction look="text"`. A map taken off the storefront, or
only embedded elsewhere, must not be stuck with its edits, and Show on storefront would not send
them: `prepareMapForSites` publishes only when the site list changes. As words, it never competes
with the filled Show. All buttons are `size="sm"` and full width (the owner's call, 2026-11-03).
`isShopify` comes from the page's server-side user rather than `useMe()`, so the first paint
already has this layout.

**Nothing in it snaps** (the owner's report, 2026-11-07: the section "jumps around and changes
all the time when data is fetched"). Three things were moving the layout:
- the swap from "Checking your storefront…" to a list of a different length;
- the theme mark, which read `false` on the server and flipped right after hydration;
- every state change.

Now:
- **Loading draws the real list.** It shows the same three titles with pulsing discs, and "Checking
  your storefront…" with a spinner under ①. Only the bodies arrive. `themeAdded` is `undefined`
  until the browser has been read (`useMarked`'s server snapshot), so the first paint is the
  loading list, never a wrong state.
- **`StepperStep` animates every change.**
  - A body cross-fades when its `bodyKey` changes (`stepMotion`), and its height eases over
    200ms (`components/ui/animated-height.tsx`, measured by a `ResizeObserver` and animated
    inside the observer callback, before paint).
  - The disc's colour and halo are a CSS transition, and the check pops in where the number was.
  - The line under a finished step fills downward.
  - ③'s title cross-fades.
- **Reduced motion** keeps the colours and drops the travel (`MotionConfig`, plus
  `useReducedMotion` for the height).

**The time on the heading row is a number, and coarse** — "12 min ago", "1 h ago", "3 d ago",
"1 week ago", then months and years (`shortAgo`, `lib/format/ago.ts`, labels written out for the
`Intl` invariant), never below "1 min". The owner's call over date-fns's "less than a minute ago".
It is worked out once per render with no counter running: a first version ticked in seconds,
and the owner did not want a live counter.

**How it got here (2026-11-01 → 11-02), so it is not rebuilt.** Two numbered cards at the top of
the scrolling column could not be pinned (in the footer at 390×844 they took 479px of the open
sheet's 482px), and in the scroller they sat on ~230px above the folds over a ~180px footer, which
the owner read as no room for the dropdowns. A **single dense row** replaced them — "On your
storefront [Add to theme] [⋯]" over "[Publish] [</>]" — at ~155px, and the owner rejected it:
the buttons were too big, four controls of similar weight said nothing about which to press, and
nothing read top to bottom. The stepper is the answer: roomier (~300px at its fullest at lg, the
folds scrolling above it), but with one obvious next press.

**The stepper is pinned at every width now, and folds away while a design fold is open**
(2026-11-07). It used to lead the scroller below `lg` and scroll away with the folds, because
pinned in a 390px sheet it filled the whole open sheet (2026-11-02). The owner then asked for the
steps to slide down to the heading row ("Your store · ● Live") whenever a fold opens, and back
when it closes — which answers the room problem from the other side, so there is one placement
and one copy again. The steps and "Embed on another site" fold away together (`HeightCollapse`),
the heading row brings them back, and the motion is the accordion's own: docs/notes/
publish-and-embed.md, "Folding the steps away". Its relative time ("5 min ago") is a `ShortAgo`
span with `suppressHydrationWarning`: rendered at request time and hydrated a minute later in the
admin's iframe, the two strings differed and the whole sidebar was regenerated on the client.

**Show on storefront waits for the designer's last save**, like Publish: it republishes, and a
snapshot is built from the stored settings (`useSettleDesign` in `use-storefront.ts`).

**The theme step is "done" only as far as this browser remembers.** Telling whether the block is
in the theme needs `read_themes`, and the app asks for no scope (above). So pressing **Add to
theme**, or **Already added** (for a merchant back on a new device), writes
`pinglide:theme-added:<mapId>` to `localStorage` (`themeAdded` in
`components/publish/stepper/marked-flag.ts`, every access wrapped). **Keep that key**: merchants'
browsers hold it, and renaming it would show them the step again. Losing it only shows the theme
step again. The states come from `storefrontSteps` (`lib/shopify/storefront-step.ts`, tested over
every combination):

| State | ① Show | ② Theme | ③ Status | Filled |
|---|---|---|---|---|
| Status loading, or theme mark not read yet | pulsing | pulsing | pulsing | none ("Checking your storefront…") |
| Status failed | — | — | — | Redeploy in ③ with edits, else none ("Couldn't check… Try again" under ①) |
| Not on the storefront | current | upcoming | upcoming (+ Redeploy as words with edits) | Show on storefront |
| On it, theme not marked, edits or never published | ✓ | **current: Redeploy first** | upcoming | Redeploy |
| On it, theme not marked, nothing to send | ✓ | current: Add to theme | upcoming | Add to theme |
| On it, theme marked, edits or never published | ✓ | ✓ | current: Redeploy your changes | Redeploy |
| On it, theme marked, nothing to send | ✓ | ✓ | ✓ Up to date + Open theme editor | none |

Add to theme marks the step before `window.open(…, "_top")`, because the theme editor replaces the
admin page and nothing in the app runs again until the merchant returns. The "Ready to publish?"
tip has a Shopify wording too (`PUBLISH_SHOPIFY` in `components/onboarding/callouts.ts`), because
the default one promises code to paste. HeroUI's `Tooltip.Content` is `break-all`: a prose tooltip
needs `break-normal`, or it splits words.

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
when it moved, and `domainMissing` drives a one-line warning under step 1 whose "Add it" adds the
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

**"Request to pinglide.myshopify.com was aborted before it completed"** from `app dev` is the
network, not the app (2026-11-03). Measured: TLS to Cloudflare's Vilnius edge (`colo=VNO`) in
~30 ms, then storefront and `/admin` paths sat 30 s with no byte, intermittently — for
`allbirds.myshopify.com` too, same IP (23.227.38.74), with shopifystatus.com green and the Admin
API endpoint answering. Probe with `curl -4 -w "%{time_starttransfer}" https://<shop>/robots.txt`
a few times; retry later or from another network (hotspot, WARP, a VPN).

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
   on its next deploy. **`SHOPIFY_PARTNER_ID` is the number in a `partners.shopify.com/<id>/…`
   URL — 5295851 — not the Dev Dashboard's organisation id (244455299, the one
   `shopify app info` prints)**; the Partner API is served at that Partners id. Set on the Site
   2026-11-02, the client secret and the API token both made secrets. **The token answered
   `activeSubscription` with "App not found"** (and `app(id: gid://partners/App/<id>)` with
   `null`) on 2026-11-02: valid — a 200, where the other org id is a 401 — but not seeing the
   app. Its Partner API client needs **Manage apps**; once it has it, expect "Only public apps
   can access active subscription" until step 2. Re-check with the one `activeSubscription`
   query in `partner-api.ts`; `null` with no error is the healthy answer for a shop on Free.
   **The Partner API is pinned to `2026-07`, not the Admin API's `2026-10`** (2026-11-03): it
   versions on its own schedule, and Shopify's schema index listed nothing newer for it. The
   "App not found" above was measured on `2026-10`.
2. Distribution: **Public** (Partners → the app → Distribution). It cannot be changed once
   chosen, and Shopify App Pricing and the Partner API's `activeSubscription` work for public
   apps only.
3. App Pricing in the Partner Dashboard: plans whose handles start `free`, `starter`, `pro`,
   monthly and yearly, at the prices in `SHOPIFY_PRICES`; no trial (Free is the trial).
4. `npm run shopify:deploy` after any change under `distribution/shopify`, and
   `npm run setup:sheet-sync` after any change to the hourly function.
5. Check: `curl -I "https://pinglide.com/shopify/session-token?shop=<shop>.myshopify.com"` is a 200.

`shopify app dev` starts `scripts/shopify-dev.mjs` as the app's web process — `npm run dev`
with `APP_URL` pointed at the CLI's tunnel — and installs the dev app on the dev store.
`allowedDevOrigins` already lets `*.trycloudflare.com` load the dev server's assets.
`shopify theme check --path distribution/shopify/extensions/pinglide-map --config
theme-check:theme-app-extension` checks the block.

## Performance

Built for Shopify (2.1) grades the app inside the admin on Web Vitals at the 75th percentile
of page loads: **LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms**, each assessed after 100 loads in 28
days. App Bridge collects them; loading the current `app-bridge.js` from the CDN is all it
needs, and we do. Shopify's own figures are in the Dev Dashboard. In development,
`ShopifyAppBridge` adds `<meta name="shopify-debug" content="web-vitals">`, so the console shows
each value as Shopify records it.

**Don't judge speed on the dev store while `shopify app dev` runs.** The admin then frames
`next dev` on this PC through a `trycloudflare.com` tunnel. Measured 2026-11-04, a first visit
to each map tab took 2.4–3.9s, of which 2.1–3.5s was Next compiling the route and 240–340ms
was our code (Appwrite reads and the render). Stop `app dev` and the dev store loads the
released app from `pinglide.com`; measure there, with the Chrome window in front (an occluded
window drew 2 frames a second and every screenshot timed out).

What is left in production, inside Shopify or not, is the server's ~300ms per tab and a fresh
MapLibre on each map tab. Measured on `localhost` the same day (dev build), Map → Locations →
Map: the first visit's map worker went quiet 1.5–2.0s after the click, and a return within
`staleTimes`' 30s drew the canvas in ~110–160ms and went quiet at ~0.6–0.8s.

**Don't add MapLibre's `prewarm()` to keep the workers between tabs; they already stay.**
MapLibre does terminate its worker pool when the last map is removed (`WorkerPool.release`),
but its global dispatcher, created with the first map and never released, holds the pool for
the rest of the page's life. Counted by wrapping `window.Worker`: one worker for the whole
session, with and without `prewarm()`, and the same timings. The Publish preview could not share
them anyway: it is the embed's own MapLibre in `srcdoc` documents.

## Built for Shopify, against the current UI

BFS is the App Store's badge and ranking boost. It comes only after **50 net installs from paid
shops, 5 reviews and a minimum rating**, and ordinary App Store review does not ask for Polaris.
It asks that the app look and behave like the admin. Polaris web components are Shopify's
*recommended* way to get there, not a rule. Assessed 2026-11-04 against Shopify's published
rejection reasons:

| Requirement | Today | Verdict |
|---|---|---|
| 4.1.4 Use the admin nav menu, not your own | `<ui-nav-menu>` (Maps, Settings), **and** our own sidebar inside the frame | Likely fail |
| 4.1.1 Buttons match Polaris | Orange primary buttons; a non-Polaris primary colour is Shopify's own rejection example | Likely fail |
| 4.1.1 A sub-page offers a back button to its parent | No title bar or breadcrumb | Likely fail |
| 4.1.1 Nothing flickers or loads in and out | The map is rebuilt on each map tab | Watch |
| 4.1.5 Contextual save bar / 4.1.6 `s-modal` | Autosave; Edit location is a HeroUI dialog with its own Save | Needs review |
| 2.1 LCP / CLS / INP | Collected, never looked at | Measure |

The cheap route, when it is time: inside the admin only, hide our sidebar and give a map's five
sections tabs under its title (BFS allows tabs for secondary navigation), add a
`<ui-title-bar>` with a back link, give `embedded=1` a Polaris-like primary colour, and send
toasts through `shopify.toast`. Rewriting the editor in Polaris is not that route: the map
canvas is custom either way. The dev store already runs the new admin design
(`admin_theme=admin-next`); Polaris 2 follows it on its own, and HeroUI cannot.

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
   **It recurred on 2026-11-04**: `/maps` loaded 90 times in about a minute, 31 of them
   through `/shopify/session-token`, each after a `✓ Compiled in 1ms`. Clicking a sidebar
   tab never landed, which read as "the map is slow". Restarting `npm run shopify:dev`
   cleared it, and the restart rotated `.shopify/dev/app-dev-*.jsonl`, so the error was lost.
   Next time, grep that log for `[browser]` *before* restarting.
4. ~~Analytics on storefronts~~ — settled 2026-11-02: the beacon asks Shopify's Customer
   Privacy API. On a page with `window.Shopify`, `embed/src/track.ts` sends only when
   `customerPrivacy.analyticsProcessingAllowed()` is `true` (region and store settings
   included), sends nothing while the API is missing, and drops what was queued before a yes.
   The block loads the API (`consent-tracking-api` 0.2). Measurement stays a paid feature for
   Shopify shops; Privacy §6 says so.
