# Environment variables — the reasoning

Moved out of CLAUDE.md on 2026-09-05. The names, scopes and defaults stay in CLAUDE.md §0;
this is why each one exists.

`.env` is gitignored and there is no `.env.example`. Names in use:

- Browser-safe: `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT_ID`, `NEXT_PUBLIC_APPWRITE_PROJECT_NAME`
- Server-only: `APPWRITE_API_KEY`, `DATABASE_ID`, `STORAGE_ID` — unprefixed deliberately. These must never reach a client component or the embed bundle (§9).
- Optional, all server-only, all defaulted: `GEOCODER_URL` (defaults to the public Photon instance), `GEOCODER_MIN_INTERVAL_MS` (defaults to 1000, and now spaces request *starts* rather than waiting for each round trip to finish — see `lib/geocoding/throttle.ts`) and `GEOCODER_USER_AGENT`. Point the first at a self-hosted Photon and lower the second before any real import volume. The third exists because public OSM-derived services block unidentified clients and Node's default UA is exactly that: a 403 from a WAF is otherwise indistinguishable from the service being down, and both arrive as a 502.
- Optional, all server-only, all defaulted: `ROUTING_URL` (defaults to the public OSRM demo server), `ROUTING_MIN_INTERVAL_MS` (defaults to 1000) and `ROUTING_USER_AGENT`. Exactly the geocoder's three, for exactly the geocoder's reasons — and with a sharper deadline: the demo server's terms forbid reselling access and warn that it can be withdrawn without notice, so `ROUTING_URL` has to point somewhere of our own before the first paying customer. `docs/self-hosting-routing.md` is the runbook, including why Valhalla beats OSRM the moment coverage goes past one country. Nothing published moves when this changes — a route's geometry is baked at draw time, which is the whole feature.
- Optional, all server-only, all defaulted: `GEOAPIFY_API_KEY`, `GEOCODER_PROVIDER` and `ROUTING_PROVIDER`. Set either provider variable to `geoapify` and that half moves onto Geoapify (`lib/geoapify/client.ts`, plus a thin adapter in each folder); unset, Photon and OSRM answer exactly as they always did, which is what makes this switchable per half and reversible. The two switches are deliberately independent — they share an account and a credit budget but not a decision, since geocoding is judged on an import of real addresses and routing on a drawn line. `GEOAPIFY_MIN_INTERVAL_MS` paces **both**, out of one process-wide throttle, because one account has one rate limit; it defaults far below the demo servers' 1000ms since arming the route tool sweeps up to 200 pins. The key is unprefixed and belongs to `APPWRITE_API_KEY`'s class — it must never reach a client component or the embed (§9), and `geoapifyGet` appends it last and keeps it out of every error message so an upstream failure cannot log it.
- **Development only: `DISABLE_ALL_PLAN`.** Set to `1`/`true`/`yes`, every account reads as
  `pro` — so every quantity limit, every feature gate and the monthly lookup allowance are
  bypassed. It exists because paid features cannot be exercised by hand on an account that
  has not bought anything, and by hand is the only way some of their failures show: a
  mis-snapped route is a plausible wrong answer, not an error. It is one early return in
  `getUserPlan` — the single point the plan is resolved — plus its twin in
  `usage.repository.ts`, so §6's rule that the checks live in the repositories is intact and
  every one of them still runs; they are simply asked about a different plan, which is why
  the ceilings become pro's 3,000 places rather than none. It warns once per process when
  it is on. **It is inert when `NODE_ENV` is `production`**, and that check replaced a note
  asking somebody to delete the variable before launch: this hands the paid product to
  everybody, it is set by an environment variable, and on Appwrite Sites setting one is a
  form field and a redeploy. "Remember not to" is a plan; the check is a guarantee.

- **Development only: `DISABLE_EMAIL_VERIFICATION`.** Set to `1`/`true`/`yes`, every account
  reads as having confirmed its address — so `withAuth` stops 403ing writes, the banner in
  the shell disappears, and Create map and Publish come back. It exists because the only
  other way to open that gate while developing is to unset `RESEND_API_KEY`, which also
  turns off the mail you may be trying to test. Shaped exactly like `DISABLE_ALL_PLAN` and
  for the same reason: it does not touch `assertEmailVerified`, it changes the answer to
  "has this address been confirmed" at the one point the value is resolved
  (`readsAsVerified` in `lib/auth/email-gate.ts`, called by both `AuthUser` mappers). The
  gate keeps living in `withAuth` and nowhere else, and — the half a server-only switch
  would have missed — the three places the UI explains the freeze all read the same
  resolved value, so the screen agrees with the server instead of showing a banner saying
  "nothing will save" above a dashboard where everything saves. It warns once per process,
  and **it is inert when `NODE_ENV` is `production`**, for the reason above it.

