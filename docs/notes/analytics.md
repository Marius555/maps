# Analytics — design notes

The Analytics tab reports on what the people who use a published map actually
did: what they typed into the search box, which locations they opened, which
controls they pressed, and roughly where in the world they were.

**This file used to describe the opposite.** What shipped first was *content*
analytics — how many locations wore each tag, which cards were missing a phone
number, how well pins were placed — and the second half of the file researched
visitor traffic analytics and explained why it was deliberately not built. The
owner overrode that. The content stats are deleted, the visitor half is built,
and the five blockers this file raised are answered below rather than removed.

## Invariants

### Collection

- **One beacon per session, not one per event.** Every interaction is queued in
  memory and flushed once, on `pagehide`. This is the entire cost argument (see
  *The §2 override* below); a change that makes the embed send per-event breaks
  the justification for the feature existing at all. `embed/src/track.test.ts`
  guards it.
- **A flush is not the end of a session, and the row is keyed so that it is not.**
  The tracker also flushes on `visibilitychange` — which is correct, and is the
  only thing that records a mobile visitor whose tab is discarded without ever
  firing `pagehide`. But *hidden* is not *gone*: pressing Directions opens a new
  tab and hides the page, and the visitor usually comes back. So one visit can
  legitimately arrive as three or four beacons, and `recordSession` keys the row
  on the session id (`sessionRowId`) and appends. **This was wrong for the whole
  first version of the feature**: `ID.unique()` meant a beacon was a row, so an
  engaged visitor counted as several visits and burned several rows of the
  monthly ceiling — silently, because nothing errors and the number merely looks
  good. Measured on real rows before the fix: five rows carrying offsets from a
  single page load — 274ms, 31s, 42s, 237s, 265s.
  `lib/repositories/analytics.repository.test.ts` guards it.
- **Absent `snapshot.analytics` means nothing happens.** No endpoint, no session
  id, no listeners, no timer — `createTracker` returns a no-op. That is what
  every map published before this shipped gets forever, and what every map whose
  owner has left the switch off gets today.
- **`sendBeacon`, never `fetch`.** `embed/dev/dev.html` requires that a
  Directions press open instantly and never be intercepted. `sendBeacon` hands
  the payload over and returns; an awaited `fetch` in a click handler is exactly
  what that rule forbids.
- **`text/plain`, not `application/json`.** `text/plain` is CORS-safelisted, so
  there is no preflight. JSON would double the request count per session, which
  is half the cost argument gone for the sake of a header.
- **No cookie and no storage.** The session id lives in a closure and dies with
  the page. Nothing follows a visitor between page loads or between sites. Do not
  "improve" this by remembering the id.
- **The tracker costs 0.8KB gzipped, all call sites included.** Measured, not
  estimated: 44.6KB → 45.4KB of a 46KB budget. Every call site is an existing
  single chokepoint — `setOpen`, the delegated Directions listener, the
  capture-phase `toggle` — which is why it is that small rather than 3KB.
- **Turning measurement *off* takes effect within the minute; turning it *on*
  needs a republish.** The asymmetry is deliberate. On needs a republish because
  a live snapshot carries no endpoint until one is written. Off is checked
  server-side in `readCollectGate`, because waiting for a republish is defensible
  for a colour and not for somebody withdrawing consent to record their visitors.

### The collector

- **204 to almost everything.** A bot, an unknown map, a domain not on the
  allowlist, a map over its ceiling — all dropped, all answered 204. A stranger's
  page must learn nothing from us: not which map ids exist, not which domains are
  allowed, not whether a map is published. An error status would also print in
  the console of a customer's site, which `embed/src/index.ts` forbids outright.
  A body we cannot parse is the one exception and answers 4xx.
- **Cheap rejections first**: size, then shape, then user agent, then the map.
  The first three cost no database round trip.
- **`lib/repositories/analytics.repository.ts` is the one repository that writes
  on behalf of nobody**, and its head says so at length. `recordSession` takes no
  `RepoContext` because there is no user; the allowlist stands in for
  authorisation and is anti-abuse, not security. Every *read* in that file takes
  a context and opens with `getMap`, like the rest of the directory.
- **Nothing throws a `PlanLimitError`.** A map at its monthly ceiling is not a
  customer doing something wrong: the write is dropped, the map keeps working for
  every visitor, and the dashboard says collection is paused.
