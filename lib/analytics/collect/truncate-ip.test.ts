import { describe, expect, it } from "vitest";

import { maskIp } from "./mask-ip";
import { truncateIp } from "./truncate-ip";

/** What is stored in place of the visitor's address. */
describe("truncateIp", () => {
  it("drops the last IPv4 octet", () => {
    expect(truncateIp("81.7.144.23")).toBe("81.7.144.0");
  });

  it("keeps only the IPv6 routing prefix", () => {
    expect(truncateIp("2001:db8:85a3:8d3:1319:8a2e:370:7348")).toBe(
      "2001:db8:85a3:8d3::",
    );
  });

  it("never keeps the groups after a compressed run", () => {
    expect(truncateIp("2001:db8::7348")).toBe("2001:db8::");
    expect(truncateIp("::1")).toBe("::");
  });

  it("treats an IPv4-mapped address as IPv4", () => {
    expect(truncateIp("::ffff:81.7.144.23")).toBe("81.7.144.0");
  });

  it("stores nothing it cannot vouch for", () => {
    expect(truncateIp(null)).toBeNull();
    expect(truncateIp("")).toBeNull();
    expect(truncateIp("not an address")).toBeNull();
  });

  it("still renders the way a full address used to", () => {
    // Recent visitors reads both old full rows and new truncated ones.
    expect(maskIp(truncateIp("81.7.144.23"))).toBe(maskIp("81.7.144.23"));
    expect(maskIp(truncateIp("2001:db8:85a3:8d3:1319:8a2e:370:7348"))).toBe(
      maskIp("2001:db8:85a3:8d3:1319:8a2e:370:7348"),
    );
  });
});
