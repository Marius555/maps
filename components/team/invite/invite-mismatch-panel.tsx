"use client";

import { Button } from "@heroui/react";

import { AuthShell } from "@/components/auth/auth-shell";
import { useLogout } from "@/lib/query/auth";
import { toastError } from "@/lib/query/toast-error";

/**
 * Signed in, but as somebody the invite was not sent to.
 *
 * Accepting is refused on the server in this case too (the invite is for an
 * address, not for whoever holds the link); this says so before the button
 * rather than after it. Logging out reloads the same page, which then offers
 * Log in with the address it names.
 */
export function InviteMismatchPanel({
  invitedEmail,
  signedInEmail,
}: {
  invitedEmail: string;
  signedInEmail: string;
}) {
  const logout = useLogout();

  return (
    <AuthShell
      title="This invite is for someone else"
      description={`It was sent to ${invitedEmail}, and you're logged in as ${signedInEmail}. Log out, then log in with ${invitedEmail} to accept it.`}
    >
      <Button
        fullWidth
        isPending={logout.isPending}
        onPress={() =>
          logout.mutate(undefined, {
            // A document load, as the account menu's Log out does: the page
            // must ask again who is signed in, from nothing.
            onSuccess: () => window.location.reload(),
            onError: (error) => toastError(error, "Couldn't log out"),
          })
        }
      >
        Log out
      </Button>
    </AuthShell>
  );
}
