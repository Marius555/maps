# Moving geocoding onto an instance we own

Imports geocode against the public Photon instance at `photon.komoot.io` today.
That is a development convenience with an expiry date, and this is the part that
costs money and a machine, written down while the reasoning is fresh rather than
on the day it is needed under pressure.

Third of three, after `self-hosting-routing.md` and `self-hosting-tiles.md`. It
was the last written and is the **most urgent of the three**, which is worth
saying plainly because the ordering in CLAUDE.md used to imply the opposite.

## Read this first: there is now a switch

`GEOCODER_PROVIDER=geoapify`, with `GEOAPIFY_API_KEY` set, moves geocoding onto
Geoapify and settles the urgency above without a machine. `lib/geocoding/geoapify.ts`
sits behind the same `GeocodeProvider` this document's plan was always going to
need, so the choice is one environment variable in either direction.

Why it is allowed where the public Photon instance is not: Geoapify sells the
service, permits commercial use, and — the part that actually decides it —
permits results to be **stored**. This app writes a geocode onto the row and
never asks again, which is what §2 requires and what Google's terms forbid.
OpenStreetMap attribution is required and already carried by every rendered map;
Geoapify's own attribution is required on the free tier.

Everything below still applies, and is not obsolete. It is what to do when
Geoapify's pricing stops working, when a customer's data cannot leave the
premises, or when import volume makes a fixed monthly VPS cheaper than credits.
Photon remains what an unset `GEOCODER_PROVIDER` builds.

One thing the swap gives up, worth knowing before choosing: `reverse-select.ts`
and its 538 lines of tests exist because Photon publishes a bounding box per
feature and never a polygon, and the Geoapify adapter does not use them — it
reads the per-feature `distance` Photon lacks. The two judgements that were ours
rather than Photon's are kept (the 300m past which nothing found is an answer
about this pin, and the basemap's own road centreline as the tiebreak), but the
quality of a dropped-pin address is a thing to compare side by side rather than
assume.

## When to do this

**Before the first paying customer**, alongside routing. Photon's own README is
the whole argument:

> You are welcome to use the API for your project as long as the number of
> requests stay in a reasonable limit. Extensive usage will be throttled or
> completely banned.

and

> We do not give guarantees for availability and reserve the right to implement
> changes without notice.

A 400-row CSV import is extensive usage by any reading. This is the same trap
§12 records for Nominatim and the same one `self-hosting-routing.md` records for
the OSRM demo server, and it has the same answer.

Note what it is **not**: a §2 problem. The geocoder runs at import time and at
pin-drop, never on a page a visitor loads — a published snapshot carries
coordinates, so a customer's visitors never touch a geocoder however many of them
there are. The exposure is entirely on the dashboard side.

## Why this one first

Of the three services, this is the one whose failure costs the most.

| | What stops working |
|---|---|
| Tiles | Every embedded map goes blank at once — but OpenFreeMap **permits commercial use** and has no request limit, so this is an availability risk, not a policy one. |
| Routing | One drawing tool. Published routes keep working; their geometry is baked. |
| **Geocoding** | **Import.** Step 3 of §1's five-step core loop, and the only way a customer gets 400 locations onto a map. |

A banned geocoder does not degrade the product, it removes the reason someone
signed up.

## What breaks if it goes away

Nothing published, and nothing a visitor sees. Specifically:

- **Import** — the addresses step, which is where a CSV becomes coordinates.
- **Pin-drop and pin-drag addresses** — the reverse lookup that names a location
  the owner placed by hand (`geocode/reverse`).
- **Search-on-submit** in the location form.

Rows already geocoded are untouched: coordinates and address parts are stored on
the row, so a map that is already built keeps working and can still be published.
Unlike `NEXT_PUBLIC_TILES_URL`, there is **no migration** here and none is wanted.

## Sizing

Photon 1.0 is OpenSearch-backed and needs **Java 21 or newer** — a hard
requirement introduced in that release, not a recommendation.

| | Planet | One country |
|---|---|---|
| Index on disk | ~95GB (2026; grows ~10%/year) | a small fraction of it |
| Disk if you want updates | ~190GB — the index is rebuilt beside itself | proportionally less |
| RAM | 64GB recommended | 8–16GB is comfortable |
| Storage | SSD at minimum, NVMe preferred | same |

