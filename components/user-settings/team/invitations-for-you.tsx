"use client";

import { Button, toast } from "@heroui/react";

import { SettingsRow, SettingsRows } from "@/components/user-settings/section/settings-row";
import { useAcceptInvitation, useDeclineInvitation } from "@/lib/query/team";
import { toastError } from "@/lib/query/toast-error";
import type { MyInvitation } from "@/lib/team/my-invitations";
import { ROLE_LABEL } from "@/lib/team/roles";

/**
 * Teams that invited this address — the way in that needs no link, for a
 * confirmed address (the server only lists them for one). Joining switches to
 * the team by a full load (`useAcceptInvitation`).
 */
export function InvitationsForYou({ invitations }: { invitations: MyInvitation[] }) {
  return (
    <SettingsRows>
      {invitations.map((invitation) => (
        <InvitationRow key={invitation.id} invitation={invitation} />
      ))}
    </SettingsRows>
  );
}

function InvitationRow({ invitation }: { invitation: MyInvitation }) {
  const accept = useAcceptInvitation();
  const decline = useDeclineInvitation();
  const team = invitation.workspaceName ? `${invitation.workspaceName}'s team` : "A team";
  const busy = accept.isPending || accept.isSuccess || decline.isPending;

  return (
    <SettingsRow
      label={<span className="block truncate">{team}</span>}
      description={`${invitation.inviterName || "Someone"} invited you as ${ROLE_LABEL[invitation.role].toLowerCase()}.`}
    >
      <Button
        size="sm"
        isPending={accept.isPending || accept.isSuccess}
        isDisabled={busy}
        onPress={() =>
          accept.mutate(invitation.id, {
            onError: (error) => toastError(error, "Couldn't join the team"),
          })
        }
      >
        Join
      </Button>
      <Button
        size="sm"
        variant="tertiary"
        isPending={decline.isPending}
        isDisabled={busy}
        onPress={() =>
          decline.mutate(invitation.id, {
            onSuccess: () => toast.success("Invitation declined", { description: team }),
            onError: (error) => toastError(error, "Couldn't decline it"),
          })
        }
      >
        Decline
      </Button>
    </SettingsRow>
  );
}
