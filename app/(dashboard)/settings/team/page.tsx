import type { Metadata } from "next";

import {
  INVITATIONS_SECTION,
  INVITES_SECTION,
  MEMBERS_SECTION,
  YOUR_TEAMS_SECTION,
  membersTitle,
} from "@/components/user-settings/team/copy";
import { InvitationsForYou } from "@/components/user-settings/team/invitations-for-you";
import { InviteButton } from "@/components/user-settings/team/invite-button";
import { PendingInvites } from "@/components/user-settings/team/pending-invites";
import { SeatMeter } from "@/components/user-settings/team/seat-meter";
import { TeamPeople } from "@/components/user-settings/team/team-people";
import { YourTeams } from "@/components/user-settings/team/your-teams";
import { SettingsSection } from "@/components/user-settings/section/settings-section";
import { requireUser } from "@/lib/auth/current-user";
import { listMyInvitations } from "@/lib/team/my-invitations";
import { loadTeamOverview } from "@/lib/team/overview";
import { listWorkspacesFor, loadActiveContext } from "@/lib/team/resolve";
import { can } from "@/lib/team/roles";

export const metadata: Metadata = { title: "Team settings" };

/**
 * Who works on the switched-to workspace, and how to add someone.
 * docs/notes/team.md has the model; lib/team/roles.ts what each role may do.
 *
 * Everything is read before the page renders, in one batch, so each section
 * arrives at its final height (docs/notes/settings.md). The sections that may be
 * empty — invitations for you, pending invites, other teams — are drawn only
 * when they have rows; the team itself always has at least its owner.
 */
export default async function TeamSettingsPage() {
  const user = await requireUser();
  const ctx = await loadActiveContext(user.id);

  const [team, workspaces, invitations] = await Promise.all([
    loadTeamOverview(ctx),
    listWorkspacesFor(user.id, user.name || user.email),
    listMyInvitations(user),
  ]);

  const own = ctx.workspaceId === user.id;
  const canInvite = can(ctx.role, "manageMembers");
  const isFull = team.seatsUsed >= team.seats;

  return (
    <>
      {invitations.length > 0 ? (
        <SettingsSection {...INVITATIONS_SECTION}>
          <InvitationsForYou invitations={invitations} />
        </SettingsSection>
      ) : null}

      <SettingsSection
        title={membersTitle(team.workspaceName, own)}
        description={MEMBERS_SECTION.description}
        action={canInvite ? <InviteButton viewerRole={ctx.role} isFull={isFull} /> : undefined}
      >
        <div className="space-y-4">
          <SeatMeter
            used={team.seatsUsed}
            seats={team.seats}
            plan={team.plan}
            isOwner={ctx.role === "owner"}
          />
          <TeamPeople people={team.people} viewerRole={ctx.role} viewerId={user.id} />
        </div>
      </SettingsSection>

      {canInvite && team.invites.length > 0 ? (
        <SettingsSection {...INVITES_SECTION}>
          <PendingInvites invites={team.invites} viewerRole={ctx.role} />
        </SettingsSection>
      ) : null}

      {workspaces.length > 1 ? (
        <SettingsSection {...YOUR_TEAMS_SECTION}>
          <YourTeams workspaces={workspaces} activeWorkspaceId={ctx.workspaceId} />
        </SettingsSection>
      ) : null}
    </>
  );
}
