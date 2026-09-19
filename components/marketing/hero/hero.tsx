import { LinkButton } from "@/components/ui/link-button";

import { ScrollCue } from "./scroll-cue";

/**
 * The hero: the page's whole argument in words, on a screen of its own.
 *
 * Who it is for, what it is, and the two ways in — read top to bottom in one
 * column. The buttons sit directly under the sentence they act on; they used to
 * be pushed to the far right of it on wide screens, where they read as floating
 * loose rather than as the end of the paragraph.
 *
 * **The map used to be in here and is now the screen below** (`MapShowcase`).
 * It was a `flex-1` sibling of this copy inside one `100svh - header`, which
 * meant the words took the screen and the map took what was left: measured at
 * 1442×732, a 1152×240 letterbox sitting on `.mk-hero-map`'s own 15rem floor.
 * Two screens give the words their screen and the map its own, and the snap
 * (globals.css) is what carries the reader from one to the other.
 *
 * **It still holds the first screen, header included.** `--mk-header` is the
 * header's own height (globals.css), subtracted because the header is above this
 * section rather than inside it — without that the first thing a visitor sees is
 * a hero already a header short of fitting. That is also why the first child of
 * `.mk-snap` is not a snap point of its own: header plus hero *is* screen one.
 */
export function Hero() {
  return (
    <section className="relative flex min-h-[calc(100svh-var(--mk-header))] flex-col px-5 pt-8 pb-8 sm:px-8 sm:pt-10 sm:pb-12">
      <div
        aria-hidden="true"
        className="mk-graticule pointer-events-none absolute inset-0"
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center">
        {/* Who this is for, said first and in the margin, the way a map sheet
            names what it covers before you read the map. */}
        <p className="mk-eyebrow text-muted">
          Store locators for 40–500 locations
        </p>

        <h1 className="mk-display mt-5 max-w-4xl text-[2.75rem] text-balance text-foreground sm:text-6xl lg:text-[4.75rem]">
          All your <span className="text-accent">locations</span>,
          <br />
          on your own site.
        </h1>

        <p className="mt-6 max-w-xl text-lg/8 text-pretty text-muted sm:mt-8">
          Import a spreadsheet, style the map, paste one line of code. No API
          keys, no developer, and the bill does not move when your traffic does.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <LinkButton href="/signup">Start free</LinkButton>
          <LinkButton href="/docs" variant="tertiary">
            Read documentation
          </LinkButton>
        </div>
      </div>

      {/* Outside the centred column, hard against the foot of the screen: it is
          a property of the page rather than the end of the paragraph. */}
      <ScrollCue label="See the map" />
    </section>
  );
}
