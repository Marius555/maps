import { MapIcon } from "lucide-react";

import { useCan } from "@/components/team/role-context";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateMapDialog } from "./create-map-dialog";

export function MapListEmpty() {
  const canCreate = useCan("edit");

  if (!canCreate) {
    return (
      <EmptyState
        icon={MapIcon}
        title="This team has no maps yet"
        description="When an editor creates one, it appears here. You can view this team's maps but not add to them."
        surface={false}
      />
    );
  }

  return (
    <EmptyState
      icon={MapIcon}
      title="No maps yet"
      description="Create a map, then drop your first location on it or import a spreadsheet."
      action={<CreateMapDialog align="center" />}
      // The page is the surface here; a grey panel on it read as a disabled
      // block rather than an invitation.
      surface={false}
    />
  );
}
