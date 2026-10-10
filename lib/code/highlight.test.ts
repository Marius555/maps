import { describe, expect, it } from "vitest";

import { embedSnippet } from "@/lib/embed/snippet";

import { highlight, type CodeLanguage, type CodeToken } from "./highlight";

const joined = (tokens: CodeToken[]) => tokens.map((token) => token.text).join("");
const ofKind = (tokens: CodeToken[], kind: CodeToken["kind"]) =>
  tokens.filter((token) => token.kind === kind).map((token) => token.text);

const ANALYTICS_EXAMPLE = `<script>
  document.addEventListener("pinglide", function (event) {
    gtag("event", "map_" + event.detail.type, event.detail);
  });
</script>`;

const SNIPPET = embedSnippet({
  scriptUrl: "https://cdn.pinglide.com/embed/v1/map.js",
  snapshotUrl: "https://cdn.pinglide.com/snapshots/abc/live.json",
  tags: ["t1", "t2"],
});

describe("highlight", () => {
  it.each<[string, CodeLanguage]>([
    [SNIPPET, "html"],
    [ANALYTICS_EXAMPLE, "html"],
    ['<div id="map"></div>\n<!-- a comment -->\n<p>Text & more</p>', "html"],
    // Malformed: unclosed tag, unclosed quote, unclosed comment, stray `<`.
    ['<script src="x', "html"],
    ["<div class='a", "html"],
    ["<!-- never closed", "html"],
    ["a < b and <3 <", "html"],
    ["<script>const s = 'unterminated", "html"],
    ['const a = `x ${y}`; // done\nfoo(1.5)/2 /* c', "js"],
    ["", "html"],
  ])("gives back exactly the input: %j", (code, lang) => {
    expect(joined(highlight(code, lang))).toBe(code);
  });

  it("colours the embed snippet's tag, attributes and values", () => {
    const tokens = highlight(SNIPPET, "html");
    expect(ofKind(tokens, "tag")).toEqual(["script", "script"]);
    expect(ofKind(tokens, "attr")).toEqual([
      "type",
      "src",
      "data-snapshot",
      "data-tags",
      "data-height",
    ]);
    expect(ofKind(tokens, "string")).toContain('"module"');
    expect(ofKind(tokens, "string")).toContain('"https://cdn.pinglide.com/embed/v1/map.js"');
  });

  it("reads an inline script's body as JavaScript", () => {
    const tokens = highlight(ANALYTICS_EXAMPLE, "html");
    expect(ofKind(tokens, "keyword")).toEqual(["function"]);
    expect(ofKind(tokens, "fn")).toEqual(["addEventListener", "gtag"]);
    expect(ofKind(tokens, "string")).toEqual(['"pinglide"', '"event"', '"map_"']);
  });

  it("leaves a script with a src alone", () => {
    const tokens = highlight('<script src="a.js">const x</script>', "html");
    expect(ofKind(tokens, "keyword")).toEqual([]);
  });

  it("does not read a comment start as punctuation", () => {
    const tokens = highlight("f()// note", "js");
    expect(ofKind(tokens, "comment")).toEqual(["// note"]);
  });
});
