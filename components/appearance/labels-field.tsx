"use client";

import { useId } from "react";

import type { LabelLevel } from "@/packages/shared/style-labels";

/**
 * How much of the basemap's own text to show.
 *
 * Three settings rather than a switch, because "no labels at all" and "all of
 * them" are both wrong for most store locators: a map with no names on it cannot
 * be read, and a map naming every café competes with the pins the customer is
 * paying to show.
 *
 * The middle option says out loud what it drops. That matters more than usual
 * here, because it also hides points of interest — which have their own switch
 * two sections down, and a control that silently overrides another one is how
 * people conclude a setting is broken.
 */
const LEVELS = [
  {
    value: "all",
    label: "All labels",
    hint: "Place names, streets, water and points of interest.",
  },
  {
    value: "some",
    label: "Fewer labels",
    hint: "Place names and airports only — no street names, water names or points of interest.",
  },
  {
    value: "none",
    label: "No labels",
    hint: "Nothing but the map itself. Your own pins still carry their names.",
  },
] as const satisfies readonly { value: LabelLevel; label: string; hint: string }[];

export function LabelsField({
  value,
  onChange,
}: {
  value: LabelLevel;
  onChange: (level: LabelLevel) => void;
}) {
  const groupName = useId();

  return (
    <fieldset>
      <legend className="text-sm font-medium text-foreground">Labels</legend>

      <div className="mt-2 flex flex-col gap-0.5">
        {LEVELS.map((level) => {
          const isSelected = level.value === value;

          return (
            <label
              key={level.value}
              // `relative` for the same reason as the theme tiles: it keeps the
              // visually-hidden radio inside the row it belongs to, so focusing it
              // cannot scroll the page to somewhere else.
              className={`group relative flex cursor-pointer items-start gap-2.5 rounded-lg p-2 transition-colors duration-[var(--duration-fast)] hover:bg-default ${
                isSelected ? "bg-default" : ""
              }`}
            >
              <input
                type="radio"
                name={groupName}
                value={level.value}
                checked={isSelected}
                onChange={() => onChange(level.value)}
                className="peer sr-only"
              />

              <span
                aria-hidden="true"
                className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border transition-colors duration-[var(--duration-fast)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)] ${
                  isSelected ? "border-accent" : "border-border"
                }`}
              >
                {isSelected ? (
                  <span className="size-2 rounded-full bg-accent" />
                ) : null}
              </span>

              <span className="min-w-0">
                <span className="block text-sm text-foreground">{level.label}</span>
                <span className="block text-xs text-muted">{level.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
