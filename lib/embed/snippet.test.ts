import { describe, expect, it } from "vitest";

import { embedSnippet, embedTestPageUrl } from "./snippet";

/**
 * The harness reads its snapshot URL with this regex rather than
 * `URLSearchParams`, so that a URL pasted in unencoded survives. Copied from
 * embed/dev/live.html deliberately: if that changes, this test is what notices.
 */
function readSnapshotParam(url: string): string | null {
  const raw = new URL(url).search.match(/[?&]snapshot=(.+)$/);
  return raw ? decodeURIComponent(raw[1]) : null;
}

describe("embedTestPageUrl", () => {
  const origin = "http://localhost:3000";

  it("points at the harness on the given origin", () => {
    const url = embedTestPageUrl(
      origin,
      "https://cdn.pinglide.com/abc123/live.json",
    );

    expect(url.startsWith(`${origin}/embed/live.html?`)).toBe(true);
  });

  it("round-trips an R2 snapshot URL through the harness's own parse", () => {
    const snapshotUrl = "https://cdn.pinglide.com/abc123/live.json";

    expect(readSnapshotParam(embedTestPageUrl(origin, snapshotUrl))).toBe(
      snapshotUrl,
    );
  });

  /*
   * The case the harness's comment is about, and the reason the value is encoded
   * rather than appended raw. An Appwrite-hosted snapshot URL carries its own
   * query string; unencoded, `?project=` would read as a second param of *our*
   * URL and the map id would arrive without the project it belongs to — a 401
   * from storage, three layers from the mistake.
   */
  it("survives a snapshot URL that carries its own query string", () => {
    const snapshotUrl =
      "https://fra.cloud.appwrite.io/v1/storage/buckets/assets/files/live-abc123/view?project=pinglide";

    const url = embedTestPageUrl(origin, snapshotUrl);

    expect(url).not.toContain("?project=");
    expect(readSnapshotParam(url)).toBe(snapshotUrl);
  });

  it("keeps snapshot as the last parameter", () => {
    const url = embedTestPageUrl(origin, "https://cdn.pinglide.com/a/live.json");

    // Nothing may be appended after it: the harness takes everything from
    // `snapshot=` to the end of the string as the URL.
    expect(url.indexOf("snapshot=")).toBeGreaterThan(-1);
    expect(url.slice(url.indexOf("snapshot=")).includes("&")).toBe(false);
  });
});

describe("embedSnippet tags", () => {
  const base = {
    scriptUrl: "https://cdn.pinglide.com/embed/map.js",
    snapshotUrl: "https://cdn.pinglide.com/abc/live.json",
  };

  it("writes no attribute for the whole map", () => {
    expect(embedSnippet(base)).not.toContain("data-tags");
    expect(embedSnippet({ ...base, tags: [] })).not.toContain("data-tags");
  });

  it("writes the chosen tag ids, comma separated", () => {
    expect(embedSnippet({ ...base, tags: ["t1", "t2"] })).toContain('data-tags="t1,t2"');
  });
});
