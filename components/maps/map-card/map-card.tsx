"use client";

import { Card } from "@heroui/react";

import type { AppMap, MapSummary } from "@/lib/repositories/types";
import { MAP_ROW_CLASS } from "../map-row-layout";
import { MapCardInfo } from "./map-card-info";
import { MapCardStatus } from "./map-card-status";
import { MapPreview } from "./map-preview/map-preview";

/**
 * One map in the list, as a full-width row: its theme on the left, what it is on
 * the right, the two split by a 45° diagonal (../map-row-layout.ts).
 *
 * **Nothing changes on hover**, deliberately and completely — no lift, no
 * shadow, no underline, no control revealed. Everything the card can say or do
 * is on it the whole time, so the list is the same picture under a moving
 * pointer as under a still one, and on a phone, where there is no hover at all.
 * Keyboard focus is the one state drawn, as a ring round the whole card, because
 * a focused card with no visible sign is a keyboard user lost.
 */
export function MapCard({
  map,
  summary,
}: {
  map: AppMap;
  /** Absent for a map created since the page loaded — nothing is on it yet. */
  summary: MapSummary | undefined;
}) {
  return (
    <Card
      className={`${MAP_ROW_CLASS} has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-[var(--focus)]`}
    >
      <MapPreview style={map.style}>
        <MapCardStatus isPublished={Boolean(map.publishedAt)} />
      </MapPreview>

      <MapCardInfo map={map} summary={summary} />
    </Card>
  );
}
