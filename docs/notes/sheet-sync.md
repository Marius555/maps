# Google Sheets sync — design notes

A map can stay linked to the Google Sheet it was imported from. Rows in the sheet
are the locations on the map: a sync adds new rows, updates changed ones, removes
rows that are gone, and republishes the live map if anything a visitor sees
changed. It runs when the owner presses **Sync now** on the Locations page, and
every 30 minutes on its own.

Built on 2026-09-16 as an answer to a rival (Atlist) shipping the same feature.
Decisions the owner made: Sync now plus a daily sync; the sheet wins for every
field a column feeds while app-only extras are kept; a published map republishes
automatically; Starter and Pro only. On 2026-10-03 the owner moved the automatic
sync from daily to **every 30 minutes** (the `googleSheetsUpdate` function).

## Invariants

### What a sync may touch

- **Only locations with a `sourceKey`.** A location added by hand has none, and a
  sync never matches, changes or removes it. That is what lets an owner keep a pin
  of their own on a sheet-driven map.
- **Only the fields a column was mapped to** (`sheetOwnedFields` in
  `lib/sheet-sync/patch.ts`). Name always; address, description, phone, email,
  website and tags only if the import mapped a column to them. Photos, logo, hours,
  pin, group, custom fields and card overrides have no column and cannot be reached:
  `SheetPlacePatch` is the complete list of what `applySheetPatches` writes.
  The Edit dialog's note (`SheetOwnedNote`) is built from the same function, so it
  names exactly the fields a sync overwrites.
- **Coordinates follow the sheet only when the sheet has some.** Otherwise a
  position changes only when the address *text* changes. An unchanged address keeps
  whatever pin the location has, including one dragged by hand. Re-geocoding every
  row every night would quietly undo those drags and spend credits for nothing.
- **`tags` stays ordered.** Main tag first, then the tags column, resolved exactly
  the way the import resolves them. A reordering is a change, because the first
  tag colours the pin.

### Matching rows to locations

- **Three passes** (`diffSheet`): the key, then a name unique on both sides, then
  an address unique on both sides. The last two are what keep photos and card
  overrides through a rename *or* a move. Changing both at once is an add and a
  removal, as in Atlist. Two rows sharing a name never guess.
- **The key is a hash of the normalised name and address** (`sourceKeysFor`), with
  `#2`, `#3` for exact duplicates. It is not the text itself, which could run past
  any varchar. It is not the row number, which changes whenever the sheet is sorted.
  Keys are assigned over *usable* rows only, so a half-typed row cannot renumber the
  duplicates below it.
- **There is no ID column yet.** The plan had an `externalId` import field. It was
  left out because adding a field to detection means synonyms like "id" and "ref",
  and the header scorer's prefix/suffix matching would let those steal columns
  from other fields on files that import correctly today. Name+address with the
  fallback passes covers renames and moves. Revisit if customers edit both at once.

### Safety

- **A sync that would remove most of the linked locations stops and asks**
  (`removalsNeedConfirmation`). The threshold is three or more removals that are
  more than half the linked locations, or any removal when the sheet came back
  empty. A cleared tab, a filter view, or the wrong tab after a rename is far more
  likely than an owner closing two thirds of their stores overnight. **The automatic
  sync never confirms.** Only the owner's **Remove N and sync** button does.
