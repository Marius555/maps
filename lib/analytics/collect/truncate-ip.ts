/**
 * An IP address with the part that names a device removed, before it is stored.
 *
 * The full address is only ever needed for one thing — the anonymous visitor key
 * (./visitor-key.ts) — and that is computed before the row is written. What is
 * kept is the network, which is still enough to answer "is this the same
 * visitor as the row above" in the Recent visitors table and to see a flood
 * coming from one place.
 *
 * The same cut `maskIp` draws, so a truncated value renders exactly as a full
 * one used to: IPv4 loses its last octet (stored as `0`), IPv6 keeps its first
 * four groups — the routing prefix — because the rest is frequently the device.
 *
 * Anything unrecognisable is dropped rather than stored as it came: a value we
 * cannot parse is a value we cannot vouch for having truncated.
 */
export function truncateIp(ip: string | null | undefined): string | null {
  if (!ip) return null;

  // An IPv4-mapped IPv6 address (`::ffff:81.7.144.23`) is an IPv4 address.
  if (ip.includes(":") && ip.includes(".")) {
    return truncateIp(ip.slice(ip.lastIndexOf(":") + 1));
  }

  if (ip.includes(":")) {
    // Only the groups before a `::` are leading groups; after it, they are the
    // tail of the address and keeping them would keep the device.
    const [head] = ip.split("::");
    const groups = head.split(":").filter(Boolean).slice(0, 4);
    return `${groups.join(":")}::`;
  }

  const octets = ip.split(".");
  if (octets.length !== 4 || octets.some((octet) => !/^\d{1,3}$/.test(octet))) {
    return null;
  }

  return `${octets[0]}.${octets[1]}.${octets[2]}.0`;
}
