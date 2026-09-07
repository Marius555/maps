"use client";

import { Button } from "@heroui/react";
import { FileSpreadsheet } from "lucide-react";
import { useRef, useState } from "react";

import { FILE_ACCEPT } from "@/lib/import/read-source";

/**
 * Choose a file, or drop one.
 *
 * Both, because the two habits are genuinely different: people who keep the file
 * in a folder browse for it, people who have it open in another window drag it.
 * The dashed frame is honest now — it was refused in the original file step
 * precisely because nothing there accepted a drop.
 */
export function FileDrop({
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
      // Not capped here. The frame still must not stretch to the full content
      // width — a dashed rectangle 1800px across reads as a layout bug rather
      // than a target — but the cap now lives on the `Tabs` root in
      // `source-tabs.tsx`, so the tab strip and this frame are one width by
      // construction instead of two that have to be kept equal by hand.
      //
      // Transparent at rest, so the frame is a dashed outline on the page
      // rather than a filled well. It used to be `bg-surface-secondary`, which
      // was a legible recess while this sat inside a white `SectionPanel` and
      // became a grey patch on a grey page the moment the panel went. The
      // dashed border is the whole affordance and needs no ground behind it.
      className={`flex w-full flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-6 text-center transition-colors ${
        isOver ? "border-primary bg-primary/5" : "border-border"
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
        className="grid size-9 place-items-center rounded-full bg-surface-secondary text-muted"
      >
        <FileSpreadsheet className="size-4" />
      </span>

      <input
        ref={input}
        type="file"
        className="sr-only"
        accept={FILE_ACCEPT}
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

      <p className="max-w-sm text-pretty text-xs text-muted">
        CSV, Excel (.xlsx) or XML. Your file is read in your browser — nothing is
        saved until you confirm.
      </p>
    </div>
  );
}
