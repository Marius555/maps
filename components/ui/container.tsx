/**
 * The one page wrapper.
 *
 * Before this there were seven different widths across the app — `max-w-6xl` on
 * the map header, `max-w-4xl` on locations, `max-w-2xl` on settings, full-bleed
 * on the editor — so content jumped sideways on every tab switch. That was half
 * of the "layout shifts" complaint; a shared container is the fix.
 *
 * `content` is deliberately unbounded in width. The sidebar already narrows the
 * column, and giving every page the same padding means every page has the same
 * left edge. Where a long-form measure is needed (settings forms, the import
 * wizard) the constraint goes on an *inner* element via `Measure`, so its left
 * edge still lines up with the page beside it.
 */
export function Container({
  size = "content",
  className = "",
  children,
}: {
  size?: "content" | "narrow";
  className?: string;
  children: React.ReactNode;
}) {
  const width =
    size === "narrow" ? "mx-auto w-full max-w-lg" : "w-full";

  return (
    <div className={`${width} flex-1 px-4 py-6 sm:px-6 ${className}`}>
      {children}
    </div>
  );
}

/**
 * A readable column inside a `Container`.
 *
 * Left-aligned, not centred: centring would move the left edge relative to the
 * pages that fill their width, reintroducing the shift this is meant to avoid.
 */
export function Measure({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`w-full max-w-2xl ${className}`}>{children}</div>;
}
