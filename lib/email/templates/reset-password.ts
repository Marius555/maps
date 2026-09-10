import { emailShell, emailText, type EmailShellInput } from "./layout";

/**
 * The reset link.
 *
 * The last line is load-bearing rather than boilerplate: this message is the one
 * an attacker can cause to be delivered to an address they do not control, by
 * typing it into the forgot-password form. Telling the recipient that nothing
 * has happened yet, and that ignoring the email leaves the account exactly as it
 * was, is what turns an alarming message into an informative one.
 */
export function resetPasswordMessage({
  name,
  url,
}: {
  name: string;
  url: string;
}): { subject: string; html: string; text: string } {
  const content: EmailShellInput = {
    title: "Reset your password",
    intro: [
      `Hi ${name},`,
      "Choose a new password using the button below. You'll be signed in straight after.",
    ],
    cta: { label: "Choose a new password", url },
    outro: [
      "This link works once and expires in an hour.",
      "If you didn't ask for this, ignore it — your password hasn't changed.",
    ],
  };

  return {
    subject: "Reset your password",
    html: emailShell(content),
    text: emailText(content),
  };
}
