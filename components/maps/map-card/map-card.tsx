"use client";

import { Card } from "@heroui/react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

import type { AppMap, MapSummary } from "@/lib/repositories/types";
import { MapCardMenu } from "./map-card-menu";
import { MapCardMeta } from "./map-card-meta";
import { MapCardStatus } from "./map-card-status";
import { MapPreview } from "./map-preview/map-preview";

/**
 * One map in the list: the map itself across the top, what it is underneath.
 *
 * **Nothing changes on hover**, deliberately and completely — no lift, no
 * shadow, no underline, no control revealed. Everything the card can say or do
 * is on it the whole time, so the grid is the same picture under a moving
 * pointer as under a still one, and on a phone, where there is no hover at all.
 * Keyboard focus is the one state drawn, as a ring round the whole card, because
 * a focused card with no visible sign is a keyboard user lost.
 *
 * The title's link is stretched over the card with a pseudo-element, which
 * makes the whole card open the editor while leaving one link in the
 * accessibility tree. The menu sits above it (`z-10`) so it stays pressable.
 */
export function MapCard({
  map,
  summary,
}: {
  map: AppMap;
  /** Absent for a map created since the page loaded — nothing is on it yet. */
  summary: MapSummary | undefined;
}) {
  const editedAt = summary?.lastEditedAt ?? map.updatedAt;

  return (
    <Card className="h-full gap-0 overflow-hidden p-0 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-[var(--focus)]">
      <MapPreview map={map} contentVersion={summary?.contentVersion}>
        <MapCardStatus isPublished={Boolean(map.publishedAt)} />
      </MapPreview>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <Card.Header className="flex-row items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Card.Title className="truncate text-base font-semibold">
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
    </Card>
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
