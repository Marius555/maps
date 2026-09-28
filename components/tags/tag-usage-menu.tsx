"use client";

import { Button, Popover } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { PinPreview } from "@/components/map/pin-preview";
import type { MapTagGroup, Place } from "@/lib/repositories/types";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import { pinColorOfTags } from "@/packages/shared/tags";

/**
 * "3 locations", as a way to reach them.
 *
 * The count used to be text, which answered "how many?" and left the owner no
 * way to ask the next question — *which ones?* — short of closing the dialog and
 * filtering the list by hand. Pressing it lists the locations wearing the tag,
 * each as its pin, its name and its street, and pressing one opens it in Edit
 * location on top of this dialog, so the tag draft underneath survives.
 *
 * The pin is coloured from the **draft** vocabulary, so a colour changed a
 * moment ago in this dialog shows here before it is saved. A group's colour is
 * not applied: this dialog knows nothing about groups, and the pin shown is the
 * question "which tag colours it?", which is the one being edited here.
 */
export function TagUsageMenu({
  tagName,
  places,
  tagGroups,
  pinIcons,
  onEditPlace,
}: {
  tagName: string;
  /** The locations wearing this tag. Never empty — the caller draws nothing then. */
  places: readonly Place[];
  tagGroups: readonly MapTagGroup[];
  pinIcons: CustomPinIcon[];
  onEditPlace: (placeId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const count = places.length;
  const countLabel = count === 1 ? "1 location" : `${count} locations`;

  return (
    <Popover.Root isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        size="sm"
        variant="ghost"
        className="shrink-0 gap-0.5 px-1.5 text-xs tabular-nums text-muted"
        aria-label={`${countLabel} tagged ${tagName}`}
      >
        {count}
        <span className="max-sm:hidden">
          {count === 1 ? " location" : " locations"}
        </span>
        <ChevronDown aria-hidden="true" className="size-3" />
      </Button>

      <Popover.Content placement="bottom end">
        <Popover.Dialog aria-label={`Locations tagged ${tagName}`}>
          <ul className="-mx-1 max-h-72 w-[min(18rem,calc(100vw-3rem))] overflow-y-auto">
            {places.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  className="flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-default-hover focus-visible:inset-ring-2 focus-visible:inset-ring-focus"
                  onClick={() => {
                    setIsOpen(false);
                    onEditPlace(place.id);
                  }}
                >
                  <PinPreview
                    icon={place.icon}
                    pinIcons={pinIcons}
                    fallbackColor={pinColorOfTags(tagGroups, place.tags)}
                    size="sm"
                    className="shrink-0"
                  />

                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {place.name || "Untitled location"}
                    </span>
                    {place.address ? (
                      <span className="truncate text-xs text-muted">
                        {place.address}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}
