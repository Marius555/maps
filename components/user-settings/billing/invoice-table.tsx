"use client";

import { buttonVariants, Pagination, Table } from "@heroui/react";
import { Download } from "lucide-react";
import { useState } from "react";

import type { Invoice, InvoicePage } from "@/lib/billing/types";
import { formatDate } from "@/lib/format/date";
import { useInvoices } from "@/lib/query/billing";
import { InvoiceStatus } from "./invoice-status";

const REASON: Record<Invoice["reason"], string> = {
  initial: "Subscription started",
  renewal: "Renewal",
  updated: "Plan change",
  other: "Payment",
};

/**
 * Held by every page but the last, so paging to a short final page does not
 * pull the pager up the screen under the pointer that just pressed it: the
 * header row plus ten 48px rows. A table's own body ignores `min-height`, which
 * is why it is on a wrapper outside the table.
 */
const FULL_PAGE_HEIGHT = "min-h-[calc(2.5rem+10*3rem)]";

/**
 * The invoices the provider has issued for this subscription, newest first,
 * each with its PDF.
 *
 * Page one comes rendered with the page. Later pages are fetched when asked,
 * and the page being left stays on screen, dimmed, until the next arrives
 * (`keepPreviousData`), so the table never empties under the pager. The pager
 * is only drawn when there is a second page. An account with ten invoices or
 * fewer never sees one, and one appearing later is a page load, not a shift.
 */
export function InvoiceTable({ firstPage }: { firstPage: InvoicePage }) {
  const [page, setPage] = useState(firstPage.page);
  const { data = firstPage, isPlaceholderData } = useInvoices(page, firstPage);
  const { invoices, lastPage } = data;

  if (invoices.length === 0 && page === 1) {
    return (
      <p className="text-sm text-muted">
        No invoices yet. Your first one appears here once a payment goes through.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className={lastPage > 1 ? FULL_PAGE_HEIGHT : undefined}>
        <Table
          aria-busy={isPlaceholderData || undefined}
          className={`transition-opacity duration-[var(--duration-fast)] ${isPlaceholderData ? "opacity-60" : ""}`}
        >
          <Table.ScrollContainer>
            {/* No minimum below `sm`: with Description hidden the four columns
                left fit a phone, and a table that scrolls sideways there would
                hide the download button off the edge. */}
            <Table.Content aria-label="Invoices" className="sm:min-w-[28rem]">
              <Table.Header>
                <Table.Column isRowHeader>Date</Table.Column>
                <Table.Column className="hidden sm:table-cell">Description</Table.Column>
                <Table.Column className="text-right">Amount</Table.Column>
                <Table.Column>Status</Table.Column>
                <Table.Column className="text-right">
                  <span className="sr-only">Invoice</span>
                </Table.Column>
              </Table.Header>

              <Table.Body>
                {invoices.map((invoice) => (
                  <Table.Row key={invoice.id} id={invoice.id} className="h-12">
                    <Table.Cell className="whitespace-nowrap tabular-nums">
                      {invoice.createdAt ? formatDate(invoice.createdAt) : "—"}
                    </Table.Cell>
                    <Table.Cell className="hidden text-muted sm:table-cell">
                      {REASON[invoice.reason]}
                    </Table.Cell>
                    <Table.Cell className="text-right whitespace-nowrap tabular-nums">
                      {invoice.total}
                    </Table.Cell>
                    <Table.Cell>
                      <InvoiceStatus status={invoice.status} />
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <InvoiceLink invoice={invoice} />
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </div>

      {lastPage > 1 ? (
        <Pagination size="sm" className="justify-between">
          <Pagination.Summary className="tabular-nums">
            Page {data.page} of {lastPage}
          </Pagination.Summary>
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous
                isDisabled={page <= 1}
                onPress={() => setPage((current) => Math.max(1, current - 1))}
              >
                <Pagination.PreviousIcon />
                Newer
              </Pagination.Previous>
            </Pagination.Item>
            <Pagination.Item>
              <Pagination.Next
                isDisabled={page >= lastPage}
                onPress={() => setPage((current) => Math.min(lastPage, current + 1))}
              >
                Older
                <Pagination.NextIcon />
              </Pagination.Next>
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>
      ) : null}
    </div>
  );
}

/**
 * The provider's PDF, in a new tab. Its link is signed and does not expire, so
 * it can be rendered into the page; there is none until a pending invoice is
 * paid.
 */
function InvoiceLink({ invoice }: { invoice: Invoice }) {
  if (!invoice.url) return <span className="text-sm text-muted">Not issued</span>;

  const date = invoice.createdAt ? formatDate(invoice.createdAt) : "this payment";

  return (
    <a
      href={invoice.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Download the invoice from ${date} (opens in a new tab)`}
      className={buttonVariants({ variant: "ghost", size: "sm" })}
    >
      <Download aria-hidden="true" className="size-4" />
      <span className="hidden sm:inline">Download</span>
    </a>
  );
}
