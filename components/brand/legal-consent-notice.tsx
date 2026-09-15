import { BRAND } from "@/lib/brand";
import { BrandLink } from "./brand-link";

/**
 * "By continuing, you agree to our Terms and Privacy Policy."
 *
 * A notice rather than a checkbox, and "continuing" rather than "creating an
 * account", because it has to cover two buttons: the form's own, and Continue
 * with Google — which creates an account on first press from the login page as
 * well as from signup, with no form to put a checkbox in.
 *
 * Built from whichever of the two links brand.json has, and not drawn at all
 * with neither: a sentence asking someone to agree to terms nobody can read is
 * worse than no sentence.
 */
export function LegalConsentNotice() {
  const { termsUrl, privacyUrl } = BRAND.legal;
  if (!termsUrl && !privacyUrl) return null;

  const link = "text-foreground underline";

  return (
    <p className="text-xs text-pretty text-muted">
      By continuing, you agree to our{" "}
      {termsUrl ? (
        <BrandLink href={termsUrl} className={link}>
          Terms of Service
        </BrandLink>
      ) : null}
      {termsUrl && privacyUrl ? " and " : null}
      {privacyUrl ? (
        <BrandLink href={privacyUrl} className={link}>
          Privacy Policy
        </BrandLink>
      ) : null}
      .
    </p>
  );
}
