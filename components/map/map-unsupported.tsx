import { MonitorOff } from "lucide-react";

/**
 * What a map frame shows when the browser cannot draw a map at all.
 *
 * Without it the frame stays its grey placeholder forever, which reads as
 * "still loading" — see lib/map/webgl.ts for why nothing else on the page
 * notices. It fills the frame it is dropped into, over MapLibre's empty
 * container.
 *
 * The frame is the size container, because this has to fit everything from the
 * editor's full-height canvas down to the 160px pin field in Edit location: the
 * medallion only appears where there is height to spare for it.
 */
export function MapUnsupported() {
  return (
    <div
      role="status"
      className="absolute inset-0 grid place-items-center overflow-hidden bg-surface-secondary px-4 [container-type:size]"
    >
      <div className="flex max-w-sm flex-col items-center gap-2 text-center">
        <span
          aria-hidden="true"
          className="hidden size-9 place-items-center rounded-full bg-default text-muted [@container(min-height:14rem)]:grid"
        >
          <MonitorOff className="size-4" />
        </span>

        <p className="text-sm font-medium text-foreground">
          This browser can&apos;t draw maps
        </p>

        <p className="text-pretty text-xs text-muted">
          Turn on hardware acceleration in your browser&apos;s settings and
          restart it, or open this page in an up-to-date Chrome, Edge, Firefox or
          Safari.
        </p>
      </div>
    </div>
  );
}
