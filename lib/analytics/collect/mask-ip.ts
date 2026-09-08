/**
 * An address a person can read without reading a person.
 *
 * The full address is what gets stored — an owner asked for it and it is on
 * their row — but the dashboard draws this. Two different jobs: the stored value
 * is evidence, available if somebody has to chase abuse; the drawn value answers
 * "is this the same visitor as the row above", which is all a table of recent
 * visitors is ever used for, and which the masked form answers just as well.
 *
 * IPv4 loses its last octet, which is the convention every analytics tool uses
 * and which keeps the network visible. IPv6 keeps its first four groups — the
 * routing prefix — because the rest is frequently the device itself.
 *
 * Client-safe: no `server-only` here, because the table that renders it is a
 * client component. Nothing in this file reads a secret or an environment.
 */
export function maskIp(ip: string | null | undefined): string {
  if (!ip) return "—";

  if (ip.includes(":")) {
    const groups = ip.split(":").filter(Boolean).slice(0, 4);
    return groups.length > 0 ? `${groups.join(":")}:••` : "—";
  }

  const octets = ip.split(".");
  if (octets.length !== 4) return "—";

  return `${octets[0]}.${octets[1]}.${octets[2]}.•`;
}
