"use client";

import { Label, Switch } from "@heroui/react";

/**
 * One on/off answer whose label will not become a glyph.
 *
 * Most of the designer's booleans belong to a set and go in a `PropertyToggles`
 * row. A few do not: "Show the results panel" governs everything under it,
 * "Zoom with the scroll wheel" is a sentence about the visitor's page rather
 * than a thing on the map, and neither has a picture that says it. Those get a
 * line each.
 *
 * **A switch, not a checkbox**, which is the distinction
 * `components/ui/properties/property-fields.tsx` already draws: a checkbox is a
 * property of a draft with a Save button, and a switch is a thing that is *on*,
 * applying the moment it moves. Everything in this panel repaints the map under
 * the pointer, so a switch is the honest control.
 *
 * The label runs first and the control sits at the end of the line —
 * `Switch.Content` is a row, so reversing it and pushing the two apart is all
 * that takes. It gives the words the whole width to wrap into, which is what
 * lets a 20rem column hold "Zoom with the scroll wheel" on one line instead of
 * the two a label-above-box control needs.
 */
export function PropertySwitch({
  label,
  isSelected,
  onChange,
}: {
  label: string;
  isSelected: boolean;
  onChange: (isSelected: boolean) => void;
}) {
  return (
    <Switch
      className="w-full"
      isSelected={isSelected}
      onChange={onChange}
    >
      <Switch.Content className="w-full flex-row-reverse items-center justify-between gap-3">
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Label className="cursor-[inherit] text-pretty">{label}</Label>
      </Switch.Content>
    </Switch>
  );
}

/** The run a group's switches sit in, at the rhythm of one line each. */
export function PropertySwitches({ children }: { children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-2.5">{children}</div>;
}
