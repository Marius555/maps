import type { CSSProperties } from "react";

import type { ThemeChoice } from "@/lib/theme/theme-choice";

/**
 * A thumbnail of the dashboard in one colour mode.
 *
 * Drawn from the palette's own values rather than from the live CSS variables,
 * because each tile must look like *its* mode whichever one the page is in: the
 * Dark tile has to be dark on a light page. The numbers are `app/globals.css`'s
 * `:root` and `.dark` tokens; if the palette moves, move these with it.
 *
 * Pure markup, no image: nothing to download, so the tile has its size and its
 * content on the first frame. `aspect-ratio` fixes the box before anything
 * inside it is laid out.
 */

type Palette = {
  background: string;
  surface: string;
  border: string;
  line: string;
  faint: string;
  accent: string;
};

const LIGHT: Palette = {
  background: "oklch(97.5% 0 0)",
  surface: "oklch(100% 0 0)",
  border: "oklch(92% 0 0)",
  line: "oklch(21% 0 0 / 0.75)",
  faint: "oklch(50% 0 0 / 0.3)",
  accent: "oklch(64.37% 0.2195 36.18)",
};

const DARK: Palette = {
  background: "oklch(14% 0 0)",
  surface: "oklch(19% 0 0)",
  border: "oklch(28% 0 0)",
  line: "oklch(97% 0 0 / 0.8)",
  faint: "oklch(68% 0 0 / 0.35)",
  accent: "oklch(67% 0.19 36.18)",
};

function Scene({ palette }: { palette: Palette }) {
  const surface: CSSProperties = {
    background: palette.surface,
    borderColor: palette.border,
  };

  return (
    <div className="absolute inset-0 flex" style={{ background: palette.background }}>
      {/* The sidebar: a column of nav rows, the first one "active". */}
      <div className="flex w-[28%] flex-col gap-1.5 border-r p-2" style={surface}>
        <div className="h-1.5 w-3/4 rounded-full" style={{ background: palette.line }} />
        <div className="mt-1 h-1.5 w-full rounded-full" style={{ background: palette.faint }} />
        <div className="h-1.5 w-2/3 rounded-full" style={{ background: palette.faint }} />
        <div className="h-1.5 w-4/5 rounded-full" style={{ background: palette.faint }} />
      </div>

      {/* The page: one panel with a heading, a line of text and a button. */}
      <div className="flex-1 p-2.5">
        <div className="flex h-full flex-col gap-1.5 rounded-md border p-2" style={surface}>
          <div className="h-1.5 w-1/2 rounded-full" style={{ background: palette.line }} />
          <div className="h-1.5 w-4/5 rounded-full" style={{ background: palette.faint }} />
          <div className="h-1.5 w-3/5 rounded-full" style={{ background: palette.faint }} />
          <div className="mt-auto h-2.5 w-1/3 self-end rounded-full" style={{ background: palette.accent }} />
        </div>
      </div>
    </div>
  );
}

export function ThemePreview({ choice }: { choice: ThemeChoice }) {
  return (
    <div aria-hidden="true" className="relative aspect-[16/10] w-full overflow-hidden rounded-[inherit]">
      <Scene palette={choice === "dark" ? DARK : LIGHT} />

      {/* System is both: the dark scene laid over the light one, cut on a
          diagonal, so the tile says "it depends" without a word. */}
      {choice === "system" ? (
        <div className="absolute inset-0 [clip-path:polygon(58%_0,100%_0,100%_100%,42%_100%)]">
          <Scene palette={DARK} />
        </div>
      ) : null}
    </div>
  );
}
