"use client";

import { Button, Popover } from "@heroui/react";
import { Tag } from "lucide-react";
import { useState } from "react";

import type { MapTagGroup } from "@/lib/repositories/types";
import { TagActionChip } from "./tag-chip";

/**
 * Adds or removes one tag across everything the marquee just caught.
 *
 * **Two named actions, never a toggle**, and that is the same argument the
 * add-only version of this menu made — followed one step further rather than
 * reversed. A selection is a mixed bag: some of it already wears the tag, some
 * doesn't. A toggle would have to pick a meaning for that ("tag the rest" or
 * "clear the ones that have it") and would then silently do the opposite of
 * what half the selection needed. Add and Remove each have exactly one meaning
 * whatever the selection started as, which is the property that made adding
 * safe in the first place; removing has it too, and only ever lacked a button.
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
  onAdd,
  onRemove,
}: {
  groups: MapTagGroup[];
  isBusy: boolean;
  onAdd: (tagId: string) => void;
  onRemove: (tagId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"add" | "remove">("add");

  // A map with no tags has nothing to offer, and a disabled button on the
  // selection bar would be one more thing to read past on every marquee.
  const usable = groups.filter((group) => group.tags.length > 0);
  if (usable.length === 0) return null;

  const pick = (tagId: string) => {
    setIsOpen(false);
    if (mode === "add") onAdd(tagId);
    else onRemove(tagId);
  };

  return (
    <Popover.Root
      isOpen={isOpen}
      onOpenChange={(next) => {
        setIsOpen(next);
        // Back to Add every time it opens. Remove is the rarer half, and a menu
        // that silently remembered it would take a tag off the next selection
        // from a click that looks exactly like the one that adds.
        if (next) setMode("add");
      }}
    >
      <Button size="sm" variant="secondary" isPending={isBusy}>
        <Tag aria-hidden="true" className="size-4" />
        Tag
      </Button>

      <Popover.Content placement="top">
        <Popover.Dialog aria-label="Add or remove a tag across the selection">
          <div className="flex max-h-72 w-56 flex-col gap-2 overflow-y-auto">
            {/*
              Which of the two the tags below will do, chosen before the tag
              rather than after it. Radios, not a pair of buttons: it is a
              choice with a current answer, and the answer changes what every
              row under it means — which `aria-pressed` on two buttons would
              not say.
            */}
            <fieldset className="flex gap-1">
              <legend className="sr-only">What to do with the tag</legend>

              {(["add", "remove"] as const).map((value) => (
                // `relative` is required — Tailwind's `sr-only` is absolute, so
                // without it the hidden input lays itself out against whatever
                // is positioned further up, which inside a portalled popover is
                // somewhere else entirely, and clicking scrolls the page.
                <label
                  key={value}
                  className={`relative flex-1 cursor-pointer rounded-lg border px-2 py-1 text-center text-xs capitalize transition-colors has-focus-visible:inset-ring-2 has-focus-visible:inset-ring-focus ${
                    mode === value
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:bg-default"
                  }`}
                >
                  <input
                    type="radio"
                    name="bulk-tag-mode"
                    className="sr-only"
                    checked={mode === value}
                    onChange={() => setMode(value)}
                  />
                  {value}
                </label>
              ))}
            </fieldset>

            {usable.map((group) => (
              <div key={group.id} className="flex flex-col gap-1.5">
                <p className="pt-1 text-xs font-medium text-muted">
                  {group.label || "Untitled group"}
                </p>

                {/*
                  The same chip the picker and the filter draw, so one
                  vocabulary looks like one vocabulary wherever it is met — but
                  as a button rather than a toggle, because clicking one here
                  fires the mode above across the whole selection and closes
                  the menu. A chip that looked like a toggle and acted once
                  would be the worse half of consistency.
                */}
                <div className="flex flex-wrap gap-1.5">
                  {group.tags.map((tag) => (
                    <TagActionChip
                      key={tag.id}
                      label={tag.label || "Unnamed tag"}
                      onClick={() => pick(tag.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}
