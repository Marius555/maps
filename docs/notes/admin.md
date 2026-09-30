# Admin console — design notes

The operator console at `/admin`: one configured account, seven pages (Overview, Users,
APIs, Email, Billing, Maps & traffic, Notifications), read across every customer account.
Notifications is the one page that writes — `docs/notes/notifications.md`.

## Invariants

- **The admin is not an Appwrite user, and its cookie is not the customer session.**
  `admin_session` (`__Host-admin_session` in production) is an HMAC-signed token from
  `lib/admin/auth/session.ts`. Nothing in `lib/auth` reads it, and it reads nothing from
  `lib/auth`. A customer signed in on the same browser is unaffected.
- **Three env values or no console.** `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`,
  `ADMIN_SESSION_SECRET` (≥ 32 chars). Missing any one of them: `/login/admin` and `/admin`
  404, and `POST /api/admin/login` 404s. Same posture as `LEMON_WEBHOOK_SECRET`.
- **The password exists only as a scrypt hash, in a format with no `$`.** Next's
  dotenv-expand reads `$N` as a variable and silently corrupts a `$scrypt$…` value.
  `npm run admin:hash` makes one; `lib/admin/auth/password.ts` verifies it. Both must agree
  on the format.
- **Sessions are stateless and revoked two ways**: an 8-hour `exp`, and a fingerprint of
  the password hash in the payload. A new `ADMIN_PASSWORD_HASH` signs every admin session
  out. Rotating `ADMIN_SESSION_SECRET` does the same.
- **Every metrics loader in `lib/admin/metrics` starts with `requireAdmin()`.** The layout
  guards the first load. It does not re-render on a client navigation, so each page calls
  `requireAdminPage()` too. The loader check is the backstop: a page that forgets its own
  check still cannot read anything.
- **Writes are `withAdmin` route handlers, never server actions** — `/api/admin/notifications`
  is the only one besides login and logout. `withAdmin` passes the route's params as its
  second argument.
- **`lib/repositories/admin/**` is deliberately not owner-scoped**, and must not be imported
  by a customer route. It is the only place in the app that reads across accounts.
- **Login is throttled per IP (5 / 15 min) and globally (20 / 15 min)**, counting every
  attempt, successes included. It always spends one scrypt, against a decoy when the email
  is wrong, so neither the message nor the timing reveals which half was right. The
  throttle is in-memory and best effort, as `lib/auth/throttle.ts` says; the scrypt cost is
  the defence that survives a restart.
- **API calls are counted batched and best effort.** `lib/api-usage/counter.ts` tallies in
  memory and flushes every 15s, one read-add-write per (day, provider, kind) that moved. A
  restart loses at most one window. The count is taken inside each transport
  (`geoapifyGet`, Photon's `requestFeatures`, OSRM's `requestOsrm`), so retries count: each
  one is a credit. The billing meter is `usage.repository.ts` and is untouched.
- **The email log can never fail a send.** `sendEmail` writes one `emailLog` row after it
  has Resend's answer, catching its own failure. The recipient is stored masked
  (`lib/email/mask.ts`). `template` is required on `sendEmail`, so a new caller cannot send
  without a label.
- **Colours come from the Analytics tab's validated `--an-*` tokens, in validated orders**
  (`lib/admin/colors.ts`). There are no new hues. A colour follows its thing (Geoapify is
  blue everywhere). Colour is for chart series and splits only — never an icon tile.
- **The shell is the customer shell's parts.** Rows are `SidebarNavItem`, the rail has the
  customer sidebar's width, header and footer menu, and below `md` it is the same HeroUI
  `Drawer`. The console once had its own tinted rail with a coloured icon chip per link; a
  second design language for one person's tool is not worth keeping in step.
- **Every page is built from three blocks** (`components/admin/kpi/`): `StatStrip` (figures
  about today, in one card), `MetricTabsCard` (the period's figures as tabs, each over its
  own daily chart), `SplitBar` (part-to-whole splits, several to one card). A figure and its
  daily chart are one tab, never a KPI card plus a "per day" card; a breakdown that a table
  on the page already has as rows is not also drawn as a chart; a value derived from another
  (ARR = MRR × 12) or a config fact (which provider answers) is a note, not a figure.
- **Date inputs are HeroUI `DatePicker`** (`components/ui/form-date-time-field.tsx`), never
  `datetime-local` — the native popover is the OS's, not ours. The form value stays a
  wall-clock string, so the schema and the ISO conversion did not change.
- **Login stays pending until the console paints.** `isSubmitting` ends when the navigation
  *starts*; `isLeaving` holds the button until the document is replaced (and `pageshow`
  clears it on a bfcache Back). `app/admin/loading.tsx` is the other half: the layout is a
  cookie check only, so the shell and skeleton stream at once and the slow metrics load
  inside the console.

## What the numbers are and are not

- **Lookups billed** reads the pooled `"*"` rows of `usage`. It is zero in development
  while `DISABLE_ALL_PLAN` is set, because that switch turns the meter off.
- **Upstream requests** start at the deploy that added `apiCalls`; there is no history
  before it. The APIs page says when counting began.
- **Emails** start at the deploy that added `emailLog`, for the same reason.
- **Map sessions per day** are exact (one `total` count per day over `mapSessions`, using
  `idx_mapsessions_day`). Countries, host sites and devices come from a capped sample of up
  to 3,000 sessions, and the cards say so.
- **Monthly revenue** is an estimate from `MARKETING_PLANS` prices: yearly plans are spread
  over 12 months, tax and coupons are ignored, and "paying" is read the way `getUserPlan`
  reads entitlement.
- **Users** reads at most 5,000 accounts per load. The Accounts tile says when that cap is
  reached.
