"use client";

import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { useEffect, useRef } from "react";

import { appendStop } from "@/lib/map/route-stops";
import { isOptimisticPlaceId } from "@/lib/query/places";
import {
  ROUTE_SNAP_RADIUS_PX,
  snapToPlace,
  type Snap,
} from "@/lib/map/snap-to-place";
import type { Place } from "@/lib/repositories/types";
import {
  MIN_LINE_POINTS,
  type LineGeometry,
  type LngLatTuple,
  type RouteStop,
} from "@/packages/shared/shapes";

/**
 * Click out the stops of a route.
 *
 * The gesture is `use-draw-line.ts`'s, which is deliberate — this is the same
 * thing to do with your hands, and a second idiom for "put points on the map"
 * would be one to learn for no reason. Two differences, and both matter.
 *
 * **A stop is a location, and only a location.** A line bonds only its two ends,
 * because a middle point that happens to pass near a pin is a bend in the path
 * and not a place anyone stops. For a route the opposite is true: a stop in the
 * middle *is* the point, and it needs to know which location it is so the route
 * can tell you later that the location moved. So a click that lands on a pin
 * becomes a stop and a click on empty ground does nothing at all — which is the
 * whole of `appendStop`, along with the two other clicks that change nothing.
 * Free waypoints were offered first and withdrawn on use: a route through
 * arbitrary ground looks like a route and is not one, because nothing about it
 * can ever go out of date and the card has nothing to call its stops.
 *
 * **The preview is straight, and that is honest.** Until the engine answers,
 * nobody knows where the roads go, and drawing a guess would be showing a route
 * that does not exist. The straight run between stops says "these are the stops"
 * and nothing more; the road path replaces it once, on commit.
 *
 * **A pin the engine cannot reach is refused out loud.** That is the one click
 * that changes nothing *and* says so — see `appendStop` for the three that stay
 * silent. It has to speak, because the pin is visibly there and visibly grey,
 * and the whole difference between a rule and a broken tool is whether the tool
 * tells you which it is.
 *
 * **And a pin nobody has asked about yet is asked about now.** The verdicts
 * arrive from a sweep and from a hover pre-warm, both of which a deliberate
 * click can outrun — the sweep is one pin per second on the public engine, and
 * a click lands about 300ms after the pointer settles. Reading only what had
 * already arrived meant the refusal fired for the pins nobody was in a hurry to
 * click and never for the ones they were. So an unanswered pin blocks its own
 * click for as long as the answer takes — the caller marks the pin, since it is
 * the caller that knows it is asking — and the outcome is then one of the two
 * above. On a warm cache none of this runs at all.
 *
 * The engine is not called from here. This hook yields stops; the caller turns
 * them into a route — which is what keeps the one metered request in one place
 * and out of the pointer handlers. `onConsider` is the exception that proves it:
 * it names a pin the pointer has settled on and lets the caller decide whether
 * to ask anything at all.
 */
