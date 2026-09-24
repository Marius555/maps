import { buttonVariants } from "@heroui/react";
import { ExternalLink } from "lucide-react";

import { SettingsRow, SettingsRows } from "@/components/user-settings/section/settings-row";
import type { PaymentMethod as Payment } from "@/lib/billing/types";

const BRANDS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  jcb: "JCB",
  diners: "Diners Club",
  unionpay: "UnionPay",
};

/**
 * How the subscription is paid, and the two things about it that stay with the
 * provider.
 *
 * **Both buttons open the provider's own pages, in a new tab.** The card form
 * and the billing address are the merchant of record's, which is the reason for
 * having one: card numbers never touch this app, and the VAT on an invoice is
 * computed from an address they hold. A new tab, so this page is still here
 * afterwards and a Back button does not have to find its way home across
 * somebody else's site.
 *
 * Plain anchors rather than `LinkButton`: these leave the app for a signed URL
 * on another domain, and prefetching one would spend a signature nobody pressed.
 * The URLs are good for 24 hours from the page load that fetched them.
 */
export function PaymentMethod({
  payment,
  updatePaymentUrl,
  portalUrl,
}: {
  payment: Payment | null;
  updatePaymentUrl: string | null;
  portalUrl: string | null;
}) {
  return (
    <SettingsRows>
      <SettingsRow label="Payment method" description={describe(payment)}>
        {updatePaymentUrl ? (
          <ExternalButton href={updatePaymentUrl}>Update</ExternalButton>
        ) : null}
      </SettingsRow>

      <SettingsRow
        label="Billing details"
        description="Billing address, tax ID, and the email your receipts go to."
      >
        {portalUrl ? <ExternalButton href={portalUrl}>Edit</ExternalButton> : null}
      </SettingsRow>
    </SettingsRows>
  );
}

function describe(payment: Payment | null): string {
  if (!payment?.method) return "Not available right now. Refresh in a moment to try again.";
  if (payment.method === "paypal") return "PayPal";

  const brand = payment.brand ? (BRANDS[payment.brand] ?? capitalise(payment.brand)) : "Card";

  return payment.lastFour ? `${brand} ending in ${payment.lastFour}` : brand;
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function ExternalButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonVariants({ variant: "secondary", size: "sm" })}
    >
      {children}
      <ExternalLink aria-hidden="true" className="size-3.5" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
