import { MAX_SOURCE_BYTES, MAX_SOURCE_ROWS, formatMb } from "../limits";
import { parseXmlDocument } from "./xml-document";
import { ImportSourceError, type SourceTable } from "./types";

/**
 * Generic XML → grid.
 *
 * There is no schema to rely on. A store-locator feed might be <stores><store>,
 * <locations><location>, <items><item>, or an RSS file whose records are <item>
 * three levels down. What every one of them has in common is a *repeating
 * element*: the tag that appears many times as a sibling, each occurrence
 * carrying one location's worth of fields. Find that, and the file becomes a
 * table.
 */

/** Deeper than this and we're descending into markup, not data. */
const MAX_DEPTH = 6;

/** A record with more fields than this is a document, not a location. */
const MAX_COLUMNS = 60;

export async function readXmlFile(file: File): Promise<SourceTable> {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new ImportSourceError(
      `That file is ${formatMb(file.size)}. Split it into files under ${formatMb(MAX_SOURCE_BYTES)} and import them one at a time.`,
    );
  }

  return readXmlText(await file.text(), file.name);
}

export function readXmlText(text: string, label: string): SourceTable {
  const doc = parseXmlDocument(text, "that file");
  const records = findRecords(doc.documentElement);

  if (records.length === 0) {
    throw new ImportSourceError(
      "We couldn't find a repeating element in that file, so there's nothing to import one location per. Export it as CSV instead, or check it has one element per location.",
    );
  }

  const truncated = records.length > MAX_SOURCE_ROWS;
  const kept = records.slice(0, MAX_SOURCE_ROWS);

  // The union of every record's fields, in the order first encountered, so a
  // record missing a field lines up with the ones that have it instead of
  // shifting every later column.
  const columns: string[] = [];
  const seen = new Set<string>();
  const flattened = kept.map((record) => flatten(record));

  for (const fields of flattened) {
    for (const key of fields.keys()) {
      if (seen.has(key)) continue;
      if (columns.length >= MAX_COLUMNS) break;

      seen.add(key);
      columns.push(key);
    }
  }

  const cells: string[][] = [columns];
  for (const fields of flattened) {
    cells.push(columns.map((column) => fields.get(column) ?? ""));
  }

  return {
    label,
    cells,
    // Row 0 is a header we constructed, not one we found — no detection needed.
    headerRowIndex: 0,
    truncated,
  };
}

/**
 * The largest group of same-named siblings that look like records.
 *
 * Scored on count first, because the record element is by definition the one
 * that repeats per location — but weighted by how field-like its children are,
 * so a wrapper such as <stores> containing one <store> per city doesn't lose to
 * a deeper set of <tag> elements that repeat more often and mean less.
 */
function findRecords(root: Element): Element[] {
  let best: { elements: Element[]; score: number } = { elements: [], score: 0 };

  const visit = (element: Element, depth: number) => {
    if (depth > MAX_DEPTH) return;

    const groups = new Map<string, Element[]>();
    for (const child of Array.from(element.children)) {
      const group = groups.get(child.localName);
      if (group) group.push(child);
      else groups.set(child.localName, [child]);
    }

    for (const siblings of groups.values()) {
      const score = scoreGroup(siblings);
      if (score > best.score) best = { elements: siblings, score };

      // Recursing into the first sibling is enough: siblings share a shape, and
      // walking all of them on a 3,000-record file is quadratic for nothing.
      const first = siblings[0];
      if (first) visit(first, depth + 1);
    }
  };

  visit(root, 0);

  // A single top-level record is legitimate — a one-location file — but a lone
  // element with one child is a config file, not a location, and importing it as
  // a one-row table would only fail later with a worse message.
  if (best.elements.length === 0 && fieldCount(root) >= 2) return [root];

  return best.elements;
}

function scoreGroup(siblings: Element[]): number {
  if (siblings.length === 0) return 0;

  const fields = fieldCount(siblings[0]);
  if (fields === 0) return 0;

  // A record has a handful of fields. One with fifty is a document; one with a
  // single child is a list of scalars, which is a column, not a row.
  const shapeliness = fields === 1 ? 0.35 : Math.min(fields / 8, 1);

  return siblings.length * shapeliness;
}

/** Attributes plus child elements — everything that could become a column. */
function fieldCount(element: Element): number {
  return element.attributes.length + element.children.length;
}

/**
 * One record → column name / value pairs.
 *
 * Nested elements become dotted paths (`address.street`), attributes get an `@`
 * prefix so they can't collide with a child of the same name, and repeated
 * children are joined rather than overwriting each other — a <store> with three
 * <phone> elements should import all three, not the last one.
 */
function flatten(record: Element): Map<string, string> {
  const fields = new Map<string, string>();

  const add = (key: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    const existing = fields.get(key);
    fields.set(key, existing ? `${existing}, ${trimmed}` : trimmed);
  };

  const walk = (element: Element, prefix: string, depth: number) => {
    for (const attribute of Array.from(element.attributes)) {
      // Namespace declarations are markup, not data.
      if (attribute.name === "xmlns" || attribute.name.startsWith("xmlns:")) {
        continue;
      }
      add(`${prefix}@${attribute.localName}`, attribute.value);
    }

    const children = Array.from(element.children);

    if (children.length === 0 || depth >= MAX_DEPTH) {
      const text = element.textContent ?? "";
      if (text.trim()) add(prefix.replace(/\.$/, ""), text);
      return;
    }

    for (const child of children) {
      walk(child, `${prefix}${child.localName}.`, depth + 1);
    }
  };

  for (const attribute of Array.from(record.attributes)) {
    if (attribute.name === "xmlns" || attribute.name.startsWith("xmlns:")) {
      continue;
    }
    add(`@${attribute.localName}`, attribute.value);
  }

  for (const child of Array.from(record.children)) {
    walk(child, `${child.localName}.`, 1);
  }

  return fields;
}
