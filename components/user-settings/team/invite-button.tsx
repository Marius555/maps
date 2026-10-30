"use client";

import { Button } from "@heroui/react";
import { UserPlus } from "lucide-react";
import { useState } from "react";

import type { WorkspaceRole } from "@/lib/team/roles";
import { InviteDialog } from "./invite-dialog";

/**
 * Invite people, or the reason it is switched off — always drawn, so the
 * section's header is the same height whatever the seat count (the settings
 * pages' rule: nothing arrives later to move what is below it).
 */
export function InviteButton({
  viewerRole,
  isFull,
}: {
  viewerRole: WorkspaceRole;
  isFull: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button size="sm" onPress={() => setIsOpen(true)} isDisabled={isFull}>
        <UserPlus aria-hidden="true" className="size-4" />
        Invite people
      </Button>

      <InviteDialog isOpen={isOpen} onOpenChange={setIsOpen} viewerRole={viewerRole} />
    </>
  );
}
