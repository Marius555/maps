"use client";

import { useRef, type ReactNode } from "react";

import { LG_DOWN, useMediaQuery } from "@/lib/ui/use-media-query";
import { useSheetDrag } from "./use-sheet-drag";

/**
 * A panel that is a column at `lg` and a bottom sheet below it.
 *
 * Three screens use it — the editor's locations list, the card designer's
 * sidebar and the publish designer's — and they were three different answers to
 * one question before this existed: a sheet, an off-canvas panel down the right
 * edge behind a scrim, and nothing at all.
 *
 * **One element, positioned two ways.** At `lg` and up this is the column it has
 * always been, and every `max-lg:` rule below simply does not apply. Below it the
 * identical box is a sheet over the page: shut, it shows the grab rail and
 * whatever `peek` holds; open, it covers most of the frame. The tree does not
 * change, so there are not two lists, two `RowDragProvider`s, two React Aria
 * `Tabs` claiming one label, or two file inputs behind one control — only the
 * transform does. Choosing between two components in JavaScript would instead
 * paint the phone's layout for a frame on every desktop load, because
 * `useMediaQuery`'s server snapshot is `false`.
 *
 * **It is not a modal, and it must never become one.** Two things rule that out:
 *
 * 1. Both the editor's grouping drag and the card designer's palette drag start
 *    inside this box and end outside it, and `useRowDragSource` resolves every
 *    drop with `elementFromPoint`. React Aria marks the rest of the page `inert`
 *    while a modal is open, and an `inert` subtree cannot be found by that call —
 *    measured, with a real HeroUI `Drawer`: the card's drop bands were all laid
 *    out at the right coordinates and not one of them could be hit. Turning a
 *    backdrop's `pointer-events` off does not help, because `inert` is on the
 *    *page*, not the overlay.
 * 2. The whole point of the peek state is that what is behind it still works.
 *    A scrim is exactly the thing this must not have; shut, the only pixels it
 *    owns are the `--sheet-peek` strip along the bottom.
 *
 * That strip sits over the bottom of whatever it is parked on, so the caller owes
 * it the room — `--map-chrome-inset` in the editor, a `max-lg:pb-*` on the card
 * canvas and on the publish preview. Attribution that is covered is attribution
 * that is absent (§12).
 *
 * `inert` on the content while shut is the one piece of JavaScript-side
 * responsiveness left, and it has to be: a sheet translated off the bottom of the
 * frame is still in the tab order, and `inert` is an attribute, so no media query
 * can set it. Phrased so the server's `false` is the safe answer — not inert,
 * which is what every screen wide enough to show this as a column wants.
 *
 * **The caller must give it a containing block and a clip**: `relative` on the
 * row this sits in, plus `max-lg:overflow-hidden`, because two thirds of the
 * sheet hangs below the frame while shut and an absolutely positioned box past
 * the bottom of the page grows the document and brings the window's scrollbar in
 * with it.
 */
