# Marketing pages

`app/(marketing)/**`, `components/marketing/**`, `lib/marketing/**`.

## Invariants

- **Every child of `.mk-snap` holds one screen, and that is a budget with a
  number.** The landing page's snap is mandatory, which is only honest while no
  section overflows. The tallest section needs **688px** of content (the scale
  section, at every width); the gate in `app/globals.css` is
  `(min-width: 64rem) and (min-height: 44rem)`, 704px. Add a row to any section
  and re-measure both (script below) before assuming it still fits.
- **A `container-type: size` box that gets its height from flex stretching
  reports `cqh` as 0.** The hero map's size container is
  `.mk-hero-map__viewport`, an `inset: 0` box, for exactly that reason; the
  frame stays an `inline-size` container because the attribution reads `cqw`
  off it. Put the size container back on the frame and the map is a 2:1 strip
  again.
- **Nothing that changes while the reader watches may change a section's
  height.** Sections centre their content, so one extra line moves everything
  above it. The verdict under the calculator is held at its tallest by
  `Reserve` + `verdictSizers`, with a test; do the same for any new copy that
  varies.
- **`SnapScroll` handles the wheel and nothing else, at `lg` and up, whatever
  the window's height.** Every gesture moves to the next stop in its direction;
  a section taller than the window has a second stop at its foot. It suspends
  the CSS snap (`data-snap-lock`) while it animates, because snapping applies to
  programmatic scrolls too.
- **The survey's figures are real numbers in the served HTML.** `CountUp` zeroes
  them after hydration, not at render. And it sets a string motion value
  directly: a `useTransform` of a number looks equivalent and silently fails
  under React's dev double-effects.
- **Below `lg` there is no snap at all, CSS or JavaScript.** Every multi-column
  grid on the page stacks there, so the sections are *twice* the height of a
  phone screen by design. It used to be `proximity`; the owner asked for it off,
  because even proximity reads as the page being tugged at the end of a flick.
- **The hero map's route is inside the stage, before the pins.** The viewport is
  a size container, which is a stacking context, so nothing on the frame can go
  between the picture and its pins. `HeroRoute` has the post-mortem.
- **Never `Intl.NumberFormat(notation: "compact")` for a traffic figure.** Node
  renders `1M`, Chrome renders `1m`. Use `VIEW_TICKS` / `viewsLabel` from
  `lib/marketing/cost.ts`.
- **The two cost cards align through shared structure, not matched margins.**
  `CostCardHeader` for row one and `CostCardBars` (`mt-auto`) for the bars. Write
  a bespoke header on one of them and the pair goes out of step again.
- **`--mk-series-*` are validated colours.** Re-run the dataviz validator if you
  move one, in both modes, against that mode's panel. The 28 points of lightness
  between the two greys is the number that carries the palette.
- **The survey section must render its numbers without JavaScript.** The chart is
  `ssr: false`; `BillTable` is what the server sends.
- **No competitor is named, and every figure is a published list price or is
  written down as an assumption.** `lib/marketing/compare.ts` holds the sources.

---

## The screen-at-a-time scroll, and what it cost to make true

The page always had the *shape* — `.mk-snap`, `screen` on `Section`, `100svh`.
It did not have the behaviour. Measured on a 1442×732 window:

| Section | Was | Fits 732? |
|---|---|---|
| Hero | 710 (map inside it 1152×**240**) | — |
| Key | 865 | no, +133 |
| Sequence | 732 | yes |
| Scale | 865 | no, +133 |
| Survey | 832 | no, +100 |

Three of the five overflowed, so the CSS had been backed off to
`scroll-snap-type: y proximity` below `min-height: 56rem` — and a 1440×900 laptop
leaves about 732px, under that, so in practice nobody got a firm snap at all. The
56rem was recorded in the file as *measured*, and it was: it was a measurement of
a layout that did not fit, promoted to a rule.

**So the fix was heights, not the snap rule.** What each section gave up:

- **Shared, in `Section`'s `screen` branch:** `py-12 sm:py-16` → `py-10 sm:py-12`,
  the title from `sm:text-5xl` → `sm:text-4xl`, the lede to `text-sm/6 sm:text-base/7`,
  and the content gap `mt-10 sm:mt-12` → `mt-7 sm:mt-8`. /pricing keeps the
  roomier scale — it is a document under a header, not a slide.
- **Key:** three columns at `lg` instead of two, so seven entries are three rows
  rather than four; tighter row gap; bodies trimmed by a line each.
- **Scale:** the restructure into two cards (below), a shorter sources footnote,
  `lg:p-7` on the cards.
- **Survey:** the table moved *beside* the chart rather than under it, which is
  the single biggest saving on the page — stacked they came to 503px.

After that, swept across 1024 / 1100 / 1280 / 1440px wide with the viewport
forced short, the worst any section needed was **685px**, at exactly 1024 where
the three key columns are narrowest and the entry text wraps most.

**Now 688px, and it is the scale section.** Holding the calculator's verdict at
two lines (below) added 24px to it permanently. Re-swept September 2026, content
heights at a 704px-tall viewport:

| Width | Key | Sequence | Scale | Survey |
|---|---|---|---|---|
| 1024 | 685 | 588 | **688** | 662 |
| 1100 | 641 | 605 | **688** | 662 |
| 1280 | 619 | 634 | **688** | 662 |
| 1440 | 619 | 634 | **688** | 662 |

The scale section does not vary because its sentence's measure is capped at
`max-w-2xl`. The gate is 44rem = 704px: 16px of headroom.

**Re-measure with this**, in the console at a few widths with the viewport
emulated short enough that `min-h` is not the binding constraint:

```js
[...document.querySelector('.mk-snap').children]
  .map(el => Math.round(el.getBoundingClientRect().height))
```

### `scroll-snap-stop: always`

Without it a wheel flick crosses several snap points in one gesture and lands
where momentum ran out, which reads as snapping that works sometimes. With it,
one gesture is one screen. Verified by letting each scroll settle: the resting
positions are `0, 732, 1464, 2196, 2928, 3660, 3769` on a 732px viewport — every
section, then the document end.

### The wheel moves the page when the gesture starts, not when it ends

CSS scroll snapping acts when a scroll *ends*: the browser lets a fling play out,
then pulls the page the rest of the way. On a page of whole screens that reads as
arriving almost at a section and being tugged into it, which was reported as
"works, but works bad". No CSS property controls this timing; it is how the
spec defines snapping.