- Optional in code, **required to sell anything**, server-only: `LEMON_API_KEY`,
  `LEMON_STORE_ID`, `LEMON_WEBHOOK_SECRET` and four variant ids —
  `LEMON_VARIANT_STARTER_MONTHLY`, `LEMON_VARIANT_STARTER_YEARLY`,
  `LEMON_VARIANT_PRO_MONTHLY`, `LEMON_VARIANT_PRO_YEARLY`. All are read as optional in
  `lib/env.ts` and checked where they are used, the way the R2 credentials are: a missing one
  should fail a checkout with its own name in the message, not take down every page in the
  dashboard belonging to people who are not buying anything. Three things worth knowing.
  **`LEMON_API_KEY` falls back to `LEMON_TEST_API_KEY`** because the provider decides test
  mode from the key itself rather than from a flag — the test key and the live key are one
  setting with two values, and naming the variable after the mode would mean renaming it on
  the day of the first real payment, which is the worst possible day to be editing
  environment variables. **`LEMON_WEBHOOK_SECRET` unset means the webhook refuses
  everybody**, exactly as `CRON_SECRET` unset makes the cron route refuse everybody: an
  unguarded endpoint that writes `subscriptions` is a free Pro plan for anyone who finds the
  URL. And the **variant ids are configuration rather than code** because they differ between
  test and production and are re-created whenever a price changes — otherwise selling the
  same product at a new price would be a deploy. `docs/notes/billing.md`.

- Optional, server-only: `SNAPSHOT_STORAGE_ID`, defaulting to `STORAGE_ID`. **Appwrite Cloud's free plan allows one bucket per project**, so published snapshots share the assets bucket, which is why `json` is in its allowed extensions. On a paid plan, point this at a dedicated bucket and add a second entry to `BUCKETS` in `scripts/appwrite-schema.mjs`; nothing else changes. Only read when `SNAPSHOT_PUBLIC_URL` is unset — see the next entry for why that is development-only.

- Optional in code, **required in production**, server-only: `SNAPSHOT_PUBLIC_URL`
  (`https://cdn.pinglide.com`), `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY` and `R2_SNAPSHOT_BUCKET` (default `snapshots`) — published snapshots on
  Cloudflare R2. **`SNAPSHOT_PUBLIC_URL` is the switch**: set, publishing writes to R2 and the
  three credentials become required, checked in `lib/r2/client.ts` so a missing one fails a
  publish by name rather than the whole dashboard at import; unset, snapshots go to Appwrite
  Storage as they always did, so a clone with no Cloudflare account still publishes. **Unset is
  not a production option**: Appwrite Storage answers 403 `general_unknown_origin` to any
  Origin not registered as a Web platform, which is every customer's site, and the embed's
  `fetch` always sends one (`docs/notes/publish-and-embed.md`). The credentials are an R2 API
  token scoped to **Object Read & Write on the `snapshots` bucket only, with no IP filter** —
  Appwrite Sites has no fixed outbound IP, so an IP-restricted token works on a laptop and fails
  every publish on the site. The secret is `APPWRITE_API_KEY`'s class: never a client component,
  never the embed, never an error message.

- Setup only, server-only, **never on the deployed site**: `CLOUDFLARE_API_TOKEN`. Read by
  `npm run setup:r2` alone, which attaches the custom domain, sets the bucket's CORS and writes
  the zone's cache and response-header rules. It needs Workers R2 Storage: Edit on the account
  and DNS, Cache Rules and Transform Rules: Edit on the zone — far more than the app should ever
  hold, which is why the app has its own narrow R2 token instead. It can expire once setup
  prints only `ok`.
