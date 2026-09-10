import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The one behaviour of the mail layer that must never regress: **a send that
 * cannot happen is not an error.**
 *
 * Every caller is on the tail of something the user has already succeeded at —
 * the account exists, the password is changed, the address is confirmed — so a
 * throw from here would report the opposite of what happened and invite them to
 * sign up twice. That is easy to break by "improving" the error handling, and
 * impossible to notice without an outage, so it is asserted rather than trusted.
 *
 * `resetModules` plus a dynamic import in each test because the module memoises
 * both its client and its one-time warning at module scope.
 */

/**
 * `lib/env.ts` calls `required()` at module load, so importing anything that
 * reaches it throws under vitest — the runner does not read `.env`, and it
 * should not: a test that depended on a developer's real Appwrite key would pass
 * on one machine and fail in CI. These three are the module's `required` set and
 * nothing here uses them; they exist so the import resolves.
 */
process.env.APPWRITE_API_KEY ||= "test-key";
process.env.DATABASE_ID ||= "test-database";
process.env.STORAGE_ID ||= "test-storage";

const ORIGINAL_KEY = process.env.RESEND_API_KEY;

beforeEach(() => {
  vi.resetModules();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = ORIGINAL_KEY;

  vi.restoreAllMocks();
  vi.doUnmock("resend");
});

const MESSAGE = {
  to: "ada@example.com",
  subject: "Subject",
  html: "<p>Body</p>",
  text: "Body",
};

describe("sendEmail with no API key", () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it("resolves rather than throwing", async () => {
    const { sendEmail } = await import("./resend");

    await expect(sendEmail(MESSAGE)).resolves.toEqual({ sent: false });
  });

  it("warns once, however many messages are attempted", async () => {
    const { sendEmail } = await import("./resend");

    await sendEmail(MESSAGE);
    await sendEmail(MESSAGE);
    await sendEmail(MESSAGE);

    // A warning per send would bury the log during an import or a busy signup
    // hour, which is how a real one stops being read.
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.warn).mock.calls[0]![0]).toContain("RESEND_API_KEY");
  });
});

describe("sendEmail when Resend refuses", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
  });

  it("treats a payload error as a failed send, not a throw", async () => {
    // Resend reports failure in the payload rather than by throwing, so this is
    // the ordinary path for a bad key or an unverified domain — not an edge case.
    const send = vi.fn().mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Domain is not verified" },
    });
    vi.doMock("resend", () => ({ Resend: class { emails = { send } } }));

    const { sendEmail } = await import("./resend");

    await expect(sendEmail(MESSAGE)).resolves.toEqual({ sent: false });
    expect(console.error).toHaveBeenCalled();
  });

  it("swallows a thrown network failure too", async () => {
    const send = vi.fn().mockRejectedValue(new Error("socket hang up"));
    vi.doMock("resend", () => ({ Resend: class { emails = { send } } }));

    const { sendEmail } = await import("./resend");

    await expect(sendEmail(MESSAGE)).resolves.toEqual({ sent: false });
  });

  it("reports a genuine success", async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: "abc" }, error: null });
    vi.doMock("resend", () => ({ Resend: class { emails = { send } } }));

    const { sendEmail } = await import("./resend");

    await expect(sendEmail(MESSAGE)).resolves.toEqual({ sent: true });

    // The product name rides in the From header so an inbox shows a name rather
    // than a bare address.
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ from: expect.stringContaining("<") }),
    );
  });
});
