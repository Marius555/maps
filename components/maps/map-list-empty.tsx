import { MapIcon } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { CreateMapDialog } from "./create-map-dialog";

export function MapListEmpty() {
  return (
    <EmptyState
      icon={MapIcon}
      title="No maps yet"
      description="Create a map, then drop your first location on it or import a spreadsheet."
      action={<CreateMapDialog />}
    />
  );
}
