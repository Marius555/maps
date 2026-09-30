/**
 * `wanmarius@gmail.com` → `wa•••@gmail.com`.
 *
 * What the email log stores instead of the address: enough to match a row to a
 * "I never got the email" complaint, not a second copy of the user list sitting
 * in a table that exists for charts. The domain stays whole because it is the
 * part that explains most delivery failures.
 */
export function maskEmail(address: string): string {
  const at = address.lastIndexOf("@");
  if (at <= 0) return "•••";

  const local = address.slice(0, at);
  const domain = address.slice(at + 1).toLowerCase();
  const kept = local.slice(0, Math.min(2, Math.max(1, local.length - 1)));

  return `${kept}•••@${domain}`.slice(0, 128);
}
