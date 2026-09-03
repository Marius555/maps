"use client";

import { Button, Chip, Popover } from "@heroui/react";
import { ChevronDown, Plus, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import type { AppMap } from "@/lib/repositories/types";
import { MAX_TAGS_PER_PLACE, MAX_TAGS_TOTAL } from "@/lib/validation/tag.schema";
import { tagChipsOf } from "@/packages/shared/tags";
import { TagToggleChip } from "./tag-chip";
import { TagQuickAdd } from "./tag-quick-add";
import { useChipReorder } from "./use-chip-reorder";

/**
 * Which of the map's tags this location wears.
 *
 * One control where there were two. The dialog used to ask a Category question
 * with a select and a "New category" button, and a Tags question with a fold of
 * checkboxes and a "New tag" button — the same question twice, under two names,
 * with the more capable answer hidden behind the fold. Categories merged into
 * tags, so this is the whole of it: a location wears as many as apply, and the
 * first one it was given colours its pin.
 *
 * **The field holds its own value.** The chips used to sit in a list *below* a
 * trigger that showed only a count ("2 tags"), which left the control that asks
 * "which tags?" not showing the answer, and a row of chips underneath belonging
 * to nothing — in a dialog where every other field contains what it holds. They
 * are inside the box now, and the trigger is what fills the space they leave.
 *
 * **The box is dressed as a field, from the field tokens.** `bg-field`,
 * `rounded-field` and `shadow-field` with no border at all is exactly what
 * `.input-group` paints, so this sits flush with the Name box above it — it was
 * `bg-default` on a `rounded-lg` bordered box, which is a grey 38px control in a
 * column of white 36px ones.
 *
 * **Creating is the dropdown's first row**, not a button beside the field. A map
 * whose owner has never opened Settings has no tags, and a picker that opens
 * onto nothing reads as a broken control rather than an empty one — while a
 * button below the field is a second thing to find and says nothing about where
 * tags come from. Opening the list is what somebody does when they want a tag,
 * so that is where the offer belongs.
 *
 * There is no Done button. Escape and a click outside both close the popover, so
 * a button whose only job was to close it read as a form step — implying the
 * tags needed committing separately from Save changes, which they never did.
 *
 * Bound through `Controller` by its caller and never `register()`: React Aria
 * owns the value of everything HeroUI renders, so `register` silently does not
 * work here — a prefilled form renders blank and then saves the blanks
 * (CLAUDE.md, Stack specifics).
 */
export function TagPicker({
  map,
  value,
  onChange,
}: {
  map: AppMap;
  /** The tag ids this location wears, **in the order they were picked**. */
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const labelId = useId();
  const hintId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  /*
   * What the menu is anchored to — see the `triggerRef` on `Popover.Content`.
   */
  const fieldRef = useRef<HTMLDivElement>(null);

  const selected = new Set(value);
  const total = map.tagGroups.reduce((sum, group) => sum + group.tags.length, 0);
  const usable = map.tagGroups.filter((group) => group.tags.length > 0);

  /*
   * Resolved rather than read straight off `value`, which is what keeps this
   * honest in two ways: ids the map no longer defines are dropped (nothing
   * sweeps a deleted tag off the places wearing it, so a dangling id is the
   * normal state), and the order is the location's own, which is what makes the
   * first chip the one the pin is wearing.
   */
  const chips = tagChipsOf(map.tagGroups, value);

  const isFull = value.length >= MAX_TAGS_PER_PLACE;

  const toggle = (id: string) => {
    // Appended, never inserted, so picking a fourth tag cannot silently
    // recolour the pin. Reordering is a separate, deliberate gesture.
    if (selected.has(id)) onChange(value.filter((tag) => tag !== id));
    else if (!isFull) onChange([...value, id]);
  };

  /*
   * Dragging a chip, or Alt with an arrow on a focused one, is the whole of
   * "use this tag's colour for the pin" — see `use-chip-reorder.ts`.
   *
   * Fed the *resolved* order and not `value`, because those are not the same
   * list: `value` can carry ids of tags the map no longer defines, which draw no
   * chip and so cannot be dragged. Reordering what is on screen and writing that
   * back would silently drop them, and a dangling id is allowed to survive an
   * edit that had nothing to do with it (CLAUDE.md §0). So the answer is spliced
   * back into `value` around the ids that are still there.
   */
  const { dragId, overId, chipProps } = useChipReorder({
    ids: chips.map((chip) => chip.id),
    onReorder: (next) => {
      const drawn = new Set(next);
      const rest = value.filter((id) => !drawn.has(id));

      onChange([...next, ...rest]);
    },
  });

  return (
    <div className="space-y-2">
      <p id={labelId} className="text-sm font-medium">
        Tags
      </p>

      {/*
        The field, and it is a box rather than a control: the chips inside it
        carry buttons of their own, and a button cannot nest in a button — the
        same constraint `color-picker-field.tsx` solves by making its clear ×
        a sibling of the trigger rather than a child of it.

        Focus is drawn on the whole box, because the box is what reads as the
        field whichever of the several controls inside it holds the keyboard.
      */}
      <div
        ref={fieldRef}
        className="flex min-h-9 w-full items-center gap-1.5 rounded-field bg-field p-1 shadow-field has-focus-visible:inset-ring-2 has-focus-visible:inset-ring-focus"
      >
        {/*
          The chips wrap in here, and the chevron below is their *sibling* — not
          another item in the same wrapping row.

          Written as one wrapping row, the trigger is whatever is left over:
          three chips fill the line, it wraps onto one of its own, and being
          flexible it then stretches across it — a band of nothing under the
          tags, in a field twice the height of the Name field above. Nothing
          about `flex-wrap` can promise a trailing item stays put. Split, the
          chevron is always at the end of the first line, wherever the chips get
          to.

          Not rendered at all when it holds nothing, because an empty `flex-1`
          box still claims its share of the row — which left the invitation
          beside it half the width of the field it is supposed to be.
        */}
        {chips.length > 0 ? (
          <ul
            aria-describedby={hintId}
            className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
          >
            {chips.map((chip) => (
              /*
               * A `<li>` rather than a span, through the same `render` hatch
               * `tag-chip.tsx` documents: these are an ordered list, and the
               * order is what decides the pin colour, so saying so in the markup
               * is what lets a screen reader announce "2 of 3" while a chip is
               * being moved.
               */
              <Chip<"li">
                key={chip.id}
                size="lg"
                variant="soft"
                className={`max-w-full select-none transition-[opacity,box-shadow] ${
                  dragId ? "cursor-grabbing" : "cursor-grab"
                } ${dragId === chip.id ? "opacity-40" : ""} ${
                  overId === chip.id ? "inset-ring-2 inset-ring-focus" : ""
                }`}
                render={(props) => <li {...props} {...chipProps(chip.id)} />}
              >
                <Chip.Label className="max-w-40 truncate">
                  {chip.label}
                </Chip.Label>

                {/*
                  `data-no-drag` so a press here is a press on the ×, not the
                  start of a drag of the chip around it.

                  The `::after` overhangs it: drawn at the size it reads best an
                  18px cross is well under the 24px a finger needs, and growing
                  the visible control to reach it would make the chip taller than
                  the field it sits in. The pseudo-element takes the taps and
                  changes no layout.
                */}
                <button
                  type="button"
                  data-no-drag
                  className="relative -me-1 rounded-full p-0.5 text-muted transition-colors after:absolute after:-inset-[3px] after:content-[''] hover:bg-default-hover hover:text-foreground focus-visible:inset-ring-2 focus-visible:inset-ring-focus"
                  onClick={() => toggle(chip.id)}
                >
                  <X aria-hidden="true" className="size-3.5" />
                  <span className="sr-only">Remove {chip.label}</span>
                </button>
              </Chip>
            ))}
          </ul>
        ) : null}

        <Popover.Root
          isOpen={isOpen}
          onOpenChange={(open) => {
            setIsOpen(open);
            // The create form lives inside the menu, so it closes with it —
            // otherwise reopening the picker lands on a half-typed tag name.
            if (!open) setIsCreating(false);
          }}
        >
          {/*
            Two shapes, because an empty field and a full one are asked
            different things. With no tags it is the whole field and carries the
            invitation, so the one thing on screen is the thing to press. With
            chips in front of it, it shrinks to the chevron and holds its place
            at the right-hand end — where a select's chevron always is, and
            where it stays as the tags wrap under it.
          */}
          <Button
            variant="tertiary"
            aria-labelledby={labelId}
            className={`h-7 shrink-0 bg-transparent px-1.5 ${
              chips.length === 0 ? "flex-1 justify-between" : ""
            }`}
          >
            {chips.length === 0 ? (
              <span className="text-muted">Choose tags</span>
            ) : null}
            <ChevronDown aria-hidden="true" className="size-4" />
          </Button>

          {/*
            Anchored to the field, not to the button that opens it.

            The trigger has two shapes — the whole field when empty, a chevron at
            the right-hand end once there are chips — so a menu anchored to it
            jumped the width of the field the moment the first tag was picked.
            `Popover.Content` spreads into React Aria's own `Popover`, whose
            first line is `useContextProps(props, ref, PopoverContext)` →
            `mergeProps(contextProps, props)`, so a `triggerRef` passed here
            beats the one `DialogTrigger` puts on the context. The field never
            moves, so neither does the menu.
          */}
          <Popover.Content triggerRef={fieldRef} placement="bottom start">
            <Popover.Dialog aria-label="Tags for this location">
              <div className="flex max-h-80 w-72 max-w-[calc(100vw-3rem)] flex-col gap-3 overflow-y-auto">
                {isCreating ? (
                  <TagQuickAdd
                    map={map}
                    onCreated={(id) => {
                      // Ticked as well as created: nobody opens this to add a
                      // tag to the vocabulary and then not use it on the
                      // location they are looking at.
                      if (!selected.has(id) && !isFull) onChange([...value, id]);
                      setIsCreating(false);
                    }}
                    onCancel={() => setIsCreating(false)}
                  />
                ) : (
                  <>
                    {/* The first row, above the vocabulary rather than under it:
                        on a map with no tags it is the only row there is, and on
                        a map with sixty it must not be at the bottom of a
                        scroller. */}
                    {total < MAX_TAGS_TOTAL ? (
                      <button
                        type="button"
                        className="flex items-center gap-2 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-default focus-visible:inset-ring-2 focus-visible:inset-ring-focus"
                        onClick={() => setIsCreating(true)}
                      >
                        <Plus aria-hidden="true" className="size-4" />
                        New tag
                      </button>
                    ) : null}

                    {usable.length === 0 ? (
                      /* Said here and only here: this is the one screen where
                         somebody has a location in front of them to try it on. */
                      <p className="text-sm text-muted">
                        Tags let visitors narrow your map by what a location
                        offers. A location can wear as many as apply, and the
                        first one colours its pin.
                      </p>
                    ) : null}

                    {usable.map((group) => (
                      <fieldset key={group.id} className="space-y-1.5">
                        {/* The group is the *question* the tags inside it answer
                            — the embed reads groups as AND and their tags as OR
                            — so a flat list of forty chips would hide which of
                            them are alternatives. */}
                        <legend className="text-xs font-medium text-muted">
                          {group.label || "Untitled group"}
                        </legend>

                        <div className="flex flex-wrap gap-2">
                          {group.tags.map((tag) => {
                            const isOn = selected.has(tag.id);

                            return (
                              <TagToggleChip
                                key={tag.id}
                                label={tag.label || "Unnamed tag"}
                                color={tag.color}
                                isOn={isOn}
                                isDisabled={!isOn && isFull}
                                onToggle={() => toggle(tag.id)}
                              />
                            );
                          })}
                        </div>
                      </fieldset>
                    ))}

                    {isFull ? (
                      <p className="text-xs text-muted">
                        A location can carry up to {MAX_TAGS_PER_PLACE} tags.
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </Popover.Dialog>
          </Popover.Content>
        </Popover.Root>
      </div>

      {/*
        The rule the coloured dot used to state, in words.

        Every chip but the first carried a faded dot that promoted its tag to the
        front, and the leading chip carried a solid one saying it was the source
        of the pin's colour. Nine tenths of the people who saw it read a row of
        coloured bubbles, so the legend is a sentence now and the promotion is
        the order of the chips themselves. Only shown when there are chips: on an
        empty field it is a rule about nothing.

        The keyboard route is `sr-only` rather than on screen, because it is the
        one instruction that is only useful to somebody who cannot make the drag.
      */}
      {chips.length > 0 ? (
        <p id={hintId} className="text-xs text-muted">
          The first tag colours the pin. Drag a tag to reorder.
          <span className="sr-only">
            {" "}
            Or focus one and press Alt with the left or right arrow.
          </span>
        </p>
      ) : null}
    </div>
  );
}
