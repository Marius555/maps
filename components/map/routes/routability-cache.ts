"use client";

/**
 * Which pins the routing engine could reach, remembered across a page reload.
 *
 * ## What this is for
 *
 * Arming the route tool sweeps up to `ROUTE_PROBE_LIMIT` pins, one upstream
 * request each, and on the hosted router every one of those bills as a reverse
 * geocode because that engine has no native `nearest`. `use-routability.ts` held
 * the answers in refs, which die with the page — so **a reload spent all two
 * hundred again**, and so did the next reload, without limit. Against an upstream
 * selling three thousand credits a day, a morning of editing one map could take
 * most of it.
 *
 * ## Why a cache here is allowed when a column was not
 *
 * `use-routability.ts` refuses to *persist* a verdict, and it is right to: "a pin
 * dragged onto a road becomes routable, and a column recording otherwise would be
 * wrong from the moment it was written."
 *
 * This is keyed on the **coordinate**, not on the location, which is what makes it
 * a different proposition. The verdict is about a point on the earth, and a point
 * on the earth does not change its mind. Move the pin and the key no longer
 * matches, so the entry is ignored and the engine is asked again — there is no
 * state to invalidate, because a stale entry cannot be read in the first place.
 *
 * ## Why `sessionStorage` rather than `localStorage`
 *
 * The defect is a *reload* costing two hundred requests, and sessionStorage covers
 * exactly that: it survives reloads in the tab that is doing the editing and dies
 * with it. `localStorage` would also cover coming back next week, and that is the
 * reason not to use it — roads are built, and a verdict held for weeks is the
 * "wrong from the moment it was written" problem arriving by a slower route. A
 * bounded lifetime is part of the argument, not a limitation of it.
 *
 * Every access is wrapped: a private window, blocked site data or a quota refusal
 * must degrade to asking the engine, never to a broken editor.
 */

/** Five decimal places is about a metre — finer than any judgement made on it. */
const PRECISION = 5;

const PREFIX = "pinglide:routable:";

export type CachedPlace = { id: string; lat: number; lng: number };

/**
 * What a verdict is about: this location, at these coordinates.
 *
 * The coordinates are in the value rather than the key so that a moved pin reads
 * as a *mismatch* rather than as a miss — the distinction matters only for
 * pruning, but it keeps one entry per location instead of one per place a pin has
 * ever been.
 */
function coordinateOf(place: CachedPlace): string {
  return `${place.lat.toFixed(PRECISION)},${place.lng.toFixed(PRECISION)}`;
}

type Entry = { at: string; routable: boolean };
type Store = Record<string, Entry>;

function read(mapId: string): Store {
  try {
    const raw = sessionStorage.getItem(PREFIX + mapId);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Store)
      : {};
  } catch {
    return {};
  }
}

function write(mapId: string, store: Store): void {
  try {
    sessionStorage.setItem(PREFIX + mapId, JSON.stringify(store));
  } catch {
    /* Full, blocked, or unavailable. The engine is still there to ask. */
  }
}

/**
 * A remembered verdict for this location at the coordinates it is at *now*, or
 * null if there is none to trust.
 */
export function recall(mapId: string, place: CachedPlace): boolean | null {
  const entry = read(mapId)[place.id];
  if (!entry || entry.at !== coordinateOf(place)) return null;

  return entry.routable;
}

/** Remember a batch of verdicts, in one read and one write rather than per pin. */
export function remember(
  mapId: string,
  verdicts: readonly { place: CachedPlace; routable: boolean }[],
): void {
  if (verdicts.length === 0) return;

  const store = read(mapId);

  for (const { place, routable } of verdicts) {
    store[place.id] = { at: coordinateOf(place), routable };
  }

  write(mapId, store);
}

/**
 * Drop everything about locations that are no longer on the map.
 *
 * The same promise `useRoutability.retainOnly` makes, and for the same reason: an
 * id that is deleted and reused must not inherit the verdict of the location that
 * used to wear it.
 */
export function retain(mapId: string, placeIds: ReadonlySet<string>): void {
  const store = read(mapId);
  let changed = false;

  for (const id of Object.keys(store)) {
    if (placeIds.has(id)) continue;

    delete store[id];
    changed = true;
  }

  if (changed) write(mapId, store);
}
