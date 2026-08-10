"use client";

import { Check } from "lucide-react";
import { useId } from "react";

import {
  AUTO_STYLE,
  MAP_STYLES,
  STYLE_LABELS,
  STYLE_SWATCHES,
  type MapStyleKey,
} from "@/lib/map/style";
import { darkenSurfaceColor } from "@/packages/shared/darken-style";

/**
 * The swatch: the style's land colour with its water cutting a corner, which is
 * the least drawing that still reads as a map rather than a paint chip.
 *
 * `auto` has no colours of its own, so it shows both of its states split down the
 * middle — the control looks like what it does. Its dark half runs the *same*
 * `darkenSurfaceColor` the map runs, so the tile cannot end up promising a shade
 * the basemap doesn't deliver.
 */
function swatchBackground(style: MapStyleKey): string {
  const paint = (
    key: keyof typeof STYLE_SWATCHES,
    transform: (color: string) => string = (color) => color,
  ) => {
    const { background, water } = STYLE_SWATCHES[key];
    return `linear-gradient(135deg, ${transform(background)} 58%, ${transform(water)} 58%)`;
  };

  if (style !== "auto") return paint(style);

  return `${paint(AUTO_STYLE)} left / 50% 100% no-repeat,
          ${paint(AUTO_STYLE, darkenSurfaceColor)} right / 50% 100% no-repeat`;
}

/**
 * Choosing a basemap by looking at it.
 *
 * This was a select of five words, which asked the user to already know what
 * "Positron" looks like. The swatches are built from each style's own
 * `background` and `water` colours (see STYLE_SWATCHES), so a tile cannot drift
 * from the tiles it stands for.
 *
 * Native radios rather than a custom widget: roving arrow-key focus, form
 * semantics and the grouping label all come for free, and there is nothing here
 * a listbox would add. The inputs are visually hidden but still focusable, which
 * is what `peer-focus-visible` on the tile keys off.
 */
export function BasemapPicker({
  value,
  onChange,
  error,
}: {
  value: MapStyleKey;
  onChange: (style: MapStyleKey) => void;
  error?: string;
}) {
  // Several of these could share a page; radios group by `name`.
  const groupName = useId();
  const errorId = useId();

  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <legend className="text-sm font-medium text-foreground">Basemap</legend>

      <p className="mb-2 text-xs text-muted">
        Auto matches light or dark for whoever is looking — your theme here, each
        visitor&rsquo;s own setting on your site. The rest stay as you pick them.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {MAP_STYLES.map((style) => {
          const isSelected = style === value;

          return (
            <label
              key={style}
              className="group cursor-pointer"
              title={STYLE_LABELS[style]}
            >
              <input
                type="radio"
                name={groupName}
                value={style}
                checked={isSelected}
                onChange={() => onChange(style)}
                className="peer sr-only"
              />

              <span
                className={`block overflow-hidden rounded-xl border transition-[border-color,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)] ${
                  isSelected
                    ? "border-accent shadow-sm"
                    : "border-border group-hover:-translate-y-px group-hover:border-muted/50"
                }`}
              >
                <span
                  className="relative block h-12 w-full"
                  style={{ background: swatchBackground(style) }}
                  aria-hidden="true"
                >
                  {isSelected ? (
                    <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-accent text-accent-foreground">
                      <Check className="size-3" />
                    </span>
                  ) : null}
                </span>

                <span
                  className={`block truncate border-t border-border px-2 py-1.5 text-xs ${
                    isSelected
                      ? "font-medium text-foreground"
                      : "text-muted group-hover:text-foreground"
                  }`}
                >
                  {STYLE_LABELS[style]}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
