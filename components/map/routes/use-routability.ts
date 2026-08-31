"use client";

import { useCallback, useRef, useState } from "react";

import { useRoutable } from "@/lib/query/routable";
import { MAX_ROUTABLE_POINTS } from "@/lib/validation/routable.schema";

import type { Place } from "@/lib/repositories/types";
import type { LngLatTuple } from "@/packages/shared/shapes";

/**
 * Which locations the routing engine can actually reach.
 *
 * A route's stops are locations and only locations (lib/map/route-stops.ts), so
 * a pin the engine cannot attach to a road is a pin the route tool must refuse —
 * and it has to refuse it *visibly*, before the click, or the tool reads as
 * broken exactly the way it did when a route through such a pin came back with a
 * message naming no pin at all.
 *
 * Held in a hook rather than in lib/stores/editor-store.ts, which is deliberately
 * transient UI state and nothing else. This is knowledge about data, gathered
 * from a server, and it is the same shape as `useAddressResolution`'s — sets of
 * ids, kept for as long as the editor is open. Not persisted: a pin dragged onto
 * a road becomes routable, and a column recording otherwise would be wrong from
 * the moment it was written.
 *
 * **Nothing here can reach a visitor.** Every call is an edit-time request made
 * while somebody is drawing (CLAUDE.md §2), and no answer is baked into a
 * published snapshot — it only greys a marker on the owner's own canvas.
 */
/**
 * How many pins one sweep request carries.
 *
 * Well under the endpoint's own cap of `MAX_ROUTABLE_POINTS`, and the reason is
 * latency rather than payload. The server answers one coordinate at a time
 * behind a process-wide throttle and the sweep runs one request at a time, so a
 * click-time check queues behind whatever remains of the batch already in
 * flight. At the cap that is twenty-five seconds of somebody waiting for a pin
 * to accept their click; at five it is five, and on a self-hosted engine it is
 * neither.
 */
const SWEEP_BATCH = Math.min(5, MAX_ROUTABLE_POINTS);

/** One frozen empty set, so the ref and the state start out identical. */
const EMPTY_IDS: ReadonlySet<string> = new Set();

