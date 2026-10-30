"use client";

import { Button } from "@heroui/react";
import { useState } from "react";

import { workspaceLabel } from "@/components/layout/sidebar/workspace-switcher";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog/responsive-dialog";
import { SettingsRow, SettingsRows } from "@/components/user-settings/section/settings-row";
import { useLeaveWorkspace, useSwitchWorkspace } from "@/lib/query/team";
import { toastError } from "@/lib/query/toast-error";
import { ROLE_LABEL } from "@/lib/team/roles";
import type { WorkspaceSummary } from "@/lib/team/types";

/**
 * The teams this person joined, each with Open and Leave. Their own workspace
 * is not listed — it cannot be left, only deleted with the account.
 */
export function YourTeams({
  workspaces,
  activeWorkspaceId,
}: {
  workspaces: readonly WorkspaceSummary[];
  activeWorkspaceId: string;
}) {
  return (
    <SettingsRows>
      {workspaces
        .filter((workspace) => !workspace.own)
        .map((workspace) => (
          <TeamRow
            key={workspace.id}
            workspace={workspace}
            isActive={workspace.id === activeWorkspaceId}
          />
        ))}
    </SettingsRows>
  );
}

function TeamRow({ workspace, isActive }: { workspace: WorkspaceSummary; isActive: boolean }) {
  const switchTo = useSwitchWorkspace();
  const leave = useLeaveWorkspace();
  const [isLeaving, setIsLeaving] = useState(false);
  const name = workspaceLabel(workspace);

  return (
    <SettingsRow
      label={<span className="block truncate">{name}</span>}
      description={`${ROLE_LABEL[workspace.role]}${isActive ? " · Open now" : ""}`}
    >
      {isActive ? null : (
        <Button
          size="sm"
          variant="tertiary"
          isPending={switchTo.isPending || switchTo.isSuccess}
          onPress={() =>
            switchTo.mutate(workspace.id, {
              onError: (error) => toastError(error, "Couldn't switch teams"),
            })
          }
        >
          Open
        </Button>
      )}
      <Button size="sm" variant="tertiary" onPress={() => setIsLeaving(true)}>
        Leave
      </Button>

      <ResponsiveDialog
        isOpen={isLeaving}
        onOpenChange={setIsLeaving}
        className="steady"
        dialogClassName="sm:max-w-[420px]"
      >
        <ResponsiveDialog.Header>
          <ResponsiveDialog.Heading>Leave {name}?</ResponsiveDialog.Heading>
        </ResponsiveDialog.Header>
        <ResponsiveDialog.Body className="text-sm text-muted">
          <p>
            You lose access to its maps. Nothing on them changes, and you&apos;d need a new
            invite to come back.
          </p>
        </ResponsiveDialog.Body>
        <ResponsiveDialog.Footer className="flex-wrap">
          <Button slot="close" variant="tertiary">
            Stay
          </Button>
          <Button
            variant="danger"
            isPending={leave.isPending || leave.isSuccess}
            onPress={() =>
              leave.mutate(workspace.id, {
                onError: (error) => toastError(error, "Couldn't leave the team"),
              })
            }
          >
            Leave team
          </Button>
        </ResponsiveDialog.Footer>
      </ResponsiveDialog>
    </SettingsRow>
  );
}
