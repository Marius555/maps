"use client";

import { useId } from "react";

import {
  SLIDER_STEPS,
  VIEW_TICKS,
  positionOf,
  viewsAt,
} from "@/lib/marketing/cost";

import { CostCardHeader } from "./cost-card";

const NUMBERS = new Intl.NumberFormat("en-GB");

/**
 * Where the decades fall on the track, derived rather than written.
 *
 * `at` used to be the literals 0, 1/3, 2/3 and 1 — true of a three-decade log
 * track and silently wrong the moment the range changes. `positionOf` is the
 * function that puts the thumb there, so asking it where a decade lands means
 * the label and the thumb cannot disagree. The four label strings come from
 * `VIEW_TICKS`, which the survey chart's axis reads too — see the note there
 * for the ICU mismatch that put them in one place.
 */
const TICKS = VIEW_TICKS.map((tick) => ({
  label: tick.label,
  at: positionOf(tick.views) / SLIDER_STEPS,
}));

/**
 * "Monthly map views", as a slider over a log scale.
 *
 * **A native range input, not HeroUI's `Slider`, and for one reason.** React
 * Aria writes the thumb's `aria-valuetext` from the raw value and offers no way
 * to change it, and the raw value here is a position on a log track — a screen
 * reader would hear "34" for fifty thousand views. The native input takes the
 * sentence directly, and brings the keyboard, touch and form behaviour with it.
 * `.mk-range` in globals.css draws it to match the app's sliders.
 *
 * The header row comes from `CostCardHeader` rather than being written here,
 * because the card beside this one has to open on exactly the same line — see
 * that file for what went wrong when both wrote their own.
 */
export function ViewsSlider({
  position,
  onChange,
}: {
  position: number;
  onChange: (position: number) => void;
}) {
  const id = useId();
  const views = viewsAt(position);
  const share = position / SLIDER_STEPS;

  return (
    <div className="mk-range-field">
      {/* The readout is hidden from the tree, not silenced: the input's own
          `aria-valuetext` already says it, and an <output> here would be a live
          region announcing every stop of a drag. */}
      <CostCardHeader
        label="Monthly map views"
        htmlFor={id}
        value={NUMBERS.format(views)}
        valueHidden
      />

      <input
        id={id}
        type="range"
        min={0}
        max={SLIDER_STEPS}
        step={1}
        value={position}
        aria-valuetext={`${NUMBERS.format(views)} views a month`}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mk-range mt-4 w-full"
        style={{ "--mk-range-fill": share } as React.CSSProperties}
      />

      <div aria-hidden="true" className="relative mt-2 h-4 text-xs text-muted">
        {TICKS.map((tick) => (
          <span
            key={tick.label}
            className="absolute top-0"
            style={{
              left: `calc(${tick.at} * (100% - var(--mk-range-thumb)) + var(--mk-range-thumb) / 2)`,
              translate:
                tick.at === 0 ? "0" : tick.at === 1 ? "-100%" : "-50%",
            }}
          >
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  );
}
