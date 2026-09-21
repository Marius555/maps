import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import { LinkButton } from "@/components/ui/link-button";
import { ResendLinkButton } from "@/components/verify-email/resend-link-button";
import { getCurrentUser } from "@/lib/auth/current-user";

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
 *
 * `sent` is the odd one out: it is not an outcome of that route at all, it is
 * where signup lands. The visitor is **signed in** when they see it, which is why
 * it is the one branch that can name the address instead of asking for it, and the
 * one that needs no link off it — the others end on *Back to log in* because their
 * visitor may be anybody.
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

  if (status === "sent") return <JustSignedUp />;

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

/**
 * Straight after signup: the account exists, the mail is on its way, and nothing
 * in the dashboard will save until the link is opened.
 *
 * Reads the session rather than a query parameter, so the address on screen is
 * the one the account actually has — a signup that landed here having corrected
 * a typo in the form would otherwise be told to check the wrong inbox. If there
 * is somehow no session (a shared link, a cookie that did not stick) it falls
 * through to the ordinary resend form rather than guessing.
 *
 * **There is no way past this screen offered here.** The action worth pressing is
 * in a mail client, and an exit into a dashboard where nothing will save is not
 * an exit — the app shell's own banner picks the visitor up once they go there by
 * themselves. So the only control is the one that sends the mail again, centred
 * under the heading because it is the only thing on the column.
 */
async function JustSignedUp() {
  const user = await getCurrentUser();

  if (!user) {
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

  return (
    <AuthShell
      title="Check your inbox"
      description={`We sent a confirmation link to ${user.email}. Open it and your account is ready — until then nothing you change will save.`}
    >
      <ResendLinkButton email={user.email} size="md" variant="secondary" align="center" />
    </AuthShell>
  );
}
