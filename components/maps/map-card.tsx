import { Chip } from "@heroui/react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

import { CategoryDot } from "@/components/categories/category-badge";
import { STYLE_LABELS } from "@/lib/map/style";
import type { AppMap } from "@/lib/repositories/types";
import { DeleteMapButton } from "./delete-map-button";

/** Beyond this the dots stop being scannable and become a stripe. */
const VISIBLE_CATEGORIES = 4;

/**
 * One map in the list.
 *
 * The old card said only a name and "Liberty · Draft", which is why the page felt
 * empty. Everything added here comes off the map row that was already loaded plus
 * one count, so nothing new is fetched per card.
 *
 * No live map preview: that would mean a MapLibre canvas per card — a WebGL
 * context each — and a real thumbnail would need every map's place coordinates,
 * which is a paginated query per map. The category colours are honest data we
 * already hold.
 */
export function MapCard({
  map,
  placeCount,
}: {
  map: AppMap;
  placeCount: number;
}) {
  const extraCategories = map.categories.length - VISIBLE_CATEGORIES;

  return (
    <div className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-muted/40">
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
        {map.categories.length > 0 ? (
          <ul className="flex min-w-0 flex-wrap items-center gap-1.5">
            {map.categories.slice(0, VISIBLE_CATEGORIES).map((category) => (
              <li key={category.id} className="flex items-center gap-1">
                <CategoryDot color={category.color} />
                <span className="max-w-24 truncate text-xs text-muted">
                  {category.label}
                </span>
              </li>
            ))}
            {extraCategories > 0 ? (
              <li className="text-xs tabular-nums text-muted">
                +{extraCategories}
              </li>
            ) : null}
          </ul>
        ) : (
          <span className="text-xs text-muted">No categories</span>
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
