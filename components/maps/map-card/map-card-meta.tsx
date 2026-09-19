import { Layers, MapPin, Shapes, type LucideIcon } from "lucide-react";

import { STYLE_LABELS, type MapStyleKey } from "@/lib/map/style";

/**
 * What is on the map, in one row: how many locations, how many shapes, and
 * which basemap it is drawn on.
 *
 * A definition list, because each figure is a value with a name and the icons
 * are not the names — a screen reader hears "Locations: 124 locations".
 */
export function MapCardMeta({
  placeCount,
  shapeCount,
  style,
}: {
  placeCount: number;
  shapeCount: number;
  style: MapStyleKey;
}) {
  return (
    <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
      <MetaItem
        icon={MapPin}
        term="Locations"
        value={`${placeCount} ${placeCount === 1 ? "location" : "locations"}`}
      />
      <MetaItem
        icon={Shapes}
        term="Shapes"
        value={`${shapeCount} ${shapeCount === 1 ? "shape" : "shapes"}`}
      />
      <MetaItem icon={Layers} term="Basemap" value={STYLE_LABELS[style]} />
    </dl>
  );
}

function MetaItem({
  icon: Icon,
  term,
  value,
}: {
  icon: LucideIcon;
  term: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <dt className="sr-only">{term}</dt>
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <dd className="truncate tabular-nums">{value}</dd>
    </div>
  );
}
