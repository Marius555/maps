import { describe, expect, it } from "vitest";

import { supportRequestMessage, type SupportRequestDetails } from "./support-request";

const bug: SupportRequestDetails = {
  kind: "bug",
  label: "Import",
  message: "Pins vanish <b>on zoom</b>.\n\nOnly in Safari.",
  replyTo: "other@example.com",
  email: "owner@example.com",
  name: "Owner",
  userId: "u1",
  plan: "free",
  page: "/maps/abc",
  viewport: "390x844",
  userAgent: "Safari",
  sentAt: "2026-09-27T12:00:00.000Z",
};

describe("supportRequestMessage", () => {
  it("escapes what the person typed", () => {
    const { html } = supportRequestMessage(bug);

    expect(html).toContain("Pins vanish &lt;b&gt;on zoom&lt;/b&gt;.");
    expect(html).not.toContain("<b>on zoom</b>");
  });

  it("puts kind, plan and area first in the subject", () => {
    expect(supportRequestMessage(bug).subject).toBe(
      "[Bug · Free · Import] Pins vanish <b>on zoom</b>. Only in Safari.",
    );
  });

  it("tags a support request by its plan and topic", () => {
    const { subject } = supportRequestMessage({
      ...bug,
      kind: "support",
      label: "Billing",
      plan: "pro",
      message: "Can I switch to yearly billing without losing my current discount please?",
    });

    expect(subject).toBe(
      "[Support · Pro · Billing] Can I switch to yearly billing without losing my current di…",
    );
  });

  it("keeps the details a reply would otherwise ask for", () => {
    const { text } = supportRequestMessage(bug);

    expect(text).toContain("Only in Safari.");
    expect(text).toContain("Area: Import");
    expect(text).toContain("Reply to: other@example.com");
    expect(text).toContain("Signed in as: Owner <owner@example.com>");
    expect(text).toContain("Page: /maps/abc");
    expect(text).toContain("Account: u1 · Free plan");
  });
});
