"use client";

import { Button } from "@heroui/react";
import { UserPlus } from "lucide-react";
import { useId, useState } from "react";

import {
  useEmailUnverified,
  VerifyEmailNotice,
} from "@/components/verify-email/verify-email-notice";
import type { WorkspaceRole } from "@/lib/team/roles";
import { InviteDialog } from "./invite-dialog";

/**
 * Invite people, or the reason it is switched off — always drawn, so the
 * section's header is the same height whatever the seat count (the settings
 * pages' rule: nothing arrives later to move what is below it).
 *
 * Greyed for an account that has not confirmed its address, with the note
 * underneath, for the reason Create map and Publish are (`CreateMapDialog`):
 * sending an invite is a write the email gate refuses, and a button that opens
 * a form whose Send can only fail is worse than one that says why up front.
 */
export function InviteButton({
  viewerRole,
  isFull,
}: {
  viewerRole: WorkspaceRole;
  isFull: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const unverified = useEmailUnverified();
  const noteId = useId();

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        size="sm"
        onPress={() => setIsOpen(true)}
        isDisabled={isFull || unverified}
        aria-describedby={unverified ? noteId : undefined}
      >
        <UserPlus aria-hidden="true" className="size-4" />
        Invite people
      </Button>

      <VerifyEmailNotice id={noteId} />

      <InviteDialog isOpen={isOpen} onOpenChange={setIsOpen} viewerRole={viewerRole} />
    </div>
  );
}
