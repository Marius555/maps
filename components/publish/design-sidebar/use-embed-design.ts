"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { resolvePanelAuto } from "@/lib/embed/panel-auto";
import { useUpdateMap } from "@/lib/query/maps";
import { createSerialWriter, type SerialWriter } from "@/lib/query/serial-writer";
import type { AppMap } from "@/lib/repositories/types";
import {
  readEmbedSettings,
  type EmbedSettings,
} from "@/lib/validation/embed-settings.schema";

/**
 * How long a change waits before it is written.
 *
 * `ColorSwatchRow` fires its `onChange` on every pointer move, so a one-second
 * drag across the colour area is thirty to sixty changes. Written straight
 * through, those are thirty concurrent PATCHes of one JSON blob: replies do not
 * land in the order they were sent, the last one to arrive is the one that
 * sticks, and the panel walks backwards and forwards between colours. The same
 * trade `useDeferredOverrides` makes for the card block panel, for the same
 * reason and with the same number.
 */
const WRITE_DELAY_MS = 400;

export type EmbedDesign = {
  /** The settings as the controls should draw them — always fully resolved. */
  settings: EmbedSettings;
  /** Change one field. Repaints immediately; writes on a trailing timer. */
  set: <K extends keyof EmbedSettings>(
    key: K,
    value: EmbedSettings[K],
  ) => void;
  /** Put everything back to what a new map gets. */
  reset: () => void;
  /**
   * Send whatever is still on the timer and wait until every write has landed.
   * Publish awaits this first (`DesignWritesProvider`), or it would build the
   * snapshot from the settings as they were before the last press.
   */
  settle: () => Promise<void>;
  error: unknown;
  /** The locations the next publish would carry — what the automatic panel counts. */
  placeCount: number;
};

/**
 * The designer's one writer of `maps.settings`.
 *
 * One hook rather than a form per group, and that is a correctness rule rather
 * than tidiness: `settings` is a single JSON column that `updateMap` serialises
 * whole, so two forms writing it are a lost update — the exact failure CLAUDE.md
 * §6 records for `settings` and `appearance`. Every control on this page goes
 * through here, which is also why `EmbedSettingsForm` was deleted rather than
 * left beside it.
 *
 * The picture and the record are two channels. `draft` is what the controls and
 * the preview read and it moves under the pointer with no network at all; the
 * PATCH is a trailing timer behind it. **The base a write is applied to is the
 * draft and never `map.settings`**, so a reply that lands late cannot become the
 * base for the next write and persist a value the owner has already moved off.
 *
 * **And the PATCHes go one at a time** (`createSerialWriter`). The draft rule
 * alone was not enough: two presses a second apart were two whole-blob writes in
 * flight at once, and when the first reply landed last it wrote the older
 * settings into the cache — and the server could commit them in that order
 * too. The switch then showed the opposite of the last press, which is what the
 * owner reported (2026-11-07). The draft is only let go once nothing is waiting
 * *and* nothing is in flight.
 *
 * **The automatic panel.** While `listAuto` is on, `list` and `search` follow
 * the number of locations (`lib/embed/panel-auto.ts`). The controls get that
 * resolved answer, but every write is applied to the *unresolved* base. Writing
 * the resolved one would store `search: false` on an unrelated colour change,
 * and the map would have no search box once it grew past one location.
 */
export function useEmbedDesign(
  map: AppMap,
  /**
   * How many locations the next publish would carry (`publishedPlaceCount`), for
   * the automatic results panel. See "The automatic panel" above.
   */
  placeCount: number,
): EmbedDesign {
  const updateMap = useUpdateMap(map.id);
  const stored = useMemo(
    () => readEmbedSettings(map.settings),
    [map.settings],
  );

  /**
   * The uncommitted answer, or null when there is nothing in flight.
   *
   * Null rather than a copy of `stored` so a background refetch of the map is
   * not fighting a draft that says the same thing — with nothing pending, the
   * server's row is simply what the controls draw.
   */
  const [draft, setDraft] = useState<EmbedSettings | null>(null);
  const base = draft ?? stored;
  // What the controls and the preview draw. Never what a write is applied to.
  const settings = useMemo(
    () => resolvePanelAuto(base, placeCount),
    [base, placeCount],
  );

  /*
   * Refs, because the timer's callback is created once and must not close over
   * a stale draft — and because a re-render must not restart the timer.
   */
  const pending = useRef<EmbedSettings | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * Query hands back a fresh `mutateAsync` on some renders, and the timer's
   * callback is created once — so it is kept in a ref, written from an effect
   * rather than during render. (Writing a ref in a render body is what
   * `react-hooks/refs` refuses, and rightly: it makes the value depend on how
   * often React chose to render.)
   */
  const mutate = useRef(updateMap.mutateAsync);

  useEffect(() => {
    mutate.current = updateMap.mutateAsync;
  }, [updateMap.mutateAsync]);

  /*
   * `mutateAsync` rather than `mutate`: Query runs a `mutate` call's own
   * callbacks only while its observer still has listeners, and every way out of
   * this page unmounts one. The writer swallows the rejection, so a flush on
   * unmount cannot reach the window either.
   */
  const writer = useRef<SerialWriter<EmbedSettings> | null>(null);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    // Made on first use rather than during render, where reading `mutate`
    // would be a ref read the compiler rightly refuses.
    const serial = (writer.current ??= createSerialWriter((value: EmbedSettings) =>
      mutate.current({ settings: value }),
    ));

    const next = pending.current;
    if (!next) return serial.idle();

    pending.current = null;

    return serial.write(next).then(() => {
      // Only when nothing newer is waiting or in flight: clearing on an older
      // reply would drop the draft back to a row the owner has already edited
      // past.
      if (!pending.current && !serial.isBusy) setDraft(null);
    });
  }, []);

  const settle = useCallback(() => flush(), [flush]);

  const write = useCallback(
    (next: EmbedSettings) => {
      setDraft(next);
      pending.current = next;

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), WRITE_DELAY_MS);
    },
    [flush],
  );

  const set = useCallback<EmbedDesign["set"]>(
    (key, value) => {
      // Applied to the draft, not to the stored row — see the header.
      const from = pending.current ?? base;

      // Touching either switch the automatic panel decides takes it over: what
      // the owner was looking at is kept, plus the change they just made.
      if (from.listAuto && (key === "list" || key === "search")) {
        const shown = resolvePanelAuto(from, placeCount);

        write({
          ...from,
          list: shown.list,
          search: shown.search,
          listAuto: false,
          [key]: value,
        });
        return;
      }

      write({ ...from, [key]: value });
    },
    [base, placeCount, write],
  );

  const reset = useCallback(() => {
    write(readEmbedSettings({}));
  }, [write]);

  // Leaving the page is the last chance to save whatever is still on the timer.
  useEffect(
    () => () => {
      void flush();
    },
    [flush],
  );

  return { settings, set, reset, settle, error: updateMap.error, placeCount };
}
