/**
 * Just enough syntax highlighting for the code this app shows people: the
 * embed snippet and the few HTML/JS examples in the guides.
 *
 * **No dependency, on purpose.** A general highlighter is tens of kilobytes of
 * grammars for a handful of short snippets in two languages, and §3 asks before
 * adding a package. This covers what those snippets contain — tags, attributes,
 * quoted values, comments, strings, numbers, keywords, calls — and anything it
 * does not recognise is passed through as plain text rather than guessed at.
 *
 * **The tokens always add back up to the input**, character for character. A
 * highlighter that drops or duplicates a character puts a broken snippet on
 * somebody's clipboard the moment they copy what they can see, so that is the
 * one property the tests hold it to, malformed input included.
 */

export type CodeTokenKind =
  | "tag"
  | "attr"
  | "string"
  | "comment"
  | "keyword"
  | "fn"
  | "number"
  | "punct";

export type CodeToken = { text: string; kind?: CodeTokenKind };

export type CodeLanguage = "html" | "js";

export function highlight(code: string, lang: CodeLanguage): CodeToken[] {
  const tokens: CodeToken[] = [];
  const push = (text: string, kind?: CodeTokenKind) => {
    if (!text) return;
    const last = tokens.at(-1);
    // Adjacent runs of the same kind merge, so plain text is one span, not many.
    if (last && last.kind === kind) last.text += text;
    else tokens.push(kind ? { text, kind } : { text });
  };

  if (lang === "js") highlightJs(code, push);
  else highlightHtml(code, push);
  return tokens;
}

type Push = (text: string, kind?: CodeTokenKind) => void;

const HTML_COMMENT = /<!--[\s\S]*?(?:-->|$)/y;
const TAG_OPEN = /<\/?[A-Za-z][\w:-]*/y;
const TAG_CLOSE = /\/?>/y;
const ATTR_NAME = /[^\s"'<>/=]+/y;
const QUOTED = /"[^"]*(?:"|$)|'[^']*(?:'|$)/y;
const UNQUOTED = /[^\s"'<>=`]+/y;
const SPACE = /\s+/y;

function matchAt(pattern: RegExp, source: string, index: number): string | null {
  pattern.lastIndex = index;
  return pattern.exec(source)?.[0] ?? null;
}

function highlightHtml(code: string, push: Push): void {
  let i = 0;

  while (i < code.length) {
    const comment = matchAt(HTML_COMMENT, code, i);
    if (comment) {
      push(comment, "comment");
      i += comment.length;
      continue;
    }

    const open = matchAt(TAG_OPEN, code, i);
    if (!open) {
      // Text up to the next `<`, or the one character that was not a tag.
      const next = code.indexOf("<", i + 1);
      const end = next === -1 ? code.length : next;
      push(code.slice(i, end));
      i = end;
      continue;
    }

    const isClosing = open.startsWith("</");
    const name = open.slice(isClosing ? 2 : 1).toLowerCase();
    push(open.slice(0, isClosing ? 2 : 1), "punct");
    push(open.slice(isClosing ? 2 : 1), "tag");
    i += open.length;

    // Attributes, up to the tag's own `>` or the end of the input.
    let closed = false;
    let hasSrc = false;
    while (i < code.length) {
      const space = matchAt(SPACE, code, i);
      if (space) {
        push(space);
        i += space.length;
        continue;
      }
      const close = matchAt(TAG_CLOSE, code, i);
      if (close) {
        push(close, "punct");
        i += close.length;
        closed = true;
        break;
      }
      if (code[i] === "=") {
        push("=", "punct");
        i += 1;
        const value = matchAt(QUOTED, code, i) ?? matchAt(UNQUOTED, code, i);
        if (value) {
          push(value, "string");
          i += value.length;
        }
        continue;
      }
      const attr = matchAt(ATTR_NAME, code, i);
      if (attr) {
        if (attr.toLowerCase() === "src") hasSrc = true;
        push(attr, "attr");
        i += attr.length;
        continue;
      }
      // A stray quote or `<` inside a tag: pass it through and move on.
      push(code[i]);
      i += 1;
    }

    // An inline script's body is JavaScript, up to its closing tag.
    if (closed && !isClosing && name === "script" && !hasSrc) {
      const end = code.toLowerCase().indexOf("</script", i);
      const stop = end === -1 ? code.length : end;
      highlightJs(code.slice(i, stop), push);
      i = stop;
    }
  }
}

const JS_KEYWORDS = new Set([
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "else",
  "export",
  "false",
  "for",
  "function",
  "if",
  "import",
  "in",
  "let",
  "new",
  "null",
  "of",
  "return",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "undefined",
  "var",
  "while",
]);

const JS_LINE_COMMENT = /\/\/[^\n]*/y;
const JS_BLOCK_COMMENT = /\/\*[\s\S]*?(?:\*\/|$)/y;
const JS_STRING = /"(?:[^"\\\n]|\\.)*(?:"|$)|'(?:[^'\\\n]|\\.)*(?:'|$)|`(?:[^`\\]|\\[\s\S])*(?:`|$)/y;
const JS_NUMBER = /\d[\d_]*(?:\.\d+)?/y;
const JS_WORD = /[A-Za-z_$][\w$]*/y;
const JS_CALL_AHEAD = /\s*\(/y;
// No `/` in a run: `)//` would swallow the start of a comment. A lone slash
// falls through to plain text.
const JS_PUNCT = /[{}()[\];,.:?=+\-*%<>!&|^~]+/y;

function highlightJs(code: string, push: Push): void {
  let i = 0;

  while (i < code.length) {
    const comment = matchAt(JS_LINE_COMMENT, code, i) ?? matchAt(JS_BLOCK_COMMENT, code, i);
    if (comment) {
      push(comment, "comment");
      i += comment.length;
      continue;
    }

    const string = matchAt(JS_STRING, code, i);
    if (string) {
      push(string, "string");
      i += string.length;
      continue;
    }

    const word = matchAt(JS_WORD, code, i);
    if (word) {
      const end = i + word.length;
      const kind: CodeTokenKind | undefined = JS_KEYWORDS.has(word)
        ? "keyword"
        : matchAt(JS_CALL_AHEAD, code, end) !== null
          ? "fn"
          : undefined;
      push(word, kind);
      i = end;
      continue;
    }

    const number = matchAt(JS_NUMBER, code, i);
    if (number) {
      push(number, "number");
      i += number.length;
      continue;
    }

    const punct = matchAt(JS_PUNCT, code, i);
    if (punct) {
      push(punct, "punct");
      i += punct.length;
      continue;
    }

    push(code[i]);
    i += 1;
  }
}
