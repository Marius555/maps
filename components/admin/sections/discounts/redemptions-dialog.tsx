"use client";

import { Button, Spinner } from "@heroui/react";
import { useState } from "react";

import { ResponsiveDialog } from "@/components/ui/responsive-dialog/responsive-dialog";
import { formatDateTime } from "@/lib/admin/format";
import type { Discount, DiscountRedemption } from "@/lib/billing/types";
import { useDiscountRedemptions } from "@/lib/query/admin";

/**
 * Who used a code: when, the buyer's address and what it took off. Fetched
 * live from the provider while the dialog is open, a page at a time.
 */
export function RedemptionsDialog({
  discount,
  isOpen,
  onOpenChange,
}: {
  discount: Discount;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const [page, setPage] = useState(1);
  const query = useDiscountRedemptions(discount.id, page, isOpen);
  const data = query.data;

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="steady"
      dialogClassName="sm:max-w-[560px]"
      scroll="inside"
    >
      <ResponsiveDialog.Header>
        <ResponsiveDialog.Heading>Who used {discount.code}</ResponsiveDialog.Heading>
      </ResponsiveDialog.Header>
      <ResponsiveDialog.Body className="min-h-40">
        {query.isError ? (
          <p className="text-sm text-danger">
            Couldn&apos;t read the redemptions from the payment provider. Close this and try again.
          </p>
        ) : !data ? (
          <div className="grid h-32 place-items-center">
            <Spinner size="sm" aria-label="Loading redemptions" />
          </div>
        ) : data.redemptions.length === 0 ? (
          <p className="text-sm text-muted">Nobody has used this code yet.</p>
        ) : (
          <ul className="divide-y divide-border" aria-busy={query.isFetching}>
            {data.redemptions.map((redemption) => (
              <RedemptionRow key={redemption.id} redemption={redemption} />
            ))}
          </ul>
        )}
      </ResponsiveDialog.Body>
      <ResponsiveDialog.Footer className="flex-wrap items-center">
        {data && data.lastPage > 1 ? (
          <div className="mr-auto flex items-center gap-2 text-xs text-muted">
            <Button
              size="sm"
              variant="tertiary"
              isDisabled={page <= 1 || query.isFetching}
              onPress={() => setPage((current) => current - 1)}
            >
              Previous
            </Button>
            <span>
              Page {data.page} of {data.lastPage}
            </span>
            <Button
              size="sm"
              variant="tertiary"
              isDisabled={page >= data.lastPage || query.isFetching}
              onPress={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
        <Button slot="close" variant="tertiary">
          Close
        </Button>
      </ResponsiveDialog.Footer>
    </ResponsiveDialog>
  );
}

function RedemptionRow({ redemption }: { redemption: DiscountRedemption }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-foreground">{redemption.email ?? "Order not readable"}</span>
        <span className="text-xs text-muted">{formatDateTime(redemption.createdAt)} UTC</span>
      </span>
      <span className="shrink-0 tabular-nums text-foreground">−{formatMoney(redemption)}</span>
    </li>
  );
}

function formatMoney({ saved, currency }: DiscountRedemption): string {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: currency ?? "EUR" }).format(
      saved / 100,
    );
  } catch {
    return `${(saved / 100).toFixed(2)} ${currency ?? ""}`.trim();
  }
}
