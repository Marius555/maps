"use client";

import { Button, toast } from "@heroui/react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { IconButton } from "@/components/ui/icon-button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog/responsive-dialog";
import { useDeleteNotification } from "@/lib/query/admin";
import { toastError } from "@/lib/query/toast-error";

/**
 * Withdraw a sent notification, behind one confirmation. It leaves every
 * owner's page at their next refresh; there is no undo.
 */
export function DeleteNotificationButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const remove = useDeleteNotification();

  return (
    <>
      <IconButton label={`Delete “${title}”`} icon={Trash2} variant="ghost" onPress={() => setIsOpen(true)} />

      <ResponsiveDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        className="steady"
        dialogClassName="sm:max-w-[420px]"
      >
        <ResponsiveDialog.Header>
          <ResponsiveDialog.Heading>Delete this notification?</ResponsiveDialog.Heading>
        </ResponsiveDialog.Header>
        <ResponsiveDialog.Body className="text-sm text-muted">
          <p>
            “{title}” stops showing to every owner it was sent to. This can’t be undone.
          </p>
        </ResponsiveDialog.Body>
        <ResponsiveDialog.Footer className="flex-wrap">
          <Button slot="close" variant="tertiary">
            Keep it
          </Button>
          <Button
            variant="danger"
            isPending={remove.isPending}
            onPress={() =>
              remove.mutate(id, {
                onSuccess: () => {
                  setIsOpen(false);
                  toast.success("Deleted");
                  router.refresh();
                },
                onError: (error) => toastError(error, "Couldn't delete the notification"),
              })
            }
          >
            Delete
          </Button>
        </ResponsiveDialog.Footer>
      </ResponsiveDialog>
    </>
  );
}
