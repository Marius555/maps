"use client";

import { Button } from "@heroui/react";
import { useState } from "react";

import { DeleteAccountDialog } from "./delete-account-dialog";

/** The row's control. Opens the dialog, where everything else happens. */
export function DeleteAccountButton({
  email,
  mapCount,
  memberCount,
}: {
  email: string;
  mapCount: number;
  /** People on this account's team, who lose access with it. */
  memberCount: number;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="danger-soft" onPress={() => setIsOpen(true)}>
        Delete account
      </Button>

      <DeleteAccountDialog
        email={email}
        mapCount={mapCount}
        memberCount={memberCount}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
}
