"use client";

import { Button } from "@heroui/react";
import { Shapes } from "lucide-react";
import { useRef, useState } from "react";

import { SHAPE_FILE_ACCEPT } from "@/lib/import/shapes";

/**
 * Choose a file of geometry, or drop one.
 *
 * The same frame the locations import uses (`components/places/import/
 * source-step/file-drop.tsx`), and deliberately not a shared component: the two
 * differ in their icon, their accept list and their footnote, which is most of
 * what either of them is. A shared version would take three props to say what
 * forty lines say plainly, and the places one would then be a file nobody can
 * change without checking what it does to shapes.
 *
 * Nothing is validated against the extension here. A dropped file goes straight
 * to the parser, which throws `ImportSourceError` with copy the dialog renders —
 * so a `.pdf` gets a sentence explaining the problem rather than a silent
 * refusal to accept the drop, which reads as the page being broken.
 */
export function ShapeFileDrop({
  isBusy,
  onPick,
}: {
  isBusy: boolean;
  onPick: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the keyboard path is
    // the button inside; the drop target is pointer-only by nature.
    <div
      className={`flex w-full flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition-colors ${
        isOver
          ? "border-primary bg-primary/5"
          : "border-border bg-surface-secondary"
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);

        const file = event.dataTransfer.files?.[0];
        if (file) onPick(file);
      }}
    >
      <span
        aria-hidden="true"
        className="grid size-11 place-items-center rounded-full bg-default text-muted"
      >
        <Shapes className="size-5" />
      </span>

      <input
        ref={input}
        type="file"
        className="sr-only"
        accept={SHAPE_FILE_ACCEPT}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onPick(file);
          // So re-picking the same file after a failed parse fires again.
          event.target.value = "";
        }}
      />

      <div className="space-y-1">
        <Button isPending={isBusy} onPress={() => input.current?.click()}>
          Choose file
        </Button>
        <p className="text-xs text-muted">or drag one here</p>
      </div>

      <p className="max-w-xs text-pretty text-xs text-muted">
        GeoJSON, TopoJSON or ArcGIS JSON — areas, lines and circles. It&rsquo;s
        read in your browser, and nothing is saved until you confirm.
      </p>
    </div>
  );
}
