/**
 * @file webdirectives/CustomCommentParser.ts
 * @description The comment-directive parser contract + the default namespaced parser (#1132,
 * webdirectives completion #1098).
 *
 * The comment *syntax* is deliberately NOT part of the core spec (`we:src/_includes/project-
 * webdirectives.njk` §3) — a {@link CustomCommentParser} turns a comment's text into a directive
 * `{ name, options }` (or `null` when it doesn't recognize it), so a project/framework can register its
 * own grammar. The shipped {@link DefaultCommentParser} implements the namespaced default:
 *
 *   <!-- namespace:directive-name
 *       option1="value1"
 *       option2="value2"
 *   -->
 *   …content…
 *   <!-- /namespace:directive-name -->
 *
 * Pure string parsing — no DOM. The registry (`CustomCommentParserRegistry`) consumes this; the runtime
 * `CustomCommentRegistry` (#1131) uses the parsed `name` to match a comment to a registered directive.
 */

/** The directive a parser extracts from a comment's text — its `namespace:name` plus parsed options. */
export interface ParsedCommentDirective {
  name: string;
  options: Record<string, unknown>;
}

/** A comment-directive syntax parser. `parse` returns the directive, or `null` if it doesn't recognize it. */
export interface CustomCommentParser {
  parse(commentText: string): ParsedCommentDirective | null;
}

/** A `namespace:name` token — a namespace and a directive name, each `[A-Za-z][\w-]*`. */
const DIRECTIVE_NAME = '[A-Za-z][\\w-]*:[A-Za-z][\\w-]*';
const OPENING_RE = new RegExp(`^(${DIRECTIVE_NAME})`);
const CLOSING_RE = new RegExp(`^/(${DIRECTIVE_NAME})\\s*$`);
/** One `key="value"` / `key='value'` / `key=bare` / bare-`key` option token. */
const OPTION_RE = /([A-Za-z_][\w-]*)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;

/** Coerce a raw option string to boolean / number / string (a bare key with no `=` becomes `true`). */
function coerce(raw: string | undefined): unknown {
  if (raw === undefined) return true;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw !== '' && !Number.isNaN(Number(raw))) return Number(raw);
  return raw;
}

/** Parse the option key/value pairs that follow a directive name. */
export function parseCommentOptions(optionsText: string): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  for (const m of optionsText.matchAll(OPTION_RE)) {
    const [, key, dq, sq, bare] = m;
    options[key] = coerce(dq ?? sq ?? bare);
  }
  return options;
}

/** The directive name a closing marker (`/namespace:name`) closes, or `null` if `text` is not one. */
export function parseClosingMarker(commentText: string): string | null {
  const m = CLOSING_RE.exec(commentText.trim());
  return m ? m[1] : null;
}

/**
 * The default namespaced comment parser. Recognizes `<!-- namespace:name option="v" … -->` as an opening
 * directive and returns `{ name, options }`; returns `null` for a closing marker (`/namespace:name`) or any
 * comment that doesn't lead with a `namespace:name` token, so a non-directive comment is left untouched.
 */
export class DefaultCommentParser implements CustomCommentParser {
  parse(commentText: string): ParsedCommentDirective | null {
    const text = commentText.trim();
    if (!text || text.startsWith('/')) return null; // a closing marker is not an opening directive
    const m = OPENING_RE.exec(text);
    if (!m) return null;
    return { name: m[1], options: parseCommentOptions(text.slice(m[0].length)) };
  }
}

/** The shipped default parser instance. */
export const defaultCommentParser = new DefaultCommentParser();
