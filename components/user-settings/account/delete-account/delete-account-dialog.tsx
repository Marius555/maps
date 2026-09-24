"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Modal } from "@heroui/react";
import { useForm, useWatch } from "react-hook-form";

import { FormTextField } from "@/components/ui/form-field";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { toastError } from "@/lib/query/toast-error";
import {
  deleteAccountSchema,
  type DeleteAccountInput,
} from "@/lib/validation/account.schema";
import { DeletionProgress } from "./deletion-progress";
import { useAccountDeletion } from "./use-account-deletion";

/**
 * The last confirmation, then the deletion itself, in one dialog.
 *
 * **What goes is listed before it goes**, including the part people forget:
 * a map embedded on somebody's website stops working the moment its snapshot is
 * deleted. Typing the address is the confirmation, because it cannot be done
 * without reading the dialog.
 *
 * **Once it starts, the dialog cannot be dismissed** (no backdrop click, no
 * Escape, no close button) until it fails or finishes. Closing it would not stop
 * anything on the server, but it would hide the one thing saying "keep this tab
 * open".
 *
 * **The confirm field and the progress share one slot of fixed height**, so the
 * dialog does not change size when one replaces the other. `steady` is on the
 * backdrop for the reason `CancelPlanButton` gives.
 */
export function DeleteAccountDialog({
  email,
  mapCount,
  isOpen,
  onOpenChange,
}: {
  email: string;
  mapCount: number;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const { phase, start, resume } = useAccountDeletion();

  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<DeleteAccountInput>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { email: "" },
  });

  const typed = useWatch({ control, name: "email" });
  const matches = (typed ?? "").trim().toLowerCase() === email.toLowerCase();

  const busy = phase.kind === "starting" || phase.kind === "deleting" || phase.kind === "done";

  const onSubmit = handleSubmit(async (values) => {
    try {
      await start(values.email);
    } catch (error) {
      if (!applyFieldErrors(error, setError)) toastError(error, "Couldn't delete your account");
    }
  });

  const maps =
    mapCount === 0 ? "Your account" : mapCount === 1 ? "Your map" : `All ${String(mapCount)} of your maps`;

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      isDismissable={!busy}
      isKeyboardDismissDisabled={busy}
      className="steady"
    >
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[440px]">
          {busy ? null : <Modal.CloseTrigger />}
          <Modal.Header>
            <Modal.Heading>Delete your account?</Modal.Heading>
          </Modal.Header>

          <form onSubmit={onSubmit} noValidate>
            <Modal.Body className="space-y-4">
              <div className="space-y-2 text-sm text-muted">
                <p>
                  {maps}, every location and photo on them, and their analytics are
                  deleted for good. Maps embedded on your websites stop working.
                </p>
                <p>
                  Any subscription is cancelled first, so nothing more is charged.
                  This can&apos;t be undone.
                </p>
              </div>

              <div className="min-h-[6.25rem]">
                {phase.kind === "deleting" ? (
                  <DeletionProgress total={phase.total} left={phase.left} />
                ) : phase.kind === "done" ? (
                  <p className="text-sm text-muted" aria-live="polite">
                    Account deleted. Taking you to the home page…
                  </p>
                ) : phase.kind === "failed" ? (
                  <p className="text-sm text-danger" role="alert">
                    {phase.message}
                  </p>
                ) : (
                  <FormTextField
                    control={control}
                    name="email"
                    type="email"
                    label="Your email address"
                    autoComplete="off"
                    description={`Type ${email} to confirm.`}
                    isDisabled={phase.kind === "starting"}
                  />
                )}
              </div>
            </Modal.Body>

            {/* Wraps below ~360px, where "Keep account" and "Delete account"
                side by side are wider than the dialog. */}
            <Modal.Footer className="flex-wrap">
              {phase.kind === "failed" && phase.confirmed ? (
                <>
                  <Button slot="close" variant="tertiary">
                    Close
                  </Button>
                  <Button type="button" variant="danger" onPress={resume}>
                    Try again
                  </Button>
                </>
              ) : (
                <>
                  <Button slot="close" variant="tertiary" isDisabled={busy}>
                    Keep account
                  </Button>
                  <Button
                    type="submit"
                    variant="danger"
                    isDisabled={!matches || (busy && phase.kind !== "starting")}
                    isPending={isSubmitting || phase.kind === "starting" || phase.kind === "deleting"}
                  >
                    Delete account
                  </Button>
                </>
              )}
            </Modal.Footer>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
