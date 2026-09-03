# Moving routing onto an engine we own

Routes work today against the public OSRM demo server. That is a development
convenience with an expiry date, and this is the part that costs money and a
machine, written down while the reasoning is fresh rather than on the day it is
needed under pressure.

## Read this first: there is now a switch

`ROUTING_PROVIDER=geoapify`, with `GEOAPIFY_API_KEY` set, moves routing onto
Geoapify and settles the deadline below without a machine.
`lib/routing/geoapify.ts` sits behind the same `RouteProvider` this document
already describes a second adapter arriving through, so the choice is one
environment variable in either direction.

Why it is allowed where the OSRM demo server is not: Geoapify sells the service,
permits commercial use, and permits results to be **stored and redistributed** —
which is the property that matters here, because a route's geometry is baked into
a published snapshot that customer sites read forever.

Three things about that adapter are worth knowing before choosing it:

- **The geometry is a `MultiLineString`**, one LineString per leg with the joint
  coordinate repeated. `flattenLegs` joins them and drops the repeats; a genuine
  gap between legs is kept rather than closed.
- **There is no `nearest` service.** The routability probe asks the reverse
  geocoder for the nearest *street* instead. That is a slightly different question
  from "nearest edge in the routing graph" — an unnamed service road is in one
  index and not the other — and it is acceptable only because
  `ROUTE_SNAP_MAX_DISTANCE_M` is deliberately generous.
- **No stop is ever named as unreachable.** OSRM says which coordinate it could
  not attach to a road, in prose; Geoapify documents no equivalent, so
  `unreachableStop` is always null and the caller falls back to a message about
  the route. The probe is what prevents the case in the first place.

And one thing that is owed rather than optional: **Geoapify attribution is
mandatory on the free tier**, and a route drawn on it is published onto a
customer's site. Decide the plan before routes reach a customer. OpenStreetMap
attribution is unchanged and non-negotiable either way.

Everything below still applies. It is what to do when that pricing stops working
or a customer's traffic cannot leave the premises, and OSRM remains what an unset
`ROUTING_PROVIDER` builds.

## When to do this

**Before the first paying customer**, and there is no wriggle room in that. The
OSRM demo server's own usage policy says, in as many words:

- roughly **1 request per second**, and no quality or uptime guarantee;
- a **valid identifying User-Agent** is required (we send one — see
  `DEFAULT_USER_AGENT` in `lib/routing/osrm.ts`);
- **reselling access is forbidden**;
- access "shall be withdrawn at any time and without giving a reason", with
  commercial users warned they "may no longer be able to serve your paying
  customers".

This is the same trap CLAUDE.md §12 records for Nominatim, and it has the same
answer. Note what it is *not*: a §2 problem. A published route makes no request
at all — the geometry is baked into the snapshot at edit time, so a customer's
visitors never touch a routing engine however many of them there are. The
exposure is entirely on the dashboard side, where the owner draws or recalculates.

## What breaks if it goes away

Nothing that is already published. Every live map keeps drawing the routes it was
published with, because they are plain coordinates in a static file. What stops
working is *drawing a new route* and *Recalculate*, which surface as a 502 with
"Couldn't reach the routing service" (`lib/api/router-errors.ts`).

That is a real mercy in a way the geocoder is not: a broken geocoder blocks
imports, a broken router blocks one drawing tool.

## Which engine

Two candidates. The choice is really about how much of the world you need.

### OSRM

What the adapter is already written against, so switching to it is one
environment variable and no code.

The cost is memory, and it is steep. OSRM loads its whole graph:

| Coverage | RAM to *build* | RAM at runtime |
|---|---|---|
| A US state / small country (MLD) | ~8–16GB | ~1–3GB |
| A large European country | ~32GB+ | ~8–16GB |
| Planet | **>128GB** | ~35–55GB |

And a second, easily-missed cost: **OSRM runs one process per profile.** Car,
bike and foot are three separate builds and three separate servers. That is why
the app offers car alone today — the demo server serves driving and 400s on the
rest, and a control that fails against the configured engine is a broken control.

Use OSRM if your customers are in one country. A €40/month VPS routes a whole
European country comfortably.

