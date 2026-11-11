import { TiltedWindow } from "./tilted-window";
import { WindowMap } from "./window-map";

/**
 * Somebody's own website, turned a little in 3D so it reads as a page and not
 * a diagram: a toolbar with an address, their heading, text and button down
 * the left, and our map filling the rest.
 */
export function BrowserWindow() {
  return (
    <TiltedWindow address="yourshop.com/stores">
      <div className="flex min-h-0 flex-1 gap-2.5 p-2.5">
        <div className="flex w-[32%] shrink-0 flex-col gap-1.5 pt-1">
          <span className="h-2 w-4/5 rounded-full bg-foreground/50" />
          <span className="h-1 w-full rounded-full bg-foreground/15" />
          <span className="h-1 w-11/12 rounded-full bg-foreground/15" />
          <span className="h-1 w-3/4 rounded-full bg-foreground/15" />
          <span className="mt-1 h-3 w-3/5 rounded-full bg-accent" />
        </div>

        <div className="relative min-w-0 flex-1 overflow-hidden rounded-md bg-foreground/[0.04]">
          <WindowMap />
        </div>
      </div>
    </TiltedWindow>
  );
}
