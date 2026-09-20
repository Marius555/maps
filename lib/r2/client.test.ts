import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The R2 client signs and sends; these check what it sends and, above all, what
 * it says when it fails. Its errors reach the logs through `toErrorResponse`, so
 * a message that carried a credential would be a leak nobody sees happen.
 */

const env = vi.hoisted(() => ({
  r2AccountId: "acct123",
  r2AccessKeyId: "AKIDEXAMPLEEXAMPLE0000000000000",
  r2SecretAccessKey: "super-secret-value-that-must-never-appear",
}));

vi.mock("@/lib/env", () => ({ env }));

import { encodeKey, r2Bucket } from "./client";

const ORIGINAL = { ...env };
const requests: Request[] = [];
let replies: Response[] = [];

beforeEach(() => {
  Object.assign(env, ORIGINAL);
  requests.length = 0;
  replies = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      requests.push(request);
      return replies.shift() ?? new Response(null, { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function s3Error(status: number, code: string): Response {
  return new Response(
    `<?xml version="1.0"?><Error><Code>${code}</Code><Message>nope</Message></Error>`,
    { status },
  );
}

describe("put", () => {
  it("PUTs the body to the bucket path with the given headers, signed", async () => {
    await r2Bucket("snapshots").put("map-1/live.json", '{"a":1}', {
      contentType: "application/json; charset=utf-8",
      cacheControl: "public, max-age=60",
    });

    const [request] = requests;
    expect(request.method).toBe("PUT");
    expect(request.url).toBe(
      "https://acct123.r2.cloudflarestorage.com/snapshots/map-1/live.json",
    );
    expect(request.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(request.headers.get("cache-control")).toBe("public, max-age=60");
    expect(request.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 /);
    expect(await request.text()).toBe('{"a":1}');
  });
});

describe("list", () => {
  it("follows continuation tokens and decodes the keys", async () => {
    replies = [
      new Response(
        "<ListBucketResult><IsTruncated>true</IsTruncated>" +
          "<Contents><Key>m/a.json</Key></Contents>" +
          "<NextContinuationToken>tok&amp;1</NextContinuationToken></ListBucketResult>",
      ),
      new Response(
        "<ListBucketResult><IsTruncated>false</IsTruncated>" +
          "<Contents><Key>m/b&amp;c.json</Key></Contents></ListBucketResult>",
      ),
    ];

    const keys = await r2Bucket("snapshots").list("m/");

    expect(keys).toEqual(["m/a.json", "m/b&c.json"]);
    expect(new URL(requests[0].url).searchParams.get("prefix")).toBe("m/");
    expect(new URL(requests[1].url).searchParams.get("continuation-token")).toBe("tok&1");
  });
});

describe("errors", () => {
  it("name the operation, key, status and R2's code — and no credential", async () => {
    replies = [s3Error(403, "AccessDenied")];

    const error = await r2Bucket("snapshots")
      .remove("map-1/live.json")
      .then(() => new Error("expected a rejection"))
      .catch((caught: unknown) => caught as Error);

    expect(error.message).toBe("R2 DELETE map-1/live.json failed: HTTP 403 AccessDenied");
    expect(error.message).not.toContain(env.r2SecretAccessKey);
    expect(error.message).not.toContain(env.r2AccessKeyId);
  });

  it("gives up after three attempts rather than aws4fetch's eleven", async () => {
    replies = [s3Error(500, "InternalError"), s3Error(500, "InternalError"), s3Error(500, "InternalError"), new Response(null)];

    await expect(
      r2Bucket("snapshots").put("k", "b", { contentType: "a", cacheControl: "b" }),
    ).rejects.toThrow("HTTP 500 InternalError");
    expect(requests).toHaveLength(3);
  });

  it("name each missing variable before any request is made", () => {
    env.r2SecretAccessKey = "";
    env.r2AccountId = "";

    expect(() => r2Bucket("snapshots")).toThrow(
      /CLOUDFLARE_ACCOUNT_ID, R2_SECRET_ACCESS_KEY missing/,
    );
    expect(() => r2Bucket("snapshots")).not.toThrow(new RegExp(env.r2AccessKeyId));
    expect(requests).toHaveLength(0);
  });
});

describe("encodeKey", () => {
  it("encodes each segment and keeps the slashes", () => {
    expect(encodeKey("map 1/2026-09-19T20-00-00-000Z.json")).toBe(
      "map%201/2026-09-19T20-00-00-000Z.json",
    );
  });
});
