import { BRAND } from "@/lib/brand";

/**
 * Who runs the product: a contact address, then the ©.
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
      {contact.supportEmail ? (
        <p>
          <a
            href={`mailto:${contact.supportEmail}`}
            className="rounded-sm transition-colors hover:text-foreground"
          >
            {contact.supportEmail}
          </a>
        </p>
      ) : null}

      <p>
        © {new Date().getFullYear()} {name}
      </p>
    </div>
  );
}
