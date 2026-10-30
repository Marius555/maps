"use client";

import { Button, Dropdown, Label, Separator } from "@heroui/react";
import { ChevronsUpDown, Users } from "lucide-react";
import { useRouter } from "next/navigation";

import { useSwitchWorkspace } from "@/lib/query/team";
import { toastError } from "@/lib/query/toast-error";
import { ROLE_LABEL } from "@/lib/team/roles";
import type { WorkspaceSummary } from "@/lib/team/types";

/**
 * Which team's maps the dashboard is showing, and the way to another.
 *
 * **Drawn only for somebody in more than one workspace.** Everybody owns one —
 * their own — so for the person working alone, which is most people, there is
 * nothing to switch between and the sidebar is exactly what it was before teams.
 *
 * Switching is a document load (lib/query/team.ts), so there is no in-between
 * state to draw beyond the button's own pending spinner.
 */
export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  isCollapsed = false,
  onNavigate,
}: {
  workspaces: readonly WorkspaceSummary[];
  activeWorkspaceId: string;
  isCollapsed?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const switchTo = useSwitchWorkspace();

  if (workspaces.length < 2) return null;

  const active = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];

  return (
    <Dropdown>
      <Button
        aria-label={`${workspaceLabel(active)}. Switch team`}
        variant="tertiary"
        isPending={switchTo.isPending}
        className={`h-auto w-full rounded-xl px-2 py-1.5 ${
          isCollapsed ? "justify-center gap-0" : "justify-start gap-2"
        }`}
      >
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-xs font-semibold text-accent"
        >
          {active.own ? <Users className="size-3.5" /> : initialOf(active.name)}
        </span>

        {/* Collapsed to zero width rather than unmounted, like the account
            menu's name, so it travels with the panel. */}
        <span
          aria-hidden={isCollapsed}
          className={`min-w-0 flex-1 overflow-hidden text-left transition-[max-width,opacity] duration-[var(--duration-panel)] ease-[var(--ease-out-fluid)] ${
            isCollapsed ? "max-w-0 opacity-0" : "max-w-full opacity-100"
          }`}
        >
          <span className="block truncate text-sm font-medium text-foreground">
            {workspaceLabel(active)}
          </span>
          <span className="block truncate text-xs font-normal text-muted">
            {active.own ? "Owner" : ROLE_LABEL[active.role]}
          </span>
        </span>

        {isCollapsed ? null : (
          <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted" />
        )}
      </Button>

      <Dropdown.Popover placement="bottom start" className="min-w-60">
        <Dropdown.Menu
          aria-label="Teams"
          onAction={(key) => {
            if (key !== "team-settings") return;

            onNavigate?.();
            router.push("/settings/team");
          }}
        >
          <Dropdown.Section
            aria-label="Switch team"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[active.id]}
            onSelectionChange={(keys) => {
              const next = keys === "all" ? undefined : [...keys][0];

              if (typeof next !== "string" || next === active.id) return;

              switchTo.mutate(next, {
                onError: (error) => toastError(error, "Couldn't switch teams"),
              });
            }}
          >
            {workspaces.map((workspace) => (
              <Dropdown.Item
                key={workspace.id}
                id={workspace.id}
                textValue={workspaceLabel(workspace)}
              >
                <div className="flex min-w-0 flex-col">
                  <Label className="truncate">{workspaceLabel(workspace)}</Label>
                  <span className="text-xs text-muted">
                    {workspace.own ? "Owner" : ROLE_LABEL[workspace.role]}
                  </span>
                </div>
              </Dropdown.Item>
            ))}
          </Dropdown.Section>

          <Separator />

          <Dropdown.Item id="team-settings" textValue="Team settings">
            <Label>Team settings</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

/** "Your maps" for the person's own workspace; the owner's name for a team. */
export function workspaceLabel(workspace: Pick<WorkspaceSummary, "name" | "own">): string {
  if (workspace.own) return "Your maps";

  return workspace.name ? `${workspace.name}'s team` : "A team";
}

function initialOf(name: string): string {
  return (name.trim()[0] ?? "T").toUpperCase();
}
