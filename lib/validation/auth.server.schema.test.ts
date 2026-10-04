import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

process.env.APPWRITE_API_KEY ||= "test-key";
process.env.DATABASE_ID ||= "test-database";
process.env.STORAGE_ID ||= "test-storage";

/**
 * The seam between the two checks and the error envelope.
 *
 * The messages themselves are the product's, not a contract — what is asserted
 * is that a refusal lands on `email`, because that is what puts the sentence
 * under the field the user has to change. An issue with no path, or one on the
 * form, renders at the top of the page pointing at nothing (`applyFieldErrors`
 * skips `_form`), and nothing about that shows up in a type check.
 */
const inspectMail = vi.hoisted(() =>
  vi.fn(async (): Promise<{ accepts: boolean; exchanges: string[] }> => ({
    accepts: true,
    exchanges: ["mx.example.com"],
  })),
);
const liveSaysDisposable = vi.hoisted(() => vi.fn(async () => false));

vi.mock("@/lib/email/mx", () => ({ inspectMail }));
vi.mock("@/lib/email/disposable-live", () => ({ liveSaysDisposable }));

const VALID = { email: "ada@example.com", password: "a-good-password" };

let signupServerSchema: typeof import("./auth.server.schema").signupServerSchema;

beforeEach(async () => {
  inspectMail.mockClear();
  inspectMail.mockResolvedValue({ accepts: true, exchanges: ["mx.example.com"] });
  liveSaysDisposable.mockClear();
  liveSaysDisposable.mockResolvedValue(false);
  ({ signupServerSchema } = await import("./auth.server.schema"));
});

/** The field messages, keyed the way the route's 422 body keys them. */
async function fieldsFor(input: Record<string, unknown>) {
  const result = await signupServerSchema.safeParseAsync(input);
  if (result.success) return null;

  return z.flattenError(result.error).fieldErrors;
}

describe("signupServerSchema", () => {
  it("accepts an ordinary address", async () => {
    await expect(signupServerSchema.parseAsync(VALID)).resolves.toMatchObject({
      email: "ada@example.com",
    });
  });

  it("refuses a throwaway address, on the email field", async () => {
    const fields = await fieldsFor({ ...VALID, email: "ada@mailinator.com" });

    expect(fields?.email?.[0]).toMatch(/can't create an account with this email/i);
  });

  it("refuses an address whose domain receives no mail, on the email field", async () => {
    inspectMail.mockResolvedValue({ accepts: false, exchanges: [] });

    const fields = await fieldsFor({ ...VALID, email: "ada@gmial.invalid" });

    expect(fields?.email?.[0]).toMatch(/mail server/i);
  });

  it("does not pay for a lookup about a domain already on the list", async () => {
    await fieldsFor({ ...VALID, email: "ada@mailinator.com" });

    expect(inspectMail).not.toHaveBeenCalled();
    expect(liveSaysDisposable).not.toHaveBeenCalled();
  });

  it("refuses an unlisted domain whose mail goes to a throwaway server", async () => {
    inspectMail.mockResolvedValue({ accepts: true, exchanges: ["em4.rejecthost.com"] });

    const fields = await fieldsFor({ ...VALID, email: "ada@brand-new-burner.com" });

    expect(fields?.email?.[0]).toMatch(/can't create an account with this email/i);
  });

  it("does not refuse a domain for receiving through a mainstream host", async () => {
    // yandex.net is on the vendored list; a business on Yandex 360 is not a burner.
    inspectMail.mockResolvedValue({ accepts: true, exchanges: ["mx.yandex.net"] });

    await expect(
      signupServerSchema.parseAsync({ ...VALID, email: "ada@shop.ru" }),
    ).resolves.toMatchObject({ email: "ada@shop.ru" });
  });

  it("refuses what the live lookup knows and the vendored list does not", async () => {
    liveSaysDisposable.mockResolvedValue(true);

    const fields = await fieldsFor({ ...VALID, email: "ada@fresh-temp.xyz" });

    expect(fields?.email?.[0]).toMatch(/can't create an account with this email/i);
  });

  it("says one thing at a time — a throwaway is not also a typo", async () => {
    inspectMail.mockResolvedValue({ accepts: false, exchanges: [] });

    const fields = await fieldsFor({ ...VALID, email: "ada@mailinator.com" });

    expect(fields?.email).toHaveLength(1);
  });

  it("still enforces everything the shared schema did", async () => {
    const fields = await fieldsFor({ email: "not-an-address", password: "x" });

    expect(fields?.email?.[0]).toBe("Enter a valid email address.");
    expect(fields?.password?.[0]).toBe("Use at least 8 characters.");
  });

  it("asks nothing of a resolver when the address is not one", async () => {
    await fieldsFor({ ...VALID, email: "not-an-address" });

    expect(inspectMail).not.toHaveBeenCalled();
    expect(liveSaysDisposable).not.toHaveBeenCalled();
  });

  it("refuses an unlisted domain whose mail goes to a throwaway server", async () => {
    inspectMail.mockResolvedValue({ accepts: true, exchanges: ["em4.rejecthost.com"] });

    const fields = await fieldsFor({ ...VALID, email: "ada@brand-new-burner.com" });

    expect(fields?.email?.[0]).toMatch(/can't create an account with this email/i);
  });

  it("does not refuse a domain for receiving through a mainstream host", async () => {
    // yandex.net is on the vendored list; a business on Yandex 360 is not a burner.
    inspectMail.mockResolvedValue({ accepts: true, exchanges: ["mx.yandex.net"] });

    await expect(
      signupServerSchema.parseAsync({ ...VALID, email: "ada@shop.ru" }),
    ).resolves.toMatchObject({ email: "ada@shop.ru" });
  });

  it("refuses what the live lookup knows and the vendored list does not", async () => {
    liveSaysDisposable.mockResolvedValue(true);

    const fields = await fieldsFor({ ...VALID, email: "ada@fresh-temp.xyz" });

    expect(fields?.email?.[0]).toMatch(/can't create an account with this email/i);
  });
});
