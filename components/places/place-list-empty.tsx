import { MapPin } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

export function PlaceListEmpty() {
  return (
    <EmptyState
      size="sm"
      icon={MapPin}
      title="No locations yet"
      description="Press Add location, then click the map."
    />
  );
}
