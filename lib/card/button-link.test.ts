import { describe, expect, it } from "vitest";

import { linkForDisplay, linkForStorage } from "./button-link";

describe("linkForStorage", () => {
  it("adds the scheme nobody types", () => {
    expect(linkForStorage("acme.com/book")).toBe("https://acme.com/book");
  });

  it("leaves a link that already has one alone, whichever it is", () => {
    expect(linkForStorage("https://acme.com")).toBe("https://acme.com");
    expect(linkForStorage("http://acme.com")).toBe("http://acme.com");
  });

  it("keeps an empty box empty, because that is how the field is cleared", () => {
    expect(linkForStorage("")).toBe("");
    expect(linkForStorage("   ")).toBe("");
  });

  it("does not trim what it stores, so typing a space is possible", () => {
    // The box reads its value back off the stored link on every keystroke, so
    // trimming here would delete the space the moment it was typed.
    expect(linkForStorage("acme.com/my page")).toBe("https://acme.com/my page");
    expect(linkForStorage("https://acme.com/a ")).toBe("https://acme.com/a ");
  });

  it("cannot be talked into storing a dangerous scheme", () => {
    // `javascript:` has no `//`, so it is not recognised as a scheme and gets
    // prefixed like any other typing — which produces something `new URL()`
    // refuses outright. `safeHref` is still the gate that matters, in both
    // renderers; this only has to avoid handing it a live one.
    expect(linkForStorage("javascript:alert(1)")).toBe(
      "https://javascript:alert(1)",
    );
    expect(() => new URL(linkForStorage("javascript:alert(1)"))).toThrow();
  });

  it("leaves a host carrying a port alone, which is why `//` is required", () => {
    expect(linkForStorage("acme.com:8080/book")).toBe(
      "https://acme.com:8080/book",
    );
  });
});

describe("linkForDisplay", () => {
  it("hides the scheme it added", () => {
    expect(linkForDisplay("https://acme.com/book")).toBe("acme.com/book");
  });

  it("keeps one the owner chose", () => {
    expect(linkForDisplay("http://acme.com")).toBe("http://acme.com");
  });

  it("shows nothing for a block with no link", () => {
    expect(linkForDisplay(undefined)).toBe("");
  });
});
