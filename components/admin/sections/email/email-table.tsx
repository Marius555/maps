"use client";

import { Chip, Tooltip } from "@heroui/react";

import { DataTable, type DataColumn } from "@/components/analytics/tables/data-table";
import { TEMPLATE_COLOR } from "@/lib/admin/colors";
import { formatDateTime } from "@/lib/admin/format";
import type { EmailMetrics } from "@/lib/admin/metrics/email";

type Row = EmailMetrics["recent"][number];

const TEMPLATE_LABEL: Record<string, string> = {
  verify: "Confirm address",
  welcome: "Welcome",
  reset: "Password reset",
  support: "Support request",
};

const COLUMNS: DataColumn<Row>[] = [
  {
    id: "sent",
    label: "Sent",
    isRowHeader: true,
    sortValue: (row) => row.sentAt,
    render: (row) => <span className="whitespace-nowrap">{formatDateTime(row.sentAt)}</span>,
  },
  {
    id: "template",
    label: "Email",
    sortValue: (row) => row.template,
    render: (row) => (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span
          aria-hidden="true"
          className="size-2 rounded-full"
          style={{ background: TEMPLATE_COLOR[row.template] }}
        />
        {TEMPLATE_LABEL[row.template] ?? row.template}
      </span>
    ),
  },
  {
    id: "to",
    label: "To",
    secondary: true,
    sortValue: (row) => row.recipient,
    render: (row) => <span className="text-muted">{row.recipient}</span>,
  },
  {
    id: "result",
    label: "Result",
    sortValue: (row) => (row.ok ? 1 : 0),
    render: (row) =>
      row.ok ? (
        <Chip size="sm" variant="soft" color="success">
          Sent
        </Chip>
      ) : (
        <FailureChip error={row.error} />
      ),
  },
];

/** A failure, with Resend's reason on hover or focus when there is one. */
function FailureChip({ error }: { error: string | null | undefined }) {
  const chip = (
    <Chip size="sm" variant="soft" color="danger">
      {error === "not_configured" ? "No API key" : "Failed"}
    </Chip>
  );

  if (!error || error === "not_configured") return chip;

  return (
    <Tooltip delay={0}>
      <Tooltip.Trigger tabIndex={0} aria-label={`Failed: ${error}`} className="inline-flex rounded-full">
        {chip}
      </Tooltip.Trigger>
      <Tooltip.Content className="max-w-72">{error}</Tooltip.Content>
    </Tooltip>
  );
}

export function EmailTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">No emails in this period.</p>;
  }

  return (
    <DataTable
      label="Recent emails"
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => row.id}
      initialSort="sent"
      visibleRows={10}
    />
  );
}
