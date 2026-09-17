import { LegalPage, legalMetadata } from "@/components/legal/legal-page";

export const metadata = legalMetadata("dpa");

export default function DpaPage() {
  return <LegalPage slug="dpa" />;
}
