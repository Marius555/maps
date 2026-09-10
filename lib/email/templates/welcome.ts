import { PRODUCT_NAME } from "@/lib/config";
import { emailShell, emailText, type EmailShellInput } from "./layout";

/**
 * Sent *after* the address is confirmed, or straight away for someone who signed
 * in with Google — those accounts arrive already verified, so there is no
 * confirmation step for this to follow.
 *
 * It exists to do one thing the verification mail cannot: point at the first
 * action worth taking. The verify mail's only job is the button; adding "here's
 * how to build a map" to it would compete with that button for the same click.
 */
export function welcomeMessage({
  name,
  url,
}: {
  name: string;
  url: string;
}): { subject: string; html: string; text: string } {
  const content: EmailShellInput = {
    title: `Welcome to ${PRODUCT_NAME}`,
    intro: [
      `You're all set, ${name}.`,
      "Create a map, import your locations from a spreadsheet, style it, and paste one line of code into your site.",
    ],
    cta: { label: "Build your first map", url },
    outro: ["Reply to this email if you get stuck — a person reads it."],
  };

  return {
    subject: `Welcome to ${PRODUCT_NAME}`,
    html: emailShell(content),
    text: emailText(content),
  };
}
