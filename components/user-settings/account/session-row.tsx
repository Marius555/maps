"use client";

import { Button, Chip, toast } from "@heroui/react";
import { Laptop, Smartphone } from "lucide-react";

import { SettingsRow } from "@/components/user-settings/section/settings-row";
import type { AccountSession } from "@/lib/auth/sessions";
import { formatDate } from "@/lib/format/date";
import { useRevokeSession } from "@/lib/query/account";
import { toastError } from "@/lib/query/toast-error";

/**
 * How a session signed in, where that can be told. Not `token`: the Google
 * exchange and every emailed link both mint sessions from a token, so the word
 * says nothing a person would recognise, and a guess would be wrong half the time.
 */
const PROVIDERS: Record<string, string> = {
  email: "Password",
  google: "Google",
  oauth2: "Google",
};

/**
 * One signed-in device: what it is, where, since when, and a way to end it.
 *
 * Named by browser and system ("Chrome 131 on Windows 11"), because that is
 * what somebody checking this list recognises, or fails to. "This device" is a
 * chip rather than a sentence, and it stands where the Sign out button stands
 * on every other row. So each row keeps its shape, and the one you are on is
 * the one you cannot sign out from here: that is Log out, which also clears the
 * cookie.
 */
export function SessionRow({ session }: { session: AccountSession }) {
  const revoke = useRevokeSession();
  const Icon = session.device ? Smartphone : Laptop;

  const name =
    [session.client, session.os].filter(Boolean).join(" on ") || session.device || "Unknown device";
  const details = [
    session.device && session.client ? session.device : null,
    `Signed in ${formatDate(session.createdAt)}`,
    PROVIDERS[session.provider] ?? null,
  ].filter(Boolean);

  return (
    <SettingsRow
      label={
        <span className="flex min-w-0 items-center gap-2">
          <Icon aria-hidden="true" className="size-4 shrink-0 text-muted" />
          <span className="truncate">{name}</span>
        </span>
      }
      description={<span className="sm:ps-6">{details.join(" · ")}</span>}
    >
      {session.current ? (
        <Chip size="sm" variant="soft" color="accent">
          This device
        </Chip>
      ) : (
        <Button
          size="sm"
          variant="tertiary"
          isPending={revoke.isPending}
          aria-label={`Sign out ${name}`}
          onPress={() =>
            revoke.mutate(session.id, {
              onSuccess: () => toast.success("Signed out", { description: name }),
              onError: (error) => toastError(error, "Couldn't sign that device out"),
            })
          }
        >
          Sign out
        </Button>
      )}
    </SettingsRow>
  );
}
