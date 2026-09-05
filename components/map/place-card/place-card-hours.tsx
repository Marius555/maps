"use client";

import { Disclosure } from "@heroui/react";

import {
  DAY_LABELS,
  DAY_LABELS_SHORT,
  dayIndex,
  formatDay,
  isEmptyHours,
  isOpenNow,
  type OpeningHours,
} from "@/packages/shared/hours";

/**
 * The week, behind the one line a visitor actually wants.
 *
 * "Can I go now" is the question, and the summary answers it: the state, and
 * today's times beside it. The other six days are one press away, which is what
 * keeps a card with a photo, a name, an address and a paragraph on it from also
 * being seven rows of numbers taller than the map it floats over.
 *
 * **It is a disclosure because the embed's is** (`buildHours` in
 * embed/src/popup.ts, a `<details>`), and the embed is what a customer
 * publishes. This used to draw the whole week with no trigger at all, so the
 * studio was showing a card no visitor has ever seen — the one thing a design
 * tool must not do. `isOpen` is the owner's choice of which state it starts in;
 * absent is closed, which is what every published card already draws.
 *
 * A HeroUI `Disclosure` where the embed builds a bare `<details>`, on the same
 * licence `Details` in components/card/card-block.tsx already takes: both open
 * from the keyboard and say the same thing, and this one turns its chevron the
 * way the rest of the dashboard does. The embed cannot have it (§4).
 *
 * "Open now" is computed at render. It can go stale if the card is left open
 * across a closing time, which is not worth a ticking interval — the card is a
 * glance, not a dashboard.
 */
export function PlaceCardHours({
  hours,
  isOpen,
  longDays,
}: {
  hours: OpeningHours | null;
  /** Start with the week showing. Absent shows only today — see above. */
  isOpen?: boolean;
  /** "Monday" rather than "Mon". */
  longDays?: boolean;
}) {
  if (isEmptyHours(hours) || !hours) return null;

  const today = dayIndex();
  const open = isOpenNow(hours);
  const labels = longDays ? DAY_LABELS : DAY_LABELS_SHORT;

  return (
    /*
     * Uncontrolled, so a visitor can open and close it, with a `key` that is the
     * owner's choice — `defaultExpanded` is read once at mount, and the one
     * place this option changes under a live card is the designer's canvas,
     * where a checkbox that visibly did nothing would be the whole feature
     * failing. Remounting is free here: it is seven rows of text.
     *
     * **Freezing it on the designer's canvas was tried and taken back out.**
     * The week is `flex: none` in a zone that packs at `flex-start`, so opening
     * it does push the blocks under it *in that zone* down — but a click that
     * does nothing is a broken control, and the answer to a block that must not
     * move is the bottom zone, which is pinned and never moves whatever the
     * middle does. `card-canvas.tsx` records the other attempt at this, a
     * `useCardFits` that rewrote the layout to fit and walked every block below
     * the week up the card and left it there. Neither is coming back.
     */
    <Disclosure key={String(isOpen)} defaultExpanded={isOpen}>
      <Disclosure.Heading>
        <Disclosure.Trigger className="flex w-full cursor-pointer items-baseline gap-1.5 text-left">
          <span
            // The state is also spelled out in words, so colour is not carrying
            // it alone for a colourblind reader. Open keeps its own green — it
            // is a state rather than a shade of the block's own text, and an
            // owner picking a colour for the week is not picking one for "you
            // can go there now".
            className={
              open
                ? "card-text card-text--body font-medium text-success"
                : "card-text card-text--body font-medium"
            }
          >
            {open ? "Open now" : "Closed now"}
          </span>
          <span className="card-text card-text--body">
            {formatDay(hours[today])}
          </span>
          {/* On the summary's own line, at its end — the one control that says
              the six other days are here. `ms-auto` rather than a spacer so it
              stays at the card's edge however wide the times are. */}
          <Disclosure.Indicator className="ms-auto size-3.5 self-center" />
        </Disclosure.Trigger>
      </Disclosure.Heading>

      <Disclosure.Content>
        <Disclosure.Body>
          {/*
            `--card-hours-gap` is the owner's row spacing, written on the
            block's own box by `blockStyle`; the fallback is the one pixel the
            embed's list has always drawn (`DEFAULT_HOURS_ROW_GAP`).
          */}
          <dl className="card-text card-text--body mt-1 grid grid-cols-[auto_1fr] gap-x-3 [row-gap:var(--card-hours-gap,1px)]">
            {hours.map((day, index) => (
              <div key={labels[index]} className="contents">
                <dt className={index === today ? "card-text--today" : undefined}>
                  {labels[index]}
                </dt>
                <dd
                  className={`text-right tabular-nums${
                    index === today ? " card-text--today" : ""
                  }`}
                >
                  {formatDay(day)}
                </dd>
              </div>
            ))}
          </dl>
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