- **The gate is cached in-process for a minute** and its count is carried forward
  locally between refreshes. It can over-admit up to a minute of traffic, which
  is the correct way to be wrong — a ceiling is a spend guard, and refusing a
  paying customer's visitors to save a hundred rows is the expensive mistake.
- **Nothing about geography is invented.** A field the host's headers did not
  carry is stored null. A row that says it does not know where a visitor was is
  worth more than one holding a country's midpoint and looking like a
  measurement. The centroid fallback happens at *read* time, in the view.
- **The session is dated from our clock**, as now minus its own longest event
  offset. A browser's clock can be years out, and the monthly ceiling and every
  figure on the page are bucketed by that date.

### The page

- **`lib/analytics/**` holds the arithmetic and no copy;
  `components/analytics/sections.ts` holds the copy and no arithmetic.** Kept from
  the deleted content stats, for the same reason: a count that quietly disagrees
  with the label beside it is the failure mode here.
- **A `DayFold` must be mergeable and must survive JSON.** Every field is a
  counter or a bag of counters — no averages, no maxima, no ratios. Those are
  derived in `view.ts` from the merged whole, where they are still correct.
- **A rollup is written once and never recomputed**, so it must never be written
  from a truncated read. `listSessions` reports truncation for this reason alone.
- **`heatFeatures` normalises weights against the busiest point.**
  `heatmap-weight` multiplies `heatmap-intensity` and the ramp saturates: hand it
  a raw count of 500 and every blob is the top colour, which is a picture with no
  information in it.
- **`heatmap-color`'s stop at density 0 must be fully transparent.** MapLibre
  interpolates that ramp across the whole canvas, so a coloured zero stop tints
  every pixel including the ocean.
- **The heat ramp is one hue with monotone lightness, and the anchor flips with
  the basemap.** Two arrays, not one: on a light basemap the dense end must be
  dark, on a dark one it must be light, and this app ships sixteen looks. Hex,
  not `oklch()` — MapLibre's colour parser predates CSS Color 4.
- **The container div is `h-full`, never `absolute inset-0`.** MapLibre's
  constructor adds `.maplibregl-map` and its stylesheet sets `position: relative`
  on that class, at the same specificity as Tailwind's `absolute` and injected
  after it.
- **Only three fields of a location cross to the client** — id, name and
  coordinates — for the table's names and the interaction heatmap's points.

## The §2 override, and the arithmetic that makes it survivable

CLAUDE.md §2 is the business model: nothing we pay for per request may run in the
visitor's path. A beacon is exactly that, and this file previously called it *"a
pricing decision before it is a build"*. Here is the decision.

Batched to one flush per session, a visit costs **one row and a handful of
executions** — the flush count varies with how often the visitor hides the page,
but the row does not, because the row is keyed on the session (see the second
invariant above).
On Appwrite Pro ($25/mo, 3.5M executions and 750K writes included, then $2 per
million executions and $1 per million writes) that is roughly **$3 per million
map sessions**. §2's benchmark — the thing the whole flat-price model exists to
beat — is Google at **$7 per thousand**. The model survives by three orders of
magnitude.

Two guards keep it there, and both matter more than they look:

1. **The batching.** Forty interactions in one request rather than forty
   requests. If that ever changes, the arithmetic above is wrong by a factor of
   twenty and the feature is no longer defensible.
2. **The monthly ceiling per map** (`SESSION_LIMITS` in `plan-limits.ts`). Without
   it one abusive site can spend real money, and the number above is unbacked.

`§6`'s plan table reads "unlimited (badge shown)" under Views, and that stays
true: the ceiling caps rows we *store*, not maps a visitor may load. A map past
its ceiling keeps working perfectly for every visitor; it stops being measured
until the month turns.

## The five blockers, answered

This file listed five things that had to be true before any of this could be
built. None of them was writing the code, and all five are still the right
questions.

1. **§2 is the business model.** Answered above, with a number. Recorded as an
   override rather than a reinterpretation — §11 still says analytics dashboards
   are out of scope for v1, and this is the second deviation from it, after the
   content stats and alongside the routes-before-Week-4 call in §0.
2. **No ingest surface exists.** There is one now, in all three places the file
   named: `app/api/collect/route.ts` (public, `withoutAuth`-shaped), a CORS entry
   for exactly `/api/collect` in `next.config.ts`, and nothing in `proxy.ts`,
   whose matcher already excluded `/api`.
