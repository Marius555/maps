"use client";

import { Button, toast } from "@heroui/react";

import { formatDate } from "@/lib/format/date";
import { useResumePlan } from "@/lib/query/billing";
import { toastError } from "@/lib/query/toast-error";
import { isEmailUnverified } from "@/lib/query/verify-email-toast";

/**
 * Undo a cancellation. No confirmation: nothing is charged today, and it
 * restores the state the customer was in an hour or a month ago. It is the
 * safe direction.
 */
export function ResumePlanButton({ planName }: { planName: string }) {
  const resumePlan = useResumePlan();

  return (
    <Button
      className="shrink-0 self-start sm:self-auto"
      isPending={resumePlan.isPending}
      onPress={() =>
        resumePlan.mutate(undefined, {
          onSuccess: ({ renewsAt }) =>
            toast.success("Plan resumed", {
              description: renewsAt
                ? `${planName} renews on ${formatDate(renewsAt)}.`
                : `${planName} renews as before.`,
            }),
          onError: (error) => {
            if (isEmailUnverified(error)) return;
            toastError(error, "Couldn't resume your plan");
          },
        })
      }
    >
      Resume plan
    </Button>
  );
}
