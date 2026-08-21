import { ImportSourceError } from "./types";

/**
 * XML text → a DOM document.
 *
 * `DOMParser` rather than a hand-rolled tokeniser: these are untrusted files, and
 * a real parser already knows about CDATA, entities, namespaces, comments and
 * every quoting rule we would otherwise get subtly wrong. It costs no bundle
 * weight because the browser ships it, and it does not resolve external entities.
 *
 * Node has no DOMParser, so the unit tests for anything reaching this run under
 * happy-dom via a `// @vitest-environment happy-dom` docblock.
 */
export function parseXmlDocument(text: string, what: string): Document {
  if (typeof DOMParser === "undefined") {
    throw new ImportSourceError(
      "This browser can't read XML files. Export your locations as CSV and try again.",
    );
  }

  const doc = new DOMParser().parseFromString(text, "application/xml");

  // DOMParser reports failure as a document *containing* a parsererror element
  // rather than by throwing — the one trap in the API.
  const failure = doc.querySelector("parsererror");
  if (failure) {
    throw new ImportSourceError(
      `We couldn't read ${what}: ${firstLine(failure.textContent ?? "")}`,
    );
  }

  if (!doc.documentElement) {
    throw new ImportSourceError(`We couldn't read ${what}: it has no content.`);
  }

  return doc;
}

/**
 * Children matching a local name, ignoring namespace prefixes.
 *
 * Office documents namespace everything and different producers pick different
 * prefixes, so matching on `tagName` alone finds nothing in half the files that
 * exist. `localName` is the part that's actually stable.
 */
export function childrenNamed(parent: Element | Document, name: string): Element[] {
  const found: Element[] = [];

  for (const child of Array.from(parent.children)) {
    if (child.localName === name) found.push(child);
  }

  return found;
}

export function firstNamed(
  parent: Element | Document,
  name: string,
): Element | null {
  return childrenNamed(parent, name)[0] ?? null;
}

/** Every descendant with this local name, in document order. */
export function descendantsNamed(root: Element | Document, name: string): Element[] {
  return Array.from(root.getElementsByTagName("*")).filter(
    (element) => element.localName === name,
  );
}

function firstLine(text: string): string {
  return text.split("\n")[0]?.trim() || "it isn't valid XML.";
}
