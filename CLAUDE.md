@AGENTS.md

# CLAUDE.md

Project instructions. Read this fully before writing code.

---

## 0. State of the code

**Weeks 1–3 of §10 are done; Week 4 is next.** Of §5's layout, `/app`, `/lib`,
`/components`, `/scripts`, `/embed` and `/packages/shared` exist. Still absent, and
correctly so — they belong to Week 4: `/functions`, and `/app/(marketing)/for/[platform]`
+ `/pricing`.

Working end to end: email auth, map CRUD, the MapLibre editor, the locations list with
search and tag filters, per-location editing with search-on-submit geocoding and photo
upload, tags with colours, custom pin icons, shapes (circles, polygons, lines), routes,
sixteen basemap looks with label and layer controls, import from CSV / XLSX / XML / Google
Sheets with column detection and a drag-to-fix review step, the card designer (saved per
account, overridable per pin), the publish designer, publish → static snapshot → embed
bundle (clustering, cards, tag filters, client-side search, find-nearest) with the one-line
snippet and the domain allowlist, and a per-map Analytics tab reporting what visitors did.

**Routes were built out of order, knowingly.** §11 lists routing as out of scope for v1 and
§10 says Week 4 is next; that call was made deliberately, against a rival shipping the
feature, and is recorded here rather than quietly overriding either section.

**Analytics is the second such call, and it bends both §11 and §2.** The tab reports what
*visitors* to a published map did: search terms with their match counts, which locations
they opened, which controls they pressed, where in the world they were. That needs a beacon
on a customer's website, which §2 forbids by default — so the override is recorded rather
than assumed. **The number that makes it survivable: one batched `sendBeacon` per session
costs about $3 per million map sessions on Appwrite, against the $7-per-*thousand* §2 exists
to beat.** Two things keep it there and must not be undone — the batching (one request per
session, never per event) and the per-map monthly ceiling in `SESSION_LIMITS`. The content
statistics this tab used to show are deleted; what was actionable in them was already a
filter on the Locations page. Full reasoning, and the five blockers it had to answer, in
`docs/notes/analytics.md`.

