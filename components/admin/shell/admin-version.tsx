import { BUILT_AT, versionLabel } from "@/lib/version";

/**
 * The release this console is running, at the foot of the rail and the mobile
 * drawer. It answers "did the deploy land", which is the same question
 * /api/version answers without a login (docs/notes/versioning.md).
 */
export function AdminVersion() {
  return (
    <p
      className="truncate px-2 pt-1 font-mono text-[11px] text-muted"
      title={BUILT_AT ? `Built ${BUILT_AT}` : undefined}
    >
      {versionLabel()}
    </p>
  );
}
