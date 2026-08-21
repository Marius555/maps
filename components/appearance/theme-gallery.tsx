"use client";

import { Check } from "lucide-react";
import { useId } from "react";

import {
  BASEMAP_SOURCES,
  STYLE_LABELS,
  THEME_KEYS,
  type MapStyleKey,
} from "@/lib/map/style";
import { ThemeSwatch } from "./theme-swatch";

/**
 * Choosing how the map looks by looking at it.
 *
 * This was a select of five words, then a grid of six two-colour chips. It is
 * sixteen now, which is what forced the grouping: `auto` is a *mode*, the five
 * basemaps are different maps, and the ten themes are one map recoloured. Those
 * are three different kinds of choice and a flat grid of sixteen tiles says they
 * are one.
 *
 * Native radios rather than a custom widget: roving arrow-key focus, form
 * semantics and the grouping label all come for free, and there is nothing here
 * a listbox would add. The inputs are visually hidden but still focusable, which
 * is what `peer-focus-visible` on the tile keys off.
 *
 * The grid is `auto-fill` rather than a breakpoint ladder. The old one hardcoded
 * `lg:grid-cols-6` for six tiles and would have had to be re-tuned for sixteen;
 * this one fits whatever it is given, which matters because the same component
 * renders in a 320px popover and in a full-width settings panel.
 */
export function ThemeGallery({
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
      <legend className="text-sm font-medium text-foreground">Map style</legend>

      <p className="mb-3 text-xs text-muted">
        Auto matches light or dark for whoever is looking — your theme here, each
        visitor&rsquo;s own setting on your site. The rest stay as you pick them.
      </p>

      <Group label="Auto">
        <Tile
          style="auto"
          groupName={groupName}
          isSelected={value === "auto"}
          onChange={onChange}
        />
      </Group>

      <Group
        label="Basemaps"
        hint="Different maps, drawn by the tile provider."
      >
        {BASEMAP_SOURCES.map((style) => (
          <Tile
            key={style}
            style={style}
            groupName={groupName}
            isSelected={value === style}
            onChange={onChange}
          />
        ))}
      </Group>

      <Group
        label="Themes"
        hint="The same map, recoloured in your browser. No extra loading."
      >
        {THEME_KEYS.map((style) => (
          <Tile
            key={style}
            style={style}
            groupName={groupName}
            isSelected={value === style}
            onChange={onChange}
          />
        ))}
      </Group>

      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function Group({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-xs font-medium text-foreground">{label}</p>
      {hint ? <p className="mb-2 text-xs text-muted">{hint}</p> : <div className="mb-2" />}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
        {children}
      </div>
    </div>
  );
}

function Tile({
  style,
  groupName,
  isSelected,
  onChange,
}: {
  style: MapStyleKey;
  groupName: string;
  isSelected: boolean;
  onChange: (style: MapStyleKey) => void;
}) {
  return (
    /*
     * `relative` is load-bearing, not decoration. Tailwind's `sr-only` is
     * `position: absolute`, so without a positioned ancestor the hidden radio
     * lays itself out against whatever is positioned further up — which, inside
     * a portalled popover, is somewhere else entirely. Clicking a tile focuses
     * that input, the browser scrolls it into view, and the whole page jumps to
     * a blank area below the app. Anchoring the input to its own tile means
     * "scroll into view" scrolls to something already in view: nothing moves.
     */
    <label
      className="group relative cursor-pointer"
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
        <span className="relative block h-12 w-full">
          <ThemeSwatch style={style} />

          {isSelected ? (
            <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-accent text-accent-foreground">
              <Check aria-hidden="true" className="size-3" />
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
}
