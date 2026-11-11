/**
 * The block editor's top bar, for a `TiltedWindow`'s `bar`: the W, the **+**
 * inserter (`data-art="plus"`), the post's title and Publish. Drawn the way it
 * reads, not the way it looks: a copy of wp-admin dates the day WordPress
 * restyles it.
 */
export function WpEditorBar() {
  return (
    <>
      <span className="grid size-3 place-items-center rounded-full bg-foreground/70 text-[6px] leading-none font-bold text-background">
        W
      </span>
      <span
        data-art="plus"
        className="ml-1 grid size-3 place-items-center rounded-[3px] bg-foreground/70 text-[9px] leading-none font-semibold text-background"
      >
        +
      </span>
      <span className="mx-auto h-1.5 w-1/4 rounded-full bg-foreground/10" />
      <span className="rounded-[3px] bg-accent px-1.5 py-[3px] text-[6.5px] leading-none font-semibold text-accent-foreground">
        Publish
      </span>
    </>
  );
}

/** A post's opening: a title and two lines of text, above whatever block follows. */
export function PostLines() {
  return (
    <>
      <span className="h-2 w-2/5 shrink-0 rounded-full bg-foreground/50" />
      <span className="h-1 w-4/5 shrink-0 rounded-full bg-foreground/15" />
      <span className="h-1 w-3/5 shrink-0 rounded-full bg-foreground/15" />
    </>
  );
}
