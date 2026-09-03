# Moving the basemap onto tiles we own

Everything in the app is ready for this. What follows is the part that costs money
and a machine, written down while the reasoning was fresh rather than on the day it
is needed under pressure.

## When to do this

Not yet, unless one of these is true:

- **You have a paying customer.** CLAUDE.md §7 draws the line here, and it is the
  right line: a public instance carries no uptime guarantee, and a customer paying
  a flat fee for an embed on their own site is owed one.
- **OpenFreeMap has wobbled.** It is funded by donations and run by one person. If
  it stops, every embedded map on every customer site goes blank at the same moment
  and nothing in the console says why.

Until then this buys nothing a customer can see. Owning the tiles is insurance, not
a feature — the flat-price advantage over Atlist comes from not paying per view,
and OpenFreeMap already costs €0.

## What it costs

| | |
|---|---|
| R2 storage, ~80GB planet + 414MB assets | **~$1.05/month** (first 10GB free, then $0.015/GB) |
| R2 reads | free to 10M class B ops/month ≈ 300k map loads, then $0.36/M |
| R2 egress | **$0** — the reason this is R2 and not S3 |
| Domain + Cloudflare DNS | ~€10/year; DNS is free |
| Building the tiles | ~€5–8 of VM rental per build, and only when you want fresher OSM data |

For contrast, a competitor on Google Maps pays roughly $7 per 1,000 map loads. A
customer at 50k views/month costs them ~$350 and costs us about a dollar.

## Before you start

1. A domain, with its zone on Cloudflare. **The built-in `pub-*.r2.dev` URL is not
   an option** — Cloudflare rate-limits it and documents it as unsuitable for
   production. A custom domain on the bucket is what makes it a CDN.
2. A Cloudflare account with R2 enabled.
3. `rclone` configured against R2, or `wrangler`. `rclone` handles an 80GB
   multipart upload better.

---

## 1. The bucket

Create an R2 bucket (`tiles`), then attach a custom domain to it —
`tiles.<yourdomain>` — from the bucket's **Settings → Public access → Custom
domains**. That is what puts Cloudflare's CDN in front of it and gives you a stable
public origin.

Check range requests before anything else depends on them. PMTiles is read entirely
by ranged GETs, so this is not optional:

```sh
curl -r 0-99 -sI https://tiles.<yourdomain>/planet.pmtiles | head -5
```

You want `HTTP/2 206` and a `Content-Range` header. A `200` means the whole file is
coming back and the map will try to download 80GB.

## 2. Build the planet

