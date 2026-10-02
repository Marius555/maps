import { CircleAlert, MapPin, Rows3 } from "lucide-react";
import Link from "next/link";

import { formatCount } from "@/lib/format/number";

/**
 * The two limits a file has to fit, before anything is read: how many rows the
 * importer takes, and how much room the plan has left.
 *
 * A full plan is said in the danger colour with the way out beside it, because
 * otherwise the first time anyone hears about it is the disabled Import button
 * at the end of a ten-minute address lookup.
 */
export function SourceFacts({
  maxRows,
  plan,
  limit,
  remaining,
}: {
  maxRows: number;
  plan: string;
  limit: number;
  remaining: number;
}) {
  const isFull = remaining === 0;

  return (
    <ul className="flex flex-col gap-2 text-xs text-muted sm:flex-row sm:flex-wrap sm:gap-x-6">
      <li className="flex items-center gap-2">
        <Rows3 aria-hidden="true" className="size-3.5 shrink-0" />
        One row per location, up to {formatCount(maxRows)} rows
      </li>

      <li
        className={`flex items-center gap-2 ${isFull ? "text-danger" : ""}`}
      >
        {isFull ? (
          <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
        ) : (
          <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
        )}

        {isFull ? (
          <span>
            Your {plan} plan is full at {formatCount(limit)} locations.{" "}
            <Link
              href="/settings/billing"
              className="font-medium underline underline-offset-2"
            >
              Upgrade
            </Link>
            , or remove some first.
          </span>
        ) : (
          <span>
            {formatCount(remaining)} of {formatCount(limit)}{" "}
            {limit === 1 ? "location" : "locations"} left on your {plan} plan
          </span>
        )}
      </li>
    </ul>
  );
}
