"use client";

import { Chip, Tooltip } from "@heroui/react";

import { DataTable, type DataColumn } from "@/components/analytics/tables/data-table";
import { NOTIFICATION_KIND_STYLE } from "@/components/notifications/notification-kind";
import { formatDateTime } from "@/lib/admin/format";
import type { SentNotificationRow, SentStatus } from "@/lib/admin/metrics/notifications";
import { DeleteNotificationButton } from "./delete-notification-button";
import { PLAN_NAMES } from "./notification-options";

const STATUS: Record<SentStatus, { label: string; color: "success" | "accent" | "default" }> = {
  live: { label: "Live", color: "success" },
  scheduled: { label: "Scheduled", color: "accent" },
  expired: { label: "Expired", color: "default" },
};

function audienceOf(row: SentNotificationRow): string {
  if (row.audience === "all") return "Everyone";
  if (row.audience === "plan") {
    return row.audiencePlans.map((plan) => PLAN_NAMES[plan] ?? plan).join(", ") || "No plan";
  }

  return row.recipientEmail ?? "Deleted account";
}

const COLUMNS: DataColumn<SentNotificationRow>[] = [
  {
    id: "title",
    label: "Notification",
    isRowHeader: true,
    render: (row) => (
      <span className="flex min-w-0 max-w-md flex-col">
        <span className="truncate font-medium text-foreground">{row.title}</span>
        <span className="truncate text-xs text-muted">{row.body}</span>
      </span>
    ),
  },
  {
    id: "sent",
    label: "Send time",
    sortValue: (row) => row.publishedAt,
    render: (row) => <span className="whitespace-nowrap">{formatDateTime(row.publishedAt)}</span>,
  },
  {
    id: "kind",
    label: "Kind",
    secondary: true,
    sortValue: (row) => row.kind,
    render: (row) => {
      const style = NOTIFICATION_KIND_STYLE[row.kind];
      const Icon = style.icon;

      return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className={`grid size-5 place-items-center rounded-full ${style.className}`}>
            <Icon aria-hidden="true" className="size-3" />
          </span>
          {style.label}
        </span>
      );
    },
  },
  {
    id: "audience",
    label: "Sent to",
    sortValue: audienceOf,
    render: (row) => <span className="whitespace-nowrap">{audienceOf(row)}</span>,
  },
  {
    id: "status",
    label: "Status",
    sortValue: (row) => row.status,
    render: (row) => {
      const chip = (
        <Chip size="sm" variant="soft" color={STATUS[row.status].color}>
          {STATUS[row.status].label}
        </Chip>
      );

      if (!row.expiresAt) return chip;

      const expiry = `${row.status === "expired" ? "Expired" : "Expires"} ${formatDateTime(row.expiresAt)} UTC`;

      return (
        <Tooltip delay={0}>
          <Tooltip.Trigger tabIndex={0} aria-label={`${STATUS[row.status].label}. ${expiry}`} className="inline-flex rounded-full">
            {chip}
          </Tooltip.Trigger>
          <Tooltip.Content>{expiry}</Tooltip.Content>
        </Tooltip>
      );
    },
  },
  {
    id: "actions",
    label: "Actions",
    render: (row) => <DeleteNotificationButton id={row.id} title={row.title} />,
  },
];

export function SentNotificationsTable({ rows }: { rows: SentNotificationRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">Nothing sent yet. Write the first one above.</p>;
  }

  return (
    <DataTable
      label="Sent notifications"
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => row.id}
      initialSort="sent"
      visibleRows={10}
    />
  );
}
