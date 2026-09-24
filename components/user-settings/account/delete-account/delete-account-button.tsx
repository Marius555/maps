"use client";

import { Button } from "@heroui/react";
import { useState } from "react";

import { DeleteAccountDialog } from "./delete-account-dialog";

/** The row's control. Opens the dialog, where everything else happens. */
export function DeleteAccountButton({ email, mapCount }: { email: string; mapCount: number }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="danger-soft" onPress={() => setIsOpen(true)}>
        Delete account
      </Button>

      <DeleteAccountDialog
        email={email}
        mapCount={mapCount}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
      />
    </>
  );
}
