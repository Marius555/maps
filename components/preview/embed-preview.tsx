"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { embedScriptUrl, embedSnippet } from "@/lib/embed/snippet";
import { useCardDesign } from "@/lib/query/card-design";
import {
  applyLiveChrome,
  isFrameReady,
  readFrameView,
  releaseFrame,
  repaintFrame,
} from "@/lib/preview/live-chrome";
import { buildPreviewSnapshot } from "@/lib/snapshot/preview";
import type { AppMap, Place, Shape } from "@/lib/repositories/types";
import { effectiveCardLayout } from "@/lib/card/designer-status";
import { CHROME_SETTING_KEYS } from "@/packages/shared/embed-chrome";
import type { MapSnapshot } from "@/packages/shared/snapshot";

/**
 * How many snapshot blobs are kept alive behind the current one.
 *
 * Enough to cover a document still loading an older snapshot; small enough that
 * a long editing session with the preview open does not accumulate megabytes of
 * dead JSON.
 */
const RETAINED_SNAPSHOTS = 4;

/**
 * How many times one snapshot may be handed to a frame before we stop.
 *
 * The reload below is self-correcting by design, and a self-correcting loop with
 * no floor is a spinner. Three covers the race it exists for; a fourth would
 * mean the frame is refusing the document for a reason retrying will never fix,
 * and a stale preview beats a frame that navigates forever.
 */
const MAX_ATTEMPTS = 3;

/**
 * How long to wait for a rebuilt document to draw its map before showing it
 * anyway.
 *
 * The wait itself is the fix for the blink — see `awaitReady`. This is its
 * floor: a map whose tiles never arrive, or a style fetch that hangs, must not
 * pin the preview on a stale document for ever. Two seconds is far longer than a
 * warm rebuild takes and short enough not to read as frozen.
 */
const READY_TIMEOUT_MS = 2000;

/**
 * The crossfade, and how long the outgoing document has to live.
 *
 * `.preview-frame-in` in app/globals.css runs for 200ms; the old map's WebGL
 * context is freed once it has finished, with a little slack so the release can
 * never land mid-fade on a busy frame.
 */
const FADE_MS = 200;
const RELEASE_AFTER_MS = FADE_MS + 80;

/**
 * What an account with no saved card design resolves to.
 *
 * A module constant rather than a `= {}` default on the query, because that
 * literal is a fresh object on every render for the whole of the loading
 * window — which invalidated the `snapshot` memo below on every render for no
 * change at all.
 */
const NO_CARD_DESIGN: Record<string, unknown> = {};

/**
 * The published map, as a visitor would get it, without publishing.
 *
 * It renders the *real* embed bundle against a snapshot built in the browser
 * from the map's current state, so there is no second implementation of popups,
 * clustering or the results panel to keep in step with the one that ships. Same
 * idea as the `/embed/dev.html` harness, pointed at live data instead of a
 * fixture.
 *
 * The iframe is load-bearing, not incidental:
 *
 * 1. `embed/src/index.ts` appends its stylesheet — and MapLibre's — to
 *    `document.head` unconditionally. Mounted inline, that would leak `.lm-*`
 *    and `.maplibregl-*` rules across the whole dashboard.
 * 2. A module is evaluated once per URL, and `mount()` is guarded by
 *    `data-lm-mounted`, so an inline preview could not be closed and reopened
 *    without cache-busting the script. A fresh document sidesteps both.
 *
 * **Most changes no longer build a document at all.** See `rebuildKey`.
 */
