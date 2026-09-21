"use client";

import { useMe } from "@/lib/query/auth";
import { ControlNote } from "@/components/ui/control-note";
import { emailUnverifiedNote } from "@/lib/repositories/errors";

/**
 * Why *this* control is greyed, said beside it.
 *
 * The banner in the shell carries the full explanation and the button that fixes
 * it; this is the one line that has to be within reading distance of the disabled
 * control itself. Both are needed, and the reason is written down in
 * lib/query/plan-limit-toast.ts: a grey button with its explanation somewhere
 * else on the page is a grey button. Publish in particular lives in a sidebar
 * footer that is often scrolled well away from the top of the window.
 *
 * `emailUnverifiedNote` is the same composer the 403 builds its message from, so
 * the sentence under the button and the sentence in the refusal can never
 * describe the same state differently — the rule `planLimitUsage` already
 * enforces for plan limits.
 *
 * Renders nothing when the address is confirmed, so callers can mount it
 * unconditionally.
 */
export function VerifyEmailNotice({ id }: { id: string }) {
  const me = useMe();
  const user = me.data?.user;

  if (!user || user.emailVerified) return null;

  return <ControlNote id={id}>{emailUnverifiedNote(user.email)}</ControlNote>;
}

/**
 * Whether the signed-in account is blocked from writing anything.
 *
 * `false` while `useMe()` is still loading, which is deliberate and is the rule
 * every caller follows: the server owns the decision either way, so a button that
 * is briefly live and then fails honestly costs a moment, while a confirmed
 * customer staring at a permanently dead control costs a support ticket.
 */
export function useEmailUnverified(): boolean {
  const me = useMe();
  return me.data ? !me.data.user.emailVerified : false;
}
