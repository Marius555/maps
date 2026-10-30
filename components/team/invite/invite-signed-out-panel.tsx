import { AuthShell } from "@/components/auth/auth-shell";
import { LinkButton } from "@/components/ui/link-button";

/**
 * Nobody signed in. Log in first here, unlike the WordPress page: an invitee is
 * as likely to have an account already as not, and the invite names the address
 * they should use either way. Both doors bring them back through `?next=`,
 * whose path carries the token — `proxy.ts` drops query strings, paths survive.
 */
export function InviteSignedOutPanel({
  title,
  email,
  selfPath,
}: {
  title: string;
  email: string;
  selfPath: string;
}) {
  const next = encodeURIComponent(selfPath);

  return (
    <AuthShell
      title={title}
      description={`This invitation is for ${email}. Log in with that address, or create an account with it — you'll come straight back here.`}
    >
      <div className="space-y-3">
        <LinkButton href={`/login?next=${next}`} fullWidth>
          Log in
        </LinkButton>
        <LinkButton href={`/signup?next=${next}`} variant="outline" fullWidth>
          Create account
        </LinkButton>
      </div>
    </AuthShell>
  );
}
