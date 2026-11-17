# Plans, spend and billing

`lib/billing/**`, `lib/repositories/{subscriptions,usage,plan-limits}.repository.ts`,
`app/api/webhooks/billing/**`, `app/api/account/subscription/**`, `app/(marketing)/upgrade/**`,
`app/(dashboard)/settings/billing/**` (and `/account`, now a redirect to it),
`app/api/account/{invoices,subscription/resume,billing-portal}/**`, `app/(marketing)/billing/return/**`,
`components/marketing/plans/**`, `components/account/**`, `components/user-settings/billing/**`,
`components/billing/**`, and the discount codes: `app/admin/discounts/**`,
`app/api/admin/discounts/**`, `components/admin/sections/discounts/**`.
The page itself is described in `docs/notes/settings.md`.

**The provider is Stripe Managed Payments (since 2026-11-17).** Lemon Squeezy stopped taking
new stores, so its adapter was replaced; every Lemon subscription row was test data and was
dropped. `getBilling()` in `lib/billing/index.ts` is the one place that names the provider.

## Invariants

- **A subscription belongs to a workspace, and a workspace is one person's account**, so nothing here changed for teams: `getSubscription` and `getUserPlan` take a `WorkspaceId`, billing pages and routes pass `ownWorkspace(user.id)`, and a member is billed nothing — the owner's plan covers the team. `docs/notes/team.md`.
- **A plan's *ceiling* must still be profitable.** `LOOKUP_LIMITS` is sized above
  full entitlement so it never refuses a customer using what they paid for; that is
  only safe while the worst case still costs less than the plan earns. Move one
  and redo the arithmetic below, in the same commit.
- **Set-to-cancel is not cancelled.** Stripe keeps a subscription with
  `cancel_at_period_end` running to the end of the paid period, so `toStatus` leaves it
  `active` and `currentPeriodEnd` (= `cancel_at`) is what closes it. Map it to
  `canceled` and you revoke a paid plan the instant somebody clicks cancel.
- **`getUserPlan` checks the status *and* the date.** The date is the safety net
  for a `customer.subscription.deleted` that is never delivered. Absent means no
  expiry, and must keep meaning that.
- **The webhook reads the raw body.** `constructEvent` checks the `stripe-signature`
  header over the exact bytes; `JSON.parse` then `JSON.stringify` does not reproduce
  them. Never move it to `parseBody`.
- **The webhook never trusts the event's copy.** Every handled event — the five
  `customer.subscription.*` and `invoice.paid` / `invoice.payment_failed` — is reduced
  to a subscription id (`subscriptionIdOfEvent`; an invoice's is at
  `parent.subscription_details.subscription`) and the subscription is **re-fetched**.
  Stripe does not guarantee delivery order, so an event's snapshot can be older than
  the row; the live read cannot. `BILLING_EVENTS` (in `lib/billing/stripe.ts`, because a
  route file may only export route fields) and `WEBHOOK_EVENTS` in
  `scripts/setup-stripe.mjs` are one list kept by hand.
- **Plans are found by price `lookup_key`, never by an id in the environment.**
  `pinglide_{starter,pro}_{monthly,yearly}`, one product per plan×cadence because a
  coupon can be limited to products but not prices. `lib/billing/stripe-prices.ts`
  caches the catalogue on `globalThis` for five minutes and never caches a failure.
  A price with none of our keys is nobody's plan (`toState` → null → 200
  `handled: false`).
- **The checkout's `success_url` must point outside `proxy.ts`'s matcher**, and so must
  the portal's `return_url`. The session cookie is `sameSite: "strict"` and the buyer
  returns from `checkout.stripe.com` / `billing.stripe.com`, so a return straight to
  `/settings/billing` answers a completed purchase with a login form. `/checkout/done`
  and `/billing/return` exist for this and `lib/billing/stripe.test.ts` asserts the
  first. From `/checkout/done` the client hops to `/maps?checkout=done`, which
  forwards to the last-opened map, where `PurchaseCelebration` (mounted in the
  dashboard shell) opens — "Activating" until the webhook lands, then "Welcome to
  Starter" — and strips the param on close.
- **The account is on the subscription's metadata, nowhere else.** Checkout sets
  `subscription_data.metadata.user_id` (and `client_reference_id`, for the Dashboard's
  eyes only). The webhook reads `subscription.metadata.user_id`, falling back to
  `findUserByBillingCustomer` — which is why `billingCustomerId` has an index.