### Valhalla

Tile-based rather than graph-in-memory, which changes the economics entirely:

| | |
|---|---|
| Planet RAM | **~4–8GB** |
| Planet disk | ~100GB |
| Profiles | car, bike, foot, and more — **one instance** |

If you need worldwide coverage, this is the one. It is not API-compatible with
OSRM, so it needs a sibling to `lib/routing/osrm.ts` — a `valhalla.ts` exporting
`createValhallaProvider` behind the same `RouteProvider` interface, and one line
changed in `lib/routing/index.ts`. That interface exists for exactly this
(CLAUDE.md §7: never import a provider outside its folder).

Valhalla's `/route` returns an encoded polyline at precision 6 rather than
GeoJSON, so that adapter *does* need the decoder this one deliberately skipped —
about twenty lines, and worth testing in isolation the way `toRouteResult` is.

**Recommendation:** OSRM on one country until a customer needs otherwise, then
Valhalla. Do not build a planet-wide OSRM; the machine that builds it costs more
than the year of routing it serves.

## Switching

```bash
ROUTING_URL=https://routing.example.com
ROUTING_MIN_INTERVAL_MS=50        # your own box; the 1000ms default is courtesy
ROUTING_USER_AGENT="custom-map-builder/1.0"
```

All three are server-only and all three are defaulted, so unset means the current
development behaviour. There is no client-side change and nothing to redeploy in
the embed, because the embed has never heard of routing.

**Already-published routes do not move**, and do not need to: their geometry is
baked. Unlike `NEXT_PUBLIC_TILES_URL`, there is no migration script here and none
is wanted — a route recomputed on a different engine is a *different route*, and
silently redrawing every customer's map to a new engine's opinion of the same
journey is not a config change.

## Running OSRM

```bash
# One country. Repeat per profile if you need more than car.
wget https://download.geofabrik.de/europe/lithuania-latest.osm.pbf

docker run -t -v "$PWD:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-extract -p /opt/car.lua /data/lithuania-latest.osm.pbf
docker run -t -v "$PWD:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-partition /data/lithuania-latest.osrm
docker run -t -v "$PWD:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-customize /data/lithuania-latest.osrm

docker run -t -i -p 5000:5000 -v "$PWD:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-routed --algorithm mld /data/lithuania-latest.osrm
```

Put it behind TLS and a firewall that only admits our server. The endpoint takes
coordinates from anybody who can reach it, and an open one is somebody else's free
routing service.

Check it answers the shape the adapter expects:

```bash
curl "http://localhost:5000/route/v1/driving/25.28,54.687;25.30,54.70?overview=full&geometries=geojson" \
  | head -c 400
```

You want `"code":"Ok"` and a `geometry.coordinates` array. That is the whole
contract — `toRouteResult` in `lib/routing/osrm.ts` reads nothing else.

## Attribution

**OpenStreetMap is credited and always has been**, on every rendered map, through
the tile source's own TileJSON — see the two guards CLAUDE.md §0 describes. A
route is OSM data drawn on an OSM-credited map, so nothing about this feature
touches that and the embed needs nothing added. §12 is intact.

**The engine credit is not there, and that is a deliberate outstanding debt.** A
line naming OSRM sat under the route summary in the shape card; it was removed on
the owner's request. The public OSRM demo server's usage policy asks that we say
where the routing came from, so for as long as `ROUTING_URL` is unset we are
using that server without the credit it asks for.

That is survivable only because the default endpoint is development-only by
design — the whole point of this document is that it stops being the endpoint
before a paying customer exists. If the demo server outlasts that plan, put the
credit back: a `<p className="text-[0.6875rem] leading-tight text-muted">` at the
foot of `components/map/routes/route-summary.tsx`, linking project-osrm.org, is
what was there.

Once routing runs on an engine of ours the question changes shape: self-hosted
OSRM is BSD-licensed software we run, not a service anybody is crediting, and the
*data* credit is OSM's — which is already on the map. At that point there is
nothing owed. If you move to Valhalla instead, the same holds: the licence is MIT
and the data is still OSM.
