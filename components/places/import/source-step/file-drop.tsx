"use client";

import { Button } from "@heroui/react";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";

import { FILE_ACCEPT } from "@/lib/import/read-source";

const FORMATS = ["CSV", "XLSX", "XML"] as const;

/**
 * Choose a file, or drop one.
 *
 * Both, because the two habits are genuinely different: people who keep the file
 * in a folder browse for it, people who have it open in another window drag it.
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
      // `h-full` and `justify-center` because this shares a grid cell with the
      // Google Sheet panel (see `source-choice.tsx`). Without them the frame
      // would end short of the cell whenever the other panel is the taller.
      //
      // Transparent at rest: the dashed border is the whole affordance and
      // needs no ground behind it (one ground per screen — see the Surfaces
      // notes in docs/notes/editor-and-layout.md).
      className={`flex h-full w-full flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
        isOver ? "border-foreground/20 bg-surface" : "border-border"
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
        className="grid size-12 place-items-center rounded-full bg-default text-muted"
      >
        <Upload className="size-5" />
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

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">
          {isOver ? "Drop to read it" : "Drop your file here"}
        </p>

        <div className="flex items-center justify-center gap-3 text-xs text-muted">
          <span>or</span>
          <Button isPending={isBusy} onPress={() => input.current?.click()}>
            Choose file
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <ul className="flex items-center justify-center gap-1.5">
          {FORMATS.map((format) => (
            <li
              key={format}
              className="rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted"
            >
              {format}
            </li>
          ))}
        </ul>

        <p className="max-w-sm text-pretty text-xs text-muted">
          Read in your browser — nothing is saved until you confirm.
        </p>
      </div>
    </div>
  );
}