- **Plan buttons that open a checkout are `CheckoutLink`, a plain `<a>`, never
  `next/link`.** A client navigation to `/upgrade` faded the page to blank while the
  provider created the checkout. A document navigation keeps the page up and gets a
  straight 307. So `/upgrade` must keep no `loading.tsx` or Suspense above it — a
  flushed shell would turn the redirect back into a client one and the blank page.
- **A subscriber's plan change is confirmed first** (`ConfirmPlanChangeDialog`), except
  "Keep …", which only undoes a booked downgrade and charges nothing. It states the
  price and when it starts, never a proration figure (Stripe could preview one with
  `invoices.createPreview`; nothing does yet).
- **A subscription Stripe no longer has is a 200 from us; a 5xx is a 5xx.** Non-2xx is
  how Stripe is told to redeliver, so `fetchSubscription` returns null on a 404 — a
  subscription that does not exist will not exist on the retry either — and throws on
  everything else.
- **Assert before the upstream call, record after it.** A request the provider
  refused is not one to bill the customer for.
- **`assertLookupHeadroom` fails open.** An unreadable meter lets the lookup
  through. Do not "harden" this into refusing — an Appwrite wobble would become an
  outage of the product.
- **`recordLookups` never throws.** It runs after the customer's work succeeded;
  anything raised there turns a successful geocode into a failed request.
- **Prices live in two systems.** `lib/marketing/plans.ts` is what a page says and
  the Stripe price behind each lookup key is what a card is charged. No test can hold
  them together; `npm run setup:stripe verify` compares the amounts. Change
  both in one sitting.
- **`/pricing` is statically rendered and must stay so.** Nothing on it may read a
  session. That is the entire reason `/upgrade` exists.
- **`DISABLE_ALL_PLAN` is inert in production**, by a `NODE_ENV` check rather than
  by a plan to delete it.
- **A subscriber is never sent to a checkout.** A checkout for somebody who already
  pays opens a *second* subscription, charged separately. `billingStanding`
  (`lib/billing/standing.ts`) decides once: `switchable` is moved in place by
  `PATCH /api/account/subscription`, `held` (past due, paused) is pointed at the
  card under Payment, and only `none` gets `/upgrade` — which itself redirects a
  `switchable` account to `/settings/billing`, because `/pricing` is static and
  sends everybody there. A *former* subscriber's checkout reuses their Stripe
  customer (`billingCustomerId`), retrying with the email alone if Stripe refuses it.
- **Absent cadence means unknown, never monthly.** `subscriptions.cadence` is
  optional with no default. Every Stripe row has one (the lookup key carries it); the
  Billing page's `withKnownCadence` backfill is left for rows written before.
- **Every write to `subscriptions` is the provider's own answer, read through
  `toState`.** The writers are the webhook, the change-plan route, the Billing page's
  cadence backfill, and the cancel and resume routes — each from a subscription it
  just read or just updated — and `upsertSubscription` is idempotent, so they can
  arrive in any order. None of them may write a value it inferred.
- **Cancelling is in the app; the merchant of record still does it.**
  `DELETE /api/account/subscription` sets `cancel_at_period_end` (releasing a booked
  downgrade first, because a schedule owns the subscription while attached), and
  `POST …/subscription/resume` clears it. The customer portal has cancelling and plan
  switching **off** (`setup:stripe` configures it), so there is one place for each.
- **`cancelled` is never stored, and is read live.** Our row keeps a cancelled
  subscription `active` (see above), so only the provider can tell "renews" from
  "ends". `subscriptionDetails` asks on every Billing visit. While cancelled, no
  plan change is offered, and the PATCH route refuses one with a 409.
- **The card is changed in Stripe's portal, through our route, per press.** Under
  Managed Payments the API cannot set `default_payment_method`, so Update and Edit
  link `GET /api/account/billing-portal` (`?flow=payment` for Update), which makes a
  portal session on the spot and 303s to it. Never render a portal URL into the page:
  it is short-lived, and a page left open would hold a dead link.
- **Invoices are displayed, never kept.** `invoices.list` by the subscription id on
  the caller's own row (100 at most, paged by ten locally), each linking Stripe's
  `invoice_pdf` (or the hosted page while there is none). Drafts are not shown, and
  an open invoice is "pending" with no link. `lib/billing/types.ts` says what this
  does and does not change about the merchant of record.
- **`billingStanding` reads the row, not `getUserPlan`.** Under `DISABLE_ALL_PLAN`
  the latter answers "pro" for everybody; billing controls taken from it would
  offer a developer a switch away from a plan they never bought.
