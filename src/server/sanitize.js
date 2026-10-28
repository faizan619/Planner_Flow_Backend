import { z } from "zod";

// Input clean-up on top of the zod schemas (which already check types and lengths).

// Characters that have no place in names, titles and notes: control
// characters (tab and line breaks are kept) and the Unicode bidi overrides
// that make text display in a different order than it's stored ("Trojan
// Source"). Zero-width joiners stay: emoji need them.
const UNSAFE_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F‪-‮⁦-⁩]/g;
export const stripUnsafeChars = (value) => (typeof value === "string" ? value.replace(UNSAFE_CHARS, "") : value);

// Wraps a string schema so unsafe characters are removed before it checks
// length etc.:  title: text(z.string().trim().min(1).max(200))
export const text = (schema) => z.preprocess(stripUnsafeChars, schema);

// Lesson notes are HTML from the app's editor. Only the formatting tags it
// writes are kept, with no attributes (so no onerror=, href=javascript:,
// style= …); script-like elements are dropped with their content; any other
// tag is dropped but its text kept. Stray "<" become text.
const ALLOWED = new Set(["p", "br", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i", "u", "s", "strike", "del", "code", "mark", "ul", "ol", "li", "blockquote"]);
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "noscript", "template", "svg", "math", "textarea", "select", "title", "head"]);

export function sanitizeRichText(html) {
  if (typeof html !== "string" || !html) return html;
  let out = "";
  let skipping = null; // inside a DROP_WITH_CONTENT element: its name
  for (const [token] of stripUnsafeChars(html).matchAll(/<!--[\s\S]*?(?:-->|$)|<[^<>]*>|[^<]+|</g)) {
    const tag = /^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(token);
    if (skipping) {
      if (tag && tag[1] === "/" && tag[2].toLowerCase() === skipping) skipping = null;
      continue;
    }
    if (token.startsWith("<!")) continue; // comments, <!DOCTYPE>, CDATA
    if (!tag) {
      out += token === "<" ? "&lt;" : token.replace(/>/g, "&gt;");
      continue;
    }
    const [, closing, rawName] = tag;
    const name = rawName.toLowerCase();
    if (DROP_WITH_CONTENT.has(name)) {
      if (!closing && !/\/\s*>$/.test(token)) skipping = name;
      continue;
    }
    if (!ALLOWED.has(name)) continue;
    if (name === "br") out += closing ? "" : "<br>";
    else out += `<${closing}${name}>`;
  }
  return out;
}
