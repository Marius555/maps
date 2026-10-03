"use client";

import { Chip } from "@heroui/react";

import { DataTable, type DataColumn } from "@/components/analytics/tables/data-table";
import { formatDate } from "@/lib/admin/format";
import type { DiscountRow } from "@/lib/admin/metrics/discounts";
import {
  formatDiscountAmount,
  formatDiscountDuration,
  offerLabel,
} from "@/lib/billing/discounts";
import { DiscountRowActions } from "./discount-row-actions";
import { STATUS_STYLE } from "./discount-options";

function plansOf(row: DiscountRow): string {
  if (row.plans.length === 0) return row.otherProducts ? "Other products" : "Every plan";

  const names = row.plans.map(offerLabel).join(", ");

  return row.otherProducts ? `${names}, and others` : names;
}

function usesOf(row: DiscountRow): string {
  const used = row.uses === null ? "—" : String(row.uses);

  return row.maxUses === null ? used : `${used} / ${String(row.maxUses)}`;
}

function windowOf(row: DiscountRow): string {
  if (!row.startsAt && !row.expiresAt) return "Always";
  if (!row.expiresAt) return `From ${formatDate(row.startsAt)}`;
  if (!row.startsAt) return `Until ${formatDate(row.expiresAt)}`;

  return `${formatDate(row.startsAt)} – ${formatDate(row.expiresAt)}`;
}

function columns(appUrl: string): DataColumn<DiscountRow>[] {
  return [
    {
      id: "code",
      label: "Discount",
      isRowHeader: true,
      render: (row) => (
        <span className="flex min-w-0 max-w-xs flex-col">
          <span className="flex items-center gap-2">
            <span className="truncate font-mono font-medium text-foreground">{row.code}</span>
            {row.featured ? (
              <Chip size="sm" variant="soft" color="accent">
                On pricing
              </Chip>
            ) : null}
            {row.testMode ? (
              <Chip size="sm" variant="soft" color="warning">
                Test
              </Chip>
            ) : null}
          </span>
          <span className="truncate text-xs text-muted">{row.name}</span>
        </span>
      ),
    },
    {
      id: "amount",
      label: "Amount",
      sortValue: (row) => (row.amountType === "percent" ? row.amount : row.amount / 100),
      render: (row) => (
        <span className="flex flex-col whitespace-nowrap">
          <span className="text-foreground">{formatDiscountAmount(row)} off</span>
          <span className="text-xs text-muted">{formatDiscountDuration(row)}</span>
        </span>
      ),
    },
    {
      id: "plans",
      label: "Plans",
      secondary: true,
      sortValue: plansOf,
      render: (row) => <span className="block max-w-48 text-pretty">{plansOf(row)}</span>,
    },
    {
      id: "uses",
      label: "Uses",
      numeric: true,
      sortValue: (row) => row.uses ?? -1,
      render: (row) => <span className="whitespace-nowrap tabular-nums">{usesOf(row)}</span>,
    },
    {
      id: "window",
      label: "Valid",
      secondary: true,
      sortValue: (row) => row.expiresAt ?? "9999",
      render: (row) => <span className="whitespace-nowrap">{windowOf(row)}</span>,
    },
    {
      id: "status",
      label: "Status",
      sortValue: (row) => row.status,
      render: (row) => (
        <Chip size="sm" variant="soft" color={STATUS_STYLE[row.status].color}>
          {STATUS_STYLE[row.status].label}
        </Chip>
      ),
    },
    {
      id: "actions",
      label: "Actions",
      render: (row) => <DiscountRowActions discount={row} appUrl={appUrl} />,
    },
  ];
}

export function DiscountsTable({ rows, appUrl }: { rows: DiscountRow[]; appUrl: string }) {
  return (
    <DataTable
      label="Discounts"
      columns={columns(appUrl)}
      rows={rows}
      rowKey={(row) => row.id}
      initialSort="code"
      visibleRows={12}
    />
  );
}