- **An upgrade starts now; a downgrade starts at the renewal — and Stripe holds the
  wait.** `planChange` (`lib/billing/plan-change.ts`) decides every case. An upgrade
  swaps the item with `create_prorations` (the difference on the next bill); a monthly →
  yearly one with `always_invoice`, so it is **charged today**, less the unused month, and
  `upgradeNote` says so (`upgradeProration`). Measured: `create_prorations` across
  intervals stretches the period to a year and bills nothing until then — Pro monthly →
  yearly became one €741 charge a year later. A downgrade (a lower plan, or yearly → monthly) is a
  **subscription schedule**: the paid price to the period's end, then the new one,
  nothing prorated, `end_behavior: "release"` (`bookedPhases`). Sending a downgrade
  "now, unprorated" instead would *charge at once* whenever the interval changes.
- **The booked downgrade is read from Stripe, never stored.** `scheduledOf` reads the
  schedule's next phase into `SubscriptionDetails.scheduled`, which is what the
  Billing page shows as pending. "Keep …" releases the schedule; an upgrade while one
  waits releases it first and moves up from the plan actually paid for.
- **The `kept*` columns are retired.** Nothing writes `keptPlan` / `keptCadence` /
  `keptUntil` any more; `withKeptPlan` still reads them in `getUserPlan` and is
  harmless with them empty. Do not drop them (CLAUDE.md, "Retired, not deleted").
- **Develop with `stripe listen`.** A deployed endpoint never hears a purchase made
  from `localhost`, and the account page then sees no subscription and offers a
  *checkout* — that is how the first Lemon-era test "switch" bought a second
  subscription. `stripe listen --events … --forward-to localhost:3000/api/webhooks/billing`
  forwards the account's events (the CLI refuses `listen` without `--events`, which is a
  third hand-kept copy of `BILLING_EVENTS`); put the `whsec_…` it prints in `.env`.
- **Discounts live at the provider and nowhere else.** `/admin/discounts` creates,
  lists and retires them through `lib/billing/stripe-discounts.ts` and reads them
  live on every visit; there is no Appwrite table. A copy would be a second answer
  that could disagree with the one that charges cards — the same reason
  `subscriptions` holds only the provider's own answer.
- **One discount is one promotion code with a coupon of its own.** The code carries
  the cap and the expiry; the coupon carries the amount, the duration and the plans.
  Deleting deactivates the code and deletes its coupon; a coupon whose code was
  refused at create is deleted on the spot. Never share a coupon between codes, or
  deleting one would void the other.
- **A discount cannot be edited.** Stripe can change neither a coupon's amount nor a
  code's text. The console offers Duplicate instead; do not build an "edit" that
  deletes and recreates behind the operator's back, because the redemption history
  belongs to the old id and would vanish from the console.
- **There is no "Starts" any more.** Stripe has no scheduled start for a code, so the
  field left the form and the schema; `startsAt` stays in `Discount` and is always
  null, so `discountStatus` is unchanged.
- **A share link carries a code, never an amount or a price.** It opens
  `/pricing?code=…`; the cards' buttons then go to `/upgrade?plan=…&cadence=…&code=…`,
  which looks the code up and sends `discounts: [{ promotion_code }]` — without one,
  `allow_promotion_codes: true`, because Stripe refuses both together. A malformed or
  unknown code is dropped, not refused — the buyer still reaches the checkout, whose
  own code box is there.
- **/pricing learns about discounts after it arrives, from `GET /api/pricing/offer`.**
  The page stays static (see above); the endpoint is public, rate-limited per address
  (`pricingOffer`), and **caches everything for a minute** (`lib/billing/public-offer.ts`)
  so a busy page is not a provider request per visitor. Never cache a failure there.
  It answers only `PublicDiscount`: never a discount's name, cap or use count.
- **One promotion at most, in `promotions`**, set from the console's row menu (Show
  on pricing page). The row names a discount id and nothing else is trusted from it:
  the lookup re-checks the discount at the provider, so an expired or deleted promo
  just stops showing. Deleting a discount clears its promotion. The repository is
  `lib/repositories/promotions.repository.ts`, not under `admin/`, because the public
  lookup reads it.
- **A code is for a checkout only.** A subscriber's plan changes are made in place,
  which takes no code, and `/upgrade` sends a subscriber to Settings → Billing. So
  existing customers cannot redeem one; the form says so.

---

## What prompted all of this

The question asked was whether one paying customer could drain the upstream
providers. They could, and the exposure was larger than one customer. Measured
against the code in September 2026, with both providers on Geoapify's free tier
(3,000 credits/day, 5 req/s):