**Keep the OpenMapTiles schema.** Use [planetiler](https://github.com/onthegomap/planetiler),
which writes OMT-schema `.pmtiles` directly. Protomaps' prebuilt daily basemap is
the tempting shortcut and ships a *different* schema: every `source-layer` match in
`packages/shared/style-layers.ts` (`place`, `aerodrome_label`, `poi`,
`transportation`, `building`, and the `class: "path"` / `subclass: "cycleway"`
special case) is written against OMT, so switching means rewriting all five style
documents, `style-layers.ts`, and re-tuning sixteen themes against
`lib/map/themes.test.ts`. Days of work to save the ~€3 planetiler costs.

**The 80GB never touches your machine.** Rent a box, build there, upload from
there. Something like a Hetzner Cloud CCX63 (48 vCPU, 192GB RAM, ~1TB disk) at
roughly €0.50/hour, destroyed when the run finishes — about €3 for a ~4 hour build.
You need ~300GB free: the planet `.osm.pbf` (~80GB), planetiler's temporary node
map, and the ~80GB output.

Java 21 or newer. Then, roughly:

```sh
wget https://github.com/onthegomap/planetiler/releases/latest/download/planetiler.jar
java -Xmx100g -jar planetiler.jar --download --area=planet --output=planet.pmtiles
```

Check planetiler's own README for the current flags before running it — the
storage and node-map options are the ones that decide whether it finishes in four
hours or overnight, and they change between releases. On a machine with less RAM,
its `--storage=mmap` path plus a fast NVMe is the documented fallback.

Then upload:

```sh
rclone copy planet.pmtiles r2:tiles/ --progress
```

## 3. The assets and the styles

A basemap is not only tiles. Fonts, sprites and the Natural Earth raster all live on
the tile host too, and leaving them behind does not remove the dependency — it hides
it. A style whose fonts are on someone else's server renders a map with no labels
the day that server stops.

```sh
npm run mirror:tile-assets
```

Downloads 768 glyph ranges (102MB), 4 sprite files, and 5,461 Natural Earth tiles
(312MB) into `public/tiles/`. About 414MB and a few minutes. It is resumable — it
skips anything already on disk — so an interrupted run continues rather than
replaying every request. `--dry-run` prints the plan without fetching;
`--only=fonts|sprites|raster` narrows it.

Then generate our own copies of the five style documents, pointed at the bucket:

```sh
npm run build:tile-styles -- https://tiles.<yourdomain>
```

It fails loudly if any style still names `openfreemap.org` anywhere, which is the
guard for upstream adding an asset class the transform has never seen.

Upload the lot:

```sh
rclone copy public/tiles/ r2:tiles/ --progress
```

Content types matter: `.json` must serve as `application/json` and `.pbf` as
`application/x-protobuf`. `rclone` usually gets this right from the extension;
check one of each after uploading.

## 4. Flip the switch

```
NEXT_PUBLIC_TILES_URL=https://tiles.<yourdomain>
```

Then redeploy. That one variable moves `STYLE_URLS` and the attribution together —
the credit becomes OpenStreetMap + OpenMapTiles instead of OpenStreetMap +
OpenFreeMap, on the map *and* on exported PNGs and PDFs, because both come from the
same pair in `lib/map/style.ts`.

## 5. Move the maps that are already published

**This is the step that is easy to forget and decides whether any of it took
effect.** `styleUrl` is resolved at publish time and baked into each snapshot —
that is exactly what makes changing hosts a republish rather than a redeploy of
every customer's embed. It also means the variable moves *new* publishes only.
Every map already live on a customer's site keeps fetching OpenFreeMap forever.

```sh
npm run migrate:style-host -- --dry-run   # look first
npm run migrate:style-host
```

Do the dry run every time. These files are what real visitors on real customer
sites are fetching right now, and it prints exactly which maps would move and to
what, writing nothing.

The real run fetches every style URL it is about to write *before* it rewrites
anything, so a missing upload fails the run instead of pointing live customer maps
at a 404. It writes a fresh archive alongside each rewritten live file, so §7's
"every published state is recoverable" still holds. It is idempotent: a snapshot
already on the target is skipped, and one whose URL names no basemap we know is
reported rather than guessed at.

---

## Verify

Do all of these. Each one fails silently in production if you skip it.

- [ ] **All sixteen themes against real tiles.** `lib/map/themes.test.ts` covers the
      maths; only a tile proves the schema matched. Open the appearance panel and
      step through every one.
- [ ] **The cycleway toggle.** OpenMapTiles files a cycleway as `class: "path"` with
      `subclass: "cycleway"`, and `packages/shared/style-layers.ts` *adds* a layer
      for it rather than revealing one. That `subclass` was verified present in a
      live OpenFreeMap tile before the switch was built; planetiler's output has to
      be checked the same way. A switch that does nothing is worse than no switch.
- [ ] **Attribution on a published embed**, not just in the dashboard. This is the
      §12 line. The embed deliberately does not pass `snapshot.attribution` to
      MapLibre — the credit comes from the tile source — so this is the check that
      the two guards (`Protocol({ metadata: true })` and the `attribution` on the
      style's vector source) actually did their job.
- [ ] **Labels at every zoom.** A glyph range that failed to mirror makes text
      vanish somewhere with nothing in the console.
- [ ] **POI icons.** Same failure mode, for the sprite.
- [ ] **Range requests:** `curl -r 0-99 -sI …/planet.pmtiles` returns `206`.
- [ ] **`cf-cache-status`** on a tile read. See below.
- [ ] **A map published before the switch**, after the migration, loading from the
      new host.

## About caching, before you add anything

Cloudflare will not edge-cache a single 80GB object — the limit is 512MB on
Free/Pro — so range reads go to R2 directly. R2 gives 10M class B ops/month free
(≈300k map loads) and $0.36/M after, so this is cheap either way, but it is worth
measuring rather than assuming.

The standard fix is Protomaps' Cloudflare Worker, which turns range reads into
cacheable `/{z}/{x}/{y}.mvt` responses. **Do not reach for it first.** It is a
metered call in every visitor's path, which CLAUDE.md §2 forbids and §13 says to
flag rather than implement. Measure `cf-cache-status` and tile latency on a real
map, and only then decide — with numbers, and knowing what rule you are bending.

## Rolling back

Unset `NEXT_PUBLIC_TILES_URL`, redeploy, and run `npm run migrate:style-host`
again. The migration reads each snapshot's *current* basemap out of its own URL
rather than matching a table of old ones, so it runs in both directions with no
extra argument: with the variable unset it walks everything back to OpenFreeMap,
credit included. Nothing here is one-way, which is the point — a switch you cannot
reverse is one nobody dares make.

The bucket can stay where it is while you work out what went wrong. Storage is
about a dollar a month and no visitor is reading it once the snapshots have moved.
