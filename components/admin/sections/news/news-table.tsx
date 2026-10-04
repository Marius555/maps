"use client";

import { Chip } from "@heroui/react";
import Link from "next/link";

import { DataTable, type DataColumn } from "@/components/analytics/tables/data-table";
import { formatDate } from "@/lib/admin/format";
import type { NewsTableRow } from "@/lib/admin/metrics/news";
import { NEWS_CATEGORY_LABELS, newsHref } from "@/lib/news/types";
import { NewsRowActions } from "./news-row-actions";
import { NEWS_STATUS_STYLE } from "./news-status";

const COLUMNS: DataColumn<NewsTableRow>[] = [
  {
    id: "title",
    label: "Post",
    isRowHeader: true,
    sortValue: (row) => row.title,
    render: (row) => (
      <span className="flex min-w-0 max-w-sm flex-col">
        <Link
          href={`/admin/news/${row.id}`}
          className="truncate rounded-sm font-medium text-foreground hover:underline"
        >
          {row.title}
        </Link>
        <span className="truncate text-xs text-muted">{newsHref(row.slug)}</span>
      </span>
    ),
  },
  {
    id: "category",
    label: "Category",
    secondary: true,
    sortValue: (row) => row.category,
    render: (row) => (
      <span className="whitespace-nowrap">{NEWS_CATEGORY_LABELS[row.category]}</span>
    ),
  },
  {
    id: "status",
    label: "Status",
    sortValue: (row) => row.status,
    render: (row) => (
      <Chip size="sm" variant="soft" color={NEWS_STATUS_STYLE[row.status].color}>
        {NEWS_STATUS_STYLE[row.status].label}
      </Chip>
    ),
  },
  {
    id: "publishedAt",
    label: "Published",
    sortValue: (row) => row.publishedAt ?? "",
    render: (row) => <span className="whitespace-nowrap">{formatDate(row.publishedAt)}</span>,
  },
  {
    id: "actions",
    label: "Actions",
    render: (row) => <NewsRowActions post={row} />,
  },
];

export function NewsTable({ rows }: { rows: NewsTableRow[] }) {
  return (
    <DataTable
      label="News posts"
      columns={COLUMNS}
      rows={rows}
      rowKey={(row) => row.id}
      initialSort="publishedAt"
      visibleRows={12}
    />
  );
}
