/**
 * The one page wrapper.
 *
 * Before this there were seven different widths across the app — `max-w-6xl` on
 * the map header, `max-w-4xl` on locations, `max-w-2xl` on settings, full-bleed
 * on the editor — so content jumped sideways on every tab switch. A shared
 * container is the fix, and the point of it is that a page picks one of three
 * named widths rather than inventing its own.
 *
 * `content` is unbounded: the sidebar already narrows the column, and the map
 * editor needs every pixel of what's left, because a canvas capped at a readable
 * measure is a smaller map for no reason.
 *
 * `centered` is the list-and-form measure — the locations table and the import
 * wizard. Those are things you read and fill in, and a 7-column table stretched
 * across a 2560px monitor has its name at one edge and its actions at the other.
 * Centring them does step sideways relative to the editor's full width, and that
 * step is real: switching from the Map tab to the Locations tab of the same map
 * moves the content. That is accepted rather than overlooked — the alternative
 * was either a full-width table or a narrow map, and both are worse than one
 * transition between two pages that are doing genuinely different jobs.
 *
 * `Measure` still exists for a readable column *inside* a full-width page, and is
 * still left-aligned for the same reason it always was.
 */
export function Container({
  size = "content",
  className = "",
  children,
}: {
  size?: "content" | "narrow" | "centered";
  className?: string;
  children: React.ReactNode;
}) {
  const width =
    size === "narrow"
      ? "mx-auto w-full max-w-lg"
      : size === "centered"
        ? "mx-auto w-full max-w-5xl"
        : "w-full";

  return (
    <div className={`${width} flex-1 px-4 py-6 sm:px-6 ${className}`}>
      {children}
    </div>
  );
}

/**
 * A readable column inside a full-width `Container`.
 *
 * Left-aligned, not centred: it exists to constrain a form on a page that is
 * otherwise filling its width, and centring it would move the left edge away
 * from the page's own padding.
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
