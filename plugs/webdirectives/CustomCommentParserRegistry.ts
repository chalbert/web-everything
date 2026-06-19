/**
 * @file webdirectives/CustomCommentParserRegistry.ts
 * @description Registry of comment-directive syntax parsers (#1132, webdirectives completion #1098).
 *
 * Extends the core `CustomRegistry` (`localName` `customCommentParsers`), mirroring
 * `we:plugs/webexpressions/CustomExpressionParserRegistry.ts`: named parsers register in definition order
 * and `parse(commentText)` tries each, returning the first that recognizes the comment. The shipped
 * default is the namespaced parser (`DefaultCommentParser`), so a project can register its own grammar
 * (`{#each}`, `*ngFor`, …) ahead of it. Pure string parsing — no DOM.
 */
import CustomRegistry from '../core/CustomRegistry';
import {
  type CustomCommentParser,
  type ParsedCommentDirective,
  defaultCommentParser,
  parseClosingMarker,
} from './CustomCommentParser';

/**
 * The registry of comment-directive parsers. A control hands a comment's text to {@link parse}; the
 * registry tries each parser in definition order and returns the first recognized directive, or `null`.
 */
export default class CustomCommentParserRegistry extends CustomRegistry<CustomCommentParser> {
  localName = 'customCommentParsers';

  /** Register a parser under `name`. Parsers are tried in definition order. */
  define(name: string, parser: CustomCommentParser): void {
    this.set(name, parser);
  }

  /** Try every registered parser in order; return the first recognized directive, or `null`. */
  parse(commentText: string): ParsedCommentDirective | null {
    for (const parser of this.values()) {
      const result = parser.parse(commentText);
      if (result) return result;
    }
    return null;
  }

  /** The directive name a closing marker (`/namespace:name`) closes, or `null` — the default grammar's boundary. */
  parseClosingMarker(commentText: string): string | null {
    return parseClosingMarker(commentText);
  }
}

/** A registry pre-loaded with the default namespaced parser. */
export function createDefaultCommentParserRegistry(): CustomCommentParserRegistry {
  const registry = new CustomCommentParserRegistry();
  registry.define('default', defaultCommentParser);
  return registry;
}
