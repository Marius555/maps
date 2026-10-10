import { AuthShell } from "@/components/auth/auth-shell";
import { LinkButton } from "@/components/ui/link-button";

/**
 * The first visit from WordPress, usually: no account yet. Sign up first,
 * because that is who arrives here most often; both doors bring the owner back
 * to this page through `?next=`.
 */
export function SignedOutPanel({ host, selfPath }: { host: string; selfPath: string }) {
  const next = encodeURIComponent(selfPath);

  return (
    <AuthShell
      title="Connect your WordPress site"
      description={`Create a free account to fill the map on ${host} with your locations. You'll come straight back here.`}
    >
      <div className="space-y-3">
        <LinkButton href={`/signup?next=${next}`} fullWidth>
          Create account
        </LinkButton>
        <LinkButton href={`/login?next=${next}`} variant="outline" fullWidth>
          Log in
        </LinkButton>
      </div>
    </AuthShell>
  );
}
