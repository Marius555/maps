import { LegalPage, legalMetadata } from "@/components/legal/legal-page";

export const metadata = legalMetadata("refunds");

export default function RefundsPage() {
  return <LegalPage slug="refunds" />;
}
