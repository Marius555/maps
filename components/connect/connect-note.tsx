import { ControlNote } from "@/components/ui/control-note";
import { allowSite } from "@/lib/connect/wordpress";
import type { AppMap } from "@/lib/repositories/types";

/**
 * What pressing Connect will do to the chosen map, said before it is pressed —
 * because two of the outcomes publish, and one of those publishes edits the
 * owner may not have meant to make live yet.
 *
 * `allowSite` is the same function the route runs, so this cannot describe a
 * different outcome from the one that happens.
 */
export function ConnectNote({
  id,
  map,
  host,
}: {
  id: string;
  /** Null for a new map. */
  map: AppMap | null;
  host: string;
}) {
  const note = connectNote(map, host);

  // The warning look only where something surprising happens: a refusal, or a
  // publish of edits the owner may not have meant to make live.
  if (note.warn) return <ControlNote id={id}>{note.text}</ControlNote>;

  return (
    <p id={id} className="text-xs text-pretty text-muted">
      {note.text}
    </p>
  );
}

export function connectBlocked(map: AppMap | null, host: string): boolean {
  return map !== null && allowSite(map.allowedDomains, hostname(host)).kind === "full";
}

function connectNote(map: AppMap | null, host: string): { text: string; warn: boolean } {
  if (!map) {
    return {
      text: `We'll create the map and publish it empty, so it shows on ${host} straight away. Add your locations here, press Publish, and your site updates by itself.`,
      warn: false,
    };
  }

  const allowed = allowSite(map.allowedDomains, hostname(host));

  if (allowed.kind === "full") {
    return {
      text: `This map already allows ${map.allowedDomains.length} other sites, the most it can. Remove one in its Publish settings to show it on ${host}.`,
      warn: true,
    };
  }

  if (allowed.kind === "added") {
    return {
      text: `This map only shows on the sites you listed, so we'll add ${host} and publish it again — including any changes you haven't published yet.`,
      warn: true,
    };
  }

  if (!map.publishedAt) {
    return {
      text: `This map isn't published yet. We'll publish it now so it shows on ${host}.`,
      warn: false,
    };
  }

  return {
    text: `It shows on ${host} as it was last published. Publish again here whenever you change it.`,
    warn: false,
  };
}

/** The allowlist holds bare hostnames; `host` may carry a port. */
function hostname(host: string): string {
  return host.split(":")[0];
}
