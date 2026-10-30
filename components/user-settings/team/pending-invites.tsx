"use client";

import { Button, Chip, toast } from "@heroui/react";
import { useState } from "react";

import { ResponsiveDialog } from "@/components/ui/responsive-dialog/responsive-dialog";
import { SettingsRow, SettingsRows } from "@/components/user-settings/section/settings-row";
import { formatDate } from "@/lib/format/date";
import { useResendInvite, useRevokeInvite } from "@/lib/query/team";
import { toastError } from "@/lib/query/toast-error";
import { canManage, ROLE_LABEL, type WorkspaceRole } from "@/lib/team/roles";
import type { TeamOverview } from "@/lib/team/types";
import { InviteLink } from "./invite-link";

/**
 * Invites nobody has accepted yet. A token is never stored, so there is no
 * Copy link here: Resend mints a new one (and kills the old), and shows it.
 */
export function PendingInvites({
  invites,
  viewerRole,
}: {
  invites: TeamInvite[];
  viewerRole: WorkspaceRole;
}) {
  return (
    <SettingsRows>
      {invites.map((invite) => (
        <InviteRow key={invite.id} invite={invite} viewerRole={viewerRole} />
      ))}
    </SettingsRows>
  );
}

type TeamInvite = TeamOverview["invites"][number];

function InviteRow({ invite, viewerRole }: { invite: TeamInvite; viewerRole: WorkspaceRole }) {
  const resend = useResendInvite();
  const revoke = useRevokeInvite();
  const [link, setLink] = useState<string | null>(null);
  const expired = invite.expired;
  const manageable = canManage(viewerRole, invite.role, null);

  return (
    <SettingsRow
      label={<span className="block truncate">{invite.email}</span>}
      description={`${ROLE_LABEL[invite.role]} · ${expired ? "Expired" : `Expires ${formatDate(invite.expiresAt)}`}`}
    >
      {manageable ? (
        <>
          <Button
            size="sm"
            variant="tertiary"
            isPending={resend.isPending}
            onPress={() =>
              resend.mutate(invite.id, {
                onSuccess: (answer) => {
                  toast.success("Invite sent again", { description: invite.email });
                  setLink(answer.inviteUrl);
                },
                onError: (error) => toastError(error, "Couldn't resend the invite"),
              })
            }
          >
            Resend
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            isPending={revoke.isPending}
            onPress={() =>
              revoke.mutate(invite.id, {
                onSuccess: () => toast.success("Invite taken back", { description: invite.email }),
                onError: (error) => toastError(error, "Couldn't take the invite back"),
              })
            }
          >
            Revoke
          </Button>
        </>
      ) : (
        <Chip size="sm" variant="soft">
          {expired ? "Expired" : "Pending"}
        </Chip>
      )}

      <ResponsiveDialog
        isOpen={link !== null}
        onOpenChange={(open) => {
          if (!open) setLink(null);
        }}
        className="steady"
        dialogClassName="sm:max-w-[440px]"
      >
        <ResponsiveDialog.Header>
          <ResponsiveDialog.Heading>New invite link</ResponsiveDialog.Heading>
        </ResponsiveDialog.Header>
        <ResponsiveDialog.Body className="space-y-4">
          <p className="text-sm text-muted">
            We emailed it to {invite.email}. The old link no longer works.
          </p>
          {link ? <InviteLink url={link} /> : null}
        </ResponsiveDialog.Body>
        <ResponsiveDialog.Footer>
          <Button slot="close">Done</Button>
        </ResponsiveDialog.Footer>
      </ResponsiveDialog>
    </SettingsRow>
  );
}
