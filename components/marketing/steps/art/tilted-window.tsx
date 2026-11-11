import type { ReactNode } from "react";

/**
 * A window turned a little in 3D, so it reads as a screen somebody is looking
 * at rather than a diagram: the landing page's publish drawing (`BrowserWindow`)
 * and every platform page's drawings are drawn in one.
 *
 * `bar` replaces the toolbar's contents — the three dots and `address` by
 * default; an editor draws its own buttons there. `className` places the
 * window in the drawing (its `inset`s); the 3D turn is the same everywhere, so
 * the windows on one page lean the same way.
 *
 * Anything laid over the window *inside* it (a sheet, an inserter) tilts with
 * it; the cursor is a sibling of the whole thing and stays flat, because a
 * pointer on a screen is not part of the screen.
 */
export function TiltedWindow({
  address,
  bar,
  className = "inset-x-[7%] top-[6%] bottom-[25%]",
  children,
}: {
  address?: string;
  bar?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="absolute inset-0 [perspective:1100px]">
      <div
        className={`absolute flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-lg ${className}`}
        style={{ transform: "rotateX(9deg) rotateY(-11deg)", transformOrigin: "50% 100%" }}
      >
        <div className="flex h-5 shrink-0 items-center gap-1 bg-foreground/[0.04] px-2">
          {bar ?? (
            <>
              <span className="size-1.5 rounded-full bg-foreground/20" />
              <span className="size-1.5 rounded-full bg-foreground/20" />
              <span className="size-1.5 rounded-full bg-foreground/20" />
              {address ? (
                <span className="ml-2 truncate rounded-full bg-foreground/[0.06] px-2 py-px text-[8px] text-muted">
                  {address}
                </span>
              ) : null}
            </>
          )}
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
