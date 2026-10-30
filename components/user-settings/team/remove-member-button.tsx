"use client";

import { Button, toast } from "@heroui/react";
import { useState } from "react";

import { ResponsiveDialog } from "@/components/ui/responsive-dialog/responsive-dialog";
import { useRemoveMember } from "@/lib/query/team";
import { toastError } from "@/lib/query/toast-error";

/**
 * Remove somebody from the team, after saying what that does. Their access ends
 * on their next click — membership is read fresh on every request — and the
 * seat is free at once.
 */
export function RemoveMemberButton({ userId, name }: { userId: string; name: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const remove = useRemoveMember();

  return (
    <>
      <Button size="sm" variant="tertiary" onPress={() => setIsOpen(true)}>
        Remove
      </Button>

      <ResponsiveDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        className="steady"
        dialogClassName="sm:max-w-[420px]"
      >
        <ResponsiveDialog.Header>
          <ResponsiveDialog.Heading>Remove {name}?</ResponsiveDialog.Heading>
        </ResponsiveDialog.Header>
        <ResponsiveDialog.Body className="space-y-3 text-sm text-muted">
          <p>
            They lose access to this team&apos;s maps straight away. Nothing they made is
            deleted, and their seat is free for someone else.
          </p>
        </ResponsiveDialog.Body>
        <ResponsiveDialog.Footer className="flex-wrap">
          <Button slot="close" variant="tertiary">
            Keep {name}
          </Button>
          <Button
            variant="danger"
            isPending={remove.isPending}
            onPress={() =>
              remove.mutate(userId, {
                onSuccess: () => {
                  setIsOpen(false);
                  toast.success("Removed", { description: `${name} no longer has access.` });
                },
                onError: (error) => toastError(error, "Couldn't remove them"),
              })
            }
          >
            Remove
          </Button>
        </ResponsiveDialog.Footer>
      </ResponsiveDialog>
    </>
  );
}
