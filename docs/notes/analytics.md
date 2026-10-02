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

- **Every tracked event is also a `pinglide` DOM event on `document`**, with
  `{ type, map, ...data }`, whether or not measurement is on. It is not a request and
  nothing leaves the page, so it needs no switch; it is how an owner forwards map
  activity to their own analytics. `type` and `map` are written after the data, so an
  event's own fields cannot overwrite them. `embed/src/track.test.ts` guards both.
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
- **`sendBeacon`, never `fetch`.** A Directions press must open instantly and never
  be intercepted (`docs/notes/publish-and-embed.md`, Invariants). `sendBeacon` hands
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
- **The asymmetry has one honest readout, and it is not the Analytics tab.** That
  tab's `isMeasuring` reads `settings` as *stored*, so between switching on and
  republishing it says "on" while the live snapshot carries no endpoint — and a
  beacon is answered `204` whether it was stored or dropped, so nothing else
  disagrees either. `/embed/live.html` fetches the snapshot and reports which of
  the two it is; the Publish page's "Open test page" button is how an owner gets
  there. Anyone debugging "analytics says on but there are no sessions" should be
  sent to that page before anywhere else.

### Visitors, without a cookie

- **Unique and returning visitors come from a server-side key, not the
  browser.** `visitorKey` (`lib/analytics/collect/visitor-key.ts`) is a salted
  SHA-256 of the calendar month, the map id, the IP and the user agent, cut to 16
  hex. The embed is unchanged and still stores nothing — the "no cookie and no
  storage" invariant above holds. **The map id is part of the hash and must stay
  there**: without it one person has one key on every customer's site.
- **The key rotates on the 1st, UTC**, which was the owner's choice between a
  day (most private, no cross-day "returning") and a month. A range spanning
  months counts a person once per month. Longer is a longer-lived identifier;
  do not lengthen it without the same conversation.
- **The full IP is never stored.** It is read for the key, then `truncateIp`
  keeps only the network. Rows from before this change hold full addresses and
  age out with retention; `maskIp` renders both forms the same.
- **"Returning" is decided at write time**, by one indexed read
  (`seenThisMonth`, index `idx_mapsessions_map_visitor`) before the row is
  created. A rollup can estimate how many distinct keys there were but cannot
  answer "seen before" for one of them. A failed read records the visit as new.
- **Visitor counts are HyperLogLog sketches** (`lib/analytics/hll.ts`, 1,024
  slots, ~3% error, near exact below a few thousand), two per day — all keys and
  returning keys. They merge by slot maximum, which is a union, so a person on
  two days is one visitor for the pair. Empty sketches are omitted from
  `mapDaily.totals`.
- **Absent means unkeyed.** A rollup with no `unkeyed` field predates visitor
  counting and reads as *all* its sessions unkeyed; the Visitors tile then says
  it only covers visits since counting began, rather than presenting a partial
  figure as the whole. Same rule as §0's "absent means the old behaviour".

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
- **Nothing empty is drawn, and a table with no rows is not a tab.** Only the
  tables are tabbed (`panels/detail-tabs.tsx`); every chart card is drawn when
  it has data and its neighbour takes the room when it does not (`PairRow`,
  `BreakdownGrid`) — never a hand-computed `col-span` per card.
- **Colour follows the metric, on every chart.** `METRIC_COLOR` in
  `charts/chart-colors.ts`, tokens `--an-*` in `globals.css` — the recorded
  exception to the accent-only palette rule. A new chart takes a metric's
  existing colour; it never assigns hues by rank. Re-run the dataviz validator
  if a token moves.
- **A sparkline's margin is at least its stroke width.** A zero day draws on
  the plot's floor; at `bottom: 0` that is the SVG edge and half the stroke is
  cut, so a flat stretch reads as a hairline beside full-weight curves.
- **Charts are client-only and never size themselves.** `charts/lazy.tsx` loads
  recharts with `ssr: false`; the box around each chart is sized by the server
  render so nothing moves when it arrives.
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
map sessions**. Visitor counting adds one indexed read per beacon (the returning
check) and no write, which moves that figure by cents rather than dollars. §2's benchmark — the thing the whole flat-price model exists to
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

**A dashboard, rebuilt 2026-09-27 at the owner's request.** The page had grown
into twelve stacked sections — six bare number tiles, a hand-drawn column chart
stretched across the full width, and eight tables, several drawn even when empty.
It is now four headline cards with sparklines above five tabs (Overview,
Locations, Search, Audience, Activity), with charts drawn by recharts. The
layout rules that came out of it:

- **Nothing empty is drawn.** A card whose data is empty is left out and its
  neighbour takes the row; a tab all of whose cards are left out is not a tab.
  `components/analytics/panels/visible-tabs.ts` holds the tab half of that rule,
  and each panel applies the same tests to its cards — keep the two in step, or a
  tab opens on nothing.
- **Four headline figures, not six.** Searches moved to the Search tab beside what
  they found; directions and calls are one card ("Directions & calls",
  `totals.actions`) with the split written under it.
- **Every headline figure has a per-day series** (`DailyRow`) for its sparkline.
  `visitors` per day is each day's sketch estimated alone, so the days do *not*
  sum to the range's Visitors figure — the traffic card's header therefore reads
  the period total from `totals`, never a sum of the days.
- **The zero leads the Search tab** as its own figure (`searchesUnmatched`), for
  the reason in the note above.
- **Recharts is loaded client-only** through `charts/lazy.tsx` (`ssr: false`, the
  landing page's shape), and **the caller's box owns every chart's height**, so
  nothing moves when the chunk arrives. Constants a server card needs to size a
  chart (`BAR_ROW_PX`) live in the plain `chart-colors.ts`, not beside the chart:
  a constant read through a client reference is not the constant.
- **Colours are `--an-series-*`** in `globals.css`: the accent, then three
  neutral steps, validated in both modes (measurements beside the tokens). A donut
  never shows more than four slices — the rest fold into "Other" — and always sits
  beside a list naming every slice with its share. A single slice draws no donut.
- **The tab lives in `?tab=`**, written with `history.replaceState` (every panel is
  already rendered; switching is not a request). The range switch carries it over.
- **Tables stayed where the question is "which one"** — locations, searches,
  picks, pages, recent visitors — inside cards. Proportions became charts.
- **The heat map only mounts when the Locations tab is opened**, because React
  Aria renders the selected panel alone.

**Revised the same day, again at the owner's request**, and several of the
rules above were reversed:

- **Tabs are for the tables only.** The page-wide tabs hid the heat map a click
  away and gave "Opened, then nothing" a card that took two fifths of a row
  beside a table. The figures, charts and heat map are always on screen now;
  the six tables (locations, opened then nothing, searches, places instead,
  embedded on, recent visitors) share one tabbed card, each tab carrying its
  row count. `?tab=` now names a table, and is omitted for the first.
- **The heat map is always mounted** — its own full-width card under the
  traffic row, with its own empty state. MapLibre therefore loads with the page.
- **Every metric has its own colour** (`--an-visitors`, `--an-visits`, …): four
  headline cards and every chart in the one accent read as one thing drawn
  over and over. The headline row doubles as the legend.
- **More chart forms**: a stacked-column chart of what visitors did per day,
  a donut of what an opened card led to (`view.outcomes`), and countries back
  as a donut beside devices. Donuts of generic slices stop at three named
  slices plus a grey "Other" (three hues validate all-pairs); metric donuts
  keep every slice, in their fixed validated order.
- **Visits and Visitors each say what they count**, in a line under the name
  (`METRIC_COPY` in `sections.ts`).
- **The period is a select again** — the segmented control was reverted.
- **The breakdown row picks its column count from how many cards it has**, not
  `auto-fit`: four cards in three auto-fit tracks wrap three-and-one and leave a
  hole, which is the complaint this revision answered.
- The warning rule down a card's left edge is gone; the tab's count chip is the
  signal now.

**A count column opens on its biggest value.** React Aria starts every
newly-sorted column ascending, which is right for names and wrong for numbers:
pressing "Directions" on a table of busiest locations should not answer with the
five nobody asked directions to.

**The heat ramp was retuned when this stopped being a coverage map.** The
original (4px radius at zoom 0, 14px at zoom 5) was right for its first job:
a customer's own shops seen at city scale, where a tight blob per cluster is the
answer. Visitor origins live two or three zoom levels further out — a country
each — and at that scale 14px is a pinprick you have to hunt for. Measured against
seeded data: six European cities read as six specks at the opening frame, and as
six readable blobs after.

**Three empty states, not one.** Never published, published with measurement off,
and on-and-waiting are three different situations with three different fixes, and
an empty state that does not name the fix is a blank page with a sentence on it.
The third one matters most: the failure mode is a customer who turns it on, sees
an empty page and concludes it is broken.
