"use client";

import { Disclosure } from "@heroui/react";
import { useEffect, useId, useRef, useState } from "react";

import { revealFold } from "@/lib/ui/reveal-fold";
import { useFormSectionGroup } from "./form-section-group";

/**
 * A part of the form you can put away.
 *
 * The edit dialog was eleven controls in one flat stack — name, address,
 * tags, pin, photo, description, phone, email, website and seven rows of
 * opening hours — with nothing saying which of them mattered, which were
 * optional, or which this location had already been given. Opening it to fix a
 * typo meant reading all of it to find the one field.
 *
 * So the few things every location needs stay open, and the rest fold away
 * behind a line each. The summary on the right is what makes that safe: folding
 * a field out of sight only works if the fold itself says whether there is
 * anything in there, otherwise the form has simply hidden the work.
 *
 * **HeroUI's `Disclosure`, not a native `<details>`.** This was a `<details>`,
 * on the reasoning that it is one and gets keyboard support for free — both
 * true, and both still true of this. What a `<details>` cannot do is *move*: it
 * has no open and closed state to animate between, so five of these in a column
 * snapped open and shut while every other panel in the app slid, and the form
 * read as a different, older thing than the app around it. React Aria writes
 * `--disclosure-panel-height` onto the panel from its measured content, which is
 * what HeroUI's stylesheet transitions — and it drops the transition under
 * `prefers-reduced-motion` without being asked (§8).
 *
 * `open` is forced when the section holds a validation error — a message nobody
 * can see is the same as no message, and a form that refuses to save without
 * saying why is the worst version of this. It is also the one thing allowed to
 * break the group's one-at-a-time rule: two errored sections both stay open,
 * because the alternative is a form that hides half of what is wrong with it.
 */
export function FormSection({
  title,
  summary,
  hasError,
  children,
}: {
  title: string;
  /** What is inside, without opening it — "2 of 3", "Not set". */
  summary: string;
  hasError?: boolean;
  children: React.ReactNode;
}) {
  const id = useId();
  const group = useFormSectionGroup();
  const [ownOpen, setOwnOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const isOpen = group ? group.openId === id : ownOpen;
  const isExpanded = isOpen || Boolean(hasError);

  const setOpen = (open: boolean) => {
    if (group) group.setOpenId(open ? id : null);
    else setOwnOpen(open);
  };

  /*
   * A lone section owns its own reveal; inside a group the group owns it.
   *
   * The split is not a preference. A group's reveal has to run on the *close* as
   * well as the open (see `revealFold`), and a closing section's own effect cannot
   * do that — by the time it runs, its answer is "nothing to reveal" and it returns.
   * One effect on the set sees both sides of a switch and picks the fold that grew.
   *
   * Keyed on `isExpanded` rather than `isOpen`, which is the state actually
   * rendered: a section forced open by a validation error otherwise never revealed,
   * so the message it opened to show could sit off the bottom of the scroller. A
   * message nobody can see is the same as no message — which is the whole reason
   * `hasError` forces the section open at all.
   */
  useEffect(() => {
    if (group || !isExpanded || !root.current) return;

    return revealFold(
      root.current,
      root.current.querySelector<HTMLElement>(".disclosure__content"),
    );
  }, [group, isExpanded]);

  return (
    <Disclosure
      ref={root}
      isExpanded={isExpanded}
      onExpandedChange={setOpen}
      className="rounded-lg border border-border"
    >
      <Disclosure.Heading>
        <Disclosure.Trigger className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-start transition-colors hover:bg-default">
          <span className="flex min-w-0 items-center gap-2">
            {/* `ms-auto` is the indicator's own default, which would shove it to
                the far end of this row; it belongs beside the title. */}
            <Disclosure.Indicator className="ms-0 text-muted" />
            <span className="truncate text-sm font-medium text-foreground">
              {title}
            </span>
          </span>

          <span
            className={`shrink-0 text-xs ${hasError ? "text-danger" : "text-muted"}`}
          >
            {summary}
          </span>
        </Disclosure.Trigger>
      </Disclosure.Heading>

      {/* The padding lives on this inner box rather than on the panel: the panel
          is the thing whose height animates, and padding on it would still be
          drawn at height zero. */}
      <Disclosure.Content>
        <div className="space-y-4 border-t border-border px-3 py-3">
          {children}
        </div>
      </Disclosure.Content>
    </Disclosure>
  );
}

/** "2 of 3" once anything is filled in, and a plain word before that. */
export function filledSummary(values: (string | null | undefined)[]): string {
  const filled = values.filter((value) => Boolean(value && value.trim())).length;

  if (filled === 0) return "Not set";
  return `${filled} of ${values.length}`;
}
