"use client";

import { Label, ToggleButton, ToggleButtonGroup, Tooltip } from "@heroui/react";
import type { LucideIcon } from "lucide-react";

/**
 * A set of independent on/off answers, on one line.
 *
 * The panel this was built for asks the same question four or five times in a
 * row — which fields does a result row draw, which of MapLibre's controls are on
 * the map — and a checkbox each meant four labelled two-line controls stacked
 * down a 20rem column for what is really one question with four parts. That is
 * what "stop putting checkboxes in their own row" was about.
 *
 * A multi-select `ToggleButtonGroup` says it in one line. **The ceiling here is
 * the icon's width, not the word's** — the same argument `PropertyChoice`'s
 * docblock makes for its own five tiles: a tile that draws the thing it is
 * choosing needs no label beside it, so five of these fit where three words
 * would not. The word survives in the tooltip and in `sr-only` text, so the
 * control is still named for a screen reader and still discoverable with a
 * pointer.
 *
 * **Not a `PropertyCheckbox`, and the difference is not draft-versus-immediate.**
 * That reading did not survive: this is the card designer's Links and Hours rows
 * now, where the panel *is* a draft held until Save — and the same panel is
 * drawn immediately-writing in the per-pin card menu, so a control that changed
 * shape with the writer would be two controls. What separates the two is how
 * many answers there are to one question. A single yes-or-no is a checkbox,
 * beside the field it qualifies. Four parts of one question — which links does
 * this row draw, how does this week read — are this, on one line.
 *
 * A `PropertySwitch` is the third, and *that* one is about immediacy: a switch
 * is a thing that is on and applies the moment it moves, which is why the
 * publish designer's sentences are switches and these are not.
 */
export function PropertyToggles<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string; icon: LucideIcon }[];
  /** The subset that is on. */
  selected: readonly T[];
  /** One key at a time — the caller writes one field, not the whole set. */
  onChange: (value: T, isSelected: boolean) => void;
}) {
  const on = new Set<string>(selected);

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <ToggleButtonGroup
        fullWidth
        size="sm"
        selectionMode="multiple"
        selectedKeys={[...on]}
        aria-label={label}
        onSelectionChange={(keys) => {
          const next = new Set([...keys].map(String));

          /*
           * Diffed rather than written whole, because the caller's store is one
           * field per option: handing it a set would make every press a write of
           * all five, and in a debounced writer that turns one changed switch
           * into five keys touched in the same PATCH.
           */
          for (const option of options) {
            const isSelected = next.has(option.value);
            if (isSelected !== on.has(option.value)) {
              onChange(option.value, isSelected);
            }
          }
        }}
      >
        {options.map((option, index) => (
          <Tooltip key={option.value} delay={0}>
            <ToggleButton id={option.value} className="min-w-0">
              {/* Every button but the first draws the rule to its left; the
                  group owns the radii, so this is all a divider takes. */}
              {index > 0 ? <ToggleButtonGroup.Separator /> : null}
              <option.icon aria-hidden="true" className="size-4" />
              <span className="sr-only">{option.label}</span>
            </ToggleButton>
            <Tooltip.Content placement="top">{option.label}</Tooltip.Content>
          </Tooltip>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}
