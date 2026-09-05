"use client";

import { Button, Popover } from "@heroui/react";
import { Filter } from "lucide-react";
import { useState } from "react";

import { UNTAGGED_FILTER_ID } from "@/lib/places/place-filters";
import type { MapTagGroup } from "@/lib/repositories/types";
import { TagToggleChip } from "./tag-chip";

/**
 * Narrowing the locations list by tag.
 *
 * Multi-select, and that is why it is a popover of checkboxes rather than
 * another `SelectControl` beside the Show picker: a select holds one value, and
 * one tag at a time cannot express the question tags exist to answer. It is the
 * same control the published map gives a visitor, in the shape a dense dashboard
 * table can afford.
 *
 * Since categories merged into tags this is the list's only vocabulary filter,
 * which is why **Untagged** is here. The Category picker it replaced had a "No
 * category" option, and that is the one question an owner asks straight after an
 * import: which rows did nothing land on.
 *
 * The rule it feeds is `matchesTags` in packages/shared — **not a copy of it
 * here**. That function is shared with the embed precisely so the owner's
 * filtered list and the visitor's filtered map cannot come to disagree about
 * what "sells bikes and opens Sundays" means.
 *
 * Grouped under their headings, like `BulkTagMenu`, because a tag on its own
 * does not say which question it answers and two groups can reasonably both
 * hold "Standard".
 */
export function TagFilterMenu({
  groups,
  selected,
  onChange,
}: {
  groups: MapTagGroup[];
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Nothing to offer on a map with no tags — including Untagged, which on such
  // a map is every location and narrows nothing.
  const usable = groups.filter((group) => group.tags.length > 0);
  if (usable.length === 0) return null;

  const isUntagged = selected.has(UNTAGGED_FILTER_ID);

  /*
   * Untagged and a real tag are mutually exclusive, in both directions.
   *
   * A location wearing nothing cannot also wear Bikes, so the combination can
   * only ever return an empty list — and a control that can be put into a state
   * with no possible answer reads as broken rather than as strict. Picking
   * either simply drops the other, with no error to dismiss.
   */
  const toggle = (id: string) => {
    const next = new Set(selected);

    if (next.has(id)) next.delete(id);
    else next.add(id);

    next.delete(UNTAGGED_FILTER_ID);
    onChange(next);
  };

  const toggleUntagged = () => {
    onChange(isUntagged ? new Set() : new Set([UNTAGGED_FILTER_ID]));
  };

  return (
    <Popover.Root isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button variant="secondary">
        <Filter aria-hidden="true" className="size-4" />
        {selected.size === 0 ? "Tags" : `Tags · ${selected.size}`}
      </Button>

      <Popover.Content placement="bottom start">
        <Popover.Dialog aria-label="Filter locations by tag">
          <div className="flex max-h-80 w-60 flex-col gap-3 overflow-y-auto">
            {usable.map((group) => (
              <fieldset key={group.id} className="space-y-1.5">
                <legend className="text-xs font-medium text-muted">
                  {group.label || "Untitled group"}
                </legend>

                <div className="flex flex-wrap gap-2">
                  {group.tags.map((tag) => (
                    // The same chip the location form offers, from the same
                    // file — an owner filtering their list and a visitor
                    // filtering the published map are answering one question,
                    // and it should not look like two.
                    <TagToggleChip
                      key={tag.id}
                      label={tag.label || "Unnamed tag"}
                      isOn={selected.has(tag.id)}
                      onToggle={() => toggle(tag.id)}
                    />
                  ))}
                </div>
              </fieldset>
            ))}

            {/* Its own fieldset under the questions, because it is not an answer
                to any of them — it is the absence of every answer. */}
            <fieldset className="space-y-1.5 border-t border-border pt-3">
              <legend className="sr-only">Locations with no tags</legend>

              <TagToggleChip
                label="Untagged"
                isOn={isUntagged}
                onToggle={toggleUntagged}
              />
            </fieldset>

            {selected.size > 0 ? (
              <Button
                size="sm"
                variant="tertiary"
                className="self-start"
                onPress={() => onChange(new Set())}
              >
                Clear tags
              </Button>
            ) : null}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}