| One user action | Credits | Bounded? |
|---|---|---|
| Arming the route tool | **200** (`ROUTE_PROBE_LIMIT`) | per arming — **a reload re-spent all 200** |
| One "Sync now" press | **~6,600** (300 steps × ~22 lookups) | presses unbounded |
| One 3,000-row import | **3,000** — an entire free-tier day | imports unbounded |
| One pin drop or drag-end | 1–2 (the hosted reverse is two requests) | unbounded |
| One route drawn or recalculated | 1 (`stops − 1`, one call) | unbounded |

There was **no counter, quota, monthly window or upstream-call logging anywhere**.
Every ceiling was per-action — `MAX_GEOCODE_BATCH` 25, `MAX_SOURCE_ROWS` 3000,
`ROUTE_PROBE_LIMIT` 200, `MAX_STEPS` 300 — and nothing was cumulative.
`geocode/batch` additionally sized its own plan check from a **client-supplied**
`runTotal`, which its own docblock admitted could be understated or re-sent.

**The margin was never the problem; availability was.** At a hosted plan of $59 a
month for 300,000 credits, a realistic Pro customer costs about €0.30 a month in
credits against roughly €35.80 net of the merchant of record's fee. The real
failure is that one burst drains a *shared daily* cap and every other customer's
import dies with no message saying why.

### Note for whoever reads this next: tiles are not this

Self-hosting PMTiles does nothing for any of the above. Tiles are the one part of
the stack in a visitor's path (§2), they are already free and unmetered on
OpenFreeMap, and they are billed by nobody. Everything in this document is the
**geocoder**, which runs on the dashboard when an owner imports, drops a pin or
arms the route tool. The fix for it is Photon on a box of ours
(`docs/self-hosting-geocoding.md`), which is a different machine and a different
budget. Confusing the two is easy and has already happened once.

---

## The competitive check, and why prices did not move

Published list prices, read September 2026:

| | Entry | Mid | Top | Views |
|---|---|---|---|---|
| Atlist | $15 / 100 markers | $25 / 1,000 (routes, Sheets) | — | **1–2k included, $0.009 each after** |
| StoreRocket | $25 / 100 | $39 / 1,000 | $69 / 10,000 | unmetered |
| Storepoint | $25 / 200 | $49 / 2,000 | $99 / unlimited | unmetered |
| Storemapper | $24.99 | $69.99 (**analytics**) | $199.99 (leads) | unmetered |
| **Us** | **€19 / 300** | **€39 / 3,000 × 15 maps** | — | unlimited |

€19 for 300 locations beats both $25 tiers; €39 for 3,000 across 15 maps beats
Storepoint's $49 for 2,000. **Cutting price would blunt the one thing that is the
company** — unlimited views, §2 — and raising it would abandon the wedge while
nobody is yet paying. So the prices stayed and three things changed instead:

1. **Annual, at two months free.** Nobody in the table offers a real annual
   discount. It is also partly self-funding: the merchant of record charges 5% +
   $0.50, plus 1.5% on non-US cards and **0.5% on every subscription renewal**, so
   twelve charges a year cost about €7.70 more to collect on Starter than one does.
2. **Analytics moved behind the paid plans.** It was built and given away while two
   of the four comparables charge $39–$70 a month for it. Nothing had to be built.
3. **Free went from 10 locations to 25.** Ten is not a map anybody falls in love
   with, and 25 costs 25 lookups once.

The "made with" badge was not done then, and is now (2026-09-26): free maps carry
it, `PLAN_FEATURES.noBadge` removes it on Starter and Pro, and the pricing cards
say so in the Views row. It fit because the embed was minified first — see
docs/notes/publish-and-embed.md. Still not done: `SESSION_LIMITS.retentionDays`, which is still dead data the legal
documents already promise.

---

## Sizing the allowance

`LOOKUP_LIMITS`, per account per calendar month: **free 250, starter 4,000, pro
50,000.**

The rule they were chosen by: **above full entitlement, and still profitable at the
ceiling.** Pro is 15 maps × 3,000 places = 45,000 locations, and importing all of
them inside one month has to work — a limit that refuses a customer using exactly
what they bought is a bug with a number attached. 50,000 is that plus slack, and at
roughly $0.20 per 1,000 credits the worst case is about $10 against ~€35.80 net.

So the monthly figure is **not** a thrift measure. What it bounds is scripted
abuse, and it is what finally closes the `runTotal` hole, because the count is kept
server-side and survives the request that caused it.

**Bursts are the daily breaker's job, not this one's.** `DAILY_LOOKUP_BUDGET` is a
pooled row (`userId: "*"`, `period: YYYY-MM-DD`) holding what the whole app has
spent today, checked against the upstream's own daily quota. It is split two ways:

- **interactive** — somebody is watching: address search, pin drop, Directions,
  an import. Spends to the last credit.