- Optional, browser-safe: `NEXT_PUBLIC_TILES_URL`. Where the basemaps are served from. **Unset means OpenFreeMap and is the current state**; setting it moves `STYLE_URLS` *and* the attribution together, because both come from one pair in `lib/map/style.ts`. Changing it does not move maps that are already published — `styleUrl` is baked into each snapshot at publish time, which is what makes the switch a republish rather than a redeploy of every customer's embed. `npm run migrate:style-host` is what moves them, in either direction.
- Optional, server-only: `RESEND_API_KEY`, `RESEND_FROM` and `APP_URL` — transactional email.
  **All three are optional and the app boots without any of them**, which is not laziness:
  every message we send is on the tail of something that has already succeeded, so a missing
  key must degrade to "the email did not arrive", never to a failed signup. `lib/email/resend.ts`
  warns once per process and no-ops. `RESEND_FROM` defaults to `onboarding@resend.dev`, which is
  the sender Resend accepts before you verify a domain — it can only deliver to your own account
  address, so it is right for development and wrong the moment a real customer signs up.
  **`APP_URL` is the one that matters and the one with a security argument.** It is the origin
  every emailed link is built from, and it is configured rather than read off the request's
  `Host` header on purpose: forgot-password takes an attacker-supplied address and mails a
  single-use token to it, so a link whose origin came from a header the caller controls would let
  a spoofed `Host` mint a working reset link pointing at the attacker's own server. Set it per
  environment; it is not browser-safe and does not need to be, since nothing on the client
  composes a link.
- Optional, server-only: `EMAIL_DOMAIN_ALLOWLIST` — a comma-separated list of domains that may
  sign up whatever the disposable-address check thinks of them. **Unset is the normal state**
  and means the vendored list decides. It exists because
  `lib/email/disposable-domains.generated.ts` is 75,000 domains somebody else maintains, and
  the day it is wrong about a real customer's domain is the day they are locked out at 2am —
  this un-blocks them in the time it takes to set a variable and redeploy. An entry covers its
  own subdomains, the same rule the embed's allowlist uses. The durable fix is `KEEP` in
  `scripts/build-disposable-domains.mjs`, which survives the next regeneration; move the domain
  there once the fire is out. There is deliberately **no switch for the MX lookup** that runs
  beside it — it already treats every uncertain answer as a yes, so there is nothing for an
  off-switch to rescue. `docs/notes/auth.md` has the reasoning for both.

- Optional, server-only: `ANALYTICS_SALT` — what the anonymous monthly visitor key is salted
  with (`lib/analytics/collect/visitor-key.ts`). Unset, the salt is derived from
  `APPWRITE_API_KEY`, so visitor counting works with no configuration. Without *a* secret the
  key would be a bare hash of an IP address, which is small enough to reverse. Changing it
  mid-month makes every visitor read as new until the 1st. `docs/notes/analytics.md`.

- Optional, server-only: `CRON_SECRET` and `SHEET_SYNC_STEP_MS` — Google Sheets sync
  (`docs/notes/sheet-sync.md`). **`CRON_SECRET` gates the daily sync's route, and unset means
  that route refuses everyone**, not that it is open: an unauthenticated trigger would let a
  stranger spend geocoding credit and republish every linked map. The same value goes on the
  `sheet-sync-daily` Appwrite Function, which is what calls it. `SHEET_SYNC_STEP_MS` is how long
  one sync step may spend looking addresses up (default 5000). A step has to finish inside the
  Appwrite Sites timeout — 15s by default, 30s at most — so raise this to about 15000 only after
  raising the site's timeout to 30s. Sync now works with neither set; the daily sync needs the
  secret. `APP_URL` matters here too: a daily republish has no request to take an origin from.

- Optional, browser-safe: `NEXT_PUBLIC_EMBED_SCRIPT_URL` (`https://cdn.pinglide.com/embed/map.js`) and `NEXT_PUBLIC_GAZETTEER_URL` (`https://cdn.pinglide.com/gazetteer`). Unset, the snippet and the gazetteer point at the dashboard's own origin, which is what makes development and self-hosting work with no config — and in production is a mistake with a deadline: every visitor would download ~345KB from Appwrite Sites (metered, and in the visitor path §2 forbids), and the script URL in a pasted snippet can never be changed. `npm run deploy:cdn` (`scripts/upload-cdn.mjs`) uploads both into the snapshots bucket under `embed/` and `gazetteer/`, skipping any file whose R2 ETag already matches its MD5.
- Build-time, optional: `UPLOAD_EMBED_ON_BUILD`. Set to `true` **on the Appwrite Site only**, and `postbuild` uploads the freshly built embed to the CDN on every deploy, so `map.js` can never lag the dashboard. It needs the R2 variables at build time too. Unset (every local build), the hook prints one line and does nothing. The gazetteer is gitignored, so the host never has it — upload it by hand with `npm run deploy:cdn` after `npm run build:gazetteer`.

`STORAGE_ID` never reaches the browser: photo URLs are composed on the server in `lib/storage/photo-url.ts` and handed to clients as `place.photoUrl`. If you need a bucket id in a component, that's the signal you're building it in the wrong layer.

