import type { SelectOption } from "@/components/ui/select-control";
import {
  canManage,
  MEMBER_ROLES,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  type WorkspaceRole,
} from "@/lib/team/roles";

/**
 * The roles somebody may hand out, as select options: everything for the owner,
 * editor and viewer for an admin (`canManage` decides, so the menu and the
 * server cannot disagree). Admin first, because the list reads top-down from
 * most to least access.
 */
export function roleOptions(viewerRole: WorkspaceRole): SelectOption[] {
  return MEMBER_ROLES.filter((role) => canManage(viewerRole, null, role)).map((role) => ({
    id: role,
    label: ROLE_LABEL[role],
    description: ROLE_DESCRIPTION[role],
  }));
}
