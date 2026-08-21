"use client";

import { Skeleton } from "@heroui/react";

import { placeSecondLine } from "@/lib/places/place-labels";
import type { Place } from "@/lib/repositories/types";
import { PlaceStatusFlag } from "./place-status-flag";

/**
 * What a row says about the location it stands for, in its three states.
 *
 * The address leads and the name sits under it. A row's job is to say *which
 * place this is*, and for a pin someone just dropped the answer is the street it
 * landed on — "Location 3" over a pair of coordinates identified nothing.
 *
 * Coordinates are gone entirely rather than demoted. Nobody recognises a place by
 * its latitude, and a location with no address still has its name on the first
 * line.
 *
 * The pin itself is not here. It used to be a coloured dot on the first line;
 * it is now the row's leading column, beside both lines rather than inside one —
 * see `PlaceListItem`. This is the text and nothing else.
 */
export function PlaceRowLabel({
  place,
  isPending,
  hasFailed,
}: {
  place: Place;
  /** The lookup is still out. */
  isPending: boolean;
  /** The lookup came back with nothing, and the row has to say so. */
  hasFailed: boolean;
}) {
  /*
   * Until the lookup answers there is nothing true to put here — only the
   * placeholder name we invented — so the row waits as a skeleton. Same two lines
   * at the same heights as the text that replaces them, so the swap is a fill and
   * not a jump.
   */
  const secondLine = placeSecondLine(place);

  if (isPending) {
    return (
      <span aria-hidden="true" className="flex min-w-0 flex-col gap-1.5">
        <Skeleton className="h-3.5 w-2/5 rounded-lg" />
        <Skeleton className="h-3 w-3/5 rounded-lg" />
      </span>
    );
  }

  return (
    <>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-sm font-medium text-foreground">
          {place.address || place.name}
        </span>
        <PlaceStatusFlag
          status={place.geocodeStatus}
          confidence={place.geocodeConfidence}
        />
      </span>

      {/*
       * A lookup that found nothing used to leave the row silent, which read as
       * the address having been lost rather than never found. Saying so costs one
       * muted line and turns a mystery into a small piece of work — §8.
       *
       * Kept short deliberately: the row is 320px wide and shares it with the
       * retry button this line is about, so anything longer truncates and the
       * sentence loses the half that mattered. The two act as one — what happened,
       * and the control that fixes it, side by side.
       */}
      {hasFailed && !place.address ? (
        <span className="truncate text-xs text-muted">
          Couldn&apos;t find an address
        </span>
      ) : place.address && secondLine ? (
        <span className="truncate text-xs text-muted">{secondLine}</span>
      ) : null}
    </>
  );
}
