"use client";

import { Button, Popover } from "@heroui/react";
import { Tag } from "lucide-react";
import { useState } from "react";

import type { MapTagGroup } from "@/lib/repositories/types";

/**
 * Adds one tag to everything the marquee just caught.
 *
 * **Adds, never toggles.** A selection is a mixed bag — some of it already wears
 * the tag, some doesn't — and a toggle would have to pick a meaning for that
 * ("tag the rest" or "clear the ones that have it") and would then silently do
 * the opposite of what half the selection needed. Adding is the one operation
 * whose result is the same whatever the selection started as. Removing a tag
 * from many locations at once is the rarer job and stays in each location's own
 * form.
 *
 * Grouped under the same headings the filters use: a tag on its own does not say
 * which question it answers, and two groups can reasonably both contain
 * "Standard".
 *
 * A `Popover.Root` wrapping a real `Button`, which is how the drawing tools
 * menu beside it is built — the Dropdown collection API wants its trigger to be
 * its own button element, and this control needs a labelled one.
 */
export function BulkTagMenu({
  groups,
  isBusy,
  onPick,
}: {
  groups: MapTagGroup[];
  isBusy: boolean;
  onPick: (tagId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // A map with no tags has nothing to offer, and a disabled button on the
  // selection bar would be one more thing to read past on every marquee.
  const usable = groups.filter((group) => group.tags.length > 0);
  if (usable.length === 0) return null;

  return (
    <Popover.Root isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button size="sm" variant="secondary" isPending={isBusy}>
        <Tag aria-hidden="true" className="size-4" />
        Tag
      </Button>

      <Popover.Content placement="top">
        <Popover.Dialog aria-label="Add a tag to the selection">
          <div className="flex max-h-72 w-56 flex-col gap-2 overflow-y-auto">
            {usable.map((group) => (
              <div key={group.id} className="flex flex-col gap-0.5">
                <p className="px-2 pt-1 text-xs font-medium text-muted">
                  {group.label || "Untitled group"}
                </p>

                {group.tags.map((tag) => (
                  <Button
                    key={tag.id}
                    size="sm"
                    variant="tertiary"
                    className="justify-start"
                    onPress={() => {
                      setIsOpen(false);
                      onPick(tag.id);
                    }}
                  >
                    {tag.label || "Unnamed tag"}
                  </Button>
                ))}
              </div>
            ))}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}
