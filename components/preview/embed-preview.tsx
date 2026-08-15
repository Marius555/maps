"use client";

import { useEffect, useMemo, useRef } from "react";

import { embedScriptUrl, embedSnippet } from "@/lib/embed/snippet";
import { buildPreviewSnapshot } from "@/lib/snapshot/preview";
import type { AppMap, Place, Shape } from "@/lib/repositories/types";

/**
 * The published map, as a visitor would get it, without publishing.
 *
 * It renders the *real* embed bundle against a snapshot built in the browser
 * from the map's current state, so there is no second implementation of popups,
 * clustering or filters to keep in step with the one that ships. Same idea as
 * the `/embed/dev.html` harness, pointed at live data instead of a fixture.
 *
 * The iframe is load-bearing, not incidental:
 *
 * 1. `embed/src/index.ts` appends its stylesheet — and MapLibre's — to
 *    `document.head` unconditionally. Mounted inline, that would leak `.lm-*`
 *    and `.maplibregl-*` rules across the whole dashboard.
 * 2. A module is evaluated once per URL, and `mount()` is guarded by
 *    `data-lm-mounted`, so an inline preview could not be closed and reopened
 *    without cache-busting the script. A fresh document sidesteps both.
 */
export function EmbedPreview({
  map,
  places,
  shapes,
  className,
}: {
  map: AppMap;
  places: Place[];
  shapes: Shape[];
  className?: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);

  /*
   * Serialised here, and used as the effect's dependency, because `places` and
   * `shapes` are fresh arrays on every react-query refetch even when nothing
   * changed. Keying the iframe on object identity would tear the map down and
   * rebuild it — losing the visitor's pan, zoom and open popup — on a background
   * refetch that changed nothing. Comparing the JSON compares what actually
   * matters.
   */
  const snapshotJson = useMemo(
    () => JSON.stringify(buildPreviewSnapshot(map, places, shapes)),
    [map, places, shapes],
  );

  /*
   * The iframe is written to directly rather than through React state. It is an
   * external system, which is what effects are for — and setting state from an
   * effect body would cascade a second render for no benefit.
   */
  useEffect(() => {
    const iframe = frame.current;
    if (!iframe) return;

    // A blob URL rather than a data: URI — a 3,000-place map is megabytes, and
    // that does not belong inside an HTML attribute. The iframe is `srcdoc`, so
    // it inherits this document's origin and can read the blob.
    const snapshotUrl = URL.createObjectURL(
      new Blob([snapshotJson], { type: "application/json" }),
    );

    iframe.srcdoc = previewDocument(snapshotUrl);

    return () => URL.revokeObjectURL(snapshotUrl);
  }, [snapshotJson]);

  return (
    <div
      className={`overflow-hidden rounded-xl border border-border bg-surface-secondary ${className ?? ""}`}
    >
      <iframe
        ref={frame}
        title="Map preview"
        className="h-full w-full border-0"
      />
    </div>
  );
}

/**
 * The host page the preview pretends to be: the customer's one-line snippet and
 * nothing else.
 *
 * `#lm-preview { height: 100% !important }` is deliberate. `resolveContainer`
 * sets a pixel height inline from `data-height`, and an important declaration in
 * a stylesheet is what outranks a plain inline style — that is what lets the map
 * fill a responsive frame instead of being pinned to one number.
 */
function previewDocument(snapshotUrl: string): string {
  const snippet = embedSnippet({
    scriptUrl: embedScriptUrl(window.location.origin),
    snapshotUrl,
    target: "#lm-preview",
    // The frame is only built once the preview is already on screen, so waiting
    // for an intersection inside it would just be a delay.
    eager: true,
  });

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { margin: 0; height: 100%; }
      #lm-preview { height: 100% !important; }
    </style>
  </head>
  <body>
    <div id="lm-preview"></div>
    ${snippet}
  </body>
</html>`;
}
