import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { InviteFlow } from "@/components/team/invite/invite-flow";
import { readPeople } from "@/lib/auth/people";
import { findInviteByToken, isLive } from "@/lib/repositories/invites.repository";
import { isInviteToken } from "@/lib/team/token";

/**
 * `referrer: "no-referrer"` because the token is in this page's own address:
 * any link out of it would otherwise hand the next site a working invite.
 */
export const metadata: Metadata = {
  title: "Join a team",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Where an invite email's button lands. docs/notes/team.md has the whole flow.
 *
 * **In the `(auth)` group, outside `proxy.ts`'s matcher, and it has to be** —
 * the same reason as /connect/wordpress. The click comes from a mail client, so
 * the browser withholds our `sameSite: "strict"` session cookie from this
 * request: a server-side session check here would see nobody and send a
 * signed-in person to the login page. So the server only reads the invite, and
 * `InviteFlow` asks who is signed in with a same-origin `fetch`.
 *
 * The invite is read before anyone signs in, so a dead link says so at once
 * rather than after a signup.
 */
export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;
  const invite = isInviteToken(token) ? await findInviteByToken(token) : null;

  if (!invite || !isLive(invite)) {
    return (
      <AuthShell
        title="This invite isn't valid any more"
        description="It may have expired, been taken back, or already been used. Ask whoever sent it for a new one."
        footer={
          <Link href="/maps" className="text-foreground underline">
            Go to your maps
          </Link>
        }
      >
        {null}
      </AuthShell>
    );
  }

  const people = await readPeople([invite.workspaceId, invite.invitedBy]);

  return (
    <InviteFlow
      token={token}
      email={invite.email}
      role={invite.role}
      teamName={people.get(invite.workspaceId)?.name ?? ""}
      inviterName={people.get(invite.invitedBy)?.name ?? ""}
    />
  );
}
