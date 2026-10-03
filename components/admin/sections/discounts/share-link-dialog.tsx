"use client";

import { Button } from "@heroui/react";
import { Copy } from "lucide-react";

import { ResponsiveDialog } from "@/components/ui/responsive-dialog/responsive-dialog";
import { discountShareLink, offerLabel } from "@/lib/billing/discounts";
import type { Discount } from "@/lib/billing/types";
import { copyText } from "./copy-text";

/**
 * A link to the pricing page with this code applied. The visitor sees the
 * discounted prices there and picks a plan; the checkout opens with the code.
 */
export function ShareLinkDialog({
  discount,
  appUrl,
  isOpen,
  onOpenChange,
}: {
  discount: Discount;
  appUrl: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const link = discountShareLink(appUrl, discount.code);
  const plans = discount.plans.length > 0 ? discount.plans.map(offerLabel).join(", ") : null;

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="steady"
      dialogClassName="sm:max-w-[480px]"
    >
      <ResponsiveDialog.Header>
        <ResponsiveDialog.Heading>Share {discount.code}</ResponsiveDialog.Heading>
      </ResponsiveDialog.Header>
      <ResponsiveDialog.Body className="space-y-4">
        <p className="text-sm text-muted">
          The link opens the pricing page with the code applied, so visitors see the discounted
          prices before they choose.{plans ? ` It only lowers ${plans}.` : ""}
        </p>
        <p className="select-all break-all rounded-xl bg-surface-secondary p-3 font-mono text-xs text-foreground">
          {link}
        </p>
      </ResponsiveDialog.Body>
      <ResponsiveDialog.Footer className="flex-wrap">
        <Button slot="close" variant="tertiary">
          Close
        </Button>
        <Button onPress={() => void copyText(link, "Paste it anywhere you share the offer.")}>
          <Copy aria-hidden="true" className="size-4" />
          Copy link
        </Button>
      </ResponsiveDialog.Footer>
    </ResponsiveDialog>
  );
}