export function BottomSheet({
  contentId,
  label,
  isOpen,
  onOpenChange,
  isRetracted = false,
  peek,
  peekClassName = "",
  className = "",
  children,
}: {
  /**
   * The id the rail's `aria-controls` points at.
   *
   * A prop rather than a literal because two sheets on one page would otherwise
   * collide on it — which is not a thing today and is one edit away from being
   * one.
   */
  contentId: string;
  /** What the rail calls this, as "Expand …" / "Collapse …". */
  label: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /**
   * Park at the peek and stop taking pointers, without closing.
   *
   * For a drag that starts inside the sheet and ends outside it: the drag source
   * lives on a row in here and its cleanup tears the ghost down on unmount, so
   * *closing* the sheet at the start of the gesture would end the gesture. It
   * gets out of the way instead, and the caller closes it once the drop has
   * landed.
   */
  isRetracted?: boolean;
  /**
   * What stays on screen when the sheet is shut, beside the rail — a title, a
   * count, a status. It is half of what a shut sheet exists to show.
   */
  peek?: ReactNode;
  /** The strip's `lg` form, where there is no rail and no gesture. */
  peekClassName?: string;
  /** The whole box's `lg` form — its width, its borders, its place in the row. */
  className?: string;
  children: ReactNode;
}) {
  const sheet = useRef<HTMLElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);

  const isSheet = useMediaQuery(LG_DOWN);
  const { dragY, isDragging, onPointerDownCapture, consumeClick } = useSheetDrag({
    isOpen,
    onOpenChange,
    sheet,
    peek: peekRef,
  });

  const isShowing = isOpen && !isRetracted;

  /*
   * Where the sheet sits, as one value handed to CSS.
   *
   * Only `max-lg:translate-y-[var(--sheet-y)]` reads it, so at `lg` the variable
   * is set and ignored and the panel is an ordinary column — the responsive half
   * of this stays in CSS, with no media query in the render and so no frame of
   * the wrong layout on a desktop load. The two resting values are deliberately
   * different units: shut is a percentage of the sheet's own height less the
   * strip, which needs no measurement and cannot drift from `--sheet-peek`.
   */
  const sheetY =
    dragY !== null
      ? `${String(dragY)}px`
      : isShowing
        ? "0px"
        : "calc(100% - var(--sheet-peek))";

  return (
    <aside
      ref={sheet}
      style={{ "--sheet-y": sheetY } as React.CSSProperties}
      /*
       * 65dvh open, which is a deliberate stop short of the frame: it leaves a
       * band of whatever is behind — the map, the card, the preview — above the
       * sheet, so acting on a row and watching what it does is one glance rather
       * than two gestures.
       *
       * No `max-h-*`: below `lg` the sheet is out of flow entirely, so there is
       * no stack of two boxes that can grow the page one row at a time.
       */
      className={`flex min-h-0 flex-col overflow-hidden bg-surface max-lg:absolute max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:h-[65dvh] max-lg:translate-y-[var(--sheet-y)] max-lg:shadow-lg ${
        isRetracted ? "max-lg:pointer-events-none" : ""
      } ${
        isDragging
          ? "transition-none"
          : "transition-transform duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
      } ${className}`}
    >
      {/*
       * The grab strip: everything that stays on screen when the sheet is shut,
       * and `--sheet-peek` is its height to the pixel.
       *
       * `touch-none` is what claims the gesture. `preventDefault()` on a pointer
       * event does not stop a pan — see use-sheet-drag.ts — and this is a
       * dedicated grip with nothing of its own to scroll, so refusing the pan
       * declaratively costs nothing and is the only thing that works.
       */}
      <div
        ref={peekRef}
        onPointerDownCapture={onPointerDownCapture}
        className={`flex h-[var(--sheet-peek)] shrink-0 flex-col border-b border-border max-lg:touch-none ${peekClassName}`}
      >
        {/*
         * A real `<button>`, full width, with the pill centred in it.
         *
         * The pill alone is a 40x4px target, which is under every touch-target
         * floor there is; the rail around it is the tappable thing and the pill
         * is what says so. `lg:hidden` rather than conditionally rendered, so
         * the panel loses its handle in CSS with no media query and no
         * first-paint flash — `MobileHeaderSlot` makes the same trade.
         */}
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          aria-label={isOpen ? `Collapse ${label}` : `Expand ${label}`}
          onClick={() => {
            // A click that is only the tail of a drag is not a press. See
            // `swallowClick` in use-sheet-drag.ts.
            if (consumeClick()) return;
            onOpenChange(!isOpen);
          }}
          className="group flex h-5 w-full shrink-0 items-center justify-center rounded-t-xl outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-focus lg:hidden"
        >
          <span
            aria-hidden="true"
            /* Colour only — this sits at the top of a sheet that is itself mid
               transform, and animating the pill's box would reflow the strip
               under the finger dragging it. It is also its own static form: the
               blanket reduced-motion rule cuts the transition to 0.01ms rather
               than removing it. */
            className="h-1 w-10 rounded-full bg-border transition-colors group-hover:bg-muted group-active:bg-muted"
          />
        </button>

        <div className="flex min-h-0 flex-1 items-center justify-between gap-2 px-3">
          {peek}
        </div>
      </div>

      <div
        id={contentId}
        inert={isSheet && !isOpen}
        className="flex min-h-0 flex-1 flex-col"
      >
        {children}
      </div>
    </aside>
  );
}
