"use client";

import { ResponsiveDialog } from "@/components/ui/responsive-dialog/responsive-dialog";
import type { AdminDiscountForm } from "@/lib/validation/discount.schema";
import { DiscountForm } from "./discount-form";

/**
 * The create form in a dialog — for New discount, and for Duplicate with the
 * form pre-filled. `defaultValues` doubles as the open state, so there is no
 * such thing as this dialog open with nothing to show.
 */
export function DiscountFormDialog({
  title,
  defaultValues,
  onClose,
}: {
  title: string;
  defaultValues: AdminDiscountForm | null;
  onClose: () => void;
}) {
  return (
    <ResponsiveDialog
      isOpen={defaultValues !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      className="steady"
      dialogClassName="sm:max-w-[560px]"
      scroll="inside"
    >
      <ResponsiveDialog.Header>
        <ResponsiveDialog.Heading>{title}</ResponsiveDialog.Heading>
      </ResponsiveDialog.Header>
      <ResponsiveDialog.Body>
        {defaultValues ? <DiscountForm defaultValues={defaultValues} onDone={onClose} /> : null}
      </ResponsiveDialog.Body>
    </ResponsiveDialog>
  );
}
