import { PRODUCT_NAME } from "@/lib/config";
import { ROLE_LABEL, type MemberRole } from "@/lib/team/roles";
import { emailShell, emailText, type EmailShellInput } from "./layout";

/**
 * An invitation to work on somebody's maps.
 *
 * **The subject is fixed**, and the names live only in the body. Both names
 * are typed by somebody other than the recipient — the inviter's own name, and
 * the workspace's, which is its owner's — so a subject built from them would
 * let anyone with an account write the first line of an email we send to an
 * address of their choosing. The body escapes them (`emailShell`) and caps their
 * length, which is as much of a stranger's words as a transactional email
 * should carry.
 */

/** Longer than this and it is not a name. */
const NAME_MAX = 60;

function capped(value: string): string {
  const trimmed = value.trim();

  return trimmed.length > NAME_MAX ? `${trimmed.slice(0, NAME_MAX - 1)}…` : trimmed;
}

export const INVITE_SUBJECT = `You're invited to a team on ${PRODUCT_NAME}`;

export function inviteMessage({
  inviterName,
  workspaceName,
  role,
  url,
}: {
  inviterName: string;
  workspaceName: string;
  role: MemberRole;
  url: string;
}): { subject: string; html: string; text: string } {
  const inviter = capped(inviterName) || "Someone";
  const team = capped(workspaceName);
  const roleLabel = ROLE_LABEL[role].toLowerCase();

  const content: EmailShellInput = {
    title: "Join the team",
    intro: [
      `${inviter} invited you to work on ${team ? `${team}'s` : "their"} maps on ${PRODUCT_NAME}, as ${roleLabel === "admin" ? "an" : "a"} ${roleLabel}.`,
      "Accept with the account that uses this email address. If you don't have one yet, you can create it on the way.",
    ],
    cta: { label: "Accept invitation", url },
    outro: [
      "The link works for 7 days.",
      "Not expecting this? Ignore it — nothing happens unless you accept.",
    ],
  };

  return {
    subject: INVITE_SUBJECT,
    html: emailShell(content),
    text: emailText(content),
  };
}
