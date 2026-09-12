"use client";

import {
  Checkbox,
  Input,
  InputGroup,
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
        {/* `min-w-0` on the button and `truncate` on the word: a flex item's
            floor is its content, so five tiles reading None / Tight / Regular
            / Roomy / Wide are about 300px of text that will make its container
            300px wide rather than wrap — which is a horizontal scrollbar on
            any panel narrower than that. At 24rem nothing changes; on a phone
            a tile degrades to "Regu…", which is a control you can still see
            and press. Icon-only options are unaffected: their word is
            `sr-only` and takes no width at all. */}
        {options.map((option, index) => (
          <ToggleButton key={option.value} id={option.value} className="min-w-0">
            {/* Every button but the first draws the rule to its left; the group
                owns the radii, so this is all a divider takes. */}
            {index > 0 ? <ToggleButtonGroup.Separator /> : null}
            {option.icon ?? null}
            {/* An icon says it faster and a word says it unambiguously, so the
                word stays for a screen reader when there is an icon to see. */}
            <span className={option.icon ? "sr-only" : "truncate"}>
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
 * The run a fold's checkboxes sit in: one per line, at the end of the fold.
 *
 * It was a grid, two across and optionally three, on the argument that a
 * checkbox is a word beside a 16px box and a whole line to say "Bold" reads as
 * an unfinished row. **`PropertyCheckbox` is two lines tall now** — the label
 * sits above its box — so that argument is gone, and what it left behind was the
 * bug: three columns of a two-line control is 7rem a column against labels like
 * "Full day names", and the Hours panel could not lay it out without pushing
 * past its own width.
 *
 * **What is left in here is lone booleans**, and that is the point of it now.
 * The sets that were four and three of these — the Links row, the week — are
 * `PropertyToggles` rows: one question with several parts, on one line. What
 * stayed is the odd single yes-or-no that qualifies the fold it is in ("Full
 * width", "Show it in full"), and the rule is that it goes *last*, so a boolean
 * never interrupts a run of fields. A checkbox landing halfway down a column was
 * the whole of "checkboxes sprinkled all over".
 *
 * One column also means one rule for both panels, which is why the `cols` prop
 * went rather than defaulting to 1: the studio and the per-pin card menu draw
 * the same `BlockProperties`, and a control that looks different depending on
 * which of them opened it is two controls.
 */
export function PropertyChecks({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-2">{children}</div>;
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
 * And a checkbox rather than a `PropertyToggles` tile, which is the other
 * neighbour: that one is for a question with several parts, where the answers
 * share a row and each has an icon that draws it. "Full width" is one answer to
 * one question and has no such icon, so a tile of it would be a row of one.
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
     * `Control` still goes *inside* `Content`, and that is load-bearing for a
     * reason the layout below does not change: `.checkbox` is the field wrapper
     * and is itself `flex-direction: column`, so composed as siblings the box
     * would draw on a line of its own with the word beside nothing.
     * `.checkbox__content` is the box that is being turned.
     *
     * **The word above and the box below**, which is a column rather than the
     * row `.checkbox__content` paints by default. Asked for directly, and it is
     * what lets a checkbox live in a 20rem panel at all: a row is as wide as its
     * label plus its box and has no way to give any of that back, so a set of
     * them is a fixed width the panel has to find. Stacked, the label is free to
     * wrap and the control is 16px wide whatever it is called.
     */
    <Checkbox variant="secondary" isSelected={isSelected} onChange={onChange}>
      <Checkbox.Content className="flex-col items-start gap-1">
        {label}
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
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
  prefix,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  maxLength: number;
  /**
   * A fixed lead-in drawn inside the box, outside the editable part.
   *
   * `https://` is the case it exists for: nobody types a scheme, so the control
   * that asks for a link should not have one in it — but a box that silently adds
   * one is a box that lies about what it stores. Showing it as furniture says
   * both at once. `InputGroup.Input` is React Aria's own `Input` underneath, so it
   * still reads the `TextField`'s value and `onChange`.
   */
  prefix?: string;
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
      {prefix === undefined ? (
        <Input placeholder={placeholder} />
      ) : (
        <InputGroup variant="secondary" fullWidth>
          <InputGroup.Prefix className="pr-0 text-muted">
            {prefix}
          </InputGroup.Prefix>
          <InputGroup.Input placeholder={placeholder} />
        </InputGroup>
      )}
    </TextField>
  );
}
