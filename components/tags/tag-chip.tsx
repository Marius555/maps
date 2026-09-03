"use client";

import { Chip } from "@heroui/react";

/**
 * What a tag looks like, decided once.
 *
 * There were three copies of it — the location dialog's picker, the locations
 * list's filter and the marquee's bulk menu — each a hand-rolled
 * `border px-2.5 py-1 rounded-lg` pill invented before the app settled on HeroUI
 * `Chip`. The card that draws the very same tags (`TagChips` in
 * components/card/card-block.tsx) had already moved to `Chip`, so one vocabulary
 * was being drawn two ways on screens a user moves between in one sitting.
 *
 * **The mechanism is `render`, and it is what makes a display component a
 * control.** HeroUI's `Chip` has no close button, no `onPress` and no selected
 * state — it is a span. But it spreads its props into `dom.span`, which accepts a
 * `render` function (`@heroui/react/dist/utils/dom.js`), so a chip can be handed
 * back as a `<label>` or a `<button>` still wearing every `.chip` class. That is
 * the whole trick, and it is why this file can look like the design system
 * rather than like an approximation of it.
 *
 * `Chip<"label">` rather than a bare `Chip`: the component is generic over the
 * element it renders and defaults to `"span"`, so without the parameter `render`
 * is handed span props and TypeScript rejects the ref on the way into a label.
 *
 * Not HeroUI's own `TagGroup`/`Tag`, which do have a real remove button: they are
 * a React Aria collection and their selection is an unordered `Set<Key>`, while
 * `places.tags` is **ordered** — the first tag colours the pin (CLAUDE.md §6).
 * Recovering pick order by diffing sets on every change is exactly how a pin
 * quietly changes colour when somebody ticks a fourth tag.
 *
 * The Tailwind utilities here beat `.chip`'s own rules without `!important`,
 * because HeroUI's BEM lives in `@layer components` (the rule
 * components/ui/inline-select.tsx already documents).
 */

/**
 * The tag's colour, as the mark that sits inside a chip.
 *
 * Deliberately the same dot `card-block.tsx` draws, so the dialog and the
 * location card agree about what a tag looks like. That file is not refactored
 * to import this one: it is rendered beside the real embed bundle in the preview
 * panel, and nothing here has a reason to go near that parity.
 *
 * A tag with no colour draws no dot rather than a grey one — "Untagged" is the
 * absence of every answer, not an answer with a dull colour.
 */
export function TagDot({
  color,
  className = "",
}: {
  color?: string;
  className?: string;
}) {
  if (!color) return null;

  return (
    <span
      aria-hidden="true"
      className={`size-2 shrink-0 rounded-full ring-1 ring-black/10 ${className}`}
      style={{ backgroundColor: color }}
    />
  );
}

/**
 * A tag as a toggle: a chip-shaped `<label>` over a real, screen-reader-only
 * input.
 *
 * The input stays real because the control has to be *announced* as a checkbox
 * or a radio; `aria-pressed` on a button would say something else about a thing
 * that is plainly a multi-select.
 *
 * **`relative` is load-bearing and must not be dropped.** `.chip` does not set
 * it and Tailwind's `sr-only` is `position: absolute`, so without it the hidden
 * input lays itself out against whatever is positioned further up — which inside
 * a portalled popover is somewhere else entirely. Clicking then scrolls the page
 * to blank space below the app, and the *next* click lands on a different chip
 * than the one under the cursor. Same bug, same fix, as `theme-gallery.tsx`.
 */
export function TagToggleChip({
  label,
  color,
  isOn,
  isDisabled = false,
  inputType = "checkbox",
  name,
  onToggle,
}: {
  label: string;
  color?: string;
  isOn: boolean;
  isDisabled?: boolean;
  inputType?: "checkbox" | "radio";
  /** Radios only, where the group is what makes them exclusive. */
  name?: string;
  onToggle: () => void;
}) {
  return (
    <Chip<"label">
      size="lg"
      variant={isOn ? "primary" : "soft"}
      color={isOn ? "accent" : "default"}
      className={`relative cursor-pointer transition-colors has-focus-visible:inset-ring-2 has-focus-visible:inset-ring-focus ${
        isOn ? "" : "hover:bg-default-hover"
      } ${isDisabled ? "opacity-50" : ""}`}
      render={(props) => <label {...props} />}
    >
      <input
        type={inputType}
        name={name}
        className="sr-only"
        checked={isOn}
        disabled={isDisabled}
        onChange={onToggle}
      />
      <TagDot color={color} />
      <Chip.Label className="truncate">{label}</Chip.Label>
    </Chip>
  );
}

/**
 * A tag as a one-shot action: the same chip, as a `<button>`.
 *
 * The bulk menu's tags are not toggles — clicking one adds or removes it across
 * a whole selection and closes the menu — so it gets a button rather than the
 * label above. A chip that looked like a toggle and fired an action instead
 * would be the worse half of consistency.
 *
 * `type="button"` because these render inside forms, where a bare button submits.
 */
export function TagActionChip({
  label,
  color,
  onClick,
}: {
  label: string;
  color?: string;
  onClick: () => void;
}) {
  return (
    <Chip<"button">
      size="lg"
      variant="soft"
      color="default"
      className="cursor-pointer transition-colors hover:bg-default-hover focus-visible:inset-ring-2 focus-visible:inset-ring-focus"
      render={(props) => <button type="button" {...props} onClick={onClick} />}
    >
      <TagDot color={color} />
      <Chip.Label className="truncate">{label}</Chip.Label>
    </Chip>
  );
}
