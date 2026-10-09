# End-to-end tests

Playwright, against `next dev` and the real Appwrite project in `.env`. Vitest
(`npm run test`) covers logic; these cover what a person does, end to end — the
flows CLAUDE.md §3 names (signup, CSV import, publish, embed loads) and, around
them, the editor, the published embed, security and limits, settings and the
operator console.

## Once

1. Create an account for the tests (not your own — tests create and delete maps
   on it), and confirm its email. An unconfirmed account cannot write.
2. In `.env`:
   ```
   E2E_EMAIL=...
   E2E_PASSWORD=...
   DISABLE_ALL_PLAN=true   # or put the test account on Pro; Free allows 1 map
   ```
3. `npx playwright install chromium`
4. `npm run build:embed` — the embed, publish and analytics specs open the real
   bundle, and skip themselves if `public/embed/map.js` is missing.

### Optional accounts — each unlocks specs that otherwise skip

| Set in `.env` | Unlocks |
|---|---|
| `E2E_EMAIL_2` / `E2E_PASSWORD_2` — a second confirmed account | `api-security.spec.ts`'s cross-account checks; `plan-limits.spec.ts` |
| `E2E_ADMIN_PASSWORD` — the console's plain password (`ADMIN_EMAIL` and the hash must be set too) | `admin.spec.ts` (signed in), `notifications.spec.ts`, `news.spec.ts` |
| `E2E_UNVERIFIED_EMAIL` / `E2E_UNVERIFIED_PASSWORD` — an account that signed up and never confirmed | `unverified.spec.ts` |

### Two passes

`DISABLE_ALL_PLAN` and `DISABLE_EMAIL_VERIFICATION` make two kinds of check
meaningless — no limit can be reached, no account is unconfirmed — so those
specs skip while either is on. To run them, switch both off in `.env`, restart
`npm run dev`, and run:

```
npx playwright test e2e/plan-limits.spec.ts e2e/unverified.spec.ts --project=chromium
```

`plan-limits.spec.ts` uses the **second** account and walks it up to its map
ceiling, whatever its plan; the location check needs it on Free.

## Running

```
npm run e2e              # all of it; starts `next dev` unless one is running
npm run e2e:smoke        # the core loop only (@smoke): sign up, maps, pin, import, publish
npm run e2e:ui           # step through visually
npx playwright test e2e/import.spec.ts --project=chromium
npx playwright show-report
```

## What each spec covers

| Spec | |
|---|---|
| `auth`, `public` | Login, logout, signup refusal; every marketing, docs, news and legal page renders |
| `api-security` | 401 signed out, 404 on unknown and **other accounts'** ids, 422s, webhook and cron secrets, the visitor beacon |
| `plan-limits`, `unverified` | Limits enforced by the API; an unconfirmed account can read but not write |
| `maps`, `locations`, `import` | Map CRUD; pin drop, edit, delete, photo, list search and tag filter; CSV, XLSX and hand-mapped columns |
| `tags`, `groups`, `shapes`, `routes`, `card` | Tag colour and **order** (kept into the snapshot); marquee grouping and group pins; drawing, and shapes surviving a basemap change; routes (router mocked); the card designer and per-location overrides |
| `publish`, `embed`, `analytics` | The snapshot contract: search, tag narrowing, republish to the same URL, designer settings, the domain allowlist, attribution, **no metered call in the visitor's path**; one analytics beacon per session |
| `account`, `admin`, `notifications`, `news` | Profile and theme; the console's guard; a notification and a news post round-trip |
| `mobile-editor` (Pixel 7) | The editor's sheet, add-by-search and publish at phone width |

## How it is put together

- `auth.setup.ts` signs each account in and saves the session to
  `playwright/.auth/` (gitignored). **A saved session that still works is
  reused**: logins are limited to ten per account per quarter hour, and signing
  in afresh on every run locked the suite out after a few runs in a row. It
  also opens each heavy page once, because a cold `next dev` compiling a route
  can outlast a test's timeout. Keep `npm run dev` running in another terminal
  and runs start faster.
- **Publishing is limited to 20 per account per 10 minutes.** A full run
  publishes about nine times, so two runs back to back fit and a third may not.
  `embed.spec.ts` publishes one map and shares it for that reason.
- `live.json` is edge-cached for a minute by design, so `readSnapshot` and the
  embed tests add a cache-busting query rather than read a stale copy.
- The onboarding overlay is cleared with "Don't show tips again", not its X:
  the X closes one overlay and the next takes its place under the same name.
- Editing a location right after dropping it waits for the create to finish.
  Until then the row has a `temp-` id the server cannot PATCH.
- `support/fixtures.ts` is the `test` to import: it closes the "Getting started"
  overlay whenever it appears; `testMap` gives a fresh map that is deleted
  afterwards; `secondUser` and `admin` are API contexts for the optional accounts.
- Every test map is named `e2e-…`; `support/global-teardown.ts` deletes any a
  crashed run left behind, on both accounts.
- Nothing spends lookups: the reverse geocode, address search and router are
  answered locally (`support/geocode-mock.ts`, `support/routing-mock.ts`), and
  the import fixtures carry lat/lng.
- Tests that change the account itself (name, card design) put it back in a
  `finally`.
- No `data-testid`s: tests find things by role and label, the way a person does.
  If a control cannot be found that way, fix its accessible name — the Draw
  button had none, and got one.
- Things on a canvas have no element. Pins are DOM markers (`.map-pin`), but a
  shape is a style layer and an embed pin is a canvas symbol, so those are
  checked through what a click does or through the API and the snapshot.
