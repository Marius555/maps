import { Play } from "lucide-react";

/**
 * Says there is something to see: the drawings stand still until hovered, and
 * a still picture gives no hint that it moves. "Tap" where there is no hover
 * (the swap is CSS, `.mk-step-hint`). Gone under reduced motion, where nothing
 * plays.
 */
export function PlayHint({ hidden }: { hidden: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-hidden={hidden || undefined}
      className="mk-step-hint map-chrome-panel pointer-events-none absolute top-3 right-3 z-20 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-muted shadow-sm motion-reduce:hidden"
    >
      <Play className="size-3" fill="currentColor" strokeWidth={0} />
      <span className="mk-step-hint__hover">Hover to play</span>
      <span className="mk-step-hint__touch">Tap to play</span>
    </span>
  );
}
