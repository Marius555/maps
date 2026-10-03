"use client";

import { useEffect, useRef, useState } from "react";

import { useUpdatePlace } from "@/lib/query/places";

/** How long a wheel drag has to rest before its colour is written. */
const SETTLE_MS = 400;

/**
 * The picker's colour as it will be, and the one PATCH that saves it.
 *
 * A swatch press is an answer and is written at once. The wheel answers on
 * every pointer move, so its colour waits for the drag to rest — and is written
 * on close or unmount whatever is still waiting, so nothing picked is lost by
 * closing quickly.
 *
 * **The draft is the base, never the row.** The row is the server's copy and
 * lags a write behind (CLAUDE.md: debounced writes apply to the local draft);
 * comparing against `lastSent` rather than `place.color` is what stops a late
 * reply from turning into a second write of a colour already moved off.
 */
export function usePinColorDraft({
  mapId,
  placeId,
  saved,
}: {
  mapId: string;
  placeId: string;
  /** What the row holds when the picker opens: a `#rrggbb`, or "" for none. */
  saved: string;
}) {
  const updatePlace = useUpdatePlace(mapId);
  const update = updatePlace.mutate;

  const [draft, setDraft] = useState(saved);
  const lastSent = useRef(saved);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = (color: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;

    if (color === lastSent.current) return;
    lastSent.current = color;
    update({ placeId, input: { color } });
  };

  /** Write now — a swatch, or the first one standing for "none". */
  const commit = (color: string) => {
    setDraft(color);
    send(color);
  };

  /** Write once the wheel rests. */
  const preview = (color: string) => {
    setDraft(color);
    pending.current = color;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => send(color), SETTLE_MS);
  };

  /** Whatever the wheel left waiting goes out now. */
  const flush = () => {
    if (pending.current !== null) send(pending.current);
  };

  // Unmounting — the row deleted, the panel switched — flushes too. Read
  // through the ref so the cleanup sees the latest `send`, not the first one.
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });
  useEffect(() => () => flushRef.current(), []);

  return { draft, commit, preview, flush };
}
