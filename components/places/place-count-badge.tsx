import { Chip } from "@heroui/react";

/**
 * Surfaces the plan limit before the user runs into it.
 *
 * At the limit this becomes a soft Chip rather than warning-coloured text.
 * `--warning` is a fill token — it has a `--warning-foreground` partner and is
 * built to be a background. Used as a text colour it sits near 2:1 against the
 * page, well under AA. The Chip uses the pair the way it was designed.
 */
export function PlaceCountBadge({
  count,
  limit,
  noun = "locations",
}: {
  count: number;
  limit: number;
  /** What is being counted. Shapes have their own limit and their own word. */
  noun?: string;
}) {
  const label = `${count} of ${limit} ${noun}`;

  if (count >= limit) {
    return (
      <Chip size="sm" variant="soft" color="warning" className="tabular-nums">
        {label}
      </Chip>
    );
  }

  return <span className="text-xs tabular-nums text-muted">{label}</span>;
}
