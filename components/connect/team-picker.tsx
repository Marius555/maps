"use client";

import { workspaceLabel } from "@/components/layout/sidebar/workspace-switcher";
import { SelectControl } from "@/components/ui/select-control";
import { useSwitchWorkspaceInPlace, useWorkspaces } from "@/lib/query/team";
import { toastError } from "@/lib/query/toast-error";
import { ROLE_LABEL } from "@/lib/team/roles";

/**
 * Whose maps the connect page lists, for somebody in more than one team.
 *
 * The same switch as the dashboard's (it sets the same cookie), but in place:
 * this page has no editor state, so reading the map list again is enough and a
 * reload would only throw away the WordPress return address it is holding.
 * Nothing at all is drawn for a person with one workspace — most people.
 */
export function TeamPicker() {
  const workspaces = useWorkspaces();
  const switchTo = useSwitchWorkspaceInPlace();

  if (!workspaces.data || workspaces.data.workspaces.length < 2) return null;

  return (
    <SelectControl
      label="Team"
      value={workspaces.data.activeWorkspaceId}
      isDisabled={switchTo.isPending}
      options={workspaces.data.workspaces.map((workspace) => ({
        id: workspace.id,
        label: workspaceLabel(workspace),
        description: workspace.own ? "Owner" : ROLE_LABEL[workspace.role],
      }))}
      onChange={(workspaceId) =>
        switchTo.mutate(workspaceId, {
          onError: (error) => toastError(error, "Couldn't switch teams"),
        })
      }
    />
  );
}

/** Whether the switched-to team lets this person connect — and so publish — a map. */
export function useCanConnect(): boolean {
  const workspaces = useWorkspaces();
  const role = workspaces.data?.role ?? "owner";

  return role !== "viewer";
}
