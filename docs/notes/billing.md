# Plans, spend and billing

`lib/billing/**`, `lib/repositories/{subscriptions,usage,plan-limits}.repository.ts`,
`app/api/webhooks/billing/**`, `app/(marketing)/upgrade/**`,
`app/(dashboard)/account/**`, `components/marketing/plans/**`, `components/account/**`.

## Invariants

- **A plan's *ceiling* must still be profitable.** `LOOKUP_LIMITS` is sized above
  full entitlement so it never refuses a customer using what they paid for; that is
  only safe while the worst case still costs less than the plan earns. Move one
  and redo the arithmetic below, in the same commit.
- **`cancelled` is not cancelled.** The provider keeps a cancelled subscription
  running to the end of the paid period, so `toStatus` maps it to `active` and
  `currentPeriodEnd` is what closes it. Map it to `canceled` and you revoke a paid
  plan the instant somebody clicks cancel.
- **`getUserPlan` checks the status *and* the date.** The date is the safety net
  for a `subscription_expired` that is never delivered. Absent means no expiry, and
  must keep meaning that.
- **The webhook reads the raw body.** `JSON.parse` then `JSON.stringify` does not
  reproduce the bytes the signature was made over. Never move it to `parseBody`.
- **Eleven subscription events, two payload shapes.** Seven send a subscription
  object; the four `subscription_payment_*` send a subscription-**invoice**, which
  has no `variant_id` and whose `status` is an invoice status. Never read one as
  the other.
- **Assert before the upstream call, record after it.** A request the provider
  refused is not one to bill the customer for.
- **`assertLookupHeadroom` fails open.** An unreadable meter lets the lookup
  through. Do not "harden" this into refusing — an Appwrite wobble would become an
  outage of the product.
- **`recordLookups` never throws.** It runs after the customer's work succeeded;
  anything raised there turns a successful geocode into a failed request.
- **Prices live in two systems.** `lib/marketing/plans.ts` is what a page says and
  `LEMON_VARIANT_*` is what a card is charged. No test can hold them together.
  Change both in one sitting.
- **`/pricing` is statically rendered and must stay so.** Nothing on it may read a
  session. That is the entire reason `/upgrade` exists.
- **`DISABLE_ALL_PLAN` is inert in production**, by a `NODE_ENV` check rather than
  by a plan to delete it.

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

Not done, and deliberately: the "made with" badge (promised in three places,
implemented nowhere — it would also have to fit inside the embed's 517 spare
bytes), and `SESSION_LIMITS.retentionDays`, which is still dead data the legal
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

Lemon Squeezy, chosen in §3 for the merchant-of-record tax handling. Fees, from
their own documentation: **5% + $0.50**, plus **1.5%** on non-US cards, **1.5%** on
PayPal, **0.5%** on subscription renewals, and **1%** on international payouts. On
€19 that is roughly €1.79 a month, about 9.4%.

**The entity on the invoice is not the brand on the dashboard.** They were acquired
by Stripe in 2024 and invoices issued from 6 April 2026 name a different company
from the ones before. `lib/legal/values.ts`'s `billing.merchantOfRecord` is quoted
verbatim by the terms, the privacy policy, the DPA and the cookie policy — so it
must be read off a real invoice in the dashboard, not from documentation or a
search result. Naming the wrong seller in a contract is not a typo.

### Test mode is the key, not a flag

A test key produces test checkouts and test webhooks; a live key produces real
ones. There is nothing in `lemon.ts` that switches between them and nothing that
could be left switched the wrong way on the day real money starts arriving.
`lib/env.ts` reads `LEMON_API_KEY` and falls back to `LEMON_TEST_API_KEY`, so a
development `.env` that already holds a test key needs no rename — and the day of
the first real payment is the worst possible day to be editing variable names.

### Two payload shapes, and the one that bit

Lemon Squeezy sends eleven `subscription_*` events in **two different shapes**, and
the documentation does not put them on the same page:

| Events | `data` is |
|---|---|
| `created`, `updated`, `cancelled`, `expired`, `resumed`, `paused`, `unpaused` | a **subscription** |
| `payment_success`, `payment_failed`, `payment_recovered`, `payment_refunded` | a **subscription-invoice** |

An invoice carries `subscription_id`, `customer_id`, `store_id` and a `status` of
`pending` / `paid` / `void` / `refunded` / `partial_refund`. It carries **no
`variant_id`**, and its status says nothing about whether the subscription runs.