- **background** — nobody is watching: the routability sweep, sheet sync, cron.
  Stops at 80%.

Without that split, the first bulk import of the morning takes the day and every
human-facing lookup fails until midnight.

### The counter can undercount, and that is the right direction

Appwrite has no atomic increment — the same fact that produced `mapDaily`. So
`recordLookups` is read-add-write and two concurrent writers can lose one. Accepted,
because a lost write makes the counter **lower** than the truth: the ceiling
arrives late rather than early. A few extra lookups is a rounding error on the
bill; refusing a paying customer who has not reached their limit is a support
ticket. Do not fix it with a lock or a retry loop. If exactness is ever needed the
answer is a row per spend and a rollup, which is what `mapSessions` and `mapDaily`
already are.

---

## The trims that came with it

**The routability sweep no longer re-spends on reload.** `use-routability.ts` held
verdicts in refs that die with the page, so arming the tool cost 200 requests, and
so did the next reload, without limit. `routability-cache.ts` is a `sessionStorage`
cache keyed on the **coordinate**, not the location id.

That keying is the whole argument, and it is why the hook's own refusal to persist
a verdict still stands. A verdict is about a point on the earth, and a point does
not change its mind; move the pin and the key stops matching, so there is no stale
entry to invalidate because a stale entry cannot be read. `sessionStorage` rather
than `localStorage` for the matching reason — roads get built, and a verdict held
for weeks is the same wrongness arriving more slowly.

**503 is no longer retried.** `isRetryableStatus` retried everything from 500 up,
and `DailyBudgetError` is a 503 — which clears when the day turns, not in the four
seconds a backoff waits. Retrying it bought nothing and delayed an honest message
by fifteen seconds. It is the only 5xx excluded, and the only 503 this API emits.

**One trim in the original plan turned out to be unimplementable** and is recorded
here so nobody spends an afternoon rediscovering it. "On a chunk retry, re-send
only the rows that had no answer" cannot be done: a retry fires only when `send()`
*threw*, which means no results came back at all, so the client has no partial
answers to skip. The server-side fix is the one that exists — `recordLookups` bills
what the loop actually got through before failing.

---

## The provider

**Stripe Managed Payments**: Stripe sells the plan as merchant of record — the buyer
sees "Sold through Link" — and collects and remits VAT, which is what §3 asked of
Paddle or Lemon Squeezy. It replaced Lemon Squeezy on 2026-11-17 because Lemon stopped
taking new stores. Enabled per checkout with `managed_payments: { enabled: true }`,
on an API version of 2025-03-31.basil or later (the SDK pins its own; `stripe@23`).

**Fees**, read from stripe.com/pricing and stripe.com/managed-payments on 2026-11-17:
**3.5% per successful transaction**, "in addition to Payments fees" — 1.5% + €0.25 on a
standard EEA card, 2.5% + €0.25 UK, 3.15% + €0.25 international, + 2% where currency
conversion is needed. On €19 from an EEA card that is about €1.20, roughly 6.3%. The
pages say "optional products like Billing … are separate", and whether a Managed
Payments subscription also pays Stripe Billing's own fee is **not confirmed** — read it
off the first real payout before redoing the margin arithmetic above.

What Managed Payments rules out, from its docs: `automatic_tax`, `tax_id_collection`,
`payment_method_types`, `invoice_creation`, `subscription_data.invoice_settings`,
`customer_update[name|address]` on the session; setting a subscription's
`default_payment_method` through the API (hence the portal route); custom checkout
domains; and any product without an eligible tax code (`txcd_10103001`, SaaS for
business use, set by `setup:stripe`). A trial longer than seven days sends Stripe's own
trial-ending emails, which is one reason downgrades are schedules, not trials.

**The entity on the receipt is quoted by the legal documents.** `lib/legal/values.ts`'s
`billing.merchantOfRecord` was filled from link.com/terms ("Link, LLC") and carries a
TODO to confirm it against a real test receipt; which Stripe entity contracts with a
buyer depends on their location (link.com/terms/contracting-entity). Naming the wrong
seller in a contract is not a typo.

### Test mode is the key, not a flag

`sk_test_…` produces test checkouts and test webhooks; `sk_live_…` real ones, with
separate products, prices, webhooks and portal configuration. Nothing in the adapter
switches between them. `STRIPE_PUBLISHABLE_KEY` is not read: hosted Checkout is a
redirect made on the server.

### The adapter