`components/marketing/snap-scroll.tsx` takes the wheel and nothing else. On the
first event of a gesture it animates (Motion's `animate`, the house curve, 0.5s)
to the next stop, and it swallows the rest of that gesture's inertia. A lull of
120ms ends a gesture. A held gesture may step again after 620ms, or a finger
resting on a trackpad would freeze the page. Measured with synthetic wheel
events on a 732px viewport: 282px travelled 60ms after the first event, a second
event in the same gesture swallowed, landing on exactly 732, then `1464` for the
next gesture and `732` for one upward. The stops are read off the DOM, not
written down, and come out as `0, 732, 1464, 2196, 2928, 3660, 3769`, the same
list the CSS makes.

**September 2026: it moves on every gesture, and on short windows too.**
Reported as "it only moves if I'm already near the middle of the next section".
Two causes. The gate was the CSS's mandatory gate, height included, so a window
under 704px tall — any laptop at 125–150% scaling — got no handler and only the
CSS `proximity` snap, which acts near a boundary and nowhere else. And the target
was `nearest stop ± 1`, which from between two stops can land back where the page
already is. Now the gate is `lg` alone, the target is the first stop at least
24px away in the direction of travel, and stops are read at the start of each
gesture rather than cached. A section taller than the window gets a second stop
with its bottom at the window's bottom, so a short window never jumps past the
last lines of one. Measured at 1280×620, one wheel gesture each:
`620, 1240, 1860, 2494, 2562, 3182, 3224, 3333`; the two in-section stops hold
under `proximity` without being pulled back. 1440×800 unchanged:
`800, 1600, 2400, 3200, 4000, 4109`.

Three things about it are load bearing:

- **The CSS snap is suspended while it animates.** Scroll snapping applies to
  programmatic scrolls too, so under `mandatory` each per-frame `scrollTo` is
  re-snapped and the move teleports. `data-snap-lock` on `<html>` switches it
  off (`html[data-snap-lock]:has(.mk-snap)` outranks the snap rule without
  `!important`) and comes off when the move lands, where restoring it is a no-op.
- **Width gate only**, read with `matchMedia`: off below `lg`, where sections
  are taller than a screen by design and there is no CSS snap either, and off
  under reduced motion. Verified: at 390×844 the wheel event is left alone,
  `scroll-snap-type` is `none`, and a scroll left 40px short of a boundary stays
  there.
- **`{ passive: false }` on `window`.** React's root wheel listener is passive
  and cannot cancel, the same trap `use-row-drag.ts` records for `touchmove`.

Keyboard, touch, a dragged scrollbar and `#features` jumps are untouched; they
were never late. A key press or pointer press during a move cancels it.

### Why the footer snaps to `end`

It is 109px tall. Aligned to `start` it claims a whole screen to show a hundred
pixels of links. Aligned to `end` its bottom meets the viewport's bottom, which
is simply where a document stops. It has to keep a snap point of *some* kind:
under a mandatory container, a scroll position with no snap point near it is one
the browser refuses to rest at, and the footer would be unreachable.

### Why the header is the first snap point and the hero is not

A mandatory container snaps to its nearest snap point on load. With the hero as
the first stop the page opened 72px down with the navigation already scrolled
off, every time. The hero is `calc(100svh - var(--mk-header))`, so header plus
hero *is* screen one, and the document's own top is where it starts.

---

## The hero and the map are two screens

The map used to be a `flex-1` sibling of the headline, lede and buttons inside
one `100svh - header`. The words won: the map landed on `.mk-hero-map`'s own
`min-height: 15rem` floor, a **1152×240** letterbox on a 1152px-wide page.

`Hero` is now the words and `MapShowcase` is the map, a screen each. Measured
after: **1152×636** at a 732px viewport, and 1152×904 at a 1000px one. Nothing in
`HeroMap` changed — `.mk-hero-map__stage` is `max(100cqw, 200cqh)` by
`max(100cqh, 50cqw)` against a size container, so the 2:1 basemap covers whatever
frame it is given and the pins, being percentages of the stage, come with it.

`MapShowcase` is deliberately **not** a `Section`: an eyebrow, a title and a lede
are about 175px spent describing the one thing on the page that describes itself.
It has no graticule either — the ruled ground belongs to the hero, and a grid
behind a map is a grid behind a grid.

### The map was letterboxed anyway, on every screen, and worst on a phone

The paragraph above measured the *frame*. The picture inside it was never that
size. Reported on mobile as "full width but the height is very small". Measured:

| Viewport | Frame | Picture (stage) |
|---|---|---|
| 390×844 | 350×764 | **349×174**, a strip in a tall empty box |
| 1442×732 | 1152×636 | **1150×575**, a 30px dead band top and bottom |

`.mk-hero-map` was `container-type: size`, and its height came only from flex
stretching (`flex: 1 1 auto` in a column whose own height comes from
`min-height: 100svh`). Chrome resolves `100cqh` to **0** there. A probe
element of `height: 100cqh` inside the frame measured 0; give the frame a pixel
height and the same probe measured 762. So `max(100cqw, 200cqh)` became
`100cqw` and `max(100cqh, 50cqw)` became `50cqw`: a 2:1 strip the width of
the frame, whatever its height. `flex: 1 1 0%` does not help (probed: still 0).
An `inset: 0` absolutely positioned box does (probed: 762).

The fix is `.mk-hero-map__viewport`, an `inset: 0` size container wrapping the
stage, with the frame demoted to `inline-size`. It has to stay a container of
*some* kind, because `.mk-hero-attrib__text` reads `calc(100cqw - 3rem)` off it
and would silently start measuring the viewport otherwise. After: **1525×762** at
390×844, **1269×634** at 1442×732, the attribution still 301px on the phone, all
38 pins in the stage, and the card still beside its pin.

No JavaScript changed. `useElementSize` reports the content box, which *is* the
viewport box, so `stageBox` / `pinInFrame` had always described the cover crop
the CSS was failing to draw. The old docblock's reasoning ("a stretched item
satisfies a size container") is true of layout and false of container query
units, and it is what hid this.

`ScrollCue` replaced what the map used to do implicitly. A hero with 350px less
in it is a sparse screen with nothing saying another one is under it. CSS
animation rather than Motion, because the arrow points down whether or not it
moves, so the reduced-motion branch is simply the animation removed.

---

## The cost section: two cards, and why they now line up

It was one `mk-panel` with a two-column grid in it. A grid makes columns agree,
not rows, and these rows did not: the left column opened with a 36px row (a label
beside a `text-3xl` readout) and the right with a bare 20px paragraph, so
everything under them was out of step. Measured, the left column's first bar sat
**78px** below the right column's — on a panel whose entire purpose is that the
two sides are read against each other. Nothing was wrong with either half alone,
which is why it survived review.

Two cards now, and the alignment is structural:

1. `CostCardHeader` — one component, so row one cannot drift. It takes `htmlFor`
   (the views card's label belongs to the slider) and `valueHidden` (that card's
   readout is `aria-hidden`, because the slider's own `aria-valuetext` already
   says it; on the other card the readout is the only place the total is stated).
2. Whatever the card is about, in the middle — a slider on one side, the itemised
   breakdown on the other.
3. `CostCardBars`, pinned with `mt-auto`. **This is what actually holds the
   alignment.** The middles will never be the same height for long; pinning the
   bars to the bottom of a stretched card means the bars agree anyway.

Measured after: both cards 566×304, header rows and both bar tracks at identical
y. "Doing it the usual way" sits level with "Metered map platform", and the two
Pinglide rows sit level with each other.

### The verdict under the cards is held at its tallest

Dragging the slider moved the whole section. The verdict sentence has three
shapes (`verdictOf`), and above `lg` the "about the same" one wraps to two
lines while the other two take one. The section centres its content, so crossing
that stretch of the slider grew the block 24px and moved both cards 12px up,
mid-drag. Measured at 1442 and at 1024: `verdictH` 24 → 48, first card's top
2355 → 2343.

`verdictSizers(flat)` walks the slider's own 61 positions and keeps the longest
sentence per branch. `Reserve` (components/marketing/reserve.tsx) renders those
three invisibly in the same grid cell as the live one, so the block is as tall as
the tallest at any width. After: one layout across all 31 sampled positions.
`cost.test.ts` asserts no position produces a sentence longer than its branch's
sizer, so a copy edit that brings the shift back fails a test.

It costs the section 24px for good: 664 → 688 at 1024×704, now the page's tallest
(see the budget table above).

The total moved out of a `text-sm` row and up into card two's header, where it is
the same size and the same line as "50,000" beside it. It is stated once — the
row in the bars carries the label and the stack alone, because the three amounts
that make the total up are itemised above.

---

## The survey section: a line chart, and the log axis argument

Nine bars in three separately scaled columns became three lines. Two reasons, and
the second is the one that matters: the claim is about a *shape* — two bills that
climb with your traffic and one that does not — and three snapshots made the
reader assemble that shape themselves; and it was the page's fourth bar chart in
a row, which is a page that has stopped choosing forms.

### Both axes are log, which `compareRows`' docblock had rejected

That docblock says a log axis needs a paragraph of explanation before it says
anything, and it is right about a bare one. But the alternative is worse: on a
linear bill axis a flat €19 against a $7,000 metered bill is pinned to the
baseline, invisible — which is the exact failure the three separate scales were
working around. So the axis is kept and *labelled*: every tick on both axes
prints a number a reader recognises (1k, 10k, $100, $1,000), and the caption says
in one line that both axes step by ten. The shape then reads without the scale
being understood at all — one line is flat and two are not.

`BILL_AXIS_MIN` / `MAX` / `TICKS` live in `lib/marketing/compare.ts` rather than
in the component, because **a log axis drops a point outside its domain in
silence** — no warning, no gap, just a series that ends early. `compare.test.ts`
asserts every point of `billSeries` lands inside them, so that becomes a red test.

### recharts

Added at the owner's request (CLAUDE.md §3 requires asking). It brings
`@reduxjs/toolkit`, `react-redux` and `immer` transitively. Nothing about the
embed's 48KB budget is affected — ESLint will not let anything under
`/components` reach `/embed` — but it is real weight on a page whose job is to
load fast for a stranger, so it is behind `next/dynamic` with `ssr: false` from a
`"use client"` wrapper. `ssr: false` is legal only inside a client component,
which is why `bill-chart-loader.tsx` exists as a file rather than as a call
inside `Compare`.

### The ICU bug this turned up

`Intl.NumberFormat("en-GB", { notation: "compact" })` does not agree with itself
across our two runtimes:

| | 1,000 | 10,000 | 100,000 | 1,000,000 |
|---|---|---|---|---|
| Node | `1K` | `10K` | `100K` | `1M` |
| Chrome | `1k` | `10k` | `100k` | `1m` |

Measured on one screen: the server-rendered comparison table printed "1M" in a
column beside a client-rendered axis that printed "1m" — not merely inconsistent,
but *milli*, the opposite of a million. Any client component formatting one of
these would also hydrate-mismatch. `VIEW_TICKS` in `lib/marketing/cost.ts` is now
four written strings, shared by the slider's ticks, the chart's axis and the
table's headings, with a test asserting the literals so it cannot be
"simplified" back into a formatter.

### Colours

Two steps of the page's own ink plus the accent — not three hues. That is the
rule at the top of `globals.css` (neutrals at zero chroma, the accent as the only
chromatic voice) and it is also the claim: two of these lines are "somebody else"
and one is us, so ranking the other two by hue would say something the page does
not say.

Validated with the dataviz skill's `validate_palette.js` against the panel each
mode actually draws on:

| Mode | Series | Surface | CVD ΔE | Normal ΔE | Contrast |
|---|---|---|---|---|---|
| light | `#2e2e2e` `#7a7a7a` `#f54600` | `#e9e9e9` | 12.0 | 22.9 | all ≥ 3:1 |
| dark | `#d7d7d7` `#747474` `#f25f36` | `#1d1d1d` | 9.7 | 21.9 | all ≥ 3:1 |

Two checks report FAIL in both modes and both are the validator saying "these are
not three hues" — a lightness band meant for hue slots, and a chroma floor greys
cannot meet by definition. That is the design system, not a defect. The dark
steps are chosen against the dark panel rather than flipped from the light ones.

Identity never rests on colour: the quiet series is dashed, each line is named at
its own end, and `BillTable` repeats the figures as text.

### It draws itself when the reader arrives

Asked for: the numbers start from zero and the lines draw, rather than being on
the page already. Built from what was installed rather than hand-written:

- **The lines are recharts' own animation.** A `Line` with animation on draws by
  growing `strokeDasharray` from nothing to the path's length
  (`lib/cartesian/LineDrawShape.js`), and the dashed locator line keeps its dash
  pattern while it draws. `isAnimationActive` is left at recharts' default
  `'auto'`, which is off during SSR and off under `prefers-reduced-motion`
  (`lib/animation/JavascriptAnimate.js`). Staggered 0 / 140 / 280ms, 1.1s each,
  so ours draws last. recharts withholds a line's label until that line finishes
  (`showLabels = !isAnimating`), so each name appears as its line lands. It gets
  a 0.25s Motion fade on a `<g>`, not `motion.text`, because on an SVG element
  Motion treats `x`/`y` as transforms.
- **When is the loader's job.** Two `useInView` reads of the chart's box: a
  600px margin mounts the chart while the reader is still a screen away, so the
  recharts chunk has loaded before they arrive, and 40% visible sets `draw`. Until
  then the chart holds `NO_DATA` with its axes faded out. The loader now owns the
  chart's height, which used to be written three times.
- **The nine figures count with `CountUp`,** once, on the table's own
  `useInView`. Each sits in a `Reserve` holding its final text, because the
  columns size to their content and "$0" is narrower than "$7,000".
- **The bill axis does not count, and cannot.** It is log with a $10 floor. There
  is no zero on it, and ticks counting from $0 would print values that disagree
  with their gridlines. It fades in with the chart instead.

Measured on the real path (wheel down one screen at a time from the top): the
chart is mounted while the reader is on the scale section with the figures still
at $0, and one more gesture in counts them up (`$3,477` → `$6,371` → `$7,000`)
while the lines draw (metered 33% → 88% → done, ours last). Jump straight in from
the top instead and the chunk is still loading, so the lines trail the numbers by
about half a second in development.

**The served HTML keeps its figures.** `BillTable` became `"use client"`, which
means hydrated, not client-only. The server still prints every figure; `curl`
shows all nine. `CountUp` prints the real value on first render and zeroes it
in a layout effect, after hydration and before paint.

**Why `CountUp` sets a string, not a transform of a number.** The first version
was `useTransform(number, format)`, the same shape as `Amount` in
`cost-bar.tsx`, and it left every figure at its final value. A transform
recomputes on Motion's next frame, and its layout-effect cleanup cancels that
frame. React runs effects twice in development, so the zeroing was scheduled,
cancelled, then not re-sent because the source was already 0. Setting the
displayed string's motion value directly writes `textContent` synchronously.
`Amount` is unaffected: it only ever counts on a change after mount.

### The end-of-line labels are nudged apart on purpose

"Metered" and "Locator" landed 1px apart. That is not a layout accident, it is
the data — at a million views a month the locator's $49 subscription is 0.7% of
the $7,000 of map loads beside it, so the two bills *are* the same bill. Fixed
offsets state that. A collision-avoidance pass that moved them by however much it
took would hide it behind a number nobody chose.

---

## Things that bit, and stay bitten

- **`min-h-0` on the map's column.** A percentage height against a parent grown
  by `flex-grow` resolves to `auto` in Chrome, and the map drops to its 15rem
  floor — the 240px letterbox, again.
- **Recharts types a label renderer's `x`/`y` as `string | number`.** On a line's
  point they are always numbers; `Number()` is the coercion that says so.
- **The theme is `data-theme` on `<html>`, not `prefers-color-scheme`.**
  Emulating the OS colour scheme in DevTools does not switch this site.
- **DevTools viewport screenshots ignore scroll position.** To shoot one section,
  give it `position: fixed; inset: 0` in the console, or shoot by element uid.
- **Reduced motion cannot be emulated through the DevTools MCP.** Stub
  `window.matchMedia` in an `initScript` with a *plain object*
  (`{ matches: true, addEventListener() {}, … }`). One built on
  `MediaQueryList.prototype` throws, because `matches` there is getter-only, and
  the page fails to load.
- **A reload restores the scroll position.** A measurement that walks down the
  page from "the top" starts wherever the last one left off. Navigate with
  `history.scrollRestoration = "manual"` in an `initScript`, then `scrollTo(0, 0)`.
