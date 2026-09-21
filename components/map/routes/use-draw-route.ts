"use client";

import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { useEffect, useRef } from "react";

import { appendStop, dropStopsOf } from "@/lib/map/route-stops";
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
 * **A pin nobody has asked about yet becomes a stop now and is undone later.**
 * The verdicts arrive from a sweep and from a hover pre-warm, both of which a
 * deliberate click can outrun — the sweep is one pin per second on the public
 * engine, and a click lands about 300ms after the pointer settles. Reading only
 * what had already arrived meant the refusal fired for the pins nobody was in a
 * hurry to click and never for the ones they were.
 *
 * This used to be answered by making the click *wait*, which was the wrong half
 * of the trade and is the bug this file was rewritten to fix. The wait is a
 * throttled upstream call behind three database round trips — one to three
 * seconds on a cold map — and for the whole of it the only thing on screen was a
 * pulse on a 36px marker, while every further click was dropped on the floor.
 * The gesture read as broken at exactly the moment it had to work: the first
 * click of the first route. The second attempt always worked, because by then
 * the verdict was cached.
 *
 * So the click takes its stop at once and the question is asked behind it. A
 * refusal removes the stop again and says why, in the same sentence it always
 * used (`onRefused`). That is a visible undo rather than an invisible wait, and
 * the rare case pays for itself instead of the common one paying for it. The
 * route request refuses a bad stop by name on its own account
 * (`use-route-request.ts`), so nothing unsafe can survive a commit either way.
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
  /**
   * The stops as they currently stand, including the point under the cursor.
   *
   * `placed` is how many of those points are decisions somebody has made — so
   * the run past it is the leg hanging off the cursor, and the renderer can draw
   * the two differently. Until it existed they were one undifferentiated dashed
   * line, and "what I have built" looked exactly like "where I am pointing".
   */
  onPreview: (geometry: LineGeometry | null, placed?: number) => void;
  /** A finished list of stops. The caller asks the engine and saves the shape. */
  onDraw: (stops: RouteStop[]) => void;
  /**
   * A location the engine cannot reach, and whether it had already been taken.
   *
   * Two genuinely different things have happened by the time this fires. Either
   * the click landed on a pin already known to be unreachable, and nothing
   * changed — or the stop was added, drawn, and has just been removed again
   * under the user's eyes. The second needs saying, because a stop vanishing
   * from a route with no explanation is the failure this whole gesture was
   * rewritten to stop.
   */
  onRefused: (placeId: string, wasTaken: boolean) => void;
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
   * Settle whether this location can be a stop.
   *
   * Resolves from what the caller already knows where it can, and asks the
   * engine where it cannot. Nothing waits on it — the stop is already on the map
   * by the time this is called, and `false` takes it back off. It never rejects:
   * a broken affordance must not stop someone drawing, because the route request
   * refuses on its own account.
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
     * Which run of stops the list currently holds.
     *
     * Bumped by every `reset`, so a verdict that lands after the gesture it
     * belonged to is over cannot edit the list that replaced it. `alive` says
     * the tool has been disarmed; this says the same thing one level down, for a
     * route that was finished, escaped or emptied while the tool stayed armed —
     * which is the ordinary case now that a click no longer waits.
     */
    let epoch = 0;

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
      //
      // `stops.length` is the count of placed points whether or not a hover is
      // on the end, which is what makes the leg to the cursor the only thing
      // drawn as unplaced.
      handlers.current.onPreview({ kind: "line", points: preview }, stops.length);
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
      epoch += 1;
      handlers.current.onPreview(null);
      announce();
    };

    /*
     * There is no `waiting` flag here any more, and its absence is the point.
     *
     * It used to drop every click made while a verdict was in flight, and to
     * hold a finish back until the answer landed — both of which existed only
     * because a click could not proceed without the engine. Nothing waits now,
     * so a second click is a second stop and a double-click finishes when it is
     * made, which is what those two lines were apologising for.
     */
    const commit = () => {
      if (stops.length < MIN_LINE_POINTS) return false;

      const drawn = stops;
      reset();
      handlers.current.onDraw(drawn);
      return true;
    };

    /**
     * A click, turned into a stop.
     *
     * Returns the location it took, or null when the click changed nothing —
     * which is what tells `onClick` whether there is anything to ask the engine
     * about. Everything it refuses, it refuses *now*: these are the four
     * answers available without leaving the browser.
     */
    const take = (snap: Snap | null): string | null => {
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
        handlers.current.onRefused(snap.placeId, false);
        return null;
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
        return null;
      }

      // A click on open ground. Said once per gesture — see `onMissed`.
      if (!snap?.placeId) {
        if (!warnedEmpty) {
          warnedEmpty = true;
          handlers.current.onMissed("empty");
        }
        return null;
      }

      // On the pin that is already the last stop, or at the cap: both change
      // nothing, and neither is worth interrupting anyone about. See
      // `appendStop`.
      const next = appendStop(stops, snap);
      if (!next) return null;

      stops = next;
      show();
      announce();

      return snap.placeId;
    };

    /**
     * The stop is on the map; now find out whether it was allowed.
     *
     * Runs behind the click rather than in front of it, and everything awkward
     * about it follows from that: by the time the answer lands the list has
     * moved on, and the stop being undone may be at any index, or gone, or
     * belong to a route that has already been drawn.
     *
     * Three guards, and each covers a different way that happens. `alive` is
     * the tool disarmed; `epoch` is this run of stops finished, escaped or
     * emptied under a tool still armed; and the `some` is the stop already
     * taken out by Backspace, where saying it aloud would be a toast about a
     * decision the user has already reversed. The pin greys either way — that is
     * `onCheck`'s own doing — which is the part of the message that matters.
     */
    const settle = (placeId: string) => {
      const mine = epoch;

      void handlers.current
        .onCheck(placeId)
        .catch(() => true)
        .then((isRoutable) => {
          if (isRoutable || !alive || mine !== epoch) return;
          if (!stops.some((stop) => stop.placeId === placeId)) return;

          stops = dropStopsOf(stops, placeId);

          // `show` draws what is left, but with nothing left there is no band
          // to draw and it would leave the last one on the map — `onMouseMove`
          // returns early at no stops, so nothing would ever clear it.
          if (stops.length === 0) handlers.current.onPreview(null);
          else show();

          announce();
          handlers.current.onRefused(placeId, true);
        });
    };

    const onClick = (event: MapMouseEvent) => {
      const taken = take(snapAt(event));
      if (!taken) return;

      /*
       * Nothing left to settle: this gesture has already asked about that pin.
       * `onCheck` answers a pin the sweep or the hover pre-warm has covered
       * without a request at all, so on a warm map this costs nothing — the set
       * is here as well as in the caller because two quick clicks on the same
       * pin run before React has committed anything.
       */
      if (asked.has(taken)) return;

      asked.add(taken);
      settle(taken);
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
