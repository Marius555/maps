import { BRAND } from "@/lib/brand";

/**
 * Who runs the product: © line and a contact address.
 *
 * Deliberately not `brand.json`'s `company.*`. The service is run as an
 * individuali veikla, so those fields are a person's name and certificate
 * number, and the owner keeps them on the legal pages only — Terms §1 is what
 * carries the details the law requires (`documents/company.md`).
 */
export function CompanyDetails() {
  const { contact, name } = BRAND;

  return (
    <div className="space-y-1">
      <p className="text-foreground">
        © {new Date().getFullYear()} {name}
      </p>

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
