"use client";

import { Chip } from "@heroui/react";
import Link from "next/link";

import { DataTable, type DataColumn } from "@/components/analytics/tables/data-table";
import { PLAN_COLOR } from "@/lib/admin/colors";
import { formatDate } from "@/lib/admin/format";
import type { UserRow } from "@/lib/admin/metrics/users";

const PLAN_LABEL: Record<string, string> = { free: "Free", starter: "Starter", pro: "Pro" };

const COLUMNS: DataColumn<UserRow>[] = [
  {
    id: "user",
    label: "Account",
    isRowHeader: true,
    sortValue: (row) => row.email,
    render: (row) => (
      <Link
        href={`/admin/users/${row.id}`}
        className="block min-w-0 rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span className="block truncate font-medium text-foreground">{row.name || "—"}</span>
        <span className="block truncate text-xs text-muted">{row.email}</span>
      </Link>
    ),
  },
  {
    id: "plan",
    label: "Plan",
    sortValue: (row) => row.plan,
    render: (row) => (
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="size-2 rounded-full"
          style={{ background: PLAN_COLOR[row.plan] }}
        />
        {PLAN_LABEL[row.plan] ?? row.plan}
      </span>
    ),
  },
  {
    id: "maps",
    label: "Maps",
    numeric: true,
    sortValue: (row) => row.maps - row.mapLimit,
    render: (row) =>
      row.maps > row.mapLimit ? (
        <span className="font-medium text-danger">
          {row.maps} / {row.mapLimit} <span className="text-xs">over</span>
        </span>
      ) : (
        `${String(row.maps)} / ${String(row.mapLimit)}`
      ),
  },
  {
    id: "status",
    label: "Address",
    secondary: true,
    sortValue: (row) => (row.verified ? 1 : 0),
    render: (row) => (
      <Chip size="sm" variant="soft" color={row.verified ? "success" : "warning"}>
        {row.verified ? "Confirmed" : "Unconfirmed"}
      </Chip>
    ),
  },
  {
    id: "method",
    label: "Sign-in",
    secondary: true,
    sortValue: (row) => row.method,
    render: (row) => (row.method === "email" ? "Email" : "Google"),
  },
  {
    id: "created",
    label: "Joined",
    numeric: true,
    sortValue: (row) => row.createdAt,
    render: (row) => formatDate(row.createdAt),
  },
  {
    id: "active",
    label: "Last active",
    numeric: true,
    secondary: true,
    sortValue: (row) => row.accessedAt,
    render: (row) => formatDate(row.accessedAt),
  },
];

export function UsersTable({ users }: { users: UserRow[] }) {
  return (
    <DataTable
      label="Accounts"
      columns={COLUMNS}
      rows={users}
      rowKey={(row) => row.id}
      initialSort="created"
      visibleRows={12}
    />
  );
}