The first version of this handler treated all of them alike. That does not corrupt
anything — `planForVariant` finds nothing and the event is declined — but it logs
*"no plan matches that variant, check `LEMON_VARIANT_*`"* **on every successful
renewal payment**, which is a false configuration alarm on the most routine event
in the system.

Simply dropping the payment events would have been worse, and this is the part
worth keeping in mind. They are the events that fire when a renewal is actually
charged. Ignoring them rests the entire renewal path on `subscription_updated`
always firing alongside — and if it ever did not, `currentPeriodEnd` would go
stale and `getUserPlan` would quietly downgrade somebody whose card had just been
charged. That is precisely the failure direction the date check exists to avoid,
reintroduced by the thing meant to be a safety net.

So a payment event takes `subscription_id` out of the invoice and asks the API
what the subscription now says (`fetchSubscriptionState`). One extra call on a
renewal, and the answer is authoritative rather than inferred from which events
happen to fire together. `toState` is shared by both paths so an event and a
fetch can never be interpreted two different ways.

### Why the webhook is a bare handler

Not `withAuth` (there is no session — the caller is a machine) and not
`withoutAuth` either, because that wrapper consumes the body through `parseBody`
and the signature is over the raw bytes. `request.text()` first, parse after. The
same shape `app/api/collect` uses, for a different reason.

**2xx or the provider retries.** An event we understand but cannot act on — an
unknown variant, a payload with no account in it — answers 200 with a note, because
retrying it tomorrow produces the same nothing. Only a genuine failure of ours is
allowed to be a 5xx, and that is exactly when a retry is what we want.

**Two ways to find the account**, and both are needed. `meta.custom_data.user_id`
is round-tripped through the checkout and is the only link a brand-new subscription
has. A renewal a year later descends from a charge rather than from a checkout and
may carry none, so `findUserByBillingCustomer` is the fallback — which is why
`billingCustomerId` has an index it would otherwise not need.

### Why `/upgrade` exists

`/pricing` is prerendered and imports `lib/marketing/plans.ts` precisely because
the enforcing table is `server-only`. A CTA that knew whether you were signed in
would make the public page dynamic. So the cards are plain links and `/upgrade`
reads the session one navigation later.

It lives in the **marketing** group, not the dashboard one: the dashboard layout
redirects anyone without a session to `/login` before a page in it runs, so a
signed-out visitor pressing a plan would be bounced to a login form with no idea
what became of their choice. Here the page can say what they were buying.

The plan is deliberately *not* carried through signup as a `next` parameter. A
redirect target in a query string is an open redirect waiting to be got wrong, for
a saving of one click.

---

## Setting up a store

`npm run setup:lemon` — idempotent, `--dry-run` supported. It finds the store,
matches variants to plans, writes the four ids and `LEMON_STORE_ID` into `.env`,
and creates or updates the webhook. It generates `LEMON_WEBHOOK_SECRET` only when
there is none, because silently rotating it would leave our value and theirs
disagreeing and every webhook 401ing, which reads as a broken endpoint.

**It cannot create products or variants — the API is read-only for both.** That is
the one manual step, and the script names exactly what is missing and refuses to
write anything until it is done.

**Variants are matched by price and interval, never by name.** A name is something
somebody types; a price and a billing interval are what the customer is agreeing
to and what `/pricing` publishes. It also skips `status: "pending"` variants —
Lemon Squeezy auto-creates a hidden default variant behind every single-variant
product, carrying the product's own price, and those would otherwise match and be
written into `.env`, where they 404 at checkout.

Run it **twice over the store's life**: once in test mode and again in live mode,
because the two have separate products and the API key decides which you see.

## Verifying it by hand

1. **The meter.** Set `LOOKUP_LIMITS.free.perMonth` to 2, import a 5-row CSV.
   The refusal should name the allowance and the reset; the `usage` row should
   hold 2, not 5.
2. **The sweep.** Open a map with more than 200 pins, arm the route tool, count 40
   `routable` calls in the network panel. Reload, arm again — **zero**.
3. **The analytics gate.** On a free account the tab shows the upgrade panel and
   `POST /api/collect` writes nothing. Flip the subscription row to `starter`;
   both resume.
4. **Checkout**, in test mode: `/pricing` → Yearly → Start on Starter → `/upgrade`
   → provider checkout → their test card → back to `/account` showing Starter.
5. **The webhook.** Their dashboard re-sends events. A bad signature must 401, a
   good one must write `subscriptions`, and a replay must change nothing.
6. **Cancellation.** Cancel in the portal: the row stays `active` with
   `currentPeriodEnd` set and the plan is kept. Then hand-set that date to
   yesterday — `getUserPlan` must drop to `free`.
