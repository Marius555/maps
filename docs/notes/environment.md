# Environment variables — the reasoning

Moved out of CLAUDE.md on 2026-09-05. The names, scopes and defaults stay in CLAUDE.md §0;
this is why each one exists.

`.env` is gitignored and there is no `.env.example`. Names in use:

- Browser-safe: `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT_ID`, `NEXT_PUBLIC_APPWRITE_PROJECT_NAME`
- Server-only: `APPWRITE_API_KEY`, `DATABASE_ID`, `STORAGE_ID` — unprefixed deliberately. These must never reach a client component or the embed bundle (§9).
- Optional, all server-only, all defaulted: `GEOCODER_URL` (defaults to the public Photon instance), `GEOCODER_MIN_INTERVAL_MS` (defaults to 1000, and now spaces request *starts* rather than waiting for each round trip to finish — see `lib/geocoding/throttle.ts`) and `GEOCODER_USER_AGENT`. Point the first at a self-hosted Photon and lower the second before any real import volume. The third exists because public OSM-derived services block unidentified clients and Node's default UA is exactly that: a 403 from a WAF is otherwise indistinguishable from the service being down, and both arrive as a 502.
- Optional, all server-only, all defaulted: `ROUTING_URL` (defaults to the public OSRM demo server), `ROUTING_MIN_INTERVAL_MS` (defaults to 1000) and `ROUTING_USER_AGENT`. Exactly the geocoder's three, for exactly the geocoder's reasons — and with a sharper deadline: the demo server's terms forbid reselling access and warn that it can be withdrawn without notice, so `ROUTING_URL` has to point somewhere of our own before the first paying customer. `docs/self-hosting-routing.md` is the runbook, including why Valhalla beats OSRM the moment coverage goes past one country. Nothing published moves when this changes — a route's geometry is baked at draw time, which is the whole feature.
- Optional, all server-only, all defaulted: `GEOAPIFY_API_KEY`, `GEOCODER_PROVIDER` and `ROUTING_PROVIDER`. Set either provider variable to `geoapify` and that half moves onto Geoapify (`lib/geoapify/client.ts`, plus a thin adapter in each folder); unset, Photon and OSRM answer exactly as they always did, which is what makes this switchable per half and reversible. The two switches are deliberately independent — they share an account and a credit budget but not a decision, since geocoding is judged on an import of real addresses and routing on a drawn line. `GEOAPIFY_MIN_INTERVAL_MS` paces **both**, out of one process-wide throttle, because one account has one rate limit; it defaults far below the demo servers' 1000ms since arming the route tool sweeps up to 200 pins. The key is unprefixed and belongs to `APPWRITE_API_KEY`'s class — it must never reach a client component or the embed (§9), and `geoapifyGet` appends it last and keeps it out of every error message so an upstream failure cannot log it.
- **Temporary, and testing only: `DISABLE_ALL_PLAN`.** Set to `1`/`true`/`yes`, every
  account reads as `pro` — so every quantity limit and the routes feature gate is
  bypassed. It exists because routes are a paid feature on an account that has no
  billing yet (§10 Week 4), which makes the routing half of a provider swap
  unreachable by hand, and by hand is the only way that half's failures show:
  they are plausible wrong answers, not errors. It is one early return in
  `getUserPlan` — the single point the plan is resolved — so §6's rule that the
  checks live in the repositories is intact and every one of them still runs; they
  are simply asked about a different plan, which is why the ceilings become pro's
  3,000 places rather than none. Honoured in every environment and it warns once
  per process when it is on. **Delete it with the pricing work.**
- Optional, server-only: `SNAPSHOT_STORAGE_ID`, defaulting to `STORAGE_ID`. **Appwrite Cloud's free plan allows one bucket per project**, so published snapshots share the assets bucket, which is why `json` is in its allowed extensions. On a paid plan, point this at a dedicated bucket and add a second entry to `BUCKETS` in `scripts/appwrite-schema.mjs`; nothing else changes.
- Optional, browser-safe: `NEXT_PUBLIC_TILES_URL`. Where the basemaps are served from. **Unset means OpenFreeMap and is the current state**; setting it moves `STYLE_URLS` *and* the attribution together, because both come from one pair in `lib/map/style.ts`. Changing it does not move maps that are already published — `styleUrl` is baked into each snapshot at publish time, which is what makes the switch a republish rather than a redeploy of every customer's embed. `npm run migrate:style-host` is what moves them, in either direction.
- Optional, browser-safe: `NEXT_PUBLIC_EMBED_SCRIPT_URL`. Set it to the CDN origin in production. Unset, the embed snippet points at the dashboard's own origin, which is what makes development and self-hosting work with no config.

`STORAGE_ID` never reaches the browser: photo URLs are composed on the server in `lib/storage/photo-url.ts` and handed to clients as `place.photoUrl`. If you need a bucket id in a component, that's the signal you're building it in the wrong layer.

