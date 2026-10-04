import type { NewsCategory } from "@/lib/news/types";

/**
 * A post's cover: the uploaded image, or — when there is none — a drawn panel
 * so no layout ever has a hole in it.
 *
 * The placeholder is the accent's soft ground with a line drawing in the
 * accent's ink, one motif per category (a street grid, contour rings, a route).
 * Theme tokens only, so it follows light and dark with no colours of its own.
 */
const ASPECT = {
  wide: "aspect-[16/9]",
  square: "aspect-square",
} as const;

export function NewsCover({
  url,
  alt,
  category,
  aspect = "wide",
  priority = false,
  className = "",
}: {
  url: string | null;
  alt: string;
  category: NewsCategory;
  aspect?: keyof typeof ASPECT;
  /** Above the fold: load eagerly. */
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-accent-soft ${ASPECT[aspect]} ${className}`}>
      {url ? (
        // A plain img: the file is on Appwrite storage, whose host next/image
        // would need configuring, and the image is already sized by its author.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <Placeholder category={category} />
      )}
    </div>
  );
}

function Placeholder({ category }: { category: NewsCategory }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full text-accent"
      fill="none"
      stroke="currentColor"
    >
      {category === "product" ? <Grid /> : category === "company" ? <Contours /> : <Route />}
    </svg>
  );
}

/** A street grid with one block picked out. */
function Grid() {
  return (
    <g strokeOpacity="0.35" strokeWidth="1">
      {[30, 75, 120, 165, 210, 255, 300].map((x) => (
        <line key={`v${x}`} x1={x} y1="0" x2={x - 20} y2="180" />
      ))}
      {[25, 70, 115, 160].map((y) => (
        <line key={`h${y}`} x1="0" y1={y} x2="320" y2={y + 8} />
      ))}
      <circle cx="166" cy="96" r="7" fill="currentColor" fillOpacity="0.9" stroke="none" />
      <circle cx="166" cy="96" r="18" strokeOpacity="0.6" />
    </g>
  );
}

/** Contour rings, like a hill on a topographic map. */
function Contours() {
  return (
    <g strokeOpacity="0.4" strokeWidth="1.2">
      {[14, 32, 52, 74, 98, 124, 152].map((r, i) => (
        <ellipse key={r} cx={200 - i * 4} cy={92 + i * 2} rx={r * 1.25} ry={r * 0.85} />
      ))}
    </g>
  );
}

/** A route between two pins. */
function Route() {
  return (
    <g strokeWidth="2">
      <path
        d="M40 140 C 90 140, 100 60, 160 70 S 240 130, 280 40"
        strokeOpacity="0.55"
        strokeDasharray="2 7"
        strokeLinecap="round"
      />
      <circle cx="40" cy="140" r="6" fill="currentColor" fillOpacity="0.9" stroke="none" />
      <circle cx="280" cy="40" r="6" fill="currentColor" fillOpacity="0.9" stroke="none" />
    </g>
  );
}
