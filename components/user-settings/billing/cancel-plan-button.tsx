"use client";

import { Button, Modal, toast } from "@heroui/react";
import { useState } from "react";

import { formatDate } from "@/lib/format/date";
import { useCancelPlan } from "@/lib/query/billing";
import { toastError } from "@/lib/query/toast-error";
import { isEmailUnverified } from "@/lib/query/verify-email-toast";

/**
 * Cancel plan, behind one confirmation.
 *
 * The dialog says the one thing people are afraid of before they press it:
 * nothing disappears today. The plan runs to the end of what was paid for, and
 * everything built stays where it is. The safe choice keeps the plan's name
 * ("Keep Pro") and is the one Escape and the close button take.
 *
 * **`steady` on the backdrop**, because the dialog portals out of the settings
 * page and would otherwise be the one place on it where a button still shrinks
 * when pressed (`app/globals.css`).
 */
export function CancelPlanButton({
  planName,
  endsOn,
}: {
  planName: string;
  /** The renewal that will not happen — the last day of the plan once cancelled. */
  endsOn: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const cancelPlan = useCancelPlan();
  const until = endsOn ? formatDate(endsOn) : "the end of this billing period";

  return (
    <>
      <Button variant="tertiary" className="shrink-0 self-start sm:self-auto" onPress={() => setIsOpen(true)}>
        Cancel plan
      </Button>

      <Modal.Backdrop isOpen={isOpen} onOpenChange={setIsOpen} className="steady">
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[420px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Cancel your {planName} plan?</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-3 text-sm text-muted">
              <p>
                You keep {planName} until {until}, and nothing more is charged after
                that. Then the account moves to Free.
              </p>
              <p>
                Your maps and locations stay, and published maps keep working. You
                can resume any time before {until}.
              </p>
            </Modal.Body>
            <Modal.Footer className="flex-wrap">
              <Button slot="close" variant="tertiary">
                Keep {planName}
              </Button>
              <Button
                variant="danger"
                isPending={cancelPlan.isPending}
                onPress={() =>
                  cancelPlan.mutate(undefined, {
                    onSuccess: ({ endsAt }) => {
                      setIsOpen(false);
                      toast.success("Plan cancelled", {
                        description: `You keep ${planName} until ${endsAt ? formatDate(endsAt) : until}.`,
                      });
                    },
                    onError: (error) => {
                      if (isEmailUnverified(error)) return;
                      toastError(error, "Couldn't cancel your plan");
                    },
                  })
                }
              >
                Cancel plan
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
