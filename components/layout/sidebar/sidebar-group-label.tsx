/**
 * A section heading inside the sidebar.
 *
 * Collapses to zero height on the rail, where there is no room for it and the
 * icons have to speak for themselves — but it stays mounted so the collapse
 * animates with the panel instead of the text disappearing a frame ahead of it.
 * `truncate` brings the `overflow-hidden` that makes `max-h-0` clip.
 *
 * **A `div`, not a `p`, and that is not cosmetic.** It holds a skeleton bar
 * before the name arrives (`SidebarMapNav`), and a `<div>` inside a `<p>` is
 * nesting the parser refuses: the browser closes the paragraph early, the DOM it
 * builds is not the one React rendered, and the whole subtree re-renders with a
 * hydration error. Measured — it is the "invalid HTML tag nesting" bullet in
 * React's own list, and the error names this component.
 */
export function SidebarGroupLabel({
  children,
  isCollapsed,
}: {
  children: React.ReactNode;
  isCollapsed: boolean;
}) {
  return (
    <div
      aria-hidden={isCollapsed}
      className={`truncate px-2.5 text-xs font-medium uppercase tracking-wide text-muted transition-[max-height,opacity,padding] duration-[var(--duration-panel)] ease-[var(--ease-out-fluid)] ${
        isCollapsed ? "max-h-0 pb-0 opacity-0" : "max-h-6 pb-1 opacity-100"
      }`}
    >
      {children}
    </div>
  );
}