3. **§4's embed budget.** The budget was **not raised**. The tracker and every
   call site cost 0.8KB gzipped, measured — 45.4KB of 46KB. The file's own
   estimate of the remaining headroom was stale (it said 3.3KB when the real
   figure was 1.6KB), which is why the first thing done was to measure.
4. **Appwrite cannot count.** Still true, and the answer is a **lazy daily
   rollup**: a completed day is folded the first time anybody asks for a range
   containing it, written to `mapDaily`, and read from there forever after. No
   cron, no scheduled function, no new deploy target. A warm load is four reads
   whatever the range.
5. **Privacy.** *Partly* answered, and the unanswered part is the honest gap. No
   cookies, no cross-site identifier, coarse geography, an owner-facing switch
   that stops collection immediately, and a panel in the designer that names the
   IP address before the owner turns it on. **What is still owed is legal work,
   not a build: a DPA and a privacy notice, before the first paying EU customer.**
   MoR billing exists for EU VAT, so there will be one. Bot traffic *is* filtered
   (`lib/analytics/collect/bots.ts`) — unfiltered, the numbers would be fiction.

## Notes

**The one thing on this page a customer would pay for is a zero.** "Sixty people
searched Kaunas" is a statistic. "Sixty people searched Kaunas and found nothing"
is their next shop — and it is a fact no other tool of theirs can produce,
because the search happens entirely inside a map on their own site. That is why
the embed reports a match count beside every query rather than just the words,
and why the zero rows are called out in words rather than left to be spotted in a
column of numbers.

**Which host we are on is an open question, and the design does not depend on the
answer.** Appwrite Sites is the plan: Next 16 is supported day one, the runtime
is a container rather than serverless shims, and it is co-located with the
database. But Appwrite documents **no geo header at all** — it sets
`x-appwrite-client-ip` and nothing about country or coordinates — while Vercel
documents four and Cloudflare in front of either adds a country free.
`geo-headers.ts` therefore reads all three families in order and takes whatever
answers, and logs once per process which family it was. **Read that log after the
first deploy and write the answer here**; it is undocumented upstream and is not
worth asserting from a plan.

**Tiles here, tables everywhere below them** — and the deleted content stats
argued the opposite, at length, so the exception is worth stating. That argument
was about *comparison*: which tag nothing is wearing, which column of the card is
empty, questions answered by running the eye down a column. The five headline
figures are not a set to compare; they are five quantities in five units, and
putting "Map loads: 1,284" beside "Searches: 31" in one column invites a
comparison that means nothing. Everything below them is still a table.

**Five tiles, five different questions.** The first draft counted map loads *and*
visits, which are the same number on every map with one embed per page — one tile
saying the other's number. They are now the funnel a store locator actually has:
somebody arrived, opened a shop, searched for one, asked for directions, called.

**The heat ramp was retuned when this stopped being a coverage map.** The
original (4px radius at zoom 0, 14px at zoom 5) was right for its first job:
a customer's own shops seen at city scale, where a tight blob per cluster is the
answer. Visitor origins live two or three zoom levels further out — a country
each — and at that scale 14px is a pinprick you have to hunt for. Measured against
seeded data: six European cities read as six specks at the opening frame, and as
six readable blobs after.

**A count column opens on its biggest value.** React Aria starts every
newly-sorted column ascending, which is right for names and wrong for numbers:
pressing "Directions" on a table of busiest locations should not answer with the
five nobody asked directions to.

**The chart is flex-boxed divs, not an SVG.** An SVG needs a viewBox, a viewBox
needs a width, and a fluid one therefore needs a ResizeObserver and a re-render
per resize — for a chart whose only geometry is how tall each column is.
Percentage heights in a flex row are fluid for free. Text is the case where SVG
earns it, and there is exactly one label.

**The chart's accessible name is one sentence, and the table under it is
separate.** Pointing `aria-labelledby` at the whole `figcaption` read the table
out as part of the name — the table announced twice, once as a label and once as
itself.

**Three empty states, not one.** Never published, published with measurement off,
and on-and-waiting are three different situations with three different fixes, and
an empty state that does not name the fix is a blank page with a sentence on it.
The third one matters most: the failure mode is a customer who turns it on, sees
an empty page and concludes it is broken.
