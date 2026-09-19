import { Chip } from "@heroui/react";

/**
 * Published or draft, over the top-left corner of the map.
 *
 * Solid rather than soft: a soft chip's tint is built for a plain surface, and
 * over a basemap — anything from white paper to near-black — it can all but
 * vanish. The shadow separates it from whatever is drawn underneath.
 */
export function MapCardStatus({ isPublished }: { isPublished: boolean }) {
  return (
    <Chip
      size="sm"
      variant="primary"
      color={isPublished ? "success" : "default"}
      className="absolute start-3 top-3 shadow-sm"
    >
      {isPublished ? "Published" : "Draft"}
    </Chip>
  );
}
