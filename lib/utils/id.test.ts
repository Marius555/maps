import { afterEach, describe, expect, it, vi } from "vitest";

import { newId, newShortId } from "./id";

const V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * The point of these is the *second* describe: `crypto.randomUUID` does not
 * exist outside a secure context, which on a phone reaching `next dev` over the
 * LAN meant every pin drop and every shape draw threw inside a TanStack Query
 * `onMutate` and reported itself as a server error.
 */
describe("newId", () => {
  it("is a v4 UUID", () => {
    expect(newId()).toMatch(V4);
  });

  it("does not repeat", () => {
    const ids = new Set(Array.from({ length: 500 }, () => newId()));

    expect(ids.size).toBe(500);
  });

  describe("without crypto.randomUUID, as on an insecure origin", () => {
    /** `getRandomValues` is *not* secure-context-gated, so it is still there. */
    const insecure = () => {
      const real = globalThis.crypto;

      vi.stubGlobal("crypto", {
        getRandomValues: real.getRandomValues.bind(real),
      });
    };

    it("still returns a v4 UUID", () => {
      insecure();

      expect(globalThis.crypto.randomUUID).toBeUndefined();
      expect(newId()).toMatch(V4);
    });

    it("still does not repeat", () => {
      insecure();

      const ids = new Set(Array.from({ length: 500 }, () => newId()));

      expect(ids.size).toBe(500);
    });
  });

  describe("with no crypto at all", () => {
    it("falls back to Math.random rather than throwing", () => {
      vi.stubGlobal("crypto", undefined);

      expect(newId()).toMatch(V4);
    });
  });
});

describe("newShortId", () => {
  it("is eight hex characters and carries no dash", () => {
    const id = newShortId();

    expect(id).toMatch(/^[0-9a-f]{8}$/);
  });

  it("matches what slicing a UUID used to give", () => {
    // The call sites it replaced were `crypto.randomUUID().slice(0, 8)`, and a
    // UUID's first group is eight hex characters — so the shape is unchanged.
    expect(newShortId()).toHaveLength(8);
  });
});
