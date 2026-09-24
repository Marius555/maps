import { Chip } from "@heroui/react";

import type { InvoiceStatus as Status } from "@/lib/billing/types";

const STATUS: Record<Status, { label: string; color: "success" | "warning" | "default" }> = {
  paid: { label: "Paid", color: "success" },
  pending: { label: "Pending", color: "warning" },
  void: { label: "Void", color: "default" },
  refunded: { label: "Refunded", color: "default" },
  partial_refund: { label: "Part refunded", color: "warning" },
};

/** An invoice's state in one word, in the colour of whether it needs anything. */
export function InvoiceStatus({ status }: { status: Status }) {
  const { label, color } = STATUS[status];

  return (
    <Chip size="sm" variant="soft" color={color}>
      {label}
    </Chip>
  );
}
