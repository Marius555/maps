import type { Metadata } from "next";

import { AdminEmpty } from "@/components/admin/kpi/admin-empty";
import { DiscountsTable } from "@/components/admin/sections/discounts/discounts-table";
import { NewDiscountButton } from "@/components/admin/sections/discounts/new-discount-button";
import { SectionCard } from "@/components/analytics/dashboard/section-card";
import { requireAdminPage } from "@/lib/admin/auth/guard";
import { loadDiscounts } from "@/lib/admin/metrics/discounts";

export const metadata: Metadata = { title: "Discounts" };

/**
 * Discount codes, made and deleted at the payment provider and read live from
 * it — there is no copy in Appwrite. docs/notes/billing.md, "Discounts".
 */
export default async function AdminDiscountsPage() {
  await requireAdminPage();

  const { discounts, error, appUrl } = await loadDiscounts();

  return (
    <SectionCard
      title="Discounts"
      hint="Codes customers enter at the checkout. Dates are UTC; uses count every customer."
      action={<NewDiscountButton />}
    >
      {error ? (
        <p className="py-6 text-sm text-danger">Couldn&apos;t read the discounts: {error}</p>
      ) : discounts.length === 0 ? (
        <AdminEmpty>No discounts yet. Press New discount to make the first one.</AdminEmpty>
      ) : (
        <DiscountsTable rows={discounts} appUrl={appUrl} />
      )}
    </SectionCard>
  );
}