**Auth and transactional email are done, and are the first of Week 4 to land.** A split
`app/(auth)` group — a drawn map panel on one half, the form on the other — carrying
email/password, **Google sign-in over Appwrite's OAuth2 *token* flow**, confirm-your-address,
and forgot/reset password. Three emails go out through Resend. Two things there are load
bearing and easy to undo by accident: the session is only ever created **on our server**, so
the httpOnly cookie `proxy.ts` and `requireUser()` read is the only session there is; and every
link that arrives from outside (a mail client, Appwrite's own domain) lands on a page outside
`proxy.ts`'s matcher rather than server-redirecting to `/maps`, because `sameSite: "strict"`
survives a redirect chain and would bounce a user who had just signed in. Both, and the reason
Appwrite's tokens are used instead of our own HMAC, are in `docs/notes/auth.md`.

**Not built yet, and next — the rest of Week 4:** pricing page, plan-limit UI, MoR billing +
webhook, landing page, one platform page (Webflow first), docs with screenshots. Plus the two upstreams §12 says are forced before anyone pays us,
which are now a switch rather than two machines: `GEOCODER_PROVIDER=geoapify` and
`ROUTING_PROVIDER=geoapify`. What is still owed there is a plan decision, not a build —
Geoapify's free tier requires its attribution, and a route drawn on it is published onto a
customer's site. Self-hosted Photon and OSRM stay in the tree as the fallback, runbooks
intact. The PMTiles archive on R2 is ready and deliberately *not* on that list (§7).

Installed since the original scaffold: `zod`, `@tanstack/react-query`, `zustand`,
`papaparse`, `date-fns`, `vitest`, `vite`, `fflate` (promoted from a pmtiles transitive —
it unzips .xlsx), `resend`, and `jsdom` as a devDependency only. Still not installed, from §3's
"Add these": biome, playwright, sentry, posthog, and `@react-email/components` — three
transactional emails do not earn a React renderer, so the templates are plain TS returning
`{ subject, html, text }`.

### Commands

```
npm run dev          # next dev
npm run build        # builds the embed first (prebuild), then next build
npm run check        # typecheck + lint + tests — run this before calling work done
npm run typecheck    # next typegen && tsc --noEmit
npm run lint         # eslint
npm run test         # vitest run
npm run build:embed  # vite build → public/embed, copy MapLibre runtime, check size
npm run setup:appwrite  # create missing tables/columns/indexes from scripts/appwrite-schema.mjs

npm run build:tile-styles -- https://tiles.example.com   # our own five style documents
npm run mirror:tile-assets      # fonts, sprites, Natural Earth raster -> public/tiles/ (414MB)
npm run migrate:style-host      # move published snapshots to the current tile host
npm run migrate:tags            # fold categories into tags (--dry-run first)
```

`npm run check` does **not** build the embed. After changing anything under `/embed`, run `npm run build:embed` too — that is where the size budget is enforced.

**Testing the embed by hand:** `npm run build:embed`, start the dev server, open
`/embed/dev.html`. It renders the real bundle against a fixture snapshot with no
Appwrite, login or publish involved. Source is `embed/dev/`, committed; Vite's
`publicDir` copies it into the gitignored build output, so it never deploys.

Linting is **ESLint flat config** (`eslint.config.mjs`, `eslint-config-next` core-web-vitals + typescript), not Biome. §3 chooses Biome; when you migrate, swap the `lint` script and delete the ESLint config. Until then `npm run lint` is the check.

Two lint rules bite repeatedly, and both are right:
- **No JSX inside a `try`/`catch`.** React renders children after the handler returns, so the catch never fires. Fetch inside the try, assign to a `let`, return JSX after it — see `app/(dashboard)/maps/[id]/settings/page.tsx`.
- **No `watch()` from react-hook-form.** It returns a fresh function each render, so the React Compiler opts the whole component out of memoization. Use `useWatch({ control, name })`.

Tests are `vitest` (`vitest.config.mts`), unit only, `lib/**/*.test.ts` and `packages/**/*.test.ts`. Single file: `npx vitest run lib/import/detect/score.test.ts`. Covered per §9: import column detection, geocode result handling, plan-limit enforcement. The default environment is `node`; the few files touching `DOMParser` or `File` opt in with a `// @vitest-environment jsdom` docblock. **jsdom, not happy-dom** — happy-dom's XML parser rejects CDATA outright, and store-locator feeds wrap names in it constantly, so it cannot tell us whether the XML source works. `lib/import/pipeline.test.ts` runs bytes-to-drafts over realistically-shaped files; it is the one that catches seam bugs the per-stage tests each miss. Snapshot generation is untested because it doesn't exist yet — add it with Week 3. `server-only` is aliased to a stub (`lib/test/server-only-stub.ts`) so repositories can be tested; the real guard still applies to every Next build.

### Stack specifics that change how you write code

- **Next.js 16.3.** Breaking changes against older App Router knowledge — read `node_modules/next/dist/docs/` before writing route, layout, or caching code (AGENTS.md says the same). Typed route props are globals: `LayoutProps<"/">`, `PageProps<"/maps/[id]">`. Don't hand-write `params` types; `app/layout.tsx` already uses the global form.
- **Tailwind v4, CSS-first.** There is no `tailwind.config.js` and none should be added. `app/globals.css` does `@import "tailwindcss"` then `@import "@heroui/styles"`; the theme is oklch CSS variables under `:root/.light` and `.dark`. Restyle by editing those variables, not by hardcoding colours in components.
- **HeroUI v3** is React Aria under the hood and has a different API from v2. Don't write v2 component code from memory. One consequence bites hard: React Aria owns an input's value, so react-hook-form's `register()` **silently does not work** — a prefilled form renders blank and then saves the blanks. Always bind through `components/ui/form-field.tsx` (`FormTextField` / `FormTextArea`), which wire `Controller` to the TextField's own `value`/`onChange`. The same ownership bites a second way: `usePress` — every HeroUI `Button` — ends its `onPointerDown` with `stopPropagation()`, and React dispatches synthetic events from its root, so **a pointer handler on a wrapper around a Button never fires in the bubble phase**. It fails silently, with no error. Bind it as `onPointerDownCapture` instead; `components/map/add-location/use-drag-to-add.ts` is the working example.
- **MapLibre's worker must be told where it lives.** MapLibre v6 derives its worker URL from `import.meta.url`, bails to `""` when that isn't an http(s) URL (which it isn't under Turbopack), and then constructs `new Worker("")` — loading the HTML page as the worker script. The worker never replies, and because vector tiles are fetched *inside* the worker, every map renders as an empty background with **no error in the console**. `scripts/copy-maplibre-worker.mjs` (via `predev`/`prebuild`) copies the worker into `public/maplibre/`, and `lib/map/worker.ts` sets `config.WORKER_URL`. A blank basemap? Check `public/maplibre/` exists before anything else.
- **The embed is an ES module, and that is forced.** MapLibre v6 ships ESM only — no UMD, no CSP build. So the snippet is `<script type="module">`, `document.currentScript` is always null (the boot code finds its script tag by `[data-snapshot]` instead), and both `/embed` and `/maplibre` need CORS headers, because module scripts and MapLibre's cross-origin worker blob are both CORS fetches. `next.config.ts` sets them.
- **MapLibre is external to the embed bundle, deliberately.** Bundling it inlines `maplibre-gl-shared.mjs`, and the worker then downloads its own copy of the same 131KB chunk — measured at 424KB gzipped total. Shipping MapLibre's dist files beside `map.js` lets the main thread and the worker share one URL: 314.5KB. Don't "simplify" this by removing `external` from `embed/vite.config.mts`.
- **Snapshots are written twice per publish.** An immutable timestamped archive, plus one live file at a fixed id that the embed actually reads. The embed's URL has to be stable across republishes or every customer would re-paste their snippet, and §2 forbids asking us which snapshot is current. `lib/snapshot/storage.ts` explains the delete-then-create window and why the embed retries once.
- Vendored skills in `.agents/skills/`, pinned by `skills-lock.json`: `heroui-react`, `appwrite-typescript`, `next-cache-components-optimizer`. Use them instead of recalling API shapes.

### Environment

`.env` is gitignored and there is no `.env.example`. **Server-only names are unprefixed
deliberately and must never reach a client component or the embed (§9)** — `GEOAPIFY_API_KEY`
included, which `geoapifyGet` appends last and keeps out of every error message. Why each
one exists: `docs/notes/environment.md`.

- Browser-safe: `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT_ID`,
  `NEXT_PUBLIC_APPWRITE_PROJECT_NAME`.
- Server-only, required: `APPWRITE_API_KEY`, `DATABASE_ID`, `STORAGE_ID`.
- Server-only, optional, defaulted: `GEOCODER_URL` (public Photon),
  `GEOCODER_MIN_INTERVAL_MS` (1000, spacing request *starts*), `GEOCODER_USER_AGENT` — the
  UA exists because public OSM services block unidentified clients, and a WAF 403 is
  otherwise indistinguishable from an outage. Point the first at a self-hosted Photon and
  lower the second before any real import volume.
- Server-only, optional, defaulted: `ROUTING_URL` (public OSRM demo),
  `ROUTING_MIN_INTERVAL_MS` (1000), `ROUTING_USER_AGENT`. **`ROUTING_URL` has to point
  somewhere of our own before the first paying customer** (§12). Nothing published moves
  when it changes — a route's geometry is baked at draw time.
- Server-only, optional: `GEOAPIFY_API_KEY`, `GEOCODER_PROVIDER`, `ROUTING_PROVIDER` (set
  either to `geoapify`; unset, Photon and OSRM answer as they always did, so it is
  switchable per half and reversible) and `GEOAPIFY_MIN_INTERVAL_MS`, which paces **both**
  halves out of one process-wide throttle because one account has one rate limit.
- Server-only, optional: `SNAPSHOT_STORAGE_ID`, defaulting to `STORAGE_ID` — Appwrite
  Cloud's free plan allows one bucket per project, which is why `json` is in the assets
  bucket's allowed extensions.
- Browser-safe, optional: `NEXT_PUBLIC_COLLECT_URL` — where a published map posts what its
  visitors did. Unset means the dashboard's own origin, which is what makes development and
  self-hosting work with no config. **Absolute, always**: the embed runs on a customer's
  page, so a relative path would post to *their* server. Nothing is written into a snapshot
  unless the owner has also switched measurement on.
- Browser-safe, optional: `NEXT_PUBLIC_TILES_URL` (**unset means OpenFreeMap and is the
  current state**; it moves `STYLE_URLS` and the attribution together, and
  `npm run migrate:style-host` moves maps already published) and
  `NEXT_PUBLIC_EMBED_SCRIPT_URL` (unset, the snippet points at the dashboard's own origin).
- **Temporary, testing only: `DISABLE_ALL_PLAN`.** Every account reads as `pro`, bypassing
  every quantity limit and the routes feature gate. One early return in `getUserPlan`, so
  §6's rule that the checks live in the repositories is intact; warns once per process.
  **Delete it with the pricing work.**

`STORAGE_ID` never reaches the browser: photo URLs are composed on the server in
`lib/storage/photo-url.ts` and handed to clients as `place.photoUrl`. If you need a bucket
id in a component, that's the signal you're building it in the wrong layer.

---

## Invariants — do not break these

Rules that apply everywhere, so they are here rather than in an area's notes file.
Area-specific invariants live at the head of each file in the table below.

- **Absent means the old behaviour.** Every optional field on a snapshot, a card layout or
  a pin means, when absent, exactly what the product did before that field existed —
  because published snapshots are read forever by sites we do not control (§7). Write a
  value equal to the default and you have added bytes to every customer's map for nothing;
  change what absent means and you have edited maps that are already live.
- **The twin renderers must agree.** `components/card/**` and `embed/src/popup.ts` build
  the same card, and `packages/shared/` is where the functions they share live. Every
  `--lm-*` custom-property fallback must equal its `--card-*` twin. A bug here does not
  look like a bug — it looks like a card drawn correctly for the wrong location.
- **`places.tags` is ordered and the first tag colours the pin.** Nothing between the form
  and the snapshot may sort it.
- **`setStyle` destroys every source and layer on the map.** It runs on every basemap or
  theme change. Shapes survive only because `use-shape-layers.ts` re-adds them on
  `styledata`; pins survive because they are DOM. Test this first after touching anything
  in that path.
- **Dangling ids are the normal state, not an error.** Nothing sweeps a deleted tag off the
  places wearing it, or a removed block off the pins overriding it. Narrow them away at
  publish and drop them when drawing — do not add a cleanup pass over 3,000 rows.
- **Never derive or reuse an id.** An id minted from a label and handed out twice
  resurrects deleted data onto every row that once wore it.
- **Retired, not deleted.** `maps.categories`, `places.category`, the `category` and
  `details` card blocks. Do not drop a column or a union member with data behind it — mark
  it `retired` so it stops being offered and keeps being read.
- **One writer per JSON blob column.** `updateMap` serialises `settings` whole, so two
  forms writing it is a lost update. `useEmbedDesign` is the only writer.
- **The embed's own-code budget is 47KB and it currently sits at 46.6KB.** The
  binding number is the **total**, 319.8KB of a 320KB ceiling. Run
  `npm run build:embed` after any change under `/embed` or `/packages/shared` — `npm run
  check` does not. Do not raise the budget to get past it (§4).
- **Adding to `EditorMode` something that is not a `ShapeKind` means auditing every
  `drawMode` read.** Five of them were silently wrong for the whole length of a route
  gesture, and the symptom was "clicking a pin does nothing".
- **For any debounced or optimistic write, the base a patch applies to is the local draft,
  never the server value.** Otherwise a late reply becomes the base for the next write and
  a value the user already moved off gets saved.
- **Verify UI behaviour in the browser against the real DOM.** Fixtures in this project
  have hidden real defects; measure the thing on screen.
- **`preventDefault()` on a pointer event does not stop a scroll.** The spec defines it as
  a no-op for panning, so a gesture that has to keep a finger from scrolling needs
  `touch-action` (declarative) or a non-passive `touchmove` (imperative) — and React
  registers `touchmove` at its root *passively*, so that one must be `addEventListener`,
  bound before the gesture starts. Believing otherwise cost `use-row-drag.ts` a grip icon on
  every draggable row; `docs/notes/editor-and-layout.md` has the post-mortem.
- **`prefers-reduced-motion` cuts every animation to a single 0.01ms pass**, so a state
  told only in motion is told to nobody. Give it a static form too.

## Deep notes — read the matching file before you edit

Each file opens with a checklist of that area's own invariants; the prose after it is the
reasoning and the bug post-mortems that produced them. These are not optional reading when
you are working in the area — most of them exist to stop a specific bug coming back.

| Touching | Read first |
|---|---|
| `components/card/**`, `lib/card/**`, `embed/src/popup.ts`, `packages/shared/card-*.ts`, `directions.ts` | `docs/notes/cards.md` |
| `components/map/shapes/**`, `lib/routing/**`, `lib/map/route-*.ts`, `packages/shared/shapes.ts` | `docs/notes/shapes-and-routes.md` |
| `components/publish/**`, `lib/preview/**`, `embed/src/**`, `packages/shared/embed-chrome.ts` | `docs/notes/publish-and-embed.md` |
| `lib/map/themes.ts`, `lib/map/style*.ts`, `packages/shared/style-tint.ts`, `scripts/tile-style.mjs` | `docs/notes/basemaps-and-tiles.md` |
| `components/tags/**`, `packages/shared/tags.ts`, `packages/shared/pin-*.ts`, `components/map/pin-marker.ts` | `docs/notes/tags-and-pins.md` |
| `components/editor/**`, `lib/import/**`, `lib/map/edge-autoscroll.ts`, any `loading.tsx`, `Container` sizes | `docs/notes/editor-and-layout.md` |
| `components/analytics/**`, `lib/analytics/**`, `embed/src/track.ts`, `app/api/collect/**` | `docs/notes/analytics.md` |
| `components/auth/**`, `lib/auth/**`, `lib/email/**`, `app/(auth)/**`, `app/api/auth/**`, `proxy.ts` | `docs/notes/auth.md` |

Self-hosting runbooks, unchanged: `docs/self-hosting-geocoding.md`,
`docs/self-hosting-routing.md`, `docs/self-hosting-tiles.md`.

---

## 1. What this project is

A web app where non-technical people build a custom interactive map of their locations and embed it on their own website with one line of code.

**Target customer:** a brand with 40–500 physical locations (stockists, dealers, venues, campuses) who wants them on a map on their site without hiring a developer.

**Core loop:** sign up → create a map → import places from CSV → style and categorise → publish → paste embed snippet into their site.

**Not in scope:** GIS analysis, routing/directions, layers, shapefiles, CMS page generation, mobile apps.

---

## 2. The one rule that governs everything

> **Nothing we pay for per request may run in the visitor's path.**

This is the entire business model. Competitors pay Google roughly $7 per 1,000 map loads and pass it on as metered pricing. We charge flat and unlimited because our per-view cost is ~zero.

**Concretely:**

- On **Publish**, generate a static JSON snapshot of the map and write it to CDN storage.
- The embed fetches that snapshot + static PMTiles. Nothing else.
- Appwrite serves the **dashboard only**. It must never be queried by a map visitor.
- Geocoding runs **once at import time**. Never at view time. Ever.

If a change would put a database query, an API call, or a serverless function into the visitor path, stop and flag it instead of implementing it.

---

## 3. Tech stack

### Already decided
| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript, `strict: true` |
| Backend | Appwrite (Auth, Databases, Storage, Functions) |
| UI | HeroUI |
| Styling | Tailwind CSS (required by HeroUI) |
| Forms | React Hook Form |
| Animation | Motion (`motion` package — the current name for Framer Motion) |

### Add these
| Purpose | Package | Why |
|---|---|---|
| Schema validation | `zod` + `@hookform/resolvers` | One schema validates form input, server actions, and CSV rows |
| Server state | `@tanstack/react-query` | Caching, optimistic updates, no hand-rolled loading state |
| Editor state | `zustand` | Map editor has lots of transient local state; Context will re-render too much |
| Map rendering | `maplibre-gl` | No API key, no per-view cost |
| Tile protocol | `pmtiles` | Registers the `pmtiles://` protocol with MapLibre |
| CSV parsing | `papaparse` | Handles messy real-world CSVs, streams large files |
| Appwrite (client) | `appwrite` | Browser SDK |
| Appwrite (server) | `node-appwrite` | Server actions and Functions |
| Billing | Paddle **or** Lemon Squeezy | Merchant of Record — handles EU VAT for us. **Not raw Stripe.** |
| Email | `resend` + `@react-email/components` | Transactional only |
| Errors | `@sentry/nextjs` | |
| Analytics | `posthog-js` | Funnel: signup → first place → publish → paid |
| Dates | `date-fns` | Opening-hours formatting |
| Embed build | `vite` | Separate build target, see §4 |
| Lint/format | `biome` | One tool, fast |
| Unit tests | `vitest` | |
| E2E | `@playwright/test` | Only for: signup, CSV import, publish, embed loads |

### Do not add
Redux, Prisma, tRPC, a UI kit other than HeroUI, Leaflet, Mapbox GL JS, `react-map-gl`, any Google Maps SDK, any ORM. Ask before adding anything not listed above.

---

## 4. Two build targets — do not merge them

This is the most important structural rule after §2.

**A. Dashboard** (`/app`) — Next.js, React, HeroUI, Motion. Bundle size doesn't matter much; only paying customers load it.

**B. Embed** (`/embed`) — a standalone vanilla TypeScript bundle built with Vite, served from CDN, loaded on strangers' websites.

The embed must **never** import React, HeroUI, Motion, TanStack Query, Zustand, or the Appwrite SDK. It gets MapLibre, pmtiles, and our own code. Nothing else.

Target: **under 250KB gzipped including MapLibre.** If a change pushes it over, flag it.

**Measured, that target is unreachable with MapLibre v6** — its own dist files are 273.2KB gzipped (`maplibre-gl.mjs` 136.4 + `maplibre-gl-shared.mjs` 131.0 + the worker 5.8), minified already, with no slim build. Actual total is **319.8KB**, of which ours is 46.6KB. `npm run build:embed` enforces a 47KB budget on our code and a 320KB ceiling on the total; it does not pretend 250KB is achievable. Getting under 250KB means changing the map library, which is a §3 decision — raise it rather than shaving our 46.6KB.

The own-code budget has been raised three times — 42 → 46 → 47KB — and each raise is argued in `scripts/check-embed-size.mjs` rather than merely recorded. It **must not be raised to get past a binding budget**: it exists to catch the MapLibre duplication regression above, and a budget that moves whenever it binds is not one. Trim, or keep the addition on the dashboard side of the seam. **The ceiling below it is now the number with the least room** — 0.2KB — and that one is not editable: if the total is what binds, it is a §3 conversation about the map library. Reasoning in `scripts/check-embed-size.mjs` and `docs/notes/publish-and-embed.md`.

`/packages/shared` is the **only** directory both targets may import from. `@/lib`, `@/components` and `@/app` are closed to the embed, and `eslint.config.mjs` enforces both halves of that.

It started type-only and now holds a little runtime too, because the editor and the embed must run *the same* transform rather than two that agree today — the preview panel draws the real embed bundle beside the editor's own canvas, so any drift is two different-looking maps on one screen. The condition for putting runtime here is **zero dependencies, vanilla TS**, since whatever this directory imports the embed inherits; ESLint holds it to the embed's own import ban. Anything needing a package belongs in `/lib`.

---

## 5. Project structure

```
/app                      Next.js App Router — dashboard + marketing
  /(marketing)            Public pages, statically rendered
    /page.tsx             Landing
    /for/[platform]       "Map for Webflow" etc. — one per platform
    /pricing
  /(dashboard)
    /maps
    /maps/[id]            Map editor
    /maps/[id]/places
    /maps/[id]/settings
    /account
  /api
    /webhooks/billing     MoR webhook → subscription state
/embed                    Vite build, vanilla TS, ships to CDN
  /src/index.ts
  /src/map.ts
  /src/filters.ts
  /src/search.ts
/lib
  /appwrite               Client + server SDK setup
  /repositories           ALL Appwrite access goes through here
  /geocoding              Provider-agnostic interface
  /snapshot               Publish → static JSON generator
  /validation             Zod schemas, shared by forms + server
/components
  /ui                     HeroUI wrappers, app-specific primitives
  /map                    Editor map canvas (client-only)
  /places                 List, import wizard, review step
/packages/shared          Imported by both targets — types, plus zero-dependency vanilla TS
/functions                Appwrite Functions (geocode queue, snapshot)
```

**Repository pattern is mandatory.** No component or route calls the Appwrite SDK directly. Everything goes through `/lib/repositories`. This keeps the database swappable and keeps query logic testable.

---

## 6. Data model (Appwrite)

Use plain `lat` / `lng` doubles, **not** spatial Point columns. Spatial types exist in Appwrite now, but "find nearest" runs client-side against the published snapshot, so a spatial index buys nothing and constrains self-hosting (geo-queries need MariaDB; MongoDB-backed self-hosted Appwrite doesn't support them).

### `maps`
`userId` · `name` · `slug` (unique) · `style` · `defaultLat` · `defaultLng` · `defaultZoom` · `tagGroups` (JSON) · `fields` (JSON) · `pinIcons` (JSON) · `settings` (JSON) · `appearance` (JSON) · `allowedDomains` (string[]) · `publishedAt` · `snapshotUrl` · ~~`categories`~~ (JSON, retired)

`settings` is the whole map designer: which of the embed's optional controls exist, the results panel's side, placement, width, transparency, blur and corners, what a results row draws, which of MapLibre's own controls are on the map and in which corner, and the embed's five colour tokens. Every field beyond the original booleans is optional in `SnapshotSettings` and absent means what the embed did before it existed — see §0. One writer only (`useEmbedDesign`), because the column is one JSON blob written whole.

`tagGroups` is the map's whole filter vocabulary: `[{id, label, tags: [{id, label, color}]}]`. It absorbed `categories`, which is left in place holding nothing — see §0. Do not drop a column with data in it.

`appearance` is the label level and the layer toggles. Its own column rather than another key
in `settings`, and the reason is mechanical: `settings` means "which of the embed's optional
controls are on", it belongs to the Publish tab's form, and `updateMap` writes it by
serialising the **whole** object — two forms writing one blob is a lost update, and the
appearance controls are on two screens at once. `style` stays where it is: still one choice
from one list, and moving it would orphan every map already saved. It is a `varchar(32)`, so
theme keys stay short.

### `places`
`mapId` · `name` · `lat` · `lng` · `address` · `tags` (string[]) · `fields?` (JSON) · `icon?` · `groupId?` · `description?` · `phone?` · `email?` · `url?` · `hours?` (JSON) · `photoIds?` (string[]) · `photoId?` (retired) · `logoId?` · `sortOrder` · `geocodeConfidence?` · `geocodeStatus` (`ok` | `low` | `failed` | `manual`) · ~~`category`~~ (retired) · `cardBlocks?` (JSON)

`cardBlocks` is how *this* location's card differs from the account's design:
`{ [blockId]: CardBlock }`, a whole resolved block per entry rather than a diff
— see §0. It can change what a block *is* and nothing else; which blocks a card
has, where they sit and in what order stay in `cardDesigns`, one row per account.

`logoId` is this location's own brand mark, as a storage file id — not the image
on the map's custom pin, which is `pinIcons` and is shared by every location
wearing it. A file rather than an inline data URI because a snapshot names it by
URL; see §0.

**`tags` is ordered and the order means something**: the first tag is what colours the pin. Nothing may sort it on the way to storage or to a snapshot.

### `shapes`
`mapId` · `name` · `kind` (`circle` | `polygon` | `line`) · `description?` · `color` · `opacity` · `geometry` (JSON) · `sortOrder`

A row per shape rather than JSON on the map, because a polygon ring is unbounded
text and dragging a vertex would otherwise rewrite the whole map document. `kind`
is the discriminator and lives only in that column; `geometry` holds the payload
alone (`{lng,lat,radius}` or `{points}`), so there is no second copy to disagree
with it. The domain type recombines them into the union in
`packages/shared/shapes.ts`.

### `mapSessions` / `mapDaily`
Visitor analytics, and the only rows in this app written by somebody who is not signed in.
`mapSessions` is one append-only row per *session* (not per event) — `mapId` · `startedAt` ·
`day` · `country` · `city` · `lat` · `lng` · `ip` · `host` · `path` · `referrer` · `device` ·
`events` (JSON) · `eventCount`. `mapDaily` is the rollup a completed day is folded into once
and read from forever after, because Appwrite has no aggregate query and no atomic increment.

Rows carry **no owner permission**: table permissions are empty with `rowSecurity: true`, so
only the admin client reads them, and that client is only ever held by the dashboard. The
write path takes no `RepoContext` and cannot — see the head of
`lib/repositories/analytics.repository.ts` before touching it.

### `subscriptions`
`userId` · `billingCustomerId` · `billingSubscriptionId` · `plan` · `status` · `currentPeriodEnd`

Provider-neutral field names — do not name them after Paddle or Stripe.

### Plan limits
| Plan | Maps | Places/map | Shapes/map | Views |
|---|---|---|---|---|
| Free | 1 | 10 | 3 | unlimited (badge shown) |
| Starter €19 | 3 | 300 | 50 | unlimited |
| Pro €39 | 15 | 3,000 | 250 | unlimited |

Enforce limits **server-side** in repositories, never only in the UI.

---

## 7. Critical implementation notes

**MapLibre cannot server-render.** Always `dynamic(() => import(...), { ssr: false })`. It touches `window` at module load.

**Register the pmtiles protocol once**, at app init, not per component mount.

**Appwrite pagination defaults to 25 documents.** Any place list must use cursor pagination. A 500-place map is 20 requests — batch it in a repository method, don't scatter calls through components.

**Geocoding is provider-agnostic.** `/lib/geocoding` exports one interface; implementations sit behind it. We may swap between hosted providers and a self-hosted Photon instance. Never import a provider SDK outside that folder.

**Never save geocode results silently.** After import, show a review step: results on a map, low-confidence rows flagged, drag-to-fix. Set `geocodeStatus` accordingly.

**Autocomplete is not in v1.** Use search-on-submit — user types a full address, presses enter, picks from 3–5 results. One request instead of ten.

**Domain allowlist** is enforced in the embed against the snapshot's `allowedDomains`. It's anti-abuse, not security — don't pretend otherwise.

**Snapshots are immutable and versioned.** Write to `snapshots/{mapId}/{timestamp}.json`, then update `snapshotUrl`. Never overwrite in place — a half-written file would break live customer sites.

**Tiles:** point at OpenFreeMap's public instance. **This is not a launch blocker and used to be written as though it were.** OpenFreeMap's FAQ permits commercial use in as many words, sets no request limit, and asks for no key — the only thing missing is an SLA ("I don't offer SLA guarantees"). So owning the tiles is insurance against one volunteer-funded service disappearing, not a policy requirement, and it costs about a dollar a month whenever you decide to buy it (`docs/self-hosting-tiles.md`). Move when OpenFreeMap wobbles or when a customer is paying enough that a blank map on their site is unacceptable — not on a date.

**Motion must not run in the embed.** Editor animations only.

---

## 8. UI and copy conventions

HeroUI defaults are the starting point, not the destination. Pick a type pairing and an accent that aren't the stock palette, and keep the rest quiet.

**Folds start shut, and one opens at a time.** Every collapsible run of controls in the app
— both designers' sidebars and the Edit location dialog — goes through `PropertyFolds` or
`FormSectionGroup`, which own that rule and scroll the opened content into view.

**Motion is for feedback, not decoration.** Import success, publish confirmation, pin drop. Respect `prefers-reduced-motion` everywhere. If an animation doesn't tell the user something happened, remove it.

**Copy rules:**
- Name things by what the user controls, never by how the system works. "Locations", not "documents". "Categories", not "enums".
- Active voice on every control. "Publish", "Import places", "Save changes" — never "Submit".
- An action keeps its name through the whole flow: the button says **Publish**, the toast says **Published**.
- Errors state what happened and how to fix it. Not "Something went wrong" — "Couldn't read row 42: no address column found. Map your columns and try again."
- Empty states are invitations to act, with the primary action right there.
- Sentence case. No filler.

**Quality floor, unannounced:** responsive to mobile, visible keyboard focus, reduced motion respected, forms usable with a keyboard alone.

---

## 9. Working conventions

- Server Actions for mutations; Route Handlers only for webhooks and public endpoints.
- Zod schema per feature in `/lib/validation`, used by both React Hook Form and the server action. Never validate only on the client.
- Every Appwrite call is wrapped in a repository method with an explicit return type.
- Appwrite secrets are server-only. The browser SDK gets the public endpoint and project ID, nothing else.
- Feature branches, conventional commits.
- Write tests for: CSV column mapping, geocode result handling, plan-limit enforcement, snapshot generation. Skip tests for UI layout.

---

## 10. Build order

Do not start a phase before the previous one works end to end.

**Week 1 — Skeleton. ✅ Done.** Next.js + Appwrite + auth. Map CRUD. MapLibre canvas rendering OpenFreeMap. Click to drop a pin, persist it, survive a refresh.

**Week 2 — Editor. ✅ Done.** Place list with add/edit/delete. CSV import with column mapping. Geocoding + review step. Categories with colours. Map settings. Photo upload.

**Week 3 — Embed. ✅ Done.** Publish → snapshot generation. Vite embed bundle. Popups, category filters, search, find-nearest, clustering. Embed code generator. Domain allowlist.

One deviation worth knowing: **the embed's search does not geocode.** It filters the places already in the snapshot by name and address. Geocoding a visitor's typed query would be a metered call in the visitor's path, which §2 forbids outright — the geocoder runs at import time and never again. "Find nearest" uses the browser's own geolocation, which is free and more accurate than resolving a typed address anyway.

**Week 4 — Business layer. ← in progress.** Auth (split-screen login/signup, Google OAuth2) and transactional email are **done** — see §0. Still owed: pricing page, plan limits, MoR integration + webhook, landing page, one platform page (Webflow first), docs with screenshots. **Our own geocoding and routing instances belong here too and are the two that are actually forced** — the public Photon and OSRM endpoints both forbid what a paying customer would make us do with them (§12). Own PMTiles on R2 is *not* on this list any more: OpenFreeMap permits commercial use, so that one is insurance to buy when it suits, not a gate to pass.

**Then stop building and go get ten customers.** What they ask for decides Phase 2 — not this file.

---

## 11. Explicitly out of scope for v1

Teams and permissions · public API · **turn-by-turn directions** (a route's line, distance and drive are in — see §0; step-by-step navigation is not, and we link out to a maps app for that) · ~~analytics dashboards~~ (**built anyway, deliberately — §0 records the override and `docs/notes/analytics.md` the reasoning**) · custom styling beyond 3–4 presets · uploaded image/floor-plan maps · mobile apps · white-labelling · multi-language UI · autocomplete · SEO location pages.

Each of these is a week not spent getting a paying customer. If one seems necessary, say why and ask first.

--- 

## 12. Known constraints

- **Vercel Hobby prohibits commercial use** and caps cron at once daily. Use Vercel Pro or self-host.
- **Google Maps is not an option anywhere in this codebase.** Their terms forbid storing business names and addresses, cap coordinate caching at 30 days, and require Places results to be shown on a Google map. Our model breaks all three.
- **Nominatim's public API forbids autocomplete and bulk use.** If we self-host geocoding, use Photon (prebuilt GraphHopper dumps, runs as a separate service on its own VPS — it is not loaded into Appwrite).
- **A licence and a demo server's usage policy are different things, and confusing them has cost time.** Every component of this stack — OSM data (ODbL), OpenFreeMap, OSRM (BSD-2), MapLibre and PMTiles (BSD-3/MIT) — permits commercial use outright, and nothing here has ever claimed otherwise. What is restricted is running production traffic through the free *demo endpoints* those projects host. Verified September 2026, and the three do not have the same answer:

  | Service | Public endpoint | Commercial traffic on it |
  |---|---|---|
  | Tiles — OpenFreeMap | `tiles.openfreemap.org` | **Allowed.** No keys, no request limit, no SLA. |
  | Geocoding — Photon | `photon.komoot.io` | **No.** "Extensive usage will be throttled or completely banned" — a CSV import is extensive usage. |
  | Routing — OSRM | `router.project-osrm.org` | **No.** Reselling forbidden, ~1 req/s, withdrawable without notice. |

  So the order before charging anyone is **geocoding first, routing with it, tiles when it suits** — not the other way round, which is how §10 used to read. Only tiles are in a visitor's path, which is why only they are forced to be flat-cost (§2); the other two run once, on the dashboard, when an owner imports or draws. Each has a runbook: `docs/self-hosting-geocoding.md`, `docs/self-hosting-routing.md`, `docs/self-hosting-tiles.md`.
- **Geoapify is the hosted answer to the two forced ones, and the property that decided it is storage.** `GEOCODER_PROVIDER=geoapify` and `ROUTING_PROVIDER=geoapify` move geocoding and routing off the demo endpoints without a VPS. What makes it usable *here* specifically is that it permits results to be stored and redistributed: this app writes a geocode onto the row and bakes a route's geometry into a static snapshot that customer sites read forever (§7), which Google's terms forbid outright and Mapbox's published terms decline to answer — the same trap this section already records for Google Maps. Two consequences to keep in view. **Geoapify attribution is mandatory on the free plan**, and a route drawn on it is published onto a customer's site, so a paid plan (or the credit) is owed before routes reach a customer; OpenStreetMap attribution is unchanged and already carried by every rendered map. And **their map tiles are not an option** — tiles are the one part of this stack in a visitor's path, so a metered tile host is exactly what §2 exists to forbid. Basemaps stay on OpenFreeMap. Self-hosting stays in the tree and stays reachable: Photon and OSRM are still what an unset switch builds.
- **OpenStreetMap's ODbL is copyleft on databases.** Rendering and displaying places is fine. Offering customers a bulk export of OSM-derived data may trigger share-alike. Flag before building any export feature.
- Attribution for OpenStreetMap and the tile provider must be visible on every rendered map, including the embed. Non-negotiable.

---

## 13. When in doubt

1. Does this put a metered call in the visitor's path? → Don't.
2. Does this add weight to the embed bundle? → Justify it.
3. Is this in the §11 out-of-scope list? → Ask first.
4. Does this get us closer to a stranger paying us? → If not, deprioritise it.

## Reminders

- Use REST patterns, avoid server actions where ever possible
- When building components always make them mobile friendly
- Dont build large components, divide large components into smaller peases and create folder inside /components folder for grouping
- If you need to login in chrom use these cridencials email: Daktaras@gmail.com, password: Daktaras123
---

## Maintaining this file

This file is loaded in full at the start of every session, so its length is a tax on every
piece of work done in this repo. It reached 1,830 lines once, growing by about 200 lines a
commit, and the §0 design journal was 80% of it.

**What belongs here:** the spec (§1–§13), rules that apply across areas, commands,
environment, and the pointer table.

**What does not:** the reasoning behind one feature, a bug post-mortem, a browser
measurement, a record of what a control used to look like. That goes to
`docs/notes/<area>.md` — as one line in that file's Invariants list, plus the prose under
it. Those files are not loaded into context and can be as long as they need to be.

Add a line here only when the rule is genuinely cross-cutting: something a person working
in an area they know well could still get wrong. Everything else has a home.
