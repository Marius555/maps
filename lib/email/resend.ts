import "server-only";

import { Resend } from "resend";

import { PRODUCT_NAME } from "@/lib/config";
import { env } from "@/lib/env";

/**
 * The one place this app sends mail from.
 *
 * **Sending must never be able to fail a request.** Every caller is on the tail
 * of something the user already succeeded at — the account exists, the password
 * is changed, the address is confirmed — so a Resend outage turning a 201 into a
 * 500 would report the opposite of what happened and invite the user to sign up
 * twice. `sendEmail` therefore resolves `{ sent: false }` for every failure mode
 * and throws for none of them; the caller decides nothing.
 *
 * The client is built on first use rather than at module load, because
 * `new Resend("")` throws and this module is imported by routes that are
 * perfectly valid on an install with no key.
 */

let client: Resend | null = null;
let warned = false;

function getClient(): Resend | null {
  if (!env.resendApiKey) {
    if (!warned) {
      warned = true;
      console.warn(
        "RESEND_API_KEY is not set — transactional email is disabled. " +
          "Signup, password reset and verification still work; the messages are not sent.",
      );
    }
    return null;
  }

  client ??= new Resend(env.resendApiKey);
  return client;
}

/**
 * `from` carries the product name so the inbox shows "Map Embed", not a bare
 * address. Resend takes the `Name <addr>` form as-is.
 */
function sender(): string {
  return `${PRODUCT_NAME} <${env.emailFrom}>`;
}

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: SendEmailInput): Promise<{ sent: boolean }> {
  const resend = getClient();
  if (!resend) return { sent: false };

  try {
    // Resend reports failure in the payload rather than by throwing, so the
    // `error` branch is not an edge case — it is the ordinary way a bad key, an
    // unverified domain or a bounced recipient arrives.
    const { error } = await resend.emails.send({
      from: sender(),
      to,
      subject,
      html,
      text,
    });

    if (error) {
      console.error("Resend rejected an email:", error.name, error.message);
      return { sent: false };
    }

    return { sent: true };
  } catch (error) {
    // A network failure or a malformed payload still lands here.
    console.error("Failed to send an email:", error);
    return { sent: false };
  }
}
