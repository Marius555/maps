"use client";

import {
  Checkbox,
  Input,
  Label,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import type { ReactNode } from "react";

import { nearestStop } from "@/lib/card/scale-stops";

/**
 * The controls every properties panel is built from.
 *
 * Lifted out of `card-properties.tsx` when the block half and the card half
 * became separate files: they are the same segmented row in both, and two
 * copies would drift into two different-looking panels one tab apart.
 *
 * **All of them are stock HeroUI at full width**, and that is a deliberate
 * reversal. They were compacted and hand-rolled to make the panel fit without
 * scrolling — an 11px label beside a 6px track, a bare `fieldset` of
 * `aria-pressed` buttons, a checkbox patched with a border. The panel already
 * scrolls (`Tabs.Panel` is `lg:flex-1 lg:overflow-y-auto`) and Save is pinned in
 * the footer outside that scroller, so height was never worth paying for in
 * animation, focus rings, keyboard handling and simply looking like the rest of
 * the app.
 *
 * **There is no slider here any more.** Every number in this panel is a named
 * choice — see `PropertyScale` and ./property-scales.tsx for why, which is the
 * argument the Corners control had already made on its own.
 */

/**
 * One of a handful of named choices, as a row of buttons.
 *
 * HeroUI's `ToggleButtonGroup` rather than a `select`: the options are few, they
 * are all worth seeing at once, and picking one is a single press instead of a
 * press, a scroll and a second press. `disallowEmptySelection` because every one
 * of these has a value at all times — pressing the selected button again must
 * not clear it into a state the card cannot draw.
 *
 * **Five fit, and the Corners control is why that had to be true.** The rule was
 * "never more than three", which was about *words*: three labels are what a
 * 24rem column holds. A tile that draws the thing it is choosing needs no label
 * at all — see the corner squares in `button-style-properties.tsx`, which say
 * their own radius — so the ceiling is the icon's width, not the word's.
 */
export function PropertyChoice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; icon?: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <ToggleButtonGroup
        fullWidth
        size="sm"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[value]}
        aria-label={label}
        onSelectionChange={(keys) => {
          const next = [...keys][0];
          if (next !== undefined) onChange(String(next) as T);
        }}
      >
        {options.map((option, index) => (
          <ToggleButton key={option.value} id={option.value}>
            {/* Every button but the first draws the rule to its left; the group
                owns the radii, so this is all a divider takes. */}
            {index > 0 ? <ToggleButtonGroup.Separator /> : null}
            {option.icon ?? null}
            {/* An icon says it faster and a word says it unambiguously, so the
                word stays for a screen reader when there is an icon to see. */}
            <span className={option.icon ? "sr-only" : undefined}>
              {option.label}
            </span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}

/**
 * A number, as one of a handful of named amounts.
 *
 * `PropertyChoice` with the string boundary done once instead of at every call
 * site — the Corners control used to spell `String(...)` and `Number(...)` out
 * by hand, and it was the only numeric control in the panel that was a row of
 * tiles at all. Everything else was a slider.
 *
 * **Why none of them is a slider any more.** A slider offers a range; nobody
 * designing a card is choosing 17px of roominess out of 14 possibilities, they
 * are choosing between roomy and tight. It also could not say *zero*: a thumb at
 * the far left of a 0–28 track reads as "not set", which is why the Corners
 * control could not express a square button and became tiles first (see
 * ./property-scales.tsx). The same argument applies to every one of them, and a
 * panel of five-tile rows with two sliders left in it reads as unfinished.
 *
 * **The displayed tile is snapped, and nothing is written to snap it.** Stored
 * numbers are routinely between stops — a block's width and height come from
 * dragging its own handles, and every design saved while these were sliders
 * holds whatever the thumb was over. `nearestStop` lights the closest tile;
 * `onChange` fires only when somebody presses one, so opening a panel never
 * edits a design.
 */
export function PropertyScale({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: readonly { value: number; label: string; icon?: ReactNode }[];
  onChange: (value: number) => void;
}) {
  const stops = options.map((option) => option.value);

  return (
    <PropertyChoice
      label={label}
      value={String(nearestStop(value, stops))}
      options={options.map((option) => ({
        ...option,
        value: String(option.value),
      }))}
      onChange={(next) => onChange(Number(next))}
    />
  );
}

/**
 * The row a group's checkboxes sit in, two across — or three.
 *
 * A checkbox is a word and a 16px box; on a 24rem column each one took a whole
 * line to say "Bold", which read as an unfinished row rather than as a control.
 * Two per line is what a pair of yes-or-nos actually needs, and a lone one still
 * sits at half width — which is honest about there being room for another rather
 * than stretching one word across the panel.
 *
 * **Three is for a set that is genuinely one question**, and the opening hours
 * block is the case it was added for: Bold, Only today and Full day names are
 * three answers to "how does this week read", and at two across the third sat
 * alone on a second line looking like a different subject. It is not the default
 * because three columns is 7rem each, which is under the width most of these
 * labels want.
 *
 * `items-center` because they are not always one line tall: "Full day names"
 * wraps at either width and "Only today" does not.
 */
export function PropertyChecks({
  cols = 2,
  children,
}: {
  cols?: 2 | 3;
  children: ReactNode;
}) {
  return (
    // Both class names written out, never assembled: Tailwind reads source text,
    // so a `grid-cols-${cols}` is a utility that is never generated.
    <div
      className={`grid items-center gap-x-3 gap-y-2 ${
        cols === 3 ? "grid-cols-3" : "grid-cols-2"
      }`}
    >
      {children}
    </div>
  );
}

/**
 * A yes-or-no about the selected block.
 *
 * A checkbox rather than the `Switch` the appearance panel uses, and the
 * distinction is worth keeping: a switch is a thing that is *on*, applying the
 * moment it moves, which is what the map's layer toggles are. Everything in this
 * panel is a property of a draft that does not leave the page until Save, and a
 * checkbox is what a property looks like.
 *
 * **The label is the whole explanation.** These carried a line of hint text
 * underneath, which doubled the height of every one of them. Where the
 * consequence genuinely needs a sentence it belongs in the field's own docblock
 * in packages/shared/card-layout.ts, which is where the next person changing it
 * will be reading — not under a checkbox on every visit forever.
 */
export function PropertyCheckbox({
  label,
  isSelected,
  onChange,
}: {
  label: string;
  isSelected: boolean;
  onChange: (isSelected: boolean) => void;
}) {
  return (
    /*
     * `variant="secondary"` because this sits on a `SectionPanel`, which is what
     * HeroUI documents the variant for — and here it is load-bearing rather than
     * decorative. The default variant draws the box from `--field-background`
     * with `--field-border: transparent` and `--border-width-field: 0`, and in
     * both themes `--field-background` is *the same colour as* `--surface`
     * (app/globals.css). An unchecked box was therefore a 16px invisible square.
     * `.checkbox--secondary` paints it `var(--default)` instead, which is the one
     * ground on this panel that is reliably not the surface. It replaced a
     * `border border-border` patch of our own; the token stays untouched, since
     * `--field-border` is every input in the app.
     *
     * `Control` goes *inside* `Content`, which is the same shape
     * `components/appearance/layers-field.tsx` gives its `Switch`. It matters
     * because `.checkbox` is the field wrapper and is `flex-direction: column` —
     * composed as siblings, the box drew on its own line *above* the word.
     * `.checkbox__content` is the row.
     */
    <Checkbox
      variant="secondary"
      isSelected={isSelected}
      onChange={onChange}
    >
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        {label}
      </Checkbox.Content>
    </Checkbox>
  );
}

/**
 * A short line of the owner's own words about the selected block.
 *
 * The only control on this panel that stores free text, which is why the cap is
 * passed in rather than left to the save: this string is written into the DOM of
 * a stranger's page by both renderers, and a box that lets someone paste a
 * paragraph and then silently truncates it on reload is a control that lies.
 * `readBlock` caps it again — belt and braces, the way the width floor is
 * checked twice.
 *
 * `variant="secondary"` for `PropertyCheckbox`'s reason, which is the same one
 * `SelectControl` documents: `--field-background` is the same colour as
 * `--surface` in both themes, so the default variant's box is invisible on a
 * `SectionPanel`.
 *
 * **`placeholder` is a default said out loud, never an example.** These fields
 * mostly have one — a button with no label says the action's own word — and
 * showing that word greyed is the honest rendering of "empty means this". An
 * invented example would read as saved content, which is the trap
 * `components/ui/form-field.tsx` documents at length.
 */
export function PropertyText({
  label,
  value,
  placeholder,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  return (
    <TextField
      variant="secondary"
      className="w-full"
      value={value}
      maxLength={maxLength}
      onChange={onChange}
    >
      <Label>{label}</Label>
      <Input placeholder={placeholder} />
    </TextField>
  );
}
