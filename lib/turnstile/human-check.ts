import "server-only";

import { env } from "@/lib/env";
import { clientIp } from "@/lib/rate-limit/ip";
import { HumanCheckError } from "@/lib/repositories/errors";
import { TURNSTILE_HEADER } from "./header";
import { checkTurnstile } from "./verify";

/**
 * The bot check in front of the two forms that send a stranger an email:
 * signup (a confirmation) and forgot-password (a reset link).
 *
 * **Why these two.** From 2026-10-24 a bot typed strangers' real addresses into
 * signup — 127 accounts in nine days, every one a confirmation email from our
 * domain to somebody who never asked — and asked for a reset on 27 of them.
 * Nothing got in, because an unconfirmed account cannot write; the damage was
 * our sending reputation, which the email gate makes load-bearing (a
 * confirmation in junk is a customer who cannot use the product).
 * docs/notes/auth.md, "Bot signups".
 *
 * Called first in each handler, after `withoutAuth`'s IP rate limit and before
 * `parseBody`, so a refused bot never costs the DNS and DeBounce lookups
 * `signupServerSchema` makes. On forgot-password the refusal describes the
 * caller, never the address, so the identical-answer rule is untouched — the
 * same argument its 429 makes.
 */

let warnedHalfConfigured = false;

/**
 * Whether the check runs at all: both halves configured.
 *
 * One without the other is a misconfiguration, and the safe reading of it is
 * "off" — a secret with no site key would refuse every signup, because no form
 * could produce a token. Warned once so it does not pass unnoticed.
 */
export function turnstileActive(): boolean {
  const secret = Boolean(env.turnstileSecretKey);
  const siteKey = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  if (secret !== siteKey && !warnedHalfConfigured) {
    warnedHalfConfigured = true;
    console.warn(
      "Only one of TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, so the signup bot check is off. Set both or neither.",
    );
  }

  return secret && siteKey;
}

/** Throws `HumanCheckError` unless the request carries a passing token. */
export async function assertHuman(request: Request): Promise<void> {
  if (!turnstileActive()) return;

  const verdict = await checkTurnstile({
    secret: env.turnstileSecretKey,
    token: request.headers.get(TURNSTILE_HEADER),
    ip: clientIp(request.headers),
  });

  if (verdict === "fail") throw new HumanCheckError();
}
