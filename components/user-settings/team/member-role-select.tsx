"use client";

import { toast } from "@heroui/react";

import { InlineSelect } from "@/components/ui/inline-select";
import { useChangeRole } from "@/lib/query/team";
import { toastError } from "@/lib/query/toast-error";
import { MEMBER_ROLES, ROLE_LABEL, type MemberRole, type WorkspaceRole } from "@/lib/team/roles";
import { roleOptions } from "./role-options";

/**
 * A member's role, changed in place. Saved on pick — one value, one request,
 * the way the account menu's theme switch saves — and confirmed by a toast,
 * since the row itself looks the same before and after.
 */
export function MemberRoleSelect({
  userId,
  name,
  role,
  viewerRole,
}: {
  userId: string;
  name: string;
  role: MemberRole;
  viewerRole: WorkspaceRole;
}) {
  const changeRole = useChangeRole();
  const options = roleOptions(viewerRole);

  return (
    <InlineSelect
      label={`Role for ${name}`}
      value={changeRole.isPending && changeRole.variables ? changeRole.variables.role : role}
      options={options}
      className="w-28 text-sm"
      onChange={(next) => {
        if (!isMemberRole(next) || next === role) return;

        changeRole.mutate(
          { userId, role: next },
          {
            onSuccess: () => toast.success("Role changed", { description: `${name} is now ${ROLE_LABEL[next].toLowerCase()}.` }),
            onError: (error) => toastError(error, "Couldn't change the role"),
          },
        );
      }}
    />
  );
}

function isMemberRole(value: string): value is MemberRole {
  return (MEMBER_ROLES as readonly string[]).includes(value);
}
