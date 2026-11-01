"use client";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";

import { ErrorMessage } from "@/components/ui/error-message";
import { useConfirmEmail } from "@/lib/query/auth";

/**
 * The press that confirms an address, on the page the emailed link opens.
 *
 * **Why a press at all.** The link used to confirm on arrival, and company mail
 * scanners open every link in a message — so they confirmed bot signups for
 * strangers who never asked. A scanner loads the page; it does not press this.
 *
 * Whatever the answer, the next screen is `/verify-email?status=…`, a same-site
 * navigation from here — which is what lets "Go to your maps" on it carry the
 * session cookie the cross-site click from the mail client could not.
 */
export function ConfirmEmailButton({ userId, secret }: { userId: string; secret: string }) {
  const router = useRouter();
  const confirm = useConfirmEmail();

  const onPress = async () => {
    try {
      const { status } = await confirm.mutateAsync({ userId, secret });
      router.replace(`/verify-email?status=${status}`);
    } catch {
      // Rendered below from `confirm.error`: the route answers every token
      // outcome with a status, so only a rate limit or an outage lands here.
    }
  };

  return (
    <div className="steady space-y-3">
      {confirm.error ? <ErrorMessage error={confirm.error} /> : null}

      {/* Pending through the navigation too, so it cannot be pressed twice. */}
      <Button fullWidth isPending={confirm.isPending || confirm.isSuccess} onPress={onPress}>
        Confirm email
      </Button>
    </div>
  );
}
