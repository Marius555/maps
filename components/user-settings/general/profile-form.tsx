"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Avatar, Button, toast } from "@heroui/react";
import { useForm, useWatch } from "react-hook-form";

import { FormTextField } from "@/components/ui/form-field";
import { initialsOf } from "@/lib/format/initials";
import { useUpdateProfile } from "@/lib/query/account";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { toastError } from "@/lib/query/toast-error";
import { profileSchema, type ProfileInput } from "@/lib/validation/account.schema";

/**
 * The person's name, and the address they sign in with.
 *
 * The avatar follows the field as it is typed. It is the one place the result of
 * this setting is drawn, so it shows it before Save instead of after.
 *
 * The email is shown, not edited: changing it means proving the new address and
 * freezing the account until that is done (docs/notes/settings.md). Showing it
 * here answers "which address is this account?", the question that brings most
 * people to this page.
 */
export function ProfileForm({ name, email }: { name: string; email: string }) {
  const updateProfile = useUpdateProfile();

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isDirty, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name },
  });

  const typed = useWatch({ control, name: "name" });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const { user } = await updateProfile.mutateAsync(values);

      // The saved value becomes the new baseline, so Save goes quiet again.
      reset({ name: user.name });
      toast.success("Saved", { description: "Your name is updated everywhere." });
    } catch (error) {
      if (!applyFieldErrors(error, setError)) toastError(error, "Couldn't save your name");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 sm:max-w-xl">
      <div className="flex items-start gap-4">
        <Avatar size="lg" className="shrink-0">
          <Avatar.Fallback>{initialsOf(typed ?? "", email)}</Avatar.Fallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <FormTextField
            control={control}
            name="name"
            label="Full name"
            autoComplete="name"
            description="How the dashboard addresses you. Visitors to your maps never see it."
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 sm:ps-16">
          <p className="text-sm font-medium text-foreground">Email</p>
          <p className="mt-0.5 truncate text-sm text-muted">{email}</p>
        </div>

        <Button
          type="submit"
          className="self-end"
          isDisabled={!isDirty}
          isPending={isSubmitting}
        >
          Save changes
        </Button>
      </div>
    </form>
  );
}
