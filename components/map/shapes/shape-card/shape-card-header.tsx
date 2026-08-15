"use client";

import { X } from "lucide-react";

import { shapeSummary } from "@/lib/map/shape-summary";
import type { Shape } from "@/lib/repositories/types";

/**
 * Name, what the shape is, and a way out.
 *
 * The heading is the name, unlike a location's card — which leads with its
 * address, because an address is a fact about the world and a location's name is
 * often a placeholder. A shape has no address, and its name is the only thing
 * anyone ever typed about it.
 *
 * The swatch is not decoration. Every shape on a map is a translucent wash of
 * some colour, and matching the card to the area it describes is what says which
 * one you have open when three overlap.
 */
export function ShapeCardHeader({
  shape,
  onClose,
}: {
  shape: Shape;
  onClose: () => void;
}) {
  return (
    <div className="flex shrink-0 items-start gap-2 p-3 pb-0">
      <span
        aria-hidden="true"
        className="mt-1 size-3 shrink-0 rounded-full border border-black/10"
        style={{ backgroundColor: shape.color }}
      />

      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-sm font-semibold text-foreground">
          {shape.name}
        </h3>
        <p className="truncate text-xs text-muted">
          {shapeSummary(shape.geometry)}
        </p>
      </div>

      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="-m-1 shrink-0 rounded-lg p-1 text-muted transition-colors hover:bg-default hover:text-foreground focus-visible:inset-ring-2 focus-visible:inset-ring-focus"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
