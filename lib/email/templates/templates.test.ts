import { describe, expect, it } from "vitest";

import { parseBrand } from "@/lib/brand";
import { emailShell, emailText, type EmailShellInput } from "./layout";
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

/**
 * The brand.json half of the shell, with brands built here rather than read from
 * the committed file, whose values are somebody's to change.
 */
describe("brand", () => {
  const MINIMAL = { name: "Acme Maps", tagline: "Maps for shops." };
  const CONTENT: EmailShellInput = {
    title: "Confirm your email",
    intro: ["Hi Ada."],
    cta: { label: "Confirm email", url: "https://app.example.com/api/auth/x?y=1" },
  };

  it("draws only what brand.json has set", () => {
    const html = emailShell(CONTENT, parseBrand(MINIMAL));

    expect(html).toContain("Acme Maps");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("mailto:");
    expect(html).not.toContain("Privacy policy");
  });

  it("resolves a logo in /public against the button's origin", () => {
    const brand = parseBrand({ ...MINIMAL, logo: { light: "/brand/logo.png" } });

    expect(emailShell(CONTENT, brand)).toContain(
      'src="https://app.example.com/brand/logo.png"',
    );
  });

  it("sends the name instead of an SVG logo, which mail clients drop", () => {
    const brand = parseBrand({
      ...MINIMAL,
      logo: { light: "https://cdn.example.com/logo.svg" },
    });
    const html = emailShell(CONTENT, brand);

    expect(html).not.toContain("<img");
    expect(html).toContain("Acme Maps");
  });

  it("carries the company, support address and privacy link in both bodies", () => {
    const brand = parseBrand({
      ...MINIMAL,
      company: { legalName: "Acme UAB", address: "Gedimino pr. 1, Vilnius" },
      contact: { supportEmail: "help@acme.example" },
      legal: { privacyUrl: "/privacy" },
    });

    for (const body of [emailShell(CONTENT, brand), emailText(CONTENT, brand)]) {
      expect(body).toContain("Acme UAB");
      expect(body).toContain("Gedimino pr. 1, Vilnius");
      expect(body).toContain("help@acme.example");
      expect(body).toContain("https://app.example.com/privacy");
    }
  });

  it("leaves out a path link when there is no button to take an origin from", () => {
    const brand = parseBrand({ ...MINIMAL, legal: { privacyUrl: "/privacy" } });
    const content = { ...CONTENT, cta: undefined };

    expect(emailShell(content, brand)).not.toContain("/privacy");
    expect(emailText(content, brand)).not.toContain("/privacy");
  });
});
