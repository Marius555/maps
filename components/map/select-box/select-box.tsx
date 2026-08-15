"use client";

import { useImperativeHandle, useRef } from "react";

import type { SelectBox as Box } from "@/lib/map/marquee";

export type SelectBoxHandle = {
  /** Draw the box, or hide it when the gesture is over. */
  show: (box: Box | null) => void;
};

/**
 * The rectangle the select tool drags out.
 *
 * A DOM element rather than a MapLibre layer, because the box is not on the
 * ground — it is a rectangle on the screen, and a style layer would rotate and
 * shear with the map while the user's drag did not.
 *
 * Positioned by writing straight to `style`, never through React state. A drag
 * reports a position per pointer sample, and a `setState` per sample would
 * re-render the editor sixty times a second to move a div four pixels. Same
 * discipline as use-map-anchor.ts, and for the same reason — which is also why
 * this is an imperative handle rather than a `box` prop.
 */
export function SelectBox({ ref }: { ref: React.Ref<SelectBoxHandle> }) {
  const element = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    show: (box) => {
      const node = element.current;
      if (!node) return;

      if (!box) {
        node.style.display = "none";
        return;
      }

      node.style.display = "block";
      node.style.transform = `translate3d(${Math.round(box.x1)}px, ${Math.round(box.y1)}px, 0)`;
      node.style.width = `${Math.round(box.x2 - box.x1)}px`;
      node.style.height = `${Math.round(box.y2 - box.y1)}px`;
    },
  }));

  return (
    <div
      ref={element}
      // Hidden until the first `show`, so an armed tool does not put a 0×0
      // rectangle in the top-left corner of the map.
      style={{ display: "none" }}
      className="pointer-events-none absolute top-0 left-0 z-10 rounded-xs border-2 border-accent bg-accent/15"
      aria-hidden
    />
  );
}