- `lib/billing/stripe-client.ts` — the SDK singleton (on `globalThis`, 10s timeout,
  one retry), `BillingError`, `call()` mapping a Stripe error onto it (a 400 naming a
  `param` becomes a 422 with that field, so a refused code lands under Code), and
  `assertStripeId`, which refuses an id without its prefix — a row left from Lemon
  (numeric ids) is a 404, not a request built from it.
- `lib/billing/stripe-prices.ts` — the lookup keys and the cached catalogue.
- `lib/billing/stripe.ts` — checkout, the reads (`toStatus`, `toState`, `toDetails`,
  `scheduledOf`), the writes (cancel, resume, `changePlan`, `keepPlan`,
  `portalSession`), invoices, and the webhook (`verifyWebhook`,
  `subscriptionIdOfEvent`, `BILLING_EVENTS`).
- `lib/billing/stripe-discounts.ts` — promotion codes and coupons.

**Status.** active, trialing, past_due and paused map to themselves; unpaid,
canceled, incomplete, incomplete_expired and anything unknown to `canceled` — an
incomplete subscription was never paid. `currentPeriodEnd` is
`cancel_at ?? ended_at ?? items[0].current_period_end` (period dates live on the items
since basil).

### Why the webhook is a bare handler

Not `withAuth` (there is no session — the caller is a machine) and not
`withoutAuth` either, because that wrapper consumes the body through `parseBody`
and the signature is over the raw bytes. `request.text()` first, verify, parse. The
same shape `app/api/collect` uses, for a different reason. The body cap is 256KB.

**2xx or Stripe retries.** An event we understand but cannot act on — a price that is
none of ours, a subscription with no account — answers 200 `handled: false`, because
retrying it tomorrow produces the same nothing. Only a genuine failure of ours is a
5xx, which is exactly when a retry is wanted. Events we do not subscribe to are 200 too.

### Why `/upgrade` exists

`/pricing` is prerendered and imports `lib/marketing/plans.ts` precisely because
the enforcing table is `server-only`. A CTA that knew whether you were signed in
would make the public page dynamic. So the cards are plain links and `/upgrade`
reads the session one navigation later.

It lives in the **marketing** group, not the dashboard one: the dashboard layout
redirects anyone without a session to `/login` before a page in it runs, so a
signed-out visitor pressing a plan would be bounced to a login form with no idea
what became of their choice. Here the page can say what they were buying.

Signed out, both of its buttons carry the choice as `?next=/upgrade?plan=…&cadence=…&code=…`
(`components/billing/upgrade-notice.tsx`), so signing up, logging in or Google all end
at the checkout. This was once withheld as an open redirect waiting to be got wrong;
it changed on 2026-10-19 because the cost was not one click — a new customer finished
signup in the dashboard having lost the plan entirely — and because `/signup` and
`/login` now pass every `next` through `safeRedirect`. An unconfirmed account can pay:
`/upgrade` is a GET page and the confirm gate covers `withAuth` writes only, so the
dashboard banner asks for the confirmation after `/checkout/done`.

### Changing a plan that already exists

`PATCH /api/account/subscription` reads the subscription live first (a 502 if Stripe
cannot be read — a change decided on a stale row is how a second charge happens),
refuses a cancelled one with 409, then asks `planChange(billed, target, booked)`:

| Outcome | When | What is sent |
|---|---|---|
| `unchanged` | the target is what is billed and nothing is booked, or is what is already booked | nothing |
| `keep` | the target is what is billed and a downgrade is booked | release the schedule |
| `now` | an upgrade | release any schedule, swap the item; `create_prorations`, or `always_invoice` across intervals |
| `renewal` | a downgrade | schedule `from_subscription`, then `bookedPhases` |

The reply is the row as written from Stripe's answer, plus `kept` describing a booked
downgrade (`{plan, cadence, until}`) so the page's existing props still draw it. Lemon
could not book a change, which is why the `kept*` columns once held the paid plan
ourselves; Stripe keeps billing — and `getUserPlan` keeps granting — the paid plan
until the schedule's phase ends, with no help.

Each column's note (`planNoteFor`, `upgradeNote`) says when its button takes effect;
the paid plan keeps "Your plan" and offers *Keep …*; the booked plan's button is a
disabled *Starts {date}*; and `PlanChangeNotice` states the change, the date and the
new price.

**Seen against the real test-mode API (2026-11-17)**, on a plain subscription built from the
four prices: booking a downgrade schedules Starter from the renewal with no new invoice and
Pro still billed; releasing it leaves Pro and no schedule; Starter → Pro monthly puts €20 on
the next bill (€59 total); Pro monthly → yearly with `always_invoice` charges €351 at once
and €390 a year later; set-to-cancel stays `active` with `cancel_at`; the portal accepts the
`payment_method_update` flow; `invoice_pdf` and `parent.subscription_details.subscription`
are present.

