"use client";

import { Button, toast } from "@heroui/react";

import { useRevokeOtherSessions } from "@/lib/query/account";
import { toastError } from "@/lib/query/toast-error";

/**
 * claude.ai's "Log out of all devices", minus this one. Without a confirmation,
 * because the worst it can do is make you sign in again elsewhere, and the
 * reason to press it is usually urgent.
 *
 * Always drawn, and disabled when there is nobody else to sign out, rather than
 * drawn only sometimes. It sits beside the section's description, and a button
 * that comes and goes rewraps those words onto a different number of lines.
 */
export function SignOutOthersButton({ isDisabled = false }: { isDisabled?: boolean }) {
  const revokeOthers = useRevokeOtherSessions();

  return (
    <Button
      size="sm"
      variant="secondary"
      isDisabled={isDisabled}
      isPending={revokeOthers.isPending}
      onPress={() =>
        revokeOthers.mutate(undefined, {
          onSuccess: ({ signedOut }) =>
            toast.success("Signed out", {
              description:
                signedOut === 1 ? "One other device was signed out." : `${String(signedOut)} other devices were signed out.`,
            }),
          onError: (error) => toastError(error, "Couldn't sign the other devices out"),
        })
      }
    >
      Sign out other devices
    </Button>
  );
}
