"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { FormTextField } from "@/components/ui/form-field";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog/responsive-dialog";
import { SelectControl } from "@/components/ui/select-control";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { useInvite } from "@/lib/query/team";
import { toastError } from "@/lib/query/toast-error";
import type { WorkspaceRole } from "@/lib/team/roles";
import { inviteSchema, type InviteInput } from "@/lib/validation/team.schema";
import { InviteLink } from "./invite-link";
import { roleOptions } from "./role-options";

/**
 * Invite one person by address, then show the link.
 *
 * The dialog stays open on success rather than closing on a toast: the email is
 * on its way, but the link is right here too, for the inviter who would rather
 * paste it into a chat — and for any setup with no email provider, where it is
 * the only way the invite reaches anybody.
 */
export function InviteDialog({
  isOpen,
  onOpenChange,
  viewerRole,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  viewerRole: WorkspaceRole;
}) {
  const invite = useInvite();
  const [sent, setSent] = useState<{ email: string; url: string } | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isSubmitting },
  } = useForm<InviteInput>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "editor" },
  });

  const close = (next: boolean) => {
    onOpenChange(next);

    if (!next) {
      // After the close animation's first frame, so the form does not flash
      // back in while the sheet is still on its way out.
      window.setTimeout(() => {
        setSent(null);
        reset();
      }, 200);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const answer = await invite.mutateAsync(values);
      setSent({ email: answer.invite.email, url: answer.inviteUrl });
    } catch (error) {
      if (!applyFieldErrors(error, setError)) toastError(error, "Couldn't send the invite");
    }
  });

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onOpenChange={close}
      className="steady"
      dialogClassName="sm:max-w-[440px]"
    >
      <ResponsiveDialog.Header>
        <ResponsiveDialog.Heading>{sent ? "Invite sent" : "Invite people"}</ResponsiveDialog.Heading>
      </ResponsiveDialog.Header>

      {sent ? (
        <>
          <ResponsiveDialog.Body className="space-y-4">
            <p className="text-sm text-muted">
              We emailed {sent.email} a link to join. You can also send it yourself — it works
              for 7 days, and only for that address.
            </p>
            <InviteLink url={sent.url} />
          </ResponsiveDialog.Body>
          <ResponsiveDialog.Footer className="flex-wrap">
            <Button variant="tertiary" onPress={() => setSent(null)}>
              Invite someone else
            </Button>
            <Button slot="close">Done</Button>
          </ResponsiveDialog.Footer>
        </>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <ResponsiveDialog.Body className="space-y-4">
            <FormTextField
              control={control}
              name="email"
              type="email"
              label="Email address"
              autoComplete="off"
              autoFocus
              description="They accept with an account that uses this address."
            />
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <SelectControl
                  label="Role"
                  options={roleOptions(viewerRole)}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </ResponsiveDialog.Body>
          <ResponsiveDialog.Footer className="flex-wrap">
            <Button slot="close" variant="tertiary">
              Cancel
            </Button>
            <Button type="submit" isPending={isSubmitting}>
              Send invite
            </Button>
          </ResponsiveDialog.Footer>
        </form>
      )}
    </ResponsiveDialog>
  );
}