**Then end to end on a real Managed Payments subscription (2026-11-17, local dev with
`stripe listen`)**, through the UI: Checkout (€19 VAT-inclusive, Link's terms, Sandbox) →
`/checkout/done` → "Welcome to Starter", signed in; Starter → Pro monthly, nothing charged
now; Downgrade to Starter booked a schedule (Managed Payments accepts schedules), Keep Pro
released it; Pro monthly → yearly charged **€371** at once (€390 − the unused €39 + the €20
Starter → Pro difference); cancel → "Ends …" with `cancel_at`, resume → "Renews …"; Update
card → the portal's payment-method page → back via `/billing/return` → Billing, signed in.
Every webhook answered 200. One bug found: the invoice table kept its cached first page after
the yearly switch, so `useChangePlan` now invalidates `["invoices"]` too.

---

## Discounts

Made at `/admin/discounts`: a name, a code, a percentage or a euro amount, which
payments it covers (the first, the first N months, or every one), a cap on uses, an
expiry, and optionally the plans it is limited to.

| Form | Stripe |
|---|---|
| Percentage / euros off | coupon `percent_off`, or `amount_off` in **cents** with `currency: "eur"` |
| First payment / first N months / every payment | coupon `duration` `once` / `repeating` + `duration_in_months` / `forever` |
| Plans | coupon `applies_to.products`, the products behind the four lookup keys |
| Code | promotion code `code` |
| Uses | promotion code `max_redemptions` — **total, across every buyer** |
| Expires | promotion code `expires_at` |

Anything not chosen is left out of the request rather than sent as its default.

**Reading them is one request.** `promotionCodes.list({ active: true, limit: 100 })`
with the coupon and its `applies_to` expanded; `uses` is the code's `times_redeemed`.
A product id that is none of our four sets `otherProducts`. `testMode` is `!livemode`.

**"Who used it" scans checkouts.** Stripe has no redemption list, so it pages through
completed Checkout Sessions (500 at most) for the ones whose `discounts` name the code,
reading the buyer's email from `customer_details` and the saving from
`total_details.amount_discount`.

**On the pricing page** a discount lowers a card only when it covers that plan at
that cadence (`discountAppliesTo`); the price is crossed out beside the new one,
and the reserved line under it says what it does ("30% off your first month").
A yearly plan is one payment, so anything short of "every payment" is phrased as
its first year. The discounted figure is drawn in the accent colour.

**An applied code is shown on the prices and nowhere else.** The row beside the
toggle is only ever "Have a discount code?" or the field (unfocused on open, apply
as an icon inside its end) — no "SPRING20 applied" line and no Remove, both taken
out at the owner's request on 2026-10-03: nobody wants to take a discount off.
**The recommended ring follows the discount** (`lib/marketing/recommended-plan.ts`):
one paid plan covered at the cadence on screen → that plan; several → the dearest;
every paid plan, or none → Starter, unchanged.

**The answer is remembered for the tab, and the cards wait for it.** A reload
within five minutes asks nobody (`use-pricing-offer.ts`, `sessionStorage`): every
reload used to re-check the remembered code, ran into `pricingOffer`'s 30-per-10-
minutes limit, and printed "Couldn't check that code right now" at somebody who
had typed nothing. Errors are shown only to whoever asked — a code typed now or
in the link followed; a remembered code is re-checked silently, dropped if
refused, kept if the check fails (`codeUnchecked` on the server's answer is what
tells those apart). A refused typed code never takes off a code already applied.
The cards stay `visibility: hidden` until the answer is in (at most 1.5s), so the
ring and the prices paint once instead of jumping from the static HTML's Starter
to the discounted plan.

**Seen (2026-11-17):** a Managed Payments checkout session accepts both
`discounts: [{ promotion_code }]` and `allow_promotion_codes`. Not yet seen: a code redeemed
through to a paid subscription.

## Setting up the account

1. Switch Managed Payments on in the Dashboard (Settings → Managed Payments).
2. `npm run setup:stripe` — idempotent. It creates the four products (tax code
   `txcd_10103001`) and their prices by lookup key, tax-**inclusive** so the page's
   €19 is what a buyer pays; configures the customer portal (card, billing email and
   tax id, invoice history; cancel and plan switching off; returns to
   `/billing/return`); and, when `APP_URL` is public, creates or updates the webhook
   at `${APP_URL}/api/webhooks/billing`.
3. **The webhook secret is returned once**, when the endpoint is created, so that is
   the only time the script has it. It **prints** it, and writes it into `.env` only when
   `.env` has no `STRIPE_WEBHOOK_SECRET` — in development `.env` holds the `stripe listen`
   one, which a production endpoint's must not overwrite. For production:
   `npm run setup:stripe https://pinglide.com` (the origin beats `APP_URL`), then put the
   printed value on the Appwrite Site. **Options are plain words** — `verify`, `dry-run`, an
   origin — because PowerShell strips the `--` in `npm run x -- --verify` and npm 11 then
   swallows `--verify` itself, so the script does a full run instead of a read-only check. An existing
   endpoint with no secret in `.env` is reported, never silently recreated — rotating
   would leave ours and theirs disagreeing and every webhook 401ing. Reveal it in the
   Dashboard, or delete the endpoint and re-run.

A wrong price is never edited: the script makes a new price on the same product with
`transfer_lookup_key` and archives the old one, so the app moves with no deploy (within
the five-minute catalogue cache). `--dry-run` says what it would do. **`--verify` is
read only** and exits non-zero when an amount, interval, currency, tax behaviour, tax
code, the webhook's events or `STRIPE_WEBHOOK_SECRET` disagree, so it can gate a deploy.

Run it **twice over the account's life**: with the test key and again with the live key.

## Webhooks in development

```
stripe login
stripe listen --events customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,customer.subscription.paused,customer.subscription.resumed,invoice.paid,invoice.payment_failed \
  --forward-to localhost:3000/api/webhooks/billing               # prints whsec_… for .env
stripe events resend evt_…                                        # one event again
stripe trigger customer.subscription.updated                      # a fake one
```

This replaces Lemon's `npm run billing:replay`, which had to sign payloads itself and
therefore could not prove the provider's own signature verified. `stripe listen`
forwards Stripe's real, signed events, needs no tunnel, and also answers "a local dev
server never hears a webhook". A `stripe trigger` subscription is on a price that is
none of ours, so it answers `handled: false` — make a real test checkout to exercise
the write.

The deployed site keeps its own endpoint secret (the one `setup:stripe` wrote); never
put the `stripe listen` one on the Appwrite Site.

## Verifying it by hand

1. **The meter.** Set `LOOKUP_LIMITS.free.perMonth` to 2, import a 5-row CSV.
   The refusal should name the allowance and the reset; the `usage` row should
   hold 2, not 5.
2. **The sweep.** Open a map with more than 200 pins, arm the route tool, count 40
   `routable` calls in the network panel. Reload, arm again — **zero**.
3. **The analytics gate.** On a free account the tab shows the upgrade panel and
   `POST /api/collect` writes nothing. Flip the subscription row to `starter`;
   both resume.
4. **Checkout**, in test mode with `stripe listen` running: `/pricing` → Yearly →
   Start on Starter → `/upgrade` → Stripe Checkout → `4242 4242 4242 4242` →
   `/checkout/done` → `/maps/<last map>` with the "Welcome to Starter" dialog
   ("Activating" first if the webhook is behind). **A login form anywhere in that tail
   is the SameSite bug returning** — see `docs/notes/auth.md`.
5. **The webhook.** A bad signature must 401, a good one must write `subscriptions`,
   and `stripe events resend` must change nothing.
6. **Cancellation.** Cancel plan on Settings → Billing: the row stays `active`
   with `currentPeriodEnd` set, the plan is kept, the Plan card says "Ends …",
   and every plan column offers only Resume. Resume plan: "Renews …" again. Then
   cancel once more and hand-set that date to yesterday — `getUserPlan` must drop
   to `free`.
7. **Switching.** On Pro monthly, *Downgrade to Starter*: the Dashboard shows a
   schedule with Starter from the renewal, no new invoice, and the page keeps Pro
   with *Keep Pro* and the notice naming the date. *Keep Pro*: the schedule is
   released. *Upgrade* Starter → Pro: prorated onto the next invoice. Monthly →
   yearly: invoiced today. Then `/pricing` → *Start on Starter* must land on
   `/settings/billing`, not a checkout.
8. **Card and portal.** Update card → Stripe's portal on the payment-method page →
   its back link → `/billing/return` → Settings → Billing, still signed in.
9. **Discounts.** `/admin/discounts` → *New discount*: `TEST20`, 20%, 2 uses, Pro
   yearly only, expiring next week. It must appear in the Dashboard as a promotion code
   on its own coupon, and a second `TEST20` must be refused under the Code field.
   *Share link* → the checkout opens on Pro yearly with the code applied. Pay; the row
   reads 1 / 2 and *Who used it* names the buyer. *Delete*: the code is inactive and
   refused at the checkout.
