import type { Ref } from "react";

/**
 * Where a form's Turnstile widget draws, when Cloudflare wants a click at all.
 *
 * `useTurnstile` renders into the inner div, which React never puts children in:
 * Cloudflare owns what is inside it. It sits directly above the submit button so
 * the checkbox, when one appears, is next to the press it is holding up. While
 * the widget stays invisible — the usual case — the slot collapses to nothing.
 *
 * `tickPrompt` is the line under the checkbox after a press it held up, naming
 * the button to press again (CLAUDE.md §8: an action keeps its name).
 */
export function TurnstileSlot({
  ref,
  tickPrompt,
  submitLabel,
}: {
  ref: Ref<HTMLDivElement>;
  tickPrompt: boolean;
  submitLabel: string;
}) {
  return (
    <div>
      <div ref={ref} className="turnstile-slot" />
      {tickPrompt ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          Tick the box above to confirm you’re a person, then press {submitLabel} again.
        </p>
      ) : null}
    </div>
  );
}
