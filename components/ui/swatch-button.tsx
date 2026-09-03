"use client";

import { Button, Popover } from "@heroui/react";
import { useState } from "react";

import { SwatchPicker } from "./swatch-picker";

/**
 * The palette, folded behind the colour it is currently set to.
 *
 * `SwatchPicker` lays its eight swatches out in a row, which is right beside a
 * full-width name field and wrong inside a chip: a tag row is a name, a count
 * and a remove button, and 200px of palette on each of twenty-four of them is a
 * settings page nobody can scan. So the dot *is* the control — it shows the
 * answer, and asking to change it costs one click.
 *
 * A plain Button with an aria-label rather than the repo's IconButton, for the
 * reason `appearance-button.tsx` gives: that one wraps its trigger in a Tooltip,
 * and a tooltip on a popover trigger stays up over the panel it just opened.
 */
export function SwatchButton({
  value,
  label,
  onChange,
}: {
  value: string;
  /** Names the control for a screen reader — "Colour for Bikes". */
  label: string;
  onChange: (color: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover.Root isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button size="sm" variant="tertiary" isIconOnly aria-label={label}>
        {/*
         * The dot is a span rather than the button's own background: a HeroUI
         * Button paints its own hover and focus states, and an inline background
         * colour would sit on top of both and leave the control looking dead.
         */}
        <span
          aria-hidden="true"
          className="size-4 rounded-full border border-black/10"
          style={{ backgroundColor: value }}
        />
      </Button>

      <Popover.Content placement="bottom start">
        <Popover.Dialog aria-label={label}>
          <div className="p-0.5">
            <SwatchPicker
              label={label}
              value={value}
              onChange={(color) => {
                onChange(color);
                setIsOpen(false);
              }}
            />
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}
