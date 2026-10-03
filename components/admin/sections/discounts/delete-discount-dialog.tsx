"use client";

import { Button, toast } from "@heroui/react";
import { useRouter } from "next/navigation";

import { ResponsiveDialog } from "@/components/ui/responsive-dialog/responsive-dialog";
import type { Discount } from "@/lib/billing/types";
import { useDeleteDiscount } from "@/lib/query/admin";
import { toastError } from "@/lib/query/toast-error";

/**
 * Delete a discount at the provider, behind one confirmation. There is no
 * undo, and no edit either — which is why the dialog says the code itself is
 * what goes away, not what anybody already got with it.
 */
export function DeleteDiscountDialog({
  discount,
  isOpen,
  onOpenChange,
}: {
  discount: Discount;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const router = useRouter();
  const remove = useDeleteDiscount();

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="steady"
      dialogClassName="sm:max-w-[420px]"
    >
      <ResponsiveDialog.Header>
        <ResponsiveDialog.Heading>Delete {discount.code}?</ResponsiveDialog.Heading>
      </ResponsiveDialog.Header>
      <ResponsiveDialog.Body className="text-sm text-muted">
        <p>
          The code stops working at the checkout, and links that carry it open the checkout without
          a discount. Customers who already used it keep their price. This can&apos;t be undone.
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
            remove.mutate(discount.id, {
              onSuccess: () => {
                onOpenChange(false);
                toast.success("Deleted", { description: `${discount.code} no longer works.` });
                router.refresh();
              },
              onError: (error) => toastError(error, "Couldn't delete the discount"),
            })
          }
        >
          Delete
        </Button>
      </ResponsiveDialog.Footer>
    </ResponsiveDialog>
  );
}
