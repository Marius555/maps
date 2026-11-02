import { describe, expect, it } from "vitest";

import { storefrontPrimary } from "./storefront-step";

const base = { onStorefront: true, isError: false, justShown: false, hasPendingChanges: false };

describe("storefrontPrimary", () => {
  it("leads with nothing while the status loads", () => {
    expect(storefrontPrimary({ ...base, onStorefront: undefined })).toBeNull();
  });

  it("falls back to Publish when the status could not be read", () => {
    expect(storefrontPrimary({ ...base, onStorefront: undefined, isError: true })).toBe("publish");
  });

  it("leads with Show on storefront until the map is there", () => {
    expect(storefrontPrimary({ ...base, onStorefront: false })).toBe("show");
    expect(storefrontPrimary({ ...base, onStorefront: false, hasPendingChanges: true })).toBe("show");
  });

  it("leads with Add to theme right after step 1, even with edits to publish", () => {
    expect(storefrontPrimary({ ...base, justShown: true, hasPendingChanges: true })).toBe("theme");
  });

  it("leads with Publish when the storefront is behind the editor", () => {
    expect(storefrontPrimary({ ...base, hasPendingChanges: true })).toBe("publish");
  });

  it("leads with Add to theme when there is nothing to publish", () => {
    expect(storefrontPrimary(base)).toBe("theme");
  });

  it("keeps the status answer over a later failed refetch", () => {
    expect(storefrontPrimary({ ...base, onStorefront: false, isError: true })).toBe("show");
  });
});
