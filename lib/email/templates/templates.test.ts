import { describe, expect, it } from "vitest";

import { resetPasswordMessage } from "./reset-password";
import { verifyEmailMessage } from "./verify-email";
import { welcomeMessage } from "./welcome";

/**
 * The one class of bug in a transactional email you cannot see without sending
 * one: a message that arrives with a dead link, an empty plain-text part, or the
 * user's name run through an escaper twice.
 *
 * Not a rendering test — how the HTML *looks* is a job for a real client, and no
 * assertion here would tell us. What it checks is that both bodies exist and
 * that everything actionable is present in each, because a client that strips
 * HTML shows the text part and a text part with no URL in it is a dead end.
 */

const LINK = "https://example.com/api/auth/verify-email?userId=u1&secret=s1";

const MESSAGES = [
  ["verify", verifyEmailMessage({ name: "Ada", url: LINK })],
  ["reset", resetPasswordMessage({ name: "Ada", url: LINK })],
  ["welcome", welcomeMessage({ name: "Ada", url: LINK })],
] as const;

describe.each(MESSAGES)("%s email", (_name, message) => {
  it("has a subject", () => {
    expect(message.subject.trim().length).toBeGreaterThan(0);
  });

  it("carries the link in the HTML body", () => {
    expect(message.html).toContain(LINK.replace(/&/g, "&amp;"));
  });

  it("carries the link in the plain-text body", () => {
    // Unescaped here: the text part is not markup, and an `&amp;` in it would be
    // pasted into the address bar exactly as written and 404.
    expect(message.text).toContain(LINK);
  });

  it("greets the recipient by name in both bodies", () => {
    expect(message.html).toContain("Ada");
    expect(message.text).toContain("Ada");
  });

  it("is a complete document", () => {
    expect(message.html.startsWith("<!doctype html>")).toBe(true);
    expect(message.html).toContain("</html>");
  });
});

describe("escaping", () => {
  it("escapes a name that looks like markup, in the HTML only", () => {
    const message = welcomeMessage({
      name: '<script>alert("x")</script>',
      url: LINK,
    });

    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("&lt;script&gt;");
    // The text part is not markup, so escaping it would show the entities to
    // the reader rather than protecting anyone.
    expect(message.text).toContain("<script>");
  });

  it("escapes a URL carrying a quote, so it cannot break out of href", () => {
    const message = verifyEmailMessage({
      name: "Ada",
      url: 'https://example.com/?x="onload="alert(1)',
    });

    expect(message.html).not.toContain('href="https://example.com/?x="');
    expect(message.html).toContain("&quot;");
  });
});

describe("the three messages are distinguishable", () => {
  it("does not reuse a subject line", () => {
    const subjects = MESSAGES.map(([, message]) => message.subject);
    expect(new Set(subjects).size).toBe(subjects.length);
  });
});
