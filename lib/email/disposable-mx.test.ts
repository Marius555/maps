import { describe, expect, it } from "vitest";

import { isDisposableMailHost } from "./disposable-mx";

describe("isDisposableMailHost", () => {
  it("matches a throwaway service's server by its domain", () => {
    expect(isDisposableMailHost("mail.mailinator.com")).toBe(true);
    expect(isDisposableMailHost("em4.rejecthost.com")).toBe(true);
    expect(isDisposableMailHost("generator.email")).toBe(true);
  });

  it("ignores case and a trailing dot", () => {
    expect(isDisposableMailHost(" MX.EmlTmp.com. ")).toBe(true);
  });

  it("matches an exact-host entry and not its siblings", () => {
    expect(isDisposableMailHost("email.chatgpt.org.uk")).toBe(true);
    expect(isDisposableMailHost("mail.chatgpt.org.uk")).toBe(false);
  });

  it("never refuses the mainstream hosts temp-mail services also use", () => {
    for (const host of [
      "mx.yandex.net",
      "route1.mx.cloudflare.net",
      "aspmx.l.google.com",
      "gmail-smtp-in.l.google.com",
      "mx.zoho.com",
      "mx1.hostinger.com",
      "eforward1.registrar-servers.com",
      "mail.protonmail.ch",
      "mxa.mailgun.org",
    ]) {
      expect(isDisposableMailHost(host), host).toBe(false);
    }
  });

  it("refuses nothing for an empty host", () => {
    expect(isDisposableMailHost("")).toBe(false);
  });
});