**Start with the countries your customers are in.** Launch does not need the
planet, and a country extract is the difference between a €20/month box and a
€60–120/month one. GraphHopper publishes both — take the **prebuilt dump** rather
than importing from Nominatim yourself; building the index is a day of machine
time to reproduce a file that is already published.

**Sharing a box with routing is the cheap arrangement.** Photon planet (64GB) and
Valhalla planet (~32GB) fit together on one 128GB machine, which is one bill
instead of two for the two services that must move at the same moment. See
`self-hosting-routing.md` for why Valhalla rather than OSRM at planet scale.

## Switching

```bash
GEOCODER_URL=https://geocoding.example.com
GEOCODER_MIN_INTERVAL_MS=0        # your own box; the 1000ms default is courtesy
GEOCODER_USER_AGENT="custom-map-builder/1.0"
```

All three are server-only and all three are defaulted, so unset means today's
behaviour. **No code changes** — the self-hosted API is byte-identical to the
public one, which is the entire reason `lib/geocoding/photon.ts` was written
against Photon rather than against something with a nicer response shape.

`GEOCODER_MIN_INTERVAL_MS` genuinely accepts `0` (`readInterval` in `photon.ts`,
asserted in `throttle.test.ts`). Dropping it is most of the speed-up: the default
paces request *starts* a second apart out of courtesy to a shared instance, and
on your own hardware a 400-row import goes from seven minutes to seconds.

Nothing in the embed changes, because the embed has never heard of geocoding.

## Running it

```bash
# One country. Swap the extract for planet-latest when you need the world.
wget https://download1.graphhopper.com/public/extracts/by-country-code/lt/photon-db-lt-latest.tar.bz2
pbzip2 -d photon-db-lt-latest.tar.bz2 && tar xf photon-db-lt-latest.tar

java -jar photon.jar -listen-ip 0.0.0.0 -listen-port 2322
```

Check the flags in Photon's own README before running it — the storage and
OpenSearch options are the ones that decide whether it starts at all, and they
change between releases.

**Put it behind TLS and a firewall that only admits our server.** The endpoint
answers anybody who can reach it, and an open one is somebody else's free
geocoding service. Same warning `self-hosting-routing.md` gives, for the same
reason.

## Verify

Do all of these. The first two are the contract `lib/geocoding/photon.ts` reads;
the rest fail quietly in production if you skip them.

- [ ] **Forward search returns candidates with an `extent`.**

      ```bash
      curl "http://localhost:2322/api?q=Gedimino+pr+9,+Vilnius&limit=5"
      ```

      You want a `features` array whose properties carry `extent`, `osm_key`
      and `osm_value`. `confidenceFor` reads the ranking and `reverse-select.ts`
      reads the extent; a build missing them scores every result the same.

- [ ] **Reverse returns something at a dropped pin.**

      ```bash
      curl "http://localhost:2322/reverse?lat=54.687&lon=25.28"
      ```

- [ ] **A pin on a street resolves to the street, not the building behind it.**
      This is what `reverse-select.ts` exists for and what the bounding-box
      ambiguity in `photon-reverse-cannot-resolve-street-vs-building` is about.
      Drop a pin on a road in the editor and read the address it fills in.

- [ ] **An import end to end**, on a real CSV, with `GEOCODER_MIN_INTERVAL_MS=0`.
      This is the thing the whole document is for.

- [ ] **A non-Latin and an accented query.** `detect/synonyms.ts` folds accents
      for column names; the geocoder is a separate index and its own answer.

- [ ] **The 403 path.** Stop the service and confirm an import fails with
      "Couldn't reach the geocoding service" rather than a 500. A geocoder that
      is down and a geocoder that is refusing us must not look the same, which is
      why `GEOCODER_USER_AGENT` exists in the first place.

## Rolling back

Unset `GEOCODER_URL` and redeploy. Nothing stored moves and nothing published
changes, because a geocode result is written onto its row at import time and
never consulted again. That makes this the most reversible of the three
switches — unlike tiles, there is no snapshot to migrate, and unlike routing
there is no geometry whose meaning depends on which engine produced it.