export function EmbedPreview({
  map,
  places,
  shapes,
  className,
  frame = true,
  settings,
  cardDesign,
}: {
  map: AppMap;
  places: Place[];
  shapes: Shape[];
  className?: string;
  /**
   * The account's card design, when the page around this already loaded it.
   *
   * Without it the query starts `undefined`, the first document is built from
   * the *default* card, and its arrival changes `rebuildKey` — so an account
   * with a saved design paid a second full document build, crossfade included,
   * on every visit. The publish page fetches it server-side alongside the map
   * for exactly that reason; absent is still correct, just a beat slower.
   */
  cardDesign?: Record<string, unknown>;
  /**
   * Whether to draw the rounded border around the frame.
   *
   * True in the preview dialog, where this is a panel on a page. False on the
   * publish designer, where the map runs to the edges the way it will on the
   * customer's own site — a rounded card there is a frame the visitor will never
   * see, drawn around the one thing on the page that is meant to be honest.
   */
  frame?: boolean;
  /**
   * The designer's uncommitted settings, when one is driving this.
   *
   * The publish page holds a draft and writes it on a 400ms timer, so without
   * this the preview would lag every press by that timer and then repaint from
   * the server's answer. Absent means the map's own stored settings, which is
   * what every other caller wants.
   */
  settings?: Record<string, unknown>;
}) {
  /*
   * Two frames, swapped on load, and that is what removes the flash.
   *
   * Assigning `srcdoc` blanks a frame the instant it is set, so a single frame
   * cannot rebuild without showing white for as long as MapLibre takes to come
   * up. The replacement is built in the standby frame and revealed only once its
   * map has actually **drawn** — not merely once the document loaded, which is a
   * far earlier moment and was itself the flash (see `awaitReady`). The outgoing
   * document stays on screen for all of it, and is released once the crossfade
   * that replaces it has finished.
   *
   * **The standby is stacked underneath, never `visibility: hidden`**, and that
   * distinction cost a real bug. A browser gives no animation frames to a
   * document it is not rendering, so a map built inside a hidden frame loads its
   * tiles and never finishes drawing them — and because MapLibre paints on
   * demand rather than in a loop, revealing the frame does not correct it. The
   * preview came up as one small patch of map in the corner of a white box.
   * Occlusion by another element is not the same thing: a covered frame is still
   * rendered, so underneath it paints normally and arrives complete.
   */
  const frameA = useRef<HTMLIFrameElement>(null);
  const frameB = useRef<HTMLIFrameElement>(null);

  /*
   * Two named refs and an accessor rather than an array of them.
   *
   * The React Compiler treats an array built during render as a render-local
   * value, so writing `srcdoc` through `frames[i].current` reads to it as
   * mutating that array after render — six `react-hooks/immutability` errors for
   * a pattern that is really "one of two DOM nodes". Reading a ref inside a
   * callback is exactly what refs are for, and this keeps every access there.
   */
  const frameAt = useCallback(
    (index: number) => (index === 0 ? frameA : frameB).current,
    [],
  );

  /**
   * The last frame brought to the front, and whether that arrival was a swap.
   *
   * `null` is the state before any document has ever drawn, and it is a state
   * worth having rather than a `visible = 0` that pretends frame A is showing
   * something. At mount frame A holds nothing but its own `about:blank`, so the
   * crossfade — which works by fading the arrival in over an opaque outgoing
   * document — had nothing underneath it and faded a *blank white frame* in over
   * the frame where the real document was being built. The cover below is what
   * stands in for the missing outgoing document, and `animate` is what stops the
   * first arrival being a fade at all: it has nothing to cross from.
   */
  const [reveal, setReveal] = useState<{
    index: number;
    animate: boolean;
  } | null>(null);
  const visible = reveal?.index ?? 0;
  /** Which frame the next document is built in. Always the one off screen. */
  const standby = useRef(1);

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
  /** The snapshot the visible frame is really showing, read off its document. */
  const showing = useRef<string | null>(null);
  /**
   * The `rebuildKey` the effect below last minted a document for.
   *
   * StrictMode double-invokes that effect, and without this the second pass
   * minted a second blob and handed the frame a second document for a snapshot
   * that had not changed — one whole extra MapLibre boot on every mount, in the
   * one environment where this is developed.
   */
  const builtFor = useRef<string | null>(null);
  /**
   * Stops the poll below, for the two moments it must not outlive: a newer
   * document being handed to the same frame, and unmount.
   */
  const cancelReady = useRef<(() => void) | null>(null);

  // The account's own card design — same source publishing itself reads from
  // (lib/repositories/publish.repository.ts), so this preview shows the same
  // card that publish would actually write, not a second guess at it.
  const { data: design = NO_CARD_DESIGN } = useCardDesign(cardDesign);

  const snapshot = useMemo(
    () =>
      buildPreviewSnapshot(
        settings ? { ...map, settings } : map,
        places,
        shapes,
        effectiveCardLayout(design),
      ),
    [map, settings, places, shapes, design],
  );

  /*
   * What is worth tearing a document down for.
   *
   * Serialised, and not compared by identity: `places` and `shapes` are fresh
   * arrays on every react-query refetch even when nothing changed, so comparing
   * JSON is what stops a background refetch losing the visitor's pan, zoom and
   * open popup.
   *
   * **The chrome settings are stripped out of it**, which is the other half. A
   * width, an opacity, a blur, a corner radius, a row pin size and all five
   * colours are custom properties on the running map's root — the effect below
   * writes them straight into the live document, so including them here would
   * rebuild on every frame of a colour drag for a change one property write
   * makes. That rebuild-per-pointer-move was the whole of the blinking.
   */
  const rebuildKey = useMemo(
    () => JSON.stringify(structural(snapshot)),
    [snapshot],
  );

  /*
   * The live half, keyed on the properties themselves rather than on the
   * snapshot holding them: this must fire when a colour moves and stay quiet
   * when a switch does, which is exactly the complement of `rebuildKey`.
   */
  const chromeKey = useMemo(
    () => JSON.stringify(pick(snapshot.settings, CHROME_SETTING_KEYS)),
    [snapshot],
  );

  /*
   * The newest snapshot, for the effects that must read it without depending on
   * it. Written from an effect rather than in the render body — a ref assigned
   * during render makes its value depend on how often React chose to render,
   * which is what `react-hooks/refs` refuses. Declared before the effects that
   * read it, so it lands first within one commit.
   */
  const latest = useRef(snapshot);

  useEffect(() => {
    latest.current = snapshot;
  }, [snapshot]);

  /**
   * Hand the standby frame the document it should be showing, if this is a
   * moment it can take one.
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
   * assigned, which is what makes this self-correcting: when a frame commits
   * something other than what it was handed, the load below sees the mismatch
   * and hands it over again.
   */
  const flush = useCallback(() => {
    const iframe = frameAt(standby.current);
    const next = wanted.current;

    if (!iframe || !next || navigating.current) return;
    if (next.url === showing.current) return;
    if (next.attempts >= MAX_ATTEMPTS) return;

    // Anything still waiting on the document this is about to replace is waiting
    // on a document that will never draw.
    cancelReady.current?.();
    cancelReady.current = null;

    next.attempts += 1;
    navigating.current = true;
    iframe.srcdoc = next.html;
  }, [frameAt]);

  /**
   * Wait for a frame's map to actually exist, then act.
   *
   * **This is the fix for the blink.** `handleLoad` used to swap on the iframe's
   * own `load` event, and that event is not the signal it looks like: `mount()`
   * in the embed is async — a snapshot fetch, then a style fetch, then
   * `createMap` — while `load` fires as soon as the module has been evaluated.
   * The identity check passes immediately too, because `script[data-snapshot]`
   * is in the HTML from the start. So the preview brought a *blank white
   * document* to the front and the map arrived a few hundred milliseconds later,
   * which is exactly what "the map disappears and comes back" was.
   *
   * The embed now says when it has drawn (`data-lm-ready`, set from MapLibre's
   * own `load`), and this polls for it. On an animation frame rather than a
   * timer, because the answer can only change on a frame the browser has
   * rendered — and the standby is deliberately *covered* rather than hidden, so
   * it gets them.
   */
  const awaitReady = useCallback(
    (index: number, done: () => void) => {
      const deadline = performance.now() + READY_TIMEOUT_MS;
      let raf = 0;

      const tick = () => {
        const doc = frameAt(index)?.contentDocument;

        if (isFrameReady(doc) || performance.now() >= deadline) {
          cancelReady.current = null;
          done();
          return;
        }

        raf = requestAnimationFrame(tick);
      };

      cancelReady.current = () => cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    },
    [frameAt],
  );

  /*
   * The iframes are written to directly rather than through React state. They
   * are an external system, which is what effects are for — and setting state
   * from an effect body would cascade a second render for no benefit.
   */
  useEffect(() => {
    /*
     * Nothing has changed, so there is nothing to build — this is StrictMode's
     * second pass. `flush` still runs, because the *first* pass may have been
     * unable to hand the document over yet.
     */
    if (builtFor.current === rebuildKey) {
      flush();
      return;
    }

    builtFor.current = rebuildKey;

    /*
     * Open where the owner is looking, not where the map was saved.
     *
     * Read off the document still on screen, through the handle the embed hangs
     * on its own root, and written over the snapshot's own `center`. Without
     * this, every structural press threw the camera back to the map's saved view
     * — which is what "the map keeps moving" meant, and it made the panel
     * controls unusable at any zoom.
     */
    const view = readFrameView(frameAt(visible)?.contentDocument);
    const json = JSON.stringify(withView(latest.current, view));

    // A blob URL rather than a data: URI — a 3,000-place map is megabytes, and
    // that does not belong inside an HTML attribute. The iframe is `srcdoc`, so
    // it inherits this document's origin and can read the blob.
    const snapshotUrl = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
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
    // `rebuildKey` is the dependency by design — the snapshot with the
    // live-applied fields taken out — and `visible` only names which frame to
    // read the camera from, so it must not schedule a rebuild of its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rebuildKey, flush, frameAt]);

  /*
   * The live half. It runs after a rebuild as well, which is not redundant: a
   * property moved while a document was loading would otherwise be lost, since
   * the blob behind that document was serialised before it.
   */
  useEffect(() => {
    applyLiveChrome(frameAt(visible)?.contentDocument, latest.current.settings);
    // Keyed on the properties, not on the snapshot that carries them: the whole
    // point is that this fires when a colour moves and stays quiet when a switch
    // does, which is the complement of `rebuildKey`.
  }, [chromeKey, visible, frameAt]);

  // The one moment the blobs are certainly dead: the component is going away, so
  // nothing is left that could still be reading one.
  useEffect(
    () => () => {
      /*
       * Except anything a document is still on its way to fetching, which is
       * the same bug the header above records for the teardown-revoke — and it
       * is reachable here for the same reason: React 19 StrictMode *simulates*
       * an unmount between the two mount passes, so this ran while the first
       * document was still loading and killed the blob out from under it. The
       * embed's `mount()` fails that fetch, warns, returns, and never sets
       * `data-lm-ready` — a white box that `awaitReady` reveals anyway two
       * seconds later.
       *
       * At most two blobs outlive a real unmount, and the document that could
       * have read them is being torn down with this component.
       */
      const live = new Set(
        [wanted.current?.url, showing.current].filter(Boolean) as string[],
      );

      for (const url of urls.current) {
        if (!live.has(url)) URL.revokeObjectURL(url);
      }

      urls.current = [];
      // Nothing left to reveal, and a stray animation frame would be reaching
      // into a document React is about to take away.
      cancelReady.current?.();
      cancelReady.current = null;
    },
    [],
  );

  const handleLoad = useCallback(
    (index: number) => {
      // The visible frame loads once, at mount, with its own about:blank. Only
      // the standby frame's loads are navigations anybody asked for.
      if (index !== standby.current) return;

      /*
       * What the frame settled on, which is not always what it was handed.
       * Every document we build carries this script tag from the first byte, so
       * a null here means the frame is showing something that is not ours.
       */
      const doc = frameAt(index)?.contentDocument;
      const got =
        doc
          ?.querySelector("script[data-snapshot]")
          ?.getAttribute("data-snapshot") ?? null;

      /*
       * **The standby frame's own initial `about:blank`, and it is not a
       * navigation anybody started.** React inserts both iframes with no `src`
       * and no `srcdoc`, which queues a `load` for that initial document — and
       * it is delivered *after* the mount effect has already assigned a real
       * `srcdoc`. Treated as an arrival it cleared `navigating` mid-flight,
       * which let `flush` assign `srcdoc` a second time and abort the document
       * that was already loading. That is the one-navigation-at-a-time
       * invariant this ref exists for, broken on every single mount, and it is
       * most of what "the map blinks several times before it initialises" was.
       *
       * Nothing deadlocks behind this: with no navigation ever aborted, every
       * `srcdoc` assignment now fires exactly one `load` of its own.
       */
      if (got === null && navigating.current) return;

      navigating.current = false;

      if (got && got === wanted.current?.url) {
        showing.current = got;

        /*
         * The document is committed, but the map inside it has not been built
         * yet — so nothing is revealed until it says it has drawn. The outgoing
         * document stays on screen for the whole of that wait, which is what
         * turns a rebuild from a white flash into a crossfade.
         */
        awaitReady(index, () => {
          const ready = frameAt(index)?.contentDocument;

          // Whatever moved while this was loading, before it is revealed.
          applyLiveChrome(ready, latest.current.settings);
          // And a remeasure, in case the browser skipped frames while it was the
          // covered one. Belt and braces behind the z-index above.
          repaintFrame(ready);

          const outgoing = frameAt(index === 0 ? 1 : 0);

          standby.current = index === 0 ? 1 : 0;
          // `animate` only once there is something to cross *from*. The first
          // document has the cover behind it, not an outgoing map, and fading
          // in over that is a fade from the panel's own ground — which reads as
          // the map arriving late rather than arriving.
          setReveal((previous) => ({ index, animate: previous !== null }));

          /*
           * Freed once its replacement is *on screen*, which is a beat after
           * this call rather than during it. `setVisible` only schedules a
           * render, so releasing here synchronously — which is what this did —
           * ran `map.remove()` on the frame that was still in front, blanking it
           * for the frame before React committed the swap. It also has to
           * outlast the crossfade, since the outgoing map is what shows through
           * it. Still bounded at two live GPU contexts, which is the property
           * this release exists to protect.
           */
          window.setTimeout(
            () => releaseFrame(outgoing?.contentDocument),
            RELEASE_AFTER_MS,
          );

          flush();
        });

        return;
      }

      flush();
    },
    [awaitReady, flush, frameAt],
  );

  return (
    <div
      className={`overflow-hidden bg-surface-secondary ${
        frame ? "rounded-xl border border-border" : ""
      } ${className ?? ""}`}
    >
      {/*
       * Both frames stay mounted and stacked. Unmounting the outgoing one is
       * the flash all over again, and remounting an iframe re-runs its document
       * from scratch — so one is simply drawn on top of the other.
       *
       * `allow` because "Nearest to me" asks for a location. A `srcdoc` frame
       * inherits this document's origin, and geolocation's default allowlist is
       * `self`, so a same-origin child should already be permitted — but the
       * container policy is the half of it we control, and it is required
       * outright the moment the preview is served from anywhere else.
       */}
      <div className="relative h-full w-full">
        <iframe
          ref={frameA}
          title="Map preview"
          allow="geolocation"
          aria-hidden={visible !== 0}
          onLoad={() => handleLoad(0)}
          className={frameClass(visible === 0, reveal?.animate ?? false)}
        />
        <iframe
          ref={frameB}
          title="Map preview"
          allow="geolocation"
          aria-hidden={visible !== 1}
          onLoad={() => handleLoad(1)}
          className={frameClass(visible === 1, reveal?.animate ?? false)}
        />

        {/*
          Until the first map has drawn, this is what is on screen.

          An opaque cover rather than making the frames transparent, because a
          browser gives no animation frames to a document it is not rendering
          and a MapLibre map that loads without them never finishes painting —
          the bug the standby frame is stacked rather than hidden to avoid. A
          cover leaves both documents rendering normally and hides the one thing
          there is to hide, which is frame A's blank `about:blank`.
        */}
        {reveal === null ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 z-20 bg-surface-secondary"
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * One of the two frames.
 *
 * Stacked by `z-index`, and neither is ever unmounted, `display: none` or
 * `visibility: hidden` — all three stop the browser rendering the document, and
 * a MapLibre map that loads without rendering opportunities never finishes
 * painting itself. The standby is simply covered, which leaves it rendering
 * normally, and `pointer-events-none` is what stops a click reaching the map
 * nobody can see.
 *
 * The arriving frame fades in over the one it replaces, which is a crossfade
 * precisely because the outgoing document is still underneath and still opaque.
 * A resting `opacity: 0` on the standby would be the hidden-frame bug again;
 * this animates only after a swap, on a document that has already drawn.
 *
 * **`animate` is false for the very first document**, which is the one arrival
 * with no outgoing map beneath it — see `reveal`. Fading in there would be a
 * fade up from the panel's own ground, on a map that is already fully drawn.
 */
function frameClass(isVisible: boolean, animate: boolean): string {
  const stack = isVisible
    ? `z-10${animate ? " preview-frame-in" : ""}`
    : "z-0 pointer-events-none";

  return `absolute inset-0 h-full w-full border-0 ${stack}`;
}

/**
 * The snapshot minus everything that must not cost a rebuild.
 *
 * Two kinds of thing come out. The chrome settings, because the effect above
 * writes them straight into the live document as custom properties. And
 * **`generatedAt`, which is `map.updatedAt`** — so every PATCH the designer makes
 * changes it, and a key carrying it rebuilt the document on the way back from
 * saving a colour. That was the live channel working perfectly and being undone
 * a beat later by its own write; measured as one iframe load per press of a
 * control that should have cost none.
 */
function structural(snapshot: MapSnapshot): Partial<MapSnapshot> {
  const settings = { ...snapshot.settings };

  for (const key of CHROME_SETTING_KEYS) delete settings[key];

  const rest: Partial<MapSnapshot> = { ...snapshot, settings };
  delete rest.generatedAt;

  return rest;
}

/**
 * The same snapshot, opening where the outgoing document was looking.
 *
 * **`bounds` has to go with it**, and that is the whole of why the first version
 * of this did nothing. A published map opens at `center` and then, on load, fits
 * `bounds` around every one of its places — which is right for a visitor arriving
 * cold and is exactly what a carried camera must not do. Setting the centre while
 * leaving the bounds in place is asking the map to open here and then fly away,
 * which is what it did.
 */
function withView(
  snapshot: MapSnapshot,
  view: { lng: number; lat: number; zoom: number } | null,
): MapSnapshot {
  if (!view) return snapshot;

  return {
    ...snapshot,
    center: { lat: view.lat, lng: view.lng, zoom: view.zoom },
    // Null, not absent: the field is required in the contract, and null is what
    // the embed already reads as "nothing to fit".
    bounds: null,
  };
}

function pick<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Partial<T> {
  const out: Partial<T> = {};

  for (const key of keys) out[key] = source[key];

  return out;
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
