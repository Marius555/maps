"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { SelectControl } from "@/components/ui/select-control";
import { ANALYTICS_RANGES, type AnalyticsRange } from "@/lib/analytics/range";
import { RANGE_LABELS } from "./sections";

/**
 * How far back the page is looking.
 *
 * It writes the range into the URL rather than into React state, and that is the
 * point: every figure on this page is a fact about a period, so a screenshot or
 * a pasted link that does not carry the period is a number with no meaning
 * attached. It is the same argument that made the Locations filters
 * URL-addressable, arrived at from the other direction.
 *
 * A navigation rather than a client-side refetch, because the page is a Server
 * Component that reads rollups: the work of changing range belongs on the server
 * where the rows are, not in a client cache that would have to learn the same
 * folding rules a second time.
 *
 * `useTransition` keeps the old numbers on screen while the new ones are
 * fetched, so the page dims rather than emptying. Swapping to a skeleton would
 * throw away a perfectly good answer to show that a better one is coming.
 */
export function RangePicker({
  mapId,
  range,
}: {
  mapId: string;
  range: AnalyticsRange;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div
      className="w-44"
      // The dim is the whole feedback; the numbers under it are still the last
      // real answer, so they must not read as the current one.
      style={{ opacity: isPending ? 0.6 : 1 }}
      aria-busy={isPending}
    >
      <SelectControl
        label="Period"
        value={range}
        options={ANALYTICS_RANGES.map((id) => ({ id, label: RANGE_LABELS[id] }))}
        onChange={(value) => {
          startTransition(() => {
            router.push(`/maps/${mapId}/analytics?range=${value}`, {
              scroll: false,
            });
          });
        }}
      />
    </div>
  );
}
