"use client";

import { useState, type ReactNode } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";

/**
 * The locations panel, and where it goes on a phone.
 *
 * Everything about *how* it moves is `components/ui/bottom-sheet.tsx` now — the
 * card designer's sidebar and the publish designer's are the same box, and they
 * were three different answers to one question before that. What is left here is
 * this panel's own shape: the column it is at `lg`, the title row it keeps up
 * there instead of a grab rail, and the count badge that is half of what the shut
 * sheet exists to show.
 *
 * The peek strip covers the corner MapLibre stacks its zoom buttons and its
 * attribution in, so the frame lifts both by `--sheet-peek` — see
 * `--map-chrome-inset` in app/globals.css. Attribution that is covered is
 * attribution that is absent (§12). The containing block and the clip the sheet
 * needs are on the editor row in `map-editor.tsx`.
 */
export function LocationsDrawer({
  title,
  meta,
  children,
}: {
  title: string;
  /** The count badge — it is half of what the shut sheet exists to show. */
  meta: ReactNode;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <BottomSheet
      contentId="locations-sheet-content"
      label={title}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      peek={
        <>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {meta}
        </>
      }
      // At `lg` there is no rail, so the strip is just the title row and shrinks
      // to it.
      peekClassName="lg:h-11 lg:justify-center"
      className="rounded-xl border border-border lg:w-80 lg:shrink-0"
    >
      {children}
    </BottomSheet>
  );
}