export function useDrawRoute({
  map,
  isReady,
  isActive,
  places,
  unroutableIds,
  onPreview,
  onDraw,
  onRefused,
  onMissed,
  onCheck,
  onConsider,
  onCancel,
  onStopsChange,
}: {
  map: React.RefObject<MapLibreMap | null>;
  isReady: boolean;
  isActive: boolean;
  /** Candidates for a stop to bond to. */
  places: Place[];
  /** Locations the routing engine cannot reach, which may not become stops. */
  unroutableIds: ReadonlySet<string>;
  /** The stops as they currently stand, including the point under the cursor. */
  onPreview: (geometry: LineGeometry | null) => void;
  /** A finished list of stops. The caller asks the engine and saves the shape. */
  onDraw: (stops: RouteStop[]) => void;
  /** A click on a location the engine cannot reach. The caller says so. */
  onRefused: (placeId: string) => void;
  /**
   * A click that added no stop, and why.
   *
   * The three cases below used to be silent on the argument that none of them is
   * worth interrupting anyone about. What that produced was five clicks becoming
   * three stops with nothing said, and a tool that reads as unreliable — the
   * same silence the snap radius was widened to fix, one layer up. So the two
   * that a person can act on are reported, and the caller decides how loudly.
   *
   * `"empty"` is a click on open ground, and fires once per gesture: it is the
   * common miss and a toast per stray click would be worse than the silence.
   * `"saving"` is a pin whose create has not come back yet — rare, and gone in a
   * moment, so it is said every time.
   *
   * The two genuinely silent cases stay silent: clicking the pin that is already
   * the last stop, and the 25-stop cap.
   */
  onMissed: (reason: "empty" | "saving") => void;
  /**
   * Settle whether this location can be a stop, waiting if it has to.
   *
   * Resolves from what the caller already knows where it can, and asks the
   * engine where it cannot. It never rejects: a broken affordance must not stop
   * someone drawing, because the route request refuses on its own account.
   */
  onCheck: (placeId: string) => Promise<boolean>;
  /**
   * The pointer has settled on this location.
   *
   * The pause before a click is the one free moment to find out whether the pin
   * under it can be a stop at all, so the caller is told and decides. Fired once
   * per rest, never per pixel of movement.
   */
  onConsider: (placeId: string) => void;
  onCancel: () => void;
  /**
   * The locations taken as stops so far, in order, whenever that changes.
   *
   * The one thing about this gesture the *pins* need to know. `onPreview` cannot
   * carry it: it strips every `placeId` on the way out, because what it feeds is
   * a GeoJSON source that draws coordinates and has no idea what a location is.
   * And `onDraw` is too late by definition — it fires when the gesture is over.
   *
   * Announced rather than exposed, so this hook still owns `stops` outright:
   * nothing can write to the list, and a reader that stops listening changes
   * nothing about the route being drawn.
   */
  onStopsChange?: (placeIds: readonly string[]) => void;
}) {
  const handlers = useRef({
    onPreview,
    onDraw,
    onRefused,
    onMissed,
    onCheck,
    onConsider,
    onCancel,
    onStopsChange,
  });
  const live = useRef({ places, unroutableIds });

  useEffect(() => {
    handlers.current = {
      onPreview,
      onDraw,
      onRefused,
      onMissed,
      onCheck,
      onConsider,
      onCancel,
      onStopsChange,
    };
    live.current = { places, unroutableIds };
  });

  useEffect(() => {
    const instance = map.current;
    if (!instance || !isReady || !isActive) return;

    let stops: RouteStop[] = [];

    /**
     * Whether this gesture is still the live one.
     *
     * A check can outlive the tool being disarmed, and a stop appended after
     * that would be added to a list the cleanup has already thrown away — and
     * would redraw a preview over a map that is back in browse mode.
     */
    let alive = true;

    /**
     * Pins this gesture has already put a question to.
     *
     * Kept here as well as in the caller because the caller's set is state and
     * this runs from a pointer handler: two quick clicks on the same unanswered
     * pin must send one request, not two.
     */
    const asked = new Set<string>();

    /**
     * Whether this gesture has already said that a click landed on nothing.
     *
     * Once. Someone who has been told what a stop is does not need telling again
     * every time the pointer is a few pixels out, and a drawing gesture is
     * exactly where a stack of toasts would cover the thing being drawn.
     */
    let warnedEmpty = false;

    /**
     * The location under the pointer, or null over open ground.
     *
     * At the pin's own radius rather than the line tool's twelve pixels. Here
     * the snap *is* the click: `appendStop` refuses anything that misses, so a
     * magnet narrower than the pin swallows aim that visibly landed on it.
     */
    const snapAt = (event: MapMouseEvent): Snap | null =>
      snapToPlace(
        live.current.places,
        event.point,
        (place) => instance.project([place.lng, place.lat]),
        ROUTE_SNAP_RADIUS_PX,
      );

    /*
     * The pin the pointer is resting on, announced once it has rested.
     *
     * Announcing on every `mousemove` would name every pin a cursor crossed on
     * its way somewhere, which is a request each on a map with three thousand of
     * them. A quarter of a second is the pause before a deliberate click and
     * long enough that a sweep across the map costs nothing.
     */
    let hovered: string | null = null;
    let dwell: ReturnType<typeof setTimeout> | null = null;

    const consider = (placeId: string | null) => {
      if (placeId === hovered) return;

      hovered = placeId;
      if (dwell) clearTimeout(dwell);
      // Same reason the click path skips it: there is nothing on the server to
      // ask about yet, and the answer would be about an id that is about to be
      // thrown away.
      if (!placeId || isOptimisticPlaceId(placeId)) return;

      dwell = setTimeout(() => handlers.current.onConsider(placeId), 250);
    };

    const show = (hover?: LngLatTuple) => {
      // The hovered point is drawn but never stored — it is where the next click
      // *would* land, not a decision anyone has made yet.
      const points = stops.map((stop) => stop.at);
      const preview = hover ? [...points, hover] : points;

      // No `route` on the preview geometry, so nothing downstream mistakes a
      // straight draft for an answer from the engine.
      handlers.current.onPreview({ kind: "line", points: preview });
    };

    /**
     * Say which locations are stops now.
     *
     * Ids only, and only the bonded ones — a legacy free waypoint is not a pin,
     * so there is nothing on the map for it to light up. Called from every place
     * `stops` is assigned below, which is the whole contract: the pins that
     * claim to be stops and the list that decides the route cannot drift apart
     * if no assignment is allowed to skip this.
     */
    const announce = () => {
      handlers.current.onStopsChange?.(
        stops
          .map((stop) => stop.placeId)
          .filter((placeId): placeId is string => Boolean(placeId)),
      );
    };

    const reset = () => {
      stops = [];
      handlers.current.onPreview(null);
      announce();
    };

    /**
     * Whether a click is currently waiting on the engine, and what to do about
     * a finish that arrives during that wait.
     *
     * A second *click* while one is in flight is dropped, not queued: queueing
     * would let someone build a route out of clicks made before they could see
     * what the first one did. A *finish* is different — the first click of a
     * double-click is very often the one that adds the last stop, and throwing
     * the finish away would commit a route one stop short of what was drawn. So
     * it is held and replayed the moment the answer lands.
     */
    let waiting = false;
    let finishWhenReady = false;

    const commit = () => {
      if (waiting) {
        finishWhenReady = true;
        // True, so the caller still swallows the browser's own double-click
        // zoom: the finish is accepted, it just has not happened yet.
        return true;
      }

      if (stops.length < MIN_LINE_POINTS) return false;

      const drawn = stops;
      reset();
      handlers.current.onDraw(drawn);
      return true;
    };

    /**
     * A click, once its pin's verdict is in.
     *
     * Split from `onClick` because the wait sits between them: everything here
     * has to be able to run a second after the pointer went down, against a
     * `stops` list that may have moved on.
     */
    const take = (snap: Snap | null) => {
      /*
       * A pin the engine cannot reach. Refused here rather than in `appendStop`,
       * which stays a rule about the list of stops and knows nothing about
       * roads — and refused by name, because this click landed squarely on
       * something the user aimed at.
       *
       * The snap still happens first. Ignoring grey pins in `snapToPlace` would
       * turn this into a click on open ground, which is the silence that made
       * the tool read as broken in the first place; there would be nothing left
       * to name.
       */
      if (snap?.placeId && live.current.unroutableIds.has(snap.placeId)) {
        handlers.current.onRefused(snap.placeId);
        return;
      }

      /*
       * A pin that exists only in the cache, waiting on its create.
       *
       * Refused, because bonding to it is unrecoverable: the temporary id is
       * swapped for the server's the moment the create lands
       * (`lib/query/places.ts`), and nothing rewrites a stop that already
       * holds the old one. The route would keep an id no location will ever
       * have — a stop reading "Deleted location" for a pin sitting right
       * there on the map, for the life of the route.
       *
       * Here rather than in `snapToPlace`, for the reason the refusal above
       * gives: a pin ignored by the magnet is a click on open ground, and the
       * message would name nothing.
       */
      if (snap?.placeId && isOptimisticPlaceId(snap.placeId)) {
        handlers.current.onMissed("saving");
        return;
      }

      // A click on open ground. Said once per gesture — see `onMissed`.
      if (!snap?.placeId) {
        if (!warnedEmpty) {
          warnedEmpty = true;
          handlers.current.onMissed("empty");
        }
        return;
      }

      // On the pin that is already the last stop, or at the cap: both change
      // nothing, and neither is worth interrupting anyone about. See
      // `appendStop`.
      const next = appendStop(stops, snap);
      if (!next) return;

      stops = next;
      show();
      announce();
    };

    const onClick = (event: MapMouseEvent) => {
      if (waiting) return;

      const snap = snapAt(event);

      // Nothing to settle: open ground, a pin this gesture already waited for,
      // or one that does not exist on the server yet — asking the engine about
      // a temporary id would spend a request on a location it has never heard
      // of. `onCheck` answers a known pin without a request, so the common case
      // never reaches the branch below at all.
      if (
        !snap?.placeId ||
        asked.has(snap.placeId) ||
        isOptimisticPlaceId(snap.placeId)
      ) {
        take(snap);
        return;
      }

      const placeId = snap.placeId;
      asked.add(placeId);
      waiting = true;

      void handlers.current
        .onCheck(placeId)
        .catch(() => true)
        .then((isRoutable) => {
          waiting = false;

          // Cancelled while we waited. `stops` is still this closure's, but the
          // gesture it belonged to is over.
          if (!alive) return;

          /*
           * The answer we were handed, not `live.current.unroutableIds`.
           *
           * That set is React state, and it is one render behind at this exact
           * moment: `onCheck` records the verdict by calling `setState`, and
           * this runs in the promise's own microtask, before React has
           * committed anything or refreshed the ref. Reading it here accepted
           * the stop and stayed silent — the pin greyed a moment later, which
           * is the tool telling you afterwards that it should not have let you
           * do the thing it just did. Measured, on a pin clicked a quarter of a
           * second after the tool was armed.
           */
          if (!isRoutable) {
            handlers.current.onRefused(placeId);
          } else {
            take(snap);
          }

          if (finishWhenReady) {
            finishWhenReady = false;
            commit();
          }
        });
    };

    const onMouseMove = (event: MapMouseEvent) => {
      const snap = snapAt(event);
      consider(snap?.placeId ?? null);

      if (stops.length === 0) return;

      /*
       * The band follows the cursor everywhere, and jumps onto a pin when it
       * finds one. That jump is the entire explanation of which clicks count —
       * freezing the band over open ground would read as a broken tool rather
       * than as a rule, and it is the only place the rule is ever shown.
       */
      show(snap?.point ?? [event.lngLat.lng, event.lngLat.lat]);
    };

    const onDoubleClick = (event: MapMouseEvent) => {
      /*
       * No slice here, unlike the line tool's. That one exists because both
       * clicks under a double-click add a point; here the second lands on the
       * pin that just became the last stop, and `appendStop` refuses it. Slicing
       * as well would throw away a stop somebody meant.
       */
      if (stops.length >= MIN_LINE_POINTS) event.preventDefault();

      commit();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        reset();
        handlers.current.onCancel();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        commit();
        return;
      }

      if (event.key === "Backspace" && stops.length > 0) {
        event.preventDefault();
        stops = stops.slice(0, -1);

        if (stops.length === 0) {
          // `reset` announces on its own account.
          reset();
        } else {
          show();
          announce();
        }
      }
    };

    // Double-clicking is how you finish, so it must not also zoom.
    instance.doubleClickZoom.disable();

    instance.on("click", onClick);
    instance.on("mousemove", onMouseMove);
    instance.on("dblclick", onDoubleClick);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      alive = false;

      instance.off("click", onClick);
      instance.off("mousemove", onMouseMove);
      instance.off("dblclick", onDoubleClick);
      window.removeEventListener("keydown", onKeyDown);

      instance.doubleClickZoom.enable();
      if (dwell) clearTimeout(dwell);
      handlers.current.onPreview(null);

      // Disarming ends the gesture, so nothing is a stop any more. Without this
      // the pins the last route was drawn through go on breathing at a map that
      // is back in browse mode.
      handlers.current.onStopsChange?.([]);
    };
  }, [map, isReady, isActive]);
}
