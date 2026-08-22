"use client";

import { Controller, type Control } from "react-hook-form";

import type { MapTagGroup } from "@/lib/repositories/types";
import type { PlaceFormValues } from "@/lib/validation/place.schema";
import { FormSection } from "./form-section";

/**
 * Which of the map's tags this location wears.
 *
 * Toggles rather than a multi-select, and grouped under their own headings,
 * because that is how the published map presents them: within a group the
 * answers are alternatives, across groups they stack. An owner picking from one
 * flat list of forty chips cannot see which of them are alternatives.
 *
 * Nothing here mints or renames a tag — that is the Filters panel in Settings.
 * This picks from what the map already defines, so a typo cannot create a tag
 * that exists on one location and nowhere else.
 */
export function TagsSection({
  control,
  groups,
}: {
  control: Control<PlaceFormValues>;
  groups: MapTagGroup[];
}) {
  // The section is omitted rather than shown empty: an owner who has not set up
  // filters has nothing to pick, and a disclosure that opens onto "no tags"
  // teaches them nothing about where tags come from.
  const usable = groups.filter((group) => group.tags.length > 0);
  if (usable.length === 0) return null;

  return (
    <Controller
      control={control}
      name="tags"
      render={({ field }) => {
        const selected = new Set(field.value ?? []);

        const toggle = (id: string) => {
          const next = new Set(selected);

          if (next.has(id)) next.delete(id);
          else next.add(id);

          field.onChange([...next]);
        };

        return (
          <FormSection
            title="Tags"
            summary={selected.size === 0 ? "None" : `${selected.size} selected`}
          >
            <div className="space-y-3">
              {usable.map((group) => (
                <fieldset key={group.id} className="space-y-1.5">
                  <legend className="text-xs font-medium text-muted">
                    {group.label}
                  </legend>

                  <div className="flex flex-wrap gap-2">
                    {group.tags.map((tag) => {
                      const isOn = selected.has(tag.id);

                      return (
                        // A real checkbox behind a styled label: the toggle has
                        // to be reachable and announced as a checkbox, and
                        // `aria-pressed` on a button would say the wrong thing
                        // for something that is a set of choices, not an action.
                        // `relative` is required — Tailwind's `sr-only` is
                        // absolute, and without it the hidden input lays itself
                        // out against whatever is positioned further up, which
                        // scrolls the page on click.
                        <label
                          key={tag.id}
                          className={`relative cursor-pointer rounded-lg border px-2.5 py-1 text-sm transition-colors has-focus-visible:inset-ring-2 has-focus-visible:inset-ring-focus ${
                            isOn
                              ? "border-foreground bg-foreground text-background"
                              : "border-border hover:bg-default"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={isOn}
                            onChange={() => toggle(tag.id)}
                          />
                          {tag.label || "Unnamed tag"}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          </FormSection>
        );
      }}
    />
  );
}
