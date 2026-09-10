import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import { LinkButton } from "@/components/ui/link-button";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
};

/**
 * Where `/api/auth/verify-email` sends people, and the whole vocabulary of that
 * route's outcomes.
 *
 * **This page exists because the session cookie is `sameSite: "strict"`.** The
 * click arrives from a mail client, which makes it a cross-site navigation —
 * a classification browsers carry through a server redirect chain. Had the route
 * handler redirected straight to `/maps`, `proxy.ts` would have seen a request
 * with no cookie on it and bounced a user who had just been signed in. This page
 * is outside the proxy's matcher, so it renders; the button on it is a same-site
 * navigation, which does carry the cookie.
 *
 * `expired` covers spent, timed out and never-valid together, because they are
 * indistinguishable to the person holding the link and the way out of all three
 * is the same.
 */
export default async function VerifyEmailPage(props: PageProps<"/verify-email">) {
  const { status } = await props.searchParams;

  if (status === "ok") {
    return (
      <AuthShell
        title="Email confirmed"
        description="You're signed in and ready to build your first map."
      >
        <LinkButton href="/maps" fullWidth>
          Go to your maps
        </LinkButton>
      </AuthShell>
    );
  }

  if (status === "expired") {
    return (
      <AuthShell
        title="That link has expired"
        description="Confirmation links work once and last 24 hours. Enter your email and we'll send a fresh one."
        footer={
          <Link href="/login" className="text-foreground underline">
            Back to log in
          </Link>
        }
      >
        <ResendVerificationForm />
      </AuthShell>
    );
  }

  // Reached by typing the URL, or by someone who deleted the email. Same form,
  // stated as the ordinary thing it is rather than as a failure.
  return (
    <AuthShell
      title="Confirm your email"
      description="Enter your address and we'll send the confirmation link again."
      footer={
        <Link href="/login" className="text-foreground underline">
          Back to log in
        </Link>
      }
    >
      <ResendVerificationForm />
    </AuthShell>
  );
}
