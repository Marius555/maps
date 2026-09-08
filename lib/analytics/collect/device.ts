import "server-only";

import type { DeviceKind } from "@/lib/repositories/types";

/**
 * Phone, tablet or desktop, from the user agent.
 *
 * Three buckets and no more, because three is what a customer can act on: "most
 * of your visitors are on a phone" changes how they size the embed on their
 * page. A browser name or an OS version changes nothing they can do, so neither
 * is collected.
 *
 * Order matters. Every Android tablet also says "Android", and an iPad says
 * "Macintosh" in desktop mode — so the tablet tests run first and the phone test
 * is what is left. iPadOS in desktop mode is genuinely indistinguishable from a
 * Mac by user agent alone and is counted as a desktop; that is a known,
 * accepted miscount rather than something to solve with a fingerprint.
 */
export function deviceOf(userAgent: string | null): DeviceKind {
  if (!userAgent) return "desktop";

  const ua = userAgent.toLowerCase();

  if (ua.includes("ipad") || (ua.includes("android") && !ua.includes("mobile"))) {
    return "tablet";
  }

  if (ua.includes("mobi") || ua.includes("iphone") || ua.includes("android")) {
    return "mobile";
  }

  return "desktop";
}
