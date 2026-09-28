"use client";

import { ResponsiveDialog } from "@/components/ui/responsive-dialog/responsive-dialog";
import type { SupportKind } from "@/lib/validation/support.schema";
import { SupportRequestForm } from "./support-request-form";

const TITLE: Record<SupportKind, string> = {
  bug: "Report a bug",
  support: "Contact support",
};

/**
 * Report a bug or Contact support, opened from the account menu.
 *
 * Controlled from outside and rendered beside the menu rather than inside it:
 * the menu closes the moment an item is chosen, and a dialog it owned would go
 * with it. `steady` for the reason the settings dialogs carry it — a dialog
 * portals out of any ancestor that set it.
 *
 * `kind` outlives `isOpen` so the title does not blank out while the dialog
 * animates away. The form is keyed by kind, so switching from one to the other
 * starts clean rather than carrying a bug's area into a support request.
 */
export function SupportRequestDialog({
  kind,
  isOpen,
  accountEmail,
  onOpenChange,
}: {
  kind: SupportKind;
  isOpen: boolean;
  accountEmail: string;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="steady"
      dialogClassName="sm:max-w-[520px]"
    >
      <ResponsiveDialog.Header>
        <ResponsiveDialog.Heading>{TITLE[kind]}</ResponsiveDialog.Heading>
      </ResponsiveDialog.Header>
      <SupportRequestForm
        key={kind}
        kind={kind}
        accountEmail={accountEmail}
        onSent={() => onOpenChange(false)}
      />
    </ResponsiveDialog>
  );
}
