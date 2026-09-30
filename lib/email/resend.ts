import "server-only";

import { Resend } from "resend";

import { PRODUCT_NAME } from "@/lib/config";
import { env } from "@/lib/env";
import { maskEmail } from "./mask";

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
          "Signup and password reset still work; the messages are not sent. " +
          "The confirm-your-email gate is off too, since no link could ever arrive " +
          "to open it (lib/auth/email-gate.ts).",
      );
    }
    return null;
  }

  client ??= new Resend(env.resendApiKey);
  return client;
}

/**
 * `from` carries the product name from brand.json, so the inbox shows a name
 * rather than a bare address. Resend takes the `Name <addr>` form as-is.
 */
function sender(): string {
  return `${PRODUCT_NAME} <${env.emailFrom}>`;
}

/**
 * Which message this is, for the operator console's email log. One per
 * template in `./templates`; required so a new caller cannot send unlabelled.
 */
export type EmailTemplate = "verify" | "welcome" | "reset" | "support";

export type SendEmailInput = {
  template: EmailTemplate;
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Where a reply goes, when that is not us — a bug report answers its reporter. */
  replyTo?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<{ sent: boolean }> {
  const outcome = await deliver(input);

  await logSend(input, outcome);

  return { sent: outcome.error === null };
}

async function deliver({
  to,
  subject,
  html,
  text,
  replyTo,
}: SendEmailInput): Promise<{ error: string | null }> {
  const resend = getClient();
  if (!resend) return { error: "not_configured" };

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
      ...(replyTo ? { replyTo } : {}),
    });

    if (error) {
      console.error("Resend rejected an email:", error.name, error.message);
      return { error: `${error.name}: ${error.message}` };
    }

    return { error: null };
  } catch (error) {
    // A network failure or a malformed payload still lands here.
    console.error("Failed to send an email:", error);
    return { error: error instanceof Error ? error.message : "send_failed" };
  }
}

/**
 * One row in the email log, after the send has its answer.
 *
 * Awaited rather than floated — every caller already runs inside `after()` or
 * has finished its own work, and a floating write can be cut off with the
 * invocation — but it can never fail the send: a logging failure is logged and
 * dropped. The recipient is masked before it leaves this function.
 */
async function logSend(
  { template, to, subject }: SendEmailInput,
  { error }: { error: string | null },
): Promise<void> {
  if (process.env.NODE_ENV === "test") return;

  try {
    const { writeEmailLog } = await import("@/lib/repositories/email-log.repository");
    const now = new Date();

    await writeEmailLog({
      sentAt: now.toISOString(),
      day: now.toISOString().slice(0, 10),
      template,
      ok: error === null,
      error,
      recipient: maskEmail(to),
      subject,
    });
  } catch (logError) {
    console.error("Couldn't write the email log:", logError);
  }
}