export function useRoutability(mapId: string) {
  const routable = useRoutable(mapId);
  const check = routable.mutateAsync;

  /**
   * Locations the engine could not put on a road.
   *
   * Held twice, and that is not redundancy. The markers repaint from *state*;
   * `check` answers a click from the **ref**, because a click can land in the
   * same tick as the answer that decides it and a read of state there would be
   * one render behind — which is a stop accepted on a pin that had just been
   * refused. `commit` is the only writer, so the two cannot drift.
   *
   * Its companion `asked` is a ref for a plainer reason: it only ever guards a
   * request, and a re-render per answer on a map with three thousand pins would
   * be three thousand renders.
   */
  const known = useRef<ReadonlySet<string>>(EMPTY_IDS);
  const [unroutableIds, setUnroutableIds] = useState<ReadonlySet<string>>(EMPTY_IDS);

  const commit = useCallback((next: ReadonlySet<string>) => {
    known.current = next;
    setUnroutableIds(next);
  }, []);

  /**
   * Everything already asked about, answered or in flight.
   *
   * A ref and not state, and that is load-bearing rather than an optimisation:
   * `probe` is called from a pointer handler that can fire again before React
   * has committed anything, so a check against state would send the same pin to
   * the engine several times. Written *before* the request goes out.
   */
  const asked = useRef(new Set<string>());

  /**
   * Everything the engine has actually answered for.
   *
   * Distinct from `asked`, and the distinction is the whole of `check`. `asked`
   * is written *before* a request goes out, so it is true of a pin the sweep is
   * still waiting on — and reading it as "answered" is what made the click-time
   * check wave through every pin a sweep happened to be holding, which is the
   * race it exists to close. Nothing is in here that we do not know.
   */
  const answered = useRef(new Set<string>());

  /**
   * The pin a click is currently waiting on, if any.
   *
   * State, because the marker layer draws it. Only ever set by `check`: the
   * sweep and the hover pre-warm are nobody's dead time and must not put a
   * spinner on anything.
   */
  const [checkingId, setCheckingId] = useState<string | null>(null);

  /**
   * Which *gesture* the running probes belong to, not which call.
   *
   * A sweep is up to two hundred pins asked about one at a time behind a
   * one-per-second throttle, so it long outlives the arming that started it and
   * has to be stoppable. Only `abort` moves this; a batch whose token has moved
   * returns rather than spending the next three minutes answering a question
   * nobody is looking at.
   *
   * Bumping it from inside `probe` would be the obvious reading and is wrong:
   * the hover pre-warm is a `probe` of one pin, so every pin the pointer crossed
   * would cancel the sweep that was greying the rest of the map.
   */
  const gesture = useRef(0);

  /** In-flight single-pin checks, so a hover and a click share one request. */
  const pending = useRef(new globalThis.Map<string, Promise<boolean>>());

  const markUnroutable = useCallback(
    (placeId: string) => {
      asked.current.add(placeId);
      answered.current.add(placeId);
      if (known.current.has(placeId)) return;

      commit(new Set(known.current).add(placeId));
    },
    [commit],
  );

  /**
   * Record a batch of answers.
   *
   * A missing entry is skipped rather than read as either verdict: a short array
   * means our own shapes disagree, and neither greying a pin nor filing it away
   * as answered is a fair thing to do to a location on that basis.
   *
   * It also *clears* a verdict that has turned. A pin dragged onto a road is
   * routable now, and nothing else in this hook would ever take the grey off.
   */
  const record = useCallback(
    (batch: readonly Place[], results: boolean[]) => {
      const next = new Set(known.current);
      let changed = false;

      batch.forEach((place, index) => {
        const verdict = results[index];

        // A short array means the shapes disagree, and that is our bug, not the
        // location's. Recording it as "answered: routable" would both blame the
        // pin for it and make sure it was never asked about again.
        if (typeof verdict !== "boolean") return;

        answered.current.add(place.id);
        const isUnroutable = !verdict;

        if (isUnroutable && !next.has(place.id)) {
          next.add(place.id);
          changed = true;
        } else if (!isUnroutable && next.has(place.id)) {
          next.delete(place.id);
          changed = true;
        }
      });

      if (changed) commit(next);
    },
    [commit],
  );

  /**
   * Ask about every one of these locations that has not been asked about yet.
   *
   * Batched at `SWEEP_BATCH`, and sequential: the engine paces itself behind one
   * process-wide throttle, so overlapping batches would only make the order they
   * answer in less predictable. The pins grey as each batch lands,
   * which on a self-hosted engine is immediate and on the public demo server —
   * one request per second — is a slow sweep nobody is waiting on. What order
   * they are asked in is lib/map/probe-order.ts's decision, not this hook's.
   *
   * **A sweep stops when the gesture does.** Two hundred pins at one a second
   * outlives the tool being armed by minutes, and a queue still running against
   * a metered engine after the user has moved on is exactly the cost §2 exists
   * to keep out. `abort` bumps the token; a batch whose token has moved returns.
   *
   * A failure is silence. This is an affordance, not an answer anybody asked
   * for, and a toast about a check the user never requested would be noise; the
   * pin simply stays as it was, and the route request itself still says so if it
   * comes to that. But the ids come **back out** of `asked` on a failure. They
   * are written in before the request so a pointer crossing a pin cannot ask
   * twice, and leaving them there after a 500 or a timeout silenced those pins
   * for the life of the editor — which is indistinguishable from the feature
   * doing nothing at all.
   */
  const probe = useCallback(
    async (places: readonly Place[]) => {
      const queue = places.filter((place) => !asked.current.has(place.id));
      if (queue.length === 0) return;

      const mine = gesture.current;
      for (const place of queue) asked.current.add(place.id);

      for (let at = 0; at < queue.length; at += SWEEP_BATCH) {
        if (mine !== gesture.current) return;

        const batch = queue.slice(at, at + SWEEP_BATCH);
        const points: LngLatTuple[] = batch.map((place) => [
          place.lng,
          place.lat,
        ]);

        try {
          const { results } = await check({ points, profile: "car" });
          if (mine !== gesture.current) return;

          record(batch, results);
        } catch {
          // See above. Nothing is said, and the pins go back on the shelf.
          for (const place of batch) asked.current.delete(place.id);
        }
      }
    },
    [check, record],
  );

  /**
   * Stop the running sweep. Called when the route tool disarms.
   *
   * Everything the abandoned sweep had claimed but not answered goes back on
   * the shelf, or arming the tool a second time would find every one of those
   * pins already in `asked`, ask about none of them, and grey nothing — the
   * failure this whole sweep exists to end, reintroduced by the thing that
   * stops it.
   */
  const abort = useCallback(() => {
    gesture.current += 1;

    for (const placeId of asked.current) {
      if (!answered.current.has(placeId)) asked.current.delete(placeId);
    }
  }, []);

  /**
   * One location, answered before the caller acts on it.
   *
   * The sweep and the hover pre-warm are both races the user can win — a
   * deliberate click lands about 300ms after the pointer settles and the public
   * engine takes about a second to answer — and losing that race is what made
   * the tool silently accept a stop it was meant to refuse. So the click asks,
   * and waits. On a warm cache, which is the whole point of the sweep and the
   * pre-warm, this returns without a request at all.
   *
   * A failure resolves `true`. This check is a courtesy in front of the route
   * request, which does its own refusing with a named stop
   * (use-route-request.ts); blocking a stop because our own affordance broke
   * would be worse than the thing it exists to prevent.
   */
  const checkOne = useCallback(
    async (place: Place): Promise<boolean> => {
      if (answered.current.has(place.id)) return !known.current.has(place.id);

      const inFlight = pending.current.get(place.id);
      if (inFlight) return inFlight;

      const answer = (async () => {
        try {
          const { results } = await check({
            points: [[place.lng, place.lat]],
            profile: "car",
          });

          asked.current.add(place.id);
          record([place], results);

          return results[0] !== false;
        } catch {
          return true;
        } finally {
          pending.current.delete(place.id);
        }
      })();

      pending.current.set(place.id, answer);
      setCheckingId(place.id);

      try {
        return await answer;
      } finally {
        // Only if nothing newer has taken the mark: two clicks in a row would
        // otherwise clear the second pin's spinner when the first resolves.
        setCheckingId((current) => (current === place.id ? null : current));
      }
    },
    [check, record],
  );

  /**
   * Drop everything remembered about locations that no longer exist.
   *
   * Driven by which places are on the map rather than by a call from whoever
   * deleted one, for `useAddressResolution.retainOnly`'s reason: a location can
   * go from the list, from its card or from a rollback, and all three have to
   * leave the same nothing behind. It also means a location deleted and its id
   * reused is asked about again rather than inheriting a verdict.
   */
  const retainOnly = useCallback((placeIds: ReadonlySet<string>) => {
    for (const placeId of asked.current) {
      if (!placeIds.has(placeId)) asked.current.delete(placeId);
    }

    // `answered` as well, or the promise in the paragraph above is only half
    // kept: a reused id would find `asked` clear and `answered` still holding a
    // verdict about a location that no longer exists.
    for (const placeId of answered.current) {
      if (!placeIds.has(placeId)) answered.current.delete(placeId);
    }

    const current = known.current;
    const next = new Set([...current].filter((id) => placeIds.has(id)));

    // Nothing written when nothing was dropped, so this cannot loop a render.
    if (next.size !== current.size) commit(next);
  }, [commit]);

  return {
    unroutableIds,
    checkingId,
    probe,
    abort,
    check: checkOne,
    markUnroutable,
    retainOnly,
  };
}
