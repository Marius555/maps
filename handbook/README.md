# Handbook — how to run everything

Every command, function and integration in this project: how to start it and what it does.
Run all commands from the project's root folder. Commands written `npm run x -- --flag` need
the `--` before their own flags.

**Needs `.env`** means the command reads secrets from the `.env` file in the root, which is
never committed. Check `.env.example` for the variable names.

1. [Every day](#1-every-day)
2. [Testing](#2-testing)
3. [The embed (the map on customers' websites)](#3-the-embed-the-map-on-customers-websites)
4. [WordPress plugin](#4-wordpress-plugin)
5. [Billing (Lemon Squeezy)](#5-billing-lemon-squeezy)
6. [Google Sheets auto-sync](#6-google-sheets-auto-sync)
7. [Other integrations, switched on in `.env`](#7-other-integrations-switched-on-in-env)
8. [Setting up a new environment](#8-setting-up-a-new-environment)
9. [Deploy and release](#9-deploy-and-release)
10. [Data builders (rarely needed)](#10-data-builders-rarely-needed)
11. [One-off migrations](#11-one-off-migrations)
12. [Danger zone](#12-danger-zone)

---

## 1. Every day

| Command | What it does | Needs |
|---|---|---|
| `npm run dev` | Starts the app at http://localhost:3000 and reloads it as you edit. | `.env` |
| `npm run check` | Runs typecheck, lint and unit tests together. Run it before calling work done. | |
| `npm run typecheck` | Checks TypeScript types only. | |
| `npm run lint` | Checks code style and common mistakes (ESLint). | |
| `npm run test` | Runs the unit tests once (Vitest). | |
| `npm run test:watch` | Re-runs the unit tests every time you save. | |
| `npx vitest run lib/import/detect/score.test.ts` | Runs one test file. | |
| `npm run build` | Builds the production version, including the embed and the WordPress zip. Uses ~2.6GB of memory. | `.env` |
| `npm run start` | Serves the production build made by `npm run build`. | `.env` |

## 2. Testing

### Browser tests (Playwright)

Before the first run:
1. Create a test account in the app and confirm its email.
2. In `.env`, set `E2E_EMAIL`, `E2E_PASSWORD` and `DISABLE_ALL_PLAN=true`.
3. Run `npx playwright install chromium` and `npm run build:embed`.

| Command | What it does | Needs |
|---|---|---|
| `npm run e2e` | Runs every browser test. Starts the dev server itself, or uses the one already running. | `.env` |
| `npm run e2e:smoke` | Runs only the quick smoke tests. | `.env` |
| `npm run e2e:ui` | Opens Playwright's window so you can watch and step through tests. | `.env` |
| `npx playwright test e2e/import.spec.ts --project=chromium` | Runs one test file. | `.env` |
| `npx playwright show-report` | Opens the report from the last run. | |
| `npm run docs:screenshots` | Retakes the screenshots on the `/docs` pages, in light and dark. | `npm run dev` running, `.env` |

Optional `.env` values that unlock more tests: `E2E_EMAIL_2`/`E2E_PASSWORD_2`,
`DEV_ADMIN_EMAIL`/`DEV_ADMIN_PASSWORD`, and `E2E_UNVERIFIED_EMAIL`/`E2E_UNVERIFIED_PASSWORD`.
More detail is in `e2e/README.md`.

### Pages for checking by hand

| Where | What it is |
|---|---|
| Map editor → **Publish** → **Open test page** | Opens `/embed/live.html`. It runs the real embed against your real published map, and is the only way to check visitor analytics end to end. Run `npm run build:embed` first. |
| http://localhost:3000/embed/dev-legacy.html | An old-format published map, to check that old maps still load. |
| http://localhost:3000/dev/hero-map, `/dev/hero-routes`, `/dev/map-themes` | Generators for the images on the landing page and the theme pictures. Development only. |

## 3. The embed (the map on customers' websites)

| Command | What it does | Needs |
|---|---|---|
| `npm run build:embed` | Builds the embed into `public/embed/` and fails if our code exceeds its size budget. Run it after any change in `embed/` or `packages/shared/`. | |
| `npm run check:embed-size` | Re-checks the size budget without rebuilding. | |
| `npm run copy:maplibre-worker` | Copies MapLibre's worker into `public/maplibre/`. `npm run dev` does this by itself. If the map shows a blank background, run this. | |
| `npm run deploy:cdn` | Uploads the embed and the place-name list to `cdn.pinglide.com`, skipping files that haven't changed. | `.env` (R2 keys) |

If `UPLOAD_EMBED_ON_BUILD=true` is set, every `npm run build` also runs `deploy:cdn` by itself.

## 4. WordPress plugin

| Command | What it does | Needs |
|---|---|---|
| `npm run build:wordpress` | Zips `distribution/wordpress/pinglide` into `public/downloads/pinglide-wordpress.zip`. Every build does this too. | |

**Test it locally (no WordPress account, no Docker):**

1. Terminal 1: `npm run dev`
2. Terminal 2 (PowerShell), all on one line:
   ```
   npx "@wp-playground/cli@latest" server --port=9400 --login --mount-dir ./distribution/wordpress/pinglide /wordpress/wp-content/plugins/pinglide --blueprint=./distribution/wordpress/playground/blueprint.json
   ```
   In Git Bash, use this instead:
   ```
   MSYS_NO_PATHCONV=1 npx @wp-playground/cli@latest server --port=9400 --login \
     --mount-dir ./distribution/wordpress/pinglide /wordpress/wp-content/plugins/pinglide \
     --blueprint=./distribution/wordpress/playground/blueprint.json
   ```
3. Open http://127.0.0.1:9400/wp-admin. If it asks you to log in, use `admin` / `password`.
4. Create a page and add the **Pinglide map** block, then click **Set up this map**.
5. Sign in on the tab that opens and pick or create a map. You are sent back to WordPress.
6. Publish the page and view it. The map should appear.

Playground forgets everything when you stop it. Edits to the plugin's PHP files show on the
next page reload.

**"There has been a critical error on this website"?** Open
http://127.0.0.1:9400/wp-content/debug.log — the last `PHP Fatal error` line says which
file broke and why. If the log is empty, stop Playground (Ctrl+C) and start it again. For a real WordPress site, upload the zip and add
`define( 'PINGLIDE_APP_URL', 'http://localhost:3000' );` to `wp-config.php`. The release
checklist is in `distribution/wordpress/README.md`.

## 5. Billing (Lemon Squeezy)

| Command | What it does | Needs |
|---|---|---|
| `npm run setup:lemon` | Finds your plan variants in the Lemon store, writes their ids into `.env` and sets up the webhook. Run it once in test mode and once in live mode. | `.env` (`LEMON_API_KEY`) |
| `npm run setup:lemon -- --dry-run` | Shows what `setup:lemon` would change, without writing anything. | `.env` |
| `npm run setup:lemon -- --verify` | Checks that the ids in `.env` match the store. Fails if they don't. | `.env` |
| `npm run billing:replay -- subscription_created --email you@example.com --plan pro` | Sends a fake, correctly signed webhook to your running app, as if that person had just paid. | `npm run dev` running, `.env` |

`billing:replay` events: `subscription_created`, `_updated`, `_cancelled`, `_expired`,
`_resumed`, `_paused`, `_unpaused`, `subscription_payment_success`, `_failed`, `_recovered`
and `_refunded`. The `payment_*` events also need `--subscription <id>`. Other flags:
`--cadence monthly|yearly`, `--url <origin>` and `--dry-run`.

**Test a real payment before deploying:**
1. Run `ngrok http 3000` and copy the https URL it prints.
2. Set `APP_URL` in `.env` to that URL, restart `npm run dev`, then run `npm run setup:lemon`.
3. Open the ngrok URL, sign in with email and password (not Google), and buy a plan with a
   test card.
4. Watch the webhook arrive at http://127.0.0.1:4040.
5. Afterwards, set `APP_URL=https://pinglide.com` again and re-run `npm run setup:lemon`.

## 6. Google Sheets auto-sync

`functions/sheet-sync` is an Appwrite Function that runs every hour. It re-syncs every
map linked to a Google Sheet. In its 03:00 UTC run it also deletes old visitor sessions.
It holds no logic of its own: it calls the site's `/api/cron/*` routes in short steps.

| Command | What it does | Needs |
|---|---|---|
| `npm run setup:sheet-sync` | Configures and uploads the function: hourly interval, timeout, `APP_URL`, and a shared `CRON_SECRET` on both the function and the site. | `.env` |

**First time:**
1. Create the function in the Appwrite console.
2. Put its id in `.env` as `CRON_GOOGLE_GOOGLE_SHEETS_UPDATE`.
3. Run `npm run setup:sheet-sync`, then redeploy the site.

**To test it:** in the Appwrite console, open the function → **Executions** → run it
**asynchronously**. The log should end with "Synced N of N due maps." You can also press
**Sync now** on a linked map's Locations page.

## 7. Other integrations, switched on in `.env`

Each of these turns off quietly when its variables are missing.

| Integration | Turn it on with | How to see it works |
|---|---|---|
| **Admin console** | `ADMIN_EMAIL`, plus the two lines `npm run admin:hash` prints | Log in at http://localhost:3000/login/admin |
| **Emails** (Resend) | `RESEND_API_KEY`, `RESEND_FROM` | Sign up or reset a password, then check `/admin/email` |
| **Address search and routes** (Geoapify) | `GEOAPIFY_API_KEY`, `GEOCODER_PROVIDER=geoapify`, `ROUTING_PROVIDER=geoapify` | Search an address or draw a route, then check `/admin/apis`. Unset, the free Photon and OSRM servers are used. |
| **Product analytics** (PostHog) | `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST` | Events in the PostHog dashboard. `NEXT_PUBLIC_DISABLE_POSTHOG=true` switches it off. |
| **Published maps on the CDN** (Cloudflare R2) | `SNAPSHOT_PUBLIC_URL` and the `R2_*` keys | Publish a map. Its file appears at `cdn.pinglide.com/<map id>/live.json`. |

| Command | What it does | Needs |
|---|---|---|
| `npm run admin:hash` | Asks for an admin password and prints `ADMIN_PASSWORD_HASH` and `ADMIN_SESSION_SECRET` to paste into `.env` and into the site's settings. Add `-- --no-secret` to change only the password. | |

**Development-only switches** (they do nothing in production): `DISABLE_ALL_PLAN=true` makes
every account Pro, `DISABLE_EMAIL_VERIFICATION=true` makes every account confirmed, and
`TUTORIAL_ALWAYS_PRESENT=true` shows the onboarding tips on every load.

## 8. Setting up a new environment

| Command | What it does | Needs |
|---|---|---|
| `npm run setup:appwrite` | Creates any missing database tables, columns, indexes and the storage bucket. Safe to re-run; it never changes what exists. | `.env` |
| `npm run setup:r2` | Sets up the CDN bucket: custom domain, CORS and cache rules. | `.env` (`CLOUDFLARE_API_TOKEN`) |
| `npm run admin:hash` | Makes the admin console password (see section 7). | |

Then section 5 (billing) and section 6 (sheet sync).

## 9. Deploy and release

**Deploying:** push to `main`. GitHub Actions (`.github/workflows/deploy.yml`) runs
`npm run check`, builds the site and uploads it to Appwrite Sites. You can also start it by
hand from the repo's **Actions** tab.

| Command | What it does | Needs |
|---|---|---|
| `npm run deploy:site -- --no-upload` | Builds and packages the site without uploading, to check it fits under the ~30MB limit. Uploading only works on Linux (GitHub Actions). | |
| `npm run release -- patch` | Bumps the version (`patch`, `minor` or `major`), writes `CHANGELOG.md`, commits and tags. It never pushes. | clean tree on `main` |
| `git push --follow-tags` | Pushes the release commit and its tag. | |

**What's live right now:** open `https://pinglide.com/api/version` (the site) and
`https://cdn.pinglide.com/embed/v1/version.json` (the embed).

## 10. Data builders (rarely needed)

| Command | What it does | Needs |
|---|---|---|
| `npm run build:gazetteer -- GB DE` | Rebuilds the place-name list the embed uses for search. With no countries it does 16 EU ones. | |
| `npm run build:world-dots` | Rebuilds the dotted Europe the landing page's map draws. Needs `npm run mirror:tile-assets` first. Rarely needed: the result is committed. | |
| `npm run build:disposable-domains` | Re-downloads the list of throwaway email domains that signup refuses. | |
| `npm run build:tile-styles -- https://tiles.example.com` | Writes our own basemap style files for a self-hosted tile server. | |
| `npm run mirror:tile-assets` | Downloads fonts, icons and the world raster for self-hosted tiles (~414MB). `-- --dry-run` shows what it would fetch. | |

## 11. One-off migrations

All of these have already been run. They are kept for history and for a fresh copy of old
data. Add `-- --dry-run` first where it is supported.

| Command | What it does |
|---|---|
| `npm run migrate:permissions` | Removes user write permissions from every row and file. `-- --verify-subscriptions` compares every subscription with Lemon Squeezy, and adding `--fix` corrects them. |
| `npm run migrate:tags` | Turns old categories into tags. |
| `npm run migrate:snapshots-to-r2` | Copies published maps from Appwrite storage to R2. |
| `npm run migrate:style-host` | Points published maps at the current tile host. |
| `npm run migrate:auto-style` | Moves maps that were never published onto the "auto" basemap, which follows light or dark mode. |
| `npm run migrate:shape-kinds` | Lets the database store lines on a project created before lines existed. |

All of them need `.env`.

## 12. Danger zone

| Command | What it does | Needs |
|---|---|---|
| `npm run danger:wipe-database` | **Dry run.** Lists everything a wipe would delete and keep. Deletes nothing. | `.env` |
| `npm run danger:wipe-database -- --execute` | **Deletes** every account except the test accounts, and everything those accounts owned: maps, locations, photos, analytics, logs, news posts, discount codes and published maps on the CDN. Paying subscriptions are cancelled first. The test accounts keep all their data. | `.env`, your admin password |

Which accounts are kept: every address in `WIPE_KEEP_EMAILS=a@x.com,b@y.com` in `.env`, plus
the `E2E_EMAIL` accounts. **Check the dry run's KEEP list before executing.**

What stops it running by accident:
- It only deletes with `--execute`.
- It must be run from your own terminal. It refuses in CI or through a pipe.
- It asks for the admin console password.
- Every kept email must belong to a real account.
- You must type the project id followed by `WIPE`.
- It waits 10 seconds, so you can still press Ctrl+C.

The code is in `scripts/wipe/`.
