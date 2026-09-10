import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  // The URL of this page carries a live credential.
  robots: { index: false, follow: false },
};

/**
 * The target of the reset email's link.
 *
 * Outside `proxy.ts`'s matcher on purpose, and this is the case a naive
 * `AUTH_PATHS` entry would get wrong: someone who is *already signed in* on this
 * browser is allowed to follow a reset link, so the proxy's
 * "has session → go to /maps" rule must not apply here.
 */
export default async function ResetPasswordPage(
  props: PageProps<"/reset-password">,
) {
  const { userId, secret } = await props.searchParams;

  if (typeof userId !== "string" || typeof secret !== "string") {
    return (
      <AuthShell
        title="That link is incomplete"
        description="Some mail clients cut long links in half. Ask for a fresh one and open it in a single click."
      >
        <p className="text-sm text-muted">
          <Link href="/forgot-password" className="text-foreground underline">
            Ask for a new link
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      description="You'll be signed in as soon as it's saved."
    >
      <ResetPasswordForm userId={userId} secret={secret} />
    </AuthShell>
  );
}
