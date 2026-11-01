import type { Ref } from "react";

/**
 * Where a form's Turnstile widget draws, when Cloudflare wants a click at all.
 *
 * `useTurnstile` renders into it. It sits directly above the submit button so
 * the checkbox, when one appears, is next to the press it is holding up. While
 * the widget stays invisible — the usual case — the slot collapses to nothing.
 */
export function TurnstileSlot({ ref }: { ref: Ref<HTMLDivElement> }) {
  return <div ref={ref} className="turnstile-slot" />;
}
