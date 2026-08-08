"use client";

import { formatDistanceToNow } from "date-fns";

import type { AppMap } from "@/lib/repositories/types";

/**
 * Where the map stands: never published, live and current, or live but behind
 * what's in the editor.
 */
export function PublishStatus({
  map,
  hasPendingChanges,
}: {
  map: AppMap;
  hasPendingChanges: boolean;
}) {
  if (!map.publishedAt) {
    return (
      <p className="text-xs text-muted">
        Not published yet. Publishing generates the map your visitors see and
        gives you a snippet to paste into your site.
      </p>
    );
  }

  return (
    <p className="text-xs text-muted">
      <span className="text-foreground">Live</span> · published{" "}
      {formatDistanceToNow(new Date(map.publishedAt), { addSuffix: true })}
      {hasPendingChanges ? (
        <>
          {" · "}
          <span className="text-accent">
            you&rsquo;ve made changes since — publish again to push them
          </span>
        </>
      ) : null}
    </p>
  );
}
