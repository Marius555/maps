import { DocsCallout } from "@/components/docs/docs-callout";

/**
 * What is still missing from a legal document, shown while it is a draft.
 *
 * Only ever drawn in development — in production a draft returns 404 instead
 * (`legal-page.tsx`) — so this is written for whoever is filling the document
 * in, and names the files where each value goes.
 */
export function DraftNotice({
  unfilled,
  markerCount,
}: {
  unfilled: string[];
  markerCount: number;
}) {
  return (
    <DocsCallout tone="warning">
      <p>
        <strong>Draft — not published.</strong> This page returns 404 in
        production until every value is filled and every marker is resolved.
        See <code>documents/legal/README.md</code>.
      </p>

      {unfilled.length > 0 && (
        <p>
          {unfilled.length} {unfilled.length === 1 ? "value" : "values"} to fill
          in <code>brand.json</code> or <code>lib/legal/values.ts</code>:{" "}
          {unfilled.map((path, index) => (
            <span key={path}>
              {index > 0 && ", "}
              <code className="break-all">{path}</code>
            </span>
          ))}
        </p>
      )}

      {markerCount > 0 && (
        <p>
          {markerCount} {markerCount === 1 ? "marker" : "markers"} to resolve in
          the Markdown: <code>[VERIFY]</code>, <code>[REMOVE IF UNUSED]</code>{" "}
          or <code>[IF USED]</code>.
        </p>
      )}
    </DocsCallout>
  );
}
