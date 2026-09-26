import { Navigation } from "lucide-react";

/**
 * What an extra field is, shown rather than described.
 *
 * The tab used to open on a sentence about "anything the built-in fields don't
 * cover", and an owner asked why the feature existed at all. The answer is where
 * the value ends up, so this draws it: the two places a field can land on the
 * card a visitor opens — a labelled detail row, or a button beside Directions.
 * Static and illustrative on purpose; the real card is the card designer's job.
 */
export function CustomFieldExplainer() {
  return (
    <div className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">
          Your own details for each location
        </p>
        <p className="text-pretty text-sm text-muted">
          For anything the built-in fields don&rsquo;t cover — a dealer code, a
          booking link, a menu. Add the field here, fill it in when you edit a
          location, and it appears on the card visitors open.
        </p>
      </div>

      {/* A miniature card: one field as a detail row, one as a button. */}
      <div
        aria-hidden="true"
        className="w-full space-y-2.5 rounded-lg bg-surface-secondary p-3 text-xs sm:w-56"
      >
        <p className="font-medium text-foreground">Northside Cycles</p>
        <div className="flex justify-between gap-3">
          <span className="text-muted">Dealer code</span>
          <span className="text-foreground">A-114</span>
        </div>
        <div className="flex gap-1.5">
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-default px-2.5 py-1 text-foreground">
            <Navigation className="size-3" />
            Directions
          </span>
          <span className="whitespace-nowrap rounded-full bg-accent px-2.5 py-1 text-accent-foreground">
            Book a fitting
          </span>
        </div>
      </div>
    </div>
  );
}
