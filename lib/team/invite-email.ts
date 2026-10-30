import "server-only";

import { readPeople } from "@/lib/auth/people";
import { sendEmail } from "@/lib/email/resend";
import { inviteMessage } from "@/lib/email/templates/invite";
import { env } from "@/lib/env";
import type { RepoContext } from "@/lib/repositories/context";
import type { Invite } from "./types";

/**
 * Where an invite link points. Built from `env.appUrl`, never from the request
 * (docs/notes/auth.md): a Host header is the caller's to choose, and a link
 * built from one would send the token wherever they pointed it.
 *
 * `/invite/<token>` is outside `proxy.ts`'s matcher on purpose — a link opened
 * from a mail client arrives without the `sameSite: "strict"` session cookie,
 * and a page inside the matcher would bounce a signed-in person to /login.
 */
export function inviteUrl(token: string): string {
  return new URL(`/invite/${token}`, env.appUrl).toString();
}

/**
 * Send the invite email. **Never throws**: the invite exists whether or not the
 * mail went out, and the inviter has Copy link and Resend for exactly that
 * case — the rule every email in the app keeps (docs/notes/auth.md).
 */
export async function sendInviteEmail(
  ctx: RepoContext,
  invite: Invite,
  token: string,
): Promise<void> {
  try {
    const people = await readPeople([ctx.workspaceId, ctx.actorId]);

    await sendEmail({
      template: "invite",
      to: invite.email,
      ...inviteMessage({
        inviterName: people.get(ctx.actorId)?.name ?? "",
        workspaceName: people.get(ctx.workspaceId)?.name ?? "",
        role: invite.role,
        url: inviteUrl(token),
      }),
    });
  } catch (error) {
    console.error("An invite was created but its email did not send:", error);
  }
}
