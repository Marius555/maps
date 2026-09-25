"use client";

import { Card } from "@heroui/react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

import type { AppMap, MapSummary } from "@/lib/repositories/types";
import { MAP_INFO_CLASS } from "../map-row-layout";
import { MapCardMenu } from "./map-card-menu";
import { MapCardMeta } from "./map-card-meta";

/**
 * The right half of a map's row: its name, when it last changed, and what is on it.
 *
 * The title's link is stretched over the whole card with a pseudo-element, which
 * makes the entire row open the editor while leaving one link in the
 * accessibility tree. The menu sits above it (`z-10`) so it stays pressable.
 */
export function MapCardInfo({
  map,
  summary,
}: {
  map: AppMap;
  summary: MapSummary | undefined;
}) {
  const editedAt = summary?.lastEditedAt ?? map.updatedAt;

  return (
    <div className={MAP_INFO_CLASS}>
      <Card.Header className="flex-row items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Card.Title className="truncate text-lg font-semibold">
            <Link
              href={`/maps/${map.id}`}
              className="outline-none after:absolute after:inset-0"
            >
              {map.name}
            </Link>
          </Card.Title>

          <Card.Description className="text-xs">
            Edited <RelativeTime iso={editedAt} />
            {map.publishedAt ? (
              <>
                {" · "}published <RelativeTime iso={map.publishedAt} />
              </>
            ) : null}
          </Card.Description>
        </div>

        <div className="relative z-10 -me-2 -mt-1 shrink-0">
          <MapCardMenu mapId={map.id} mapName={map.name} />
        </div>
      </Card.Header>

      <Card.Footer className="mt-auto">
        <MapCardMeta
          placeCount={summary?.placeCount ?? 0}
          shapeCount={summary?.shapeCount ?? 0}
          style={map.style}
        />
      </Card.Footer>
    </div>
  );
}

/**
 * "2 hours ago", with the machine-readable time beside it.
 *
 * No `title` tooltip: that is an element appearing on hover, which this card
 * does not do. suppressHydrationWarning because the server and the browser
 * compute "ago" seconds apart and may legitimately disagree.
 */
function RelativeTime({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {formatDistanceToNow(new Date(iso), { addSuffix: true })}
    </time>
  );
}
