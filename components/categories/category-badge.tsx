import type { MapCategory } from "@/lib/repositories/types";

/**
 * A category's colour and name together. Colour alone never carries the meaning —
 * the label is always present, so the category survives a colourblind reader and
 * a greyscale print.
 */
export function CategoryBadge({
  category,
  size = "md",
}: {
  category: MapCategory;
  size?: "sm" | "md";
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full ring-1 ring-black/10"
        style={{ backgroundColor: category.color }}
      />
      <span
        className={`truncate ${size === "sm" ? "text-xs" : "text-sm"} text-foreground`}
      >
        {category.label}
      </span>
    </span>
  );
}

/** The dot on its own, for dense rows where the label is already nearby. */
export function CategoryDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="size-2.5 shrink-0 rounded-full ring-1 ring-black/10"
      style={{ backgroundColor: color }}
    />
  );
}
