"use client";

import { useCallback, useRef } from "react";

/**
 * A min-height that only ever grows, for as long as the element is mounted.
 *
 * **Why the embed dialog needs it.** Its two tab panels are stacked in one grid
 * cell so the dialog is the height of the taller and does not move when the tab
 * changes. But on a selection change React Aria takes the *previously* selected
 * panel out of the layout for the length of one commit, and puts it back after.
 * Going Website → WordPress that left only the shorter WordPress panel: the
 * dialog shrank by 177px, re-centred 88px lower, and the tab indicator — which
 * measures where the old one was in that same commit — slid in from 88px above
 * its row. Measured 2026-11-07: `translate: -260px -88.4px` on the new
 * indicator, against a correct `-260px 0` the other way.
 *
 * Holding the tallest height the panels have reached means that one-commit gap
 * cannot shrink anything, so nothing re-centres and the indicator measures a
 * row that has not moved. It is reset by unmounting, which the dialog's content
 * does every time it closes.
 */
export function useStickyMinHeight<T extends HTMLElement>() {
  const observer = useRef<ResizeObserver | null>(null);

  return useCallback((element: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!element) return;

    let tallest = 0;
    const hold = () => {
      const height = element.getBoundingClientRect().height;
      if (height <= tallest) return;
      tallest = height;
      element.style.minHeight = `${String(Math.ceil(height))}px`;
    };

    hold();
    observer.current = new ResizeObserver(hold);
    observer.current.observe(element);
  }, []);
}
