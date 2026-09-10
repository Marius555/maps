import { emailShell, emailText, type EmailShellInput } from "./layout";

/**
 * Confirm your address.
 *
 * Sent once at signup, and again on request from `/verify-email?status=expired`.
 * It is deliberately the *only* mail a new account gets: the welcome message
 * waits until the address is confirmed, so nobody's first impression is two
 * emails arriving together saying overlapping things.
 *
 * The copy states the expiry because a link that has quietly died is the single
 * most common way this flow confuses someone, and it names the way out in the
 * same breath.
 */
export function verifyEmailMessage({
  name,
  url,
}: {
  name: string;
  url: string;
}): { subject: string; html: string; text: string } {
  const content: EmailShellInput = {
    title: "Confirm your email",
    intro: [
      `Hi ${name}, thanks for signing up.`,
      "Confirm this address and your account is ready to go.",
    ],
    cta: { label: "Confirm email", url },
    outro: [
      "This link works once and expires in 24 hours. If it has, sign in and ask for a new one.",
      "If you didn't create an account, you can ignore this email.",
    ],
  };

  return {
    subject: "Confirm your email",
    html: emailShell(content),
    text: emailText(content),
  };
}
