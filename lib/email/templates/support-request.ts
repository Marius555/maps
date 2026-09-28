import type { PlanId } from "@/lib/repositories/plan-limits";
import type { SupportKind } from "@/lib/validation/support.schema";
import { emailShell, emailText, type EmailShellInput } from "./layout";

export type SupportRequestDetails = {
  kind: SupportKind;
  /** The chosen area (a bug) or topic (a support request), as its label. */
  label: string;
  message: string;
  replyTo: string;
  /** The signed-in address, which may differ from `replyTo`. */
  email: string;
  name: string;
  userId: string;
  plan: PlanId;
  page?: string;
  viewport?: string;
  userAgent?: string;
  /** ISO 8601, UTC. */
  sentAt: string;
};

const KIND_TAG: Record<SupportKind, string> = { bug: "Bug", support: "Support" };
const PLAN_TAG: Record<PlanId, string> = { free: "Free", starter: "Starter", pro: "Pro" };

/** How much of the message goes in the subject line. */
const PREVIEW = 60;

/**
 * A bug report or support request, sent to our own inbox rather than to a customer.
 *
 * **The subject is the triage.** `[Support · Pro · Billing] …` against
 * `[Bug · Free · Import] …`: the kind first, then the plan, so an inbox sorted
 * or filtered by subject puts paying customers' requests together, then what
 * it is about. The start of the message follows, so the list view says
 * something before anything is opened.
 *
 * The same shell as every other message — it escapes what the person typed,
 * which is the one thing this template must not get wrong. `replyTo` goes on the
 * message at the call site, so answering is Reply.
 */
export function supportRequestSubject(details: SupportRequestDetails): string {
  const oneLine = details.message.replace(/\s+/g, " ").trim();
  const preview = oneLine.length > PREVIEW ? `${oneLine.slice(0, PREVIEW - 1)}…` : oneLine;

  return `[${KIND_TAG[details.kind]} · ${PLAN_TAG[details.plan]} · ${details.label}] ${preview}`;
}

export function supportRequestMessage(details: SupportRequestDetails): {
  subject: string;
  html: string;
  text: string;
} {
  const content: EmailShellInput = {
    title: details.kind === "bug" ? "Bug report" : "Support request",
    // One paragraph per line the person wrote, so their breaks survive.
    intro: details.message.split(/\r?\n/).filter((line) => line.trim() !== ""),
    outro: [
      `${details.kind === "bug" ? "Area" : "Topic"}: ${details.label}`,
      `Reply to: ${details.replyTo}`,
      `Signed in as: ${details.name ? `${details.name} <${details.email}>` : details.email}`,
      `Account: ${details.userId} · ${PLAN_TAG[details.plan]} plan`,
      `Page: ${details.page || "unknown"}`,
      `Screen: ${details.viewport || "unknown"}`,
      `Browser: ${details.userAgent || "unknown"}`,
      `Sent: ${details.sentAt}`,
    ],
  };

  return {
    subject: supportRequestSubject(details),
    html: emailShell(content),
    text: emailText(content),
  };
}
