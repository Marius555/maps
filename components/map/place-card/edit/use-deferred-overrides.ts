"use client";

import { useCallback, useEffect, useRef } from "react";

import { useUpdatePlace } from "@/lib/query/places";
import type { CardBlockOverrides } from "@/packages/shared/card-overrides";

/**
 * How long the panel waits before telling the server, in ms.
 *
 * Long enough that a colour drag is one request rather than sixty, short enough
 * that letting go of a control and reaching for the next one does not outrun it.
 * Every exit from the panel flushes, so this is only ever the delay for a change
 * somebody is still in the middle of making.
 */
const COMMIT_MS = 400;

/**
 * One pin's card overrides: painted immediately, saved once.
 *
 * **The bug this exists to fix is not a slow save, it is a wrong one.**
 * `ColorPickerField` fires its `onChange` on every pointer move, which is
 * correct — the studio holds a local draft and writes nothing until Save, so a
 * frame-rate `onChange` there costs a re-render and nothing else. This panel had
 * no draft: every frame of a drag became a `PATCH`, thirty to sixty of them in
 * flight at once, and `useUpdatePlace` merges whatever response lands last over
 * whatever the cache holds. Responses do not arrive in the order they were sent,
 * so the card walked backwards and forwards between colours as they landed. And
 * because the next patch was computed from the cache, a stale reply did not just
 * flicker — it became the base for the following write and was saved.
 *
 * So the two halves are split. **`onPreview` is the picture** — it goes straight
 * into the card's `blockOverrides` and repaints under the pointer with no
 * network at all, the same preview channel a shape drag paints through. **The
 * mutation is the record**, and it fires once, on a trailing timer, from the
 * value the panel is holding rather than from the cache.
 *
 * `pending` is what has not been sent yet, and `flush` is what sends it. Every
 * way out of the panel goes through one of the two: Done and the popover's own
 * dismissal call it, and the effect below catches everything else — Escape, a
 * click outside, the map's `movestart`, and the edit-mode toggle — because all
 * of them unmount this hook's owner.
 */
export function useDeferredOverrides(
  mapId: string,
  placeId: string,
  onPreview: (overrides: CardBlockOverrides | null) => void,
) {
  const updatePlace = useUpdatePlace(mapId);

  const pending = useRef<CardBlockOverrides | null>(null);
  const timer = useRef<number | null>(null);

  /*
   * Read through refs rather than closed over, so `write` and `flush` keep one
   * identity for the life of the panel. They are called from inside
   * `BlockProperties`, which re-renders on every keystroke of a Label field —
   * and a `flush` that changed identity would restart the timer it is supposed
   * to be clearing.
   */
  const mutate = useRef(updatePlace.mutateAsync);
  const preview = useRef(onPreview);
  useEffect(() => {
    mutate.current = updatePlace.mutateAsync;
    preview.current = onPreview;
  });

  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }

    const next = pending.current;
    pending.current = null;
    if (!next) return;

    /*
     * `mutateAsync`, and **not** `mutate` with an `onSettled` beside it. Query
     * runs the callbacks handed to a `mutate` call only `if (this.#mutateOptions
     * && this.hasListeners())` — and every exit from this panel unmounts the
     * observer before the round trip lands, so that `onSettled` would never fire
     * at all and the preview would stand for ever over a row that may not even
     * have saved. The promise settles either way.
     *
     * The preview steps aside once the row it was standing in for is the row.
     * Guarded on `pending`, because a change made while this was in flight has a
     * preview of its own that must not be cleared out from under it — and only
     * ever *after* the round trip, since dropping it the moment the request goes
     * would show one frame of the old value while the optimistic write is still
     * a microtask away.
     *
     * On a failure it steps aside too: `useUpdatePlace` rolls the cache back,
     * and a preview left standing would hide that the save did not happen. The
     * panel says so in its own error line, which reads the mutation's `error`;
     * the `catch` here only stops the same rejection also surfacing as an
     * unhandled one.
     */
    mutate
      .current({ placeId, input: { cardBlocks: next } })
      .catch(() => {})
      .finally(() => {
        if (pending.current === null) preview.current(null);
      });
  }, [placeId]);

  const write = useCallback(
    (overrides: CardBlockOverrides) => {
      pending.current = overrides;
      preview.current(overrides);

      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, COMMIT_MS);
    },
    [flush],
  );

  /*
   * Nothing is lost by closing the panel. Through a ref so the effect can run
   * once, on unmount alone: depending on `flush` would tear down and re-run it
   * whenever the place id changed, flushing a half-made edit at the one moment
   * the panel is being pointed at something else.
   */
  const onUnmount = useRef(flush);
  useEffect(() => {
    onUnmount.current = flush;
  });

  useEffect(() => {
    return () => onUnmount.current();
  }, []);

  return { write, flush, error: updatePlace.error };
}
