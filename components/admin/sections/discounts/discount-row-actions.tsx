"use client";

import { toast } from "@heroui/react";
import { Copy, CopyPlus, Link2, Megaphone, MegaphoneOff, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { RowMenu, type RowMenuItem } from "@/components/ui/row-menu";
import type { DiscountRow } from "@/lib/admin/metrics/discounts";
import { useFeatureDiscount } from "@/lib/query/admin";
import { toastError } from "@/lib/query/toast-error";
import type { AdminDiscountForm } from "@/lib/validation/discount.schema";
import { copyText } from "./copy-text";
import { DeleteDiscountDialog } from "./delete-discount-dialog";
import { DiscountFormDialog } from "./discount-form-dialog";
import { formFromDiscount } from "./discount-options";
import { RedemptionsDialog } from "./redemptions-dialog";
import { ShareLinkDialog } from "./share-link-dialog";

type Open = "share" | "redemptions" | "delete" | null;

/** One discount's actions, behind the row menu, and the dialogs they open. */
export function DiscountRowActions({ discount, appUrl }: { discount: DiscountRow; appUrl: string }) {
  const router = useRouter();
  const feature = useFeatureDiscount();
  const [open, setOpen] = useState<Open>(null);
  const [duplicate, setDuplicate] = useState<AdminDiscountForm | null>(null);

  const dialogProps = (which: Exclude<Open, null>) => ({
    discount,
    isOpen: open === which,
    onOpenChange: (isOpen: boolean) => setOpen(isOpen ? which : null),
  });

  const toggleFeatured = () => {
    const featured = !discount.featured;

    feature.mutate(
      { id: discount.id, code: discount.code, featured },
      {
        onSuccess: () => {
          toast.success(featured ? "Shown on pricing page" : "Removed from pricing page", {
            description: featured
              ? `Every visitor sees ${discount.code} applied, within a minute.`
              : "Visitors can still type the code.",
          });
          router.refresh();
        },
        onError: (error) => toastError(error, "Couldn't change the pricing page"),
      },
    );
  };

  const items: RowMenuItem[] = [
    {
      id: "copy",
      label: "Copy code",
      icon: Copy,
      onAction: () => void copyText(discount.code, "Customers type it at the checkout."),
    },
    { id: "share", label: "Share link", icon: Link2, onAction: () => setOpen("share") },
    discount.featured
      ? { id: "feature", label: "Stop showing on pricing page", icon: MegaphoneOff, onAction: toggleFeatured }
      : { id: "feature", label: "Show on pricing page", icon: Megaphone, onAction: toggleFeatured },
    { id: "redemptions", label: "Who used it", icon: Users, onAction: () => setOpen("redemptions") },
    {
      id: "duplicate",
      label: "Duplicate",
      icon: CopyPlus,
      onAction: () => setDuplicate(formFromDiscount(discount, Date.now())),
    },
    { id: "delete", label: "Delete", icon: Trash2, isDanger: true, onAction: () => setOpen("delete") },
  ];

  return (
    <>
      <RowMenu label={`Actions for ${discount.code}`} items={items} />

      <ShareLinkDialog {...dialogProps("share")} appUrl={appUrl} />
      <RedemptionsDialog {...dialogProps("redemptions")} />
      <DeleteDiscountDialog {...dialogProps("delete")} />
      <DiscountFormDialog
        title={`Duplicate ${discount.code}`}
        defaultValues={duplicate}
        onClose={() => setDuplicate(null)}
      />
    </>
  );
}
