import { Chip } from "@heroui/react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

import { STYLE_LABELS } from "@/lib/map/style";
import type { AppMap } from "@/lib/repositories/types";
import { DeleteMapButton } from "./delete-map-button";

/** Beyond this the dots stop being scannable and become a stripe. */
const VISIBLE_TAGS = 4;

/**
 * One map in the list.
 *
 * The old card said only a name and "Liberty · Draft", which is why the page felt
 * empty. Everything added here comes off the map row that was already loaded plus
 * one count, so nothing new is fetched per card.
 *
 * No live map preview: that would mean a MapLibre canvas per card — a WebGL
 * context each — and a real thumbnail would need every map's place coordinates,
 * which is a paginated query per map. The tag colours are honest data we
 * already hold.
 */
export function MapCard({
  map,
  placeCount,
}: {
  map: AppMap;
  placeCount: number;
}) {
  /*
   * Flattened across the groups, because a card has room for a stripe of dots
   * and not for the questions they answer. The order is the map's own, so the
   * first four are the four the owner arranged first rather than four at random.
   */
  const tags = map.tagGroups.flatMap((group) => group.tags);
  const extraTags = tags.length - VISIBLE_TAGS;

  return (
    // The lift is a single pixel on purpose: enough to say the whole card is
    // pressable, not enough to make a grid of them feel restless.
    <div className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-surface p-4 transition-[color,background-color,border-color,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-px hover:border-muted/40 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-sm font-medium text-foreground">
          {/* The pseudo-element makes the whole card the link target while
              keeping a single accessible link in the tree. */}
          <Link
            href={`/maps/${map.id}`}
            className="truncate after:absolute after:inset-0 hover:underline"
          >
            {map.name}
          </Link>
        </h3>

        <Chip
          size="sm"
          variant="soft"
          color={map.publishedAt ? "success" : "default"}
          className="shrink-0"
        >
          {map.publishedAt ? "Published" : "Draft"}
        </Chip>
      </div>

      <dl className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <dt className="sr-only">Locations</dt>
        <dd className="tabular-nums">
          {placeCount} {placeCount === 1 ? "location" : "locations"}
        </dd>

        <span aria-hidden="true">·</span>

        <dt className="sr-only">Basemap</dt>
        <dd>{STYLE_LABELS[map.style]}</dd>

        <span aria-hidden="true">·</span>

        <dt className="sr-only">Last updated</dt>
        <dd>
          {/*
           * suppressHydrationWarning: a relative time computed on the server and
           * again on the client can legitimately differ by the seconds between
           * the two renders.
           */}
          <time
            dateTime={map.updatedAt}
            title={new Date(map.updatedAt).toLocaleString()}
            suppressHydrationWarning
          >
            {formatDistanceToNow(new Date(map.updatedAt), { addSuffix: true })}
          </time>
        </dd>
      </dl>

      <div className="mt-auto flex items-end justify-between gap-2">
        {tags.length > 0 ? (
          <ul className="flex min-w-0 flex-wrap items-center gap-1.5">
            {tags.slice(0, VISIBLE_TAGS).map((tag) => (
              <li key={tag.id} className="flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="max-w-24 truncate text-xs text-muted">
                  {tag.label}
                </span>
              </li>
            ))}
            {extraTags > 0 ? (
              <li className="text-xs tabular-nums text-muted">+{extraTags}</li>
            ) : null}
          </ul>
        ) : (
          <span className="text-xs text-muted">No tags</span>
        )}

        {/*
         * Above the card's link overlay so it stays clickable, and revealed on
         * hover or keyboard focus so a grid of cards isn't a grid of delete
         * buttons. focus-within keeps it reachable without a mouse.
         */}
        <div className="relative z-10 shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <DeleteMapButton mapId={map.id} mapName={map.name} />
        </div>
      </div>
    </div>
  );
}
