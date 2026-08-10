@AGENTS.md

# CLAUDE.md

Project instructions. Read this fully before writing code.

---

## 0. Where the code actually is

**Weeks 1–3 of §10 are done.** On disk, of §5's layout: `/app`, `/lib`, `/components`, `/scripts`, `/embed`, `/packages/shared` exist. Still absent, and correctly so — they belong to Week 4: `/functions`, and `/app/(marketing)/for/[platform]` + `/pricing`.

What works end to end: email auth, map CRUD, the MapLibre editor (click or drag pins, save the current view as the default), the locations list with search and category filter, per-location editing with search-on-submit geocoding and photo upload, categories with colours, map settings, CSV import with column mapping → geocoding → a drag-to-fix review step → bulk insert, **publish → static snapshot, the embed bundle (clustering, popups, category filters, client-side search, find-nearest), the one-line embed snippet, and the domain allowlist**.

Not built yet, and next: everything in Week 4 — pricing page, plan-limit UI, MoR billing + webhook, our own PMTiles on R2, landing page, one platform page, docs, transactional email.

Installed since the original scaffold: `zod`, `@tanstack/react-query`, `zustand`, `papaparse`, `date-fns`, `vitest`, `vite`.
Still not installed, from §3's "Add these": biome, playwright, sentry, posthog, resend.

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

Tests are `vitest` (`vitest.config.mts`), unit only, `lib/**/*.test.ts`. Single file: `npx vitest run lib/csv/column-mapping.test.ts`. Covered per §9: CSV column mapping, geocode result handling, plan-limit enforcement. Snapshot generation is untested because it doesn't exist yet — add it with Week 3. `server-only` is aliased to a stub (`lib/test/server-only-stub.ts`) so repositories can be tested; the real guard still applies to every Next build.

### Stack specifics that change how you write code

