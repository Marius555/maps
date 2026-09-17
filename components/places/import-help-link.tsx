import { CircleHelp } from "lucide-react";
import Link from "next/link";

/**
 * The way out of the locations list to the guide for filling it.
 *
 * A link and not a button, at the weight of the count badge beside it. The slot
 * used to hold `AttentionBadge`, which said how many rows the geocoder was
 * unsure about and filtered the list to them when pressed — a second control for
 * something the toolbar's Show select already does, in the one row that is meant
 * to read as the table's caption. The filter stayed; the button went.
 *
 * **Always rendered**, which the badge could not be: it hid itself at zero, and
 * an import guide is most useful before anything has gone wrong.
 *
 * **A new tab**, because `/docs` is a marketing route and an in-place navigation
 * would swap the whole dashboard shell out from under somebody who is mid-task
 * on their locations. The promise is in the accessible name, not only in the
 * behaviour.
 */
export function ImportHelpLink() {
  return (
    <Link
      href="/docs/importing-locations"
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg text-xs text-muted transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <CircleHelp aria-hidden="true" className="size-3.5 shrink-0" />
      How to import locations
      <span className="sr-only"> (opens in a new tab)</span>
    </Link>
  );
}