- **Low-confidence and failed lookups are skipped, not written** (§7's "never save
  geocode results silently" is bent here, and this is the condition). A new row
  whose address does not resolve with confidence is listed in the report by sheet
  row number. A matched row whose *new* address does not resolve keeps its old
  address and pin, and every other field still updates. The fix is in the sheet:
  a clearer address, or lat/lng columns.
- **Failed lookups are remembered for a week** (`sheetLinks.failedLookups`, keyed
  by a hash of the normalised address). Without this, one unfindable address would
  be paid for again on every step of every run. An edited address hashes differently
  and is looked up at once.
- **A soft lock** (`syncingUntil`) keeps a second press of Sync now, or the automatic
  job arriving mid-sync, from writing the same rows twice. Read-then-write, so two
  syncs starting in the same millisecond can still both run; the cost of that is a
  duplicate write, not a duplicate row.
- **The plan is checked on every step**, not only when the link was made. An
  account that drops to Free keeps its link, and the link stops spending.
- **Deleting a map deletes its link** (`deleteMap`), or the automatic job would fail on
  it every run.

### Hosting: why a sync is a series of steps

- **Appwrite Sites cuts every request off at the site timeout: 15 seconds by
  default, 30 at most.** Hosting is Appwrite Sites, not Vercel, so there is no
  `maxDuration` to raise and no platform cron. A sheet that gained two hundred
  addresses is minutes of geocoding at a public provider's pace.
- **So `runSheetSyncStep` does a bounded slice and answers `more`.** Each step:
  - looks addresses up for `SHEET_SYNC_STEP_MS` (default 5000)
  - writes at most 60 updates and 200 creates
  - returns `more: true` if anything is left

  The next step recomputes the diff from scratch and carries on. Nothing is
  carried between steps except the locations themselves and `failedLookups`,
  which is why a step can be interrupted anywhere.
- **`continuing: true` adds a step's counts to the previous step's report**
  (`mergeStepReports`), so the owner sees one sync. Skipped rows are not added up:
  every step re-reports every row it cannot use, so the latest list is the whole
  list.
- **Only the last step republishes**, and only when the combined report changed
  something. `publishMap` gets `env.appUrl`, because the automatic job has no request
  to read an origin from.
- **Sync now loops in the browser** (`useSyncSheet`). The mutation stays pending
  for the whole sync, and `onStep` shows the counts climbing. The loop lives in
  `SheetSyncButton`, not the popover, so closing the popover does not stop it.

## The automatic sync: an Appwrite Function

`functions/sheet-sync` holds no sync logic. It runs as the `googleSheetsUpdate`
function (id in `.env` as `CRON_GOOGLE_GOOGLE_SHEETS_UPDATE`) on `*/30 * * * *`
(UTC). It asks `GET /api/cron/sheet-sync` which maps are due (least recently synced
first), then calls `POST /api/cron/sheet-sync { mapId, continuing }` one step at a
time until each map answers `more: false`. A scheduled execution is asynchronous,
so it may run for 15 minutes; it stops starting steps a minute before that. Maps it
does not reach go first next run. Fifteen minutes is under the 30-minute schedule,
so two runs never overlap; the soft lock is the backstop.

- **A map synced in the last 10 minutes is not due** (`MIN_GAP_MS` in the route).
  That skips a map its owner just synced by hand. It is 10 rather than ~25 because
  `lastSyncedAt` is written at every step, and a run can reach a map as late as
  fourteen minutes in; a longer gap would make that map skip the next run and sync
  hourly.
- **The interval the UI states is `AUTO_SYNC_EVERY`** in `lib/sheet-sync/schedule.ts`.
  The real schedule is the function's cron, set by `npm run setup:sheet-sync`.
  Change the two together.

**The same function also runs the visitor-session purge.** On the runs that start
in the 03:00 UTC hour it first walks `POST /api/cron/session-retention { cursor }`
for at most two minutes, then syncs as usual. It is the project's only scheduler,
and a second function would be a second deploy for one HTTP loop.
`docs/notes/analytics.md`, "Retention". Redeploying the function
(`npm run setup:sheet-sync`) is what turns the purge on.

Every cron call requires `Authorization: Bearer $CRON_SECRET`
(`lib/api/cron-auth.ts`), and all of them refuse when `CRON_SECRET` is unset on
the site. An open trigger would let a stranger spend
geocoding credit and republish every linked map.

### Setup: `npm run setup:sheet-sync`

Create the function once in the console (any Node runtime) and put its id in `.env`
as `CRON_GOOGLE_GOOGLE_SHEETS_UPDATE`. Then run the script. It is idempotent, and
also how a change under `functions/sheet-sync` is shipped:

- generates `CRON_SECRET` into `.env` if there is none
- sets the function: schedule `*/30 * * * *`, timeout 900, **no execute access**,
  **no scopes** (it never touches Appwrite, only our route), no build command
- upserts `APP_URL` (`SHEET_SYNC_APP_URL`, default the site's Appwrite domain) and
  `CRON_SECRET` on the function, and `CRON_SECRET` on the site
- packs the folder and deploys it as the active deployment

Then **redeploy the site** so it reads `CRON_SECRET`. Separately, raise the site
timeout to 30s and set `SHEET_SYNC_STEP_MS=15000` so each step does three times the
work. At the default 15s timeout, leave `SHEET_SYNC_STEP_MS` unset.

To check, run it once from the console's Executions tab, **asynchronously** (a
synchronous execution is capped at 30 seconds). The log should end with
"Synced N of N due maps."

## Verified

- Measured on 2026-09-16 against Google's public sample sheet (30 rows, state codes
  for addresses), on a throwaway map:
  - An import with three rows placed by hand linked the sheet and stamped keys.
  - The first Sync now took 6.9s: nothing changed for the three, and 27 rows were
    skipped with reasons.
  - Renaming a location in the app and syncing put the sheet's name back and kept
    a phone number typed in the app (no phone column).
  - The second sync took 1.5s, because every failed address came from
    `failedLookups`.
  - Deleting the map left no link row and no places.
- The cron route answers 401 without the secret and with a wrong one.
- 2026-10-03, every 30 minutes: `functions/sheet-sync/src/main.js` run locally
  against the dev server synced a map linked to the same sample sheet in 4 steps
  and 23s, status ok, with 30 rows skipped (bare state codes) and 13 addresses cached.
  An immediate second run found 0 due maps (the 10-minute gap). A freshly linked
  map is not due; backdated an hour, it is.
- 2026-10-03, on Appwrite: after `setup:sheet-sync` the function reads back with
  timeout 900, no execute access, no scopes, `APP_URL` + `CRON_SECRET`, and our code
  active. One async execution reached `maps-5sbu.appwrite.network`, which answered
  **404 because the site has no active deployment**. Not verified on Appwrite until
  the site is deployed with its env.
