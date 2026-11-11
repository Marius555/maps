import { PinGlyph } from "./stage-cursor";

/**
 * The Pinglide map block as WordPress shows it before it is set up: a dashed
 * box, the block's name, a line of help and **Set up this map**
 * (`data-art="setup"`). The labels are the plugin's own (`blocks/map/block.json`).
 * Fills whatever box it is put in.
 */
export function BlockPlaceholder() {
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-1.5 rounded-md border border-dashed border-foreground/25 bg-foreground/[0.03] px-3">
      <span className="flex items-center gap-1.5 text-[9px] leading-none font-semibold text-foreground">
        <PinGlyph />
        Pinglide map
      </span>
      <span className="h-1 w-3/5 rounded-full bg-foreground/15" />
      <span
        data-art="setup"
        className="mt-1 w-fit rounded-full bg-foreground px-2.5 py-1 text-[8px] leading-none font-medium text-background"
      >
        Set up this map
      </span>
    </div>
  );
}