- **Next.js 16.3.** Breaking changes against older App Router knowledge — read `node_modules/next/dist/docs/` before writing route, layout, or caching code (AGENTS.md says the same). Typed route props are globals: `LayoutProps<"/">`, `PageProps<"/maps/[id]">`. Don't hand-write `params` types; `app/layout.tsx` already uses the global form.
- **Tailwind v4, CSS-first.** There is no `tailwind.config.js` and none should be added. `app/globals.css` does `@import "tailwindcss"` then `@import "@heroui/styles"`; the theme is oklch CSS variables under `:root/.light` and `.dark`. Restyle by editing those variables, not by hardcoding colours in components.
- **HeroUI v3** is React Aria under the hood and has a different API from v2. Don't write v2 component code from memory. One consequence bites hard: React Aria owns an input's value, so react-hook-form's `register()` **silently does not work** — a prefilled form renders blank and then saves the blanks. Always bind through `components/ui/form-field.tsx` (`FormTextField` / `FormTextArea`), which wire `Controller` to the TextField's own `value`/`onChange`. The same ownership bites a second way: `usePress` — every HeroUI `Button` — ends its `onPointerDown` with `stopPropagation()`, and React dispatches synthetic events from its root, so **a pointer handler on a wrapper around a Button never fires in the bubble phase**. It fails silently, with no error. Bind it as `onPointerDownCapture` instead; `components/map/add-location/use-drag-to-add.ts` is the working example.
- **MapLibre's worker must be told where it lives.** MapLibre v6 derives its worker URL from `import.meta.url`, bails to `""` when that isn't an http(s) URL (which it isn't under Turbopack), and then constructs `new Worker("")` — loading the HTML page as the worker script. The worker never replies, and because vector tiles are fetched *inside* the worker, every map renders as an empty background with **no error in the console**. `scripts/copy-maplibre-worker.mjs` (via `predev`/`prebuild`) copies the worker into `public/maplibre/`, and `lib/map/worker.ts` sets `config.WORKER_URL`. A blank basemap? Check `public/maplibre/` exists before anything else.
- **The embed is an ES module, and that is forced.** MapLibre v6 ships ESM only — no UMD, no CSP build. So the snippet is `<script type="module">`, `document.currentScript` is always null (the boot code finds its script tag by `[data-snapshot]` instead), and both `/embed` and `/maplibre` need CORS headers, because module scripts and MapLibre's cross-origin worker blob are both CORS fetches. `next.config.ts` sets them.
- **MapLibre is external to the embed bundle, deliberately.** Bundling it inlines `maplibre-gl-shared.mjs`, and the worker then downloads its own copy of the same 131KB chunk — measured at 424KB gzipped total. Shipping MapLibre's dist files beside `map.js` lets the main thread and the worker share one URL: 296KB. Don't "simplify" this by removing `external` from `embed/vite.config.mts`.
- **§4's 250KB budget is not reachable and the check knows it.** MapLibre v6 alone is 273.2KB gzipped. `scripts/check-embed-size.mjs` therefore budgets *our* code (40KB, currently 22.8KB) and puts a 320KB ceiling on the total to catch the duplication regression above. See §4.
- **Snapshots are written twice per publish.** An immutable timestamped archive, plus one live file at a fixed id that the embed actually reads. The embed's URL has to be stable across republishes or every customer would re-paste their snippet, and §2 forbids asking us which snapshot is current. `lib/snapshot/storage.ts` explains the delete-then-create window and why the embed retries once.
- Vendored skills in `.agents/skills/`, pinned by `skills-lock.json`: `heroui-react`, `appwrite-typescript`, `next-cache-components-optimizer`. Use them instead of recalling API shapes.

### Environment

`.env` is gitignored and there is no `.env.example`. Names in use:

- Browser-safe: `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT_ID`, `NEXT_PUBLIC_APPWRITE_PROJECT_NAME`
- Server-only: `APPWRITE_API_KEY`, `DATABASE_ID`, `STORAGE_ID` — unprefixed deliberately. These must never reach a client component or the embed bundle (§9).
- Optional, all server-only, all defaulted: `GEOCODER_URL` (defaults to the public Photon instance), `GEOCODER_MIN_INTERVAL_MS` (defaults to 1000, and now spaces request *starts* rather than waiting for each round trip to finish — see `lib/geocoding/throttle.ts`) and `GEOCODER_USER_AGENT`. Point the first at a self-hosted Photon and lower the second before any real import volume. The third exists because public OSM-derived services block unidentified clients and Node's default UA is exactly that: a 403 from a WAF is otherwise indistinguishable from the service being down, and both arrive as a 502.
- Optional, server-only: `SNAPSHOT_STORAGE_ID`, defaulting to `STORAGE_ID`. **Appwrite Cloud's free plan allows one bucket per project**, so published snapshots share the assets bucket, which is why `json` is in its allowed extensions. On a paid plan, point this at a dedicated bucket and add a second entry to `BUCKETS` in `scripts/appwrite-schema.mjs`; nothing else changes.
- Optional, browser-safe: `NEXT_PUBLIC_EMBED_SCRIPT_URL`. Set it to the CDN origin in production. Unset, the embed snippet points at the dashboard's own origin, which is what makes development and self-hosting work with no config.

`STORAGE_ID` never reaches the browser: photo URLs are composed on the server in `lib/storage/photo-url.ts` and handed to clients as `place.photoUrl`. If you need a bucket id in a component, that's the signal you're building it in the wrong layer.

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

**Measured, that target is unreachable with MapLibre v6** — its own dist files are 273.2KB gzipped (`maplibre-gl.mjs` 136.4 + `maplibre-gl-shared.mjs` 131.0 + the worker 5.8), minified already, with no slim build. Actual total is **296KB**, of which ours is 22.8KB. `npm run build:embed` enforces a 40KB budget on our code and a 320KB ceiling on the total; it does not pretend 250KB is achievable. Getting under 250KB means changing the map library, which is a §3 decision — raise it rather than shaving our 22.8KB.

`/packages/shared` is the **only** directory both targets may import from. `@/lib`, `@/components` and `@/app` are closed to the embed, and `eslint.config.mjs` enforces both halves of that.

It started type-only. It now also holds a little runtime — `color.ts`, `darken-style.ts`, `load-style.ts` — because the editor and the embed must run *the same* dark-basemap transform, not two that agree today: the preview panel renders the real embed bundle beside the editor's own canvas, so any drift is two differently-coloured maps on one screen. The condition for putting runtime here is **zero dependencies, vanilla TS**, since whatever this directory imports the embed inherits. ESLint holds `/packages/shared` to the embed's own import ban for exactly that reason. Anything needing a package belongs in `/lib`.

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
`userId` · `name` · `slug` (unique) · `style` · `defaultLat` · `defaultLng` · `defaultZoom` · `categories` (JSON) · `settings` (JSON) · `allowedDomains` (string[]) · `publishedAt` · `snapshotUrl`

### `places`
`mapId` · `name` · `lat` · `lng` · `address` · `category` · `description?` · `phone?` · `email?` · `url?` · `hours?` (JSON) · `photoId?` · `sortOrder` · `geocodeConfidence?` · `geocodeStatus` (`ok` | `low` | `failed` | `manual`)

### `subscriptions`
`userId` · `billingCustomerId` · `billingSubscriptionId` · `plan` · `status` · `currentPeriodEnd`

Provider-neutral field names — do not name them after Paddle or Stripe.

### Plan limits
| Plan | Maps | Places/map | Views |
|---|---|---|---|
| Free | 1 | 10 | unlimited (badge shown) |
| Starter €19 | 3 | 300 | unlimited |
| Pro €39 | 15 | 3,000 | unlimited |

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

**Tiles:** point at OpenFreeMap's public instance in development. Before any paying customer, switch to our own PMTiles extract on Cloudflare R2. Public instances carry no uptime guarantee.

**Motion must not run in the embed.** Editor animations only.

---

## 8. UI and copy conventions

HeroUI defaults are the starting point, not the destination. Pick a type pairing and an accent that aren't the stock palette, and keep the rest quiet.

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

**Week 4 — Business layer. ← next.** Pricing page, plan limits, MoR integration + webhook, own PMTiles on R2, landing page, one platform page (Webflow first), docs with screenshots, transactional email.

**Then stop building and go get ten customers.** What they ask for decides Phase 2 — not this file.

---

## 11. Explicitly out of scope for v1

Teams and permissions · public API · routing/directions (link out to Google Maps) · analytics dashboards · custom styling beyond 3–4 presets · uploaded image/floor-plan maps · mobile apps · white-labelling · multi-language UI · autocomplete · SEO location pages.

Each of these is a week not spent getting a paying customer. If one seems necessary, say why and ask first.

---

## 12. Known constraints

- **Vercel Hobby prohibits commercial use** and caps cron at once daily. Use Vercel Pro or self-host.
- **Google Maps is not an option anywhere in this codebase.** Their terms forbid storing business names and addresses, cap coordinate caching at 30 days, and require Places results to be shown on a Google map. Our model breaks all three.
- **Nominatim's public API forbids autocomplete and bulk use.** If we self-host geocoding, use Photon (prebuilt GraphHopper dumps, runs as a separate service on its own VPS — it is not loaded into Appwrite).
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