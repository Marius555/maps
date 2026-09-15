import { BRAND } from "@/lib/brand";

/**
 * Who runs the product: © line, registered details and a contact address.
 *
 * The © line falls back to the product name, so it is never empty; every line
 * after it appears only once brand.json has a value for it.
 */
export function CompanyDetails() {
  const { company, contact, name } = BRAND;

  return (
    <div className="space-y-1">
      <p className="text-foreground">
        © {new Date().getFullYear()} {company.legalName ?? name}
      </p>

      {company.address ? (
        <p className="whitespace-pre-line">{company.address}</p>
      ) : null}

      {company.registrationNumber ? (
        <p>Company no. {company.registrationNumber}</p>
      ) : null}

      {company.vatNumber ? <p>VAT {company.vatNumber}</p> : null}

      {contact.supportEmail ? (
        <p>
          <a
            href={`mailto:${contact.supportEmail}`}
            className="transition-colors hover:text-foreground"
          >
            {contact.supportEmail}
          </a>
        </p>
      ) : null}
    </div>
  );
}
