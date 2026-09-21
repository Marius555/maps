import { emailShell, emailText, type EmailShellInput } from "./layout";

/**
 * Confirm your address.
 *
 * Sent once at signup, and again on request from `/verify-email?status=expired`
 * or from the notice on the Publish tab. It is deliberately the *only* mail a new
 * account gets: the welcome message waits until the address is confirmed, so
 * nobody's first impression is two emails arriving together saying overlapping
 * things.
 *
 * **It congratulates in one line and then gets out of the way.** The greeting is
 * there because this is the first thing we ever say to a customer and "thanks for
 * signing up" is not a welcome — but the division of labour with `welcome.ts` is
 * unchanged and load bearing. This mail's job is the button. Anything resembling
 * "here's how to build your first map" belongs in the welcome mail, which is read
 * by someone who has already clicked and has nothing competing for the click.
 *
 * The copy states the expiry because a link that has quietly died is the single
 * most common way this flow confuses someone, and it names the way out in the
 * same breath.
 *
 * The subject keeps "confirm your email" in it. "You're in" on its own is a
 * pleasant sentence that tells nobody in a crowded inbox what to do.
 */
export function verifyEmailMessage({
  name,
  url,
}: {
  name: string;
  url: string;
}): { subject: string; html: string; text: string } {
  const content: EmailShellInput = {
    title: `Welcome aboard, ${name}`,
    intro: [
      "Your account is created.",
      "Confirm this address and your first map is one import away.",
    ],
    cta: { label: "Confirm email", url },
    outro: [
      "This link works once and expires in 24 hours. If it has, sign in and ask for a new one.",
      "If you didn't create an account, you can ignore this email.",
    ],
  };

  return {
    subject: "You're in — confirm your email",
    html: emailShell(content),
    text: emailText(content),
  };
}
