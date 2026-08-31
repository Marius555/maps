"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { embedScriptUrl, embedSnippet } from "@/lib/embed/snippet";
import { useCardDesign } from "@/lib/query/card-design";
import { buildPreviewSnapshot } from "@/lib/snapshot/preview";
import type { AppMap, Place, Shape } from "@/lib/repositories/types";
import { effectiveCardLayout } from "@/lib/card/designer-status";

/**
 * How many snapshot blobs are kept alive behind the current one.
 *
 * Enough to cover a document still loading an older snapshot; small enough that
 * a long editing session with the preview open does not accumulate megabytes of
 * dead JSON.
 */
const RETAINED_SNAPSHOTS = 4;

/**
 * How many times one snapshot may be handed to the frame before we stop.
 *
 * The reload below is self-correcting by design, and a self-correcting loop with
 * no floor is a spinner. Three covers the race it exists for; a fourth would
 * mean the frame is refusing the document for a reason retrying will never fix,
 * and a stale preview beats a frame that navigates forever.
 */
const MAX_ATTEMPTS = 3;

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
  /**
   * Every snapshot blob this preview has minted, oldest first.
   *
   * The obvious cleanup — revoking on the effect's teardown — is a bug, and a
   * reliably fatal one. A `srcdoc` document has to fetch the embed bundle and
   * MapLibre before it ever reads `data-snapshot`, so the blob has to outlive
   * the effect that made it by hundreds of milliseconds. It never did:
   * `cardDesign` resolves after mount and StrictMode double-invokes the mount
   * effect, so the first blob was always revoked before the first document
   * reached it. The preview was a white box, and silently — `mount()` warns on
   * a failed fetch and returns without touching the container.
   */
  const urls = useRef<string[]>([]);
  /** The document we want on screen, and how many times we have offered it. */
  const wanted = useRef<{ url: string; html: string; attempts: number } | null>(
    null,
  );
  /** Whether a navigation we started is still in flight. */
  const navigating = useRef(false);
  /** The snapshot the frame is really showing, read back off its document. */
  const showing = useRef<string | null>(null);

  // The account's own card design — same source publishing itself reads from
  // (lib/repositories/publish.repository.ts), so this preview shows the same
  // card that publish would actually write, not a second guess at it.
  const { data: cardDesign = {} } = useCardDesign();

  /*
   * Serialised here, and used as the effect's dependency, because `places` and
   * `shapes` are fresh arrays on every react-query refetch even when nothing
   * changed. Keying the iframe on object identity would tear the map down and
   * rebuild it — losing the visitor's pan, zoom and open popup — on a background
   * refetch that changed nothing. Comparing the JSON compares what actually
   * matters.
   */
  const snapshotJson = useMemo(
    () =>
      JSON.stringify(
        buildPreviewSnapshot(map, places, shapes, effectiveCardLayout(cardDesign)),
      ),
    [map, places, shapes, cardDesign],
  );

  /**
   * Hand the frame the document it should be showing, if this is a moment it can
   * take one.
   *
   * **A `srcdoc` assigned while the previous one is still loading is dropped**,
   * and dropped in silence: the property and the attribute both hold the newest
   * document while the frame goes on committing an older one, whose snapshot
   * blob is by then several generations stale. That is most of what made the
   * preview a white box — the effect below fires twice under StrictMode and
   * again when `cardDesign` resolves, so three documents were racing before
   * anyone had edited anything, and the one that won was never the last one.
   *
   * So there is one navigation in the air at a time and the rest wait. `showing`
   * is read back off the committed document rather than assumed from what was
   * assigned, which is what makes this self-correcting: when the frame commits
   * something other than what it was handed, the load below sees the mismatch
   * and hands it over again.
   */
  const flush = useCallback(() => {
    const iframe = frame.current;
    const next = wanted.current;

    if (!iframe || !next || navigating.current) return;
    if (next.url === showing.current) return;
    if (next.attempts >= MAX_ATTEMPTS) return;

    next.attempts += 1;
    navigating.current = true;
    iframe.srcdoc = next.html;
  }, []);

  /*
   * The iframe is written to directly rather than through React state. It is an
   * external system, which is what effects are for — and setting state from an
   * effect body would cascade a second render for no benefit.
   */
  useEffect(() => {
    // A blob URL rather than a data: URI — a 3,000-place map is megabytes, and
    // that does not belong inside an HTML attribute. The iframe is `srcdoc`, so
    // it inherits this document's origin and can read the blob.
    const snapshotUrl = URL.createObjectURL(
      new Blob([snapshotJson], { type: "application/json" }),
    );

    urls.current.push(snapshotUrl);

    while (urls.current.length > RETAINED_SNAPSHOTS) {
      const stale = urls.current.shift();
      if (stale) URL.revokeObjectURL(stale);
    }

    wanted.current = {
      url: snapshotUrl,
      html: previewDocument(snapshotUrl),
      attempts: 0,
    };

    flush();
  }, [snapshotJson, flush]);

  // The one moment the blobs are certainly dead: the frame is going away, so
  // nothing is left that could still be reading one.
  useEffect(
    () => () => {
      for (const url of urls.current) URL.revokeObjectURL(url);
      urls.current = [];
    },
    [],
  );

  const handleLoad = useCallback(() => {
    navigating.current = false;
    /*
     * What the frame settled on, which is not always what it was handed. Its own
     * initial about:blank carries no snippet and reads as null — correctly "not
     * the snapshot we want", so it simply flushes again.
     */
    showing.current =
      frame.current?.contentDocument
        ?.querySelector("script[data-snapshot]")
        ?.getAttribute("data-snapshot") ?? null;

    flush();
  }, [flush]);

  return (
    <div
      className={`overflow-hidden rounded-xl border border-border bg-surface-secondary ${className ?? ""}`}
    >
      {/*
       * `allow` because "Nearest to me" asks for a location.
       *
       * A `srcdoc` frame inherits this document's origin, and geolocation's
       * default allowlist is `self`, so a same-origin child should already be
       * permitted — but the container policy is the half of it we control, and
       * it is required outright the moment the preview is served from anywhere
       * else. The remaining reasons a lookup fails here are the visitor's own
       * (an insecure origin, a permission already denied, a timeout), and the
       * embed now names which one it was.
       */}
      <iframe
        ref={frame}
        title="Map preview"
        allow="geolocation"
        onLoad={handleLoad}
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
