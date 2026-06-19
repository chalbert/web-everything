/**
 * @file webdirectives/index.ts
 * @description Custom template directives module
 */

if (typeof window !== 'undefined') {
  console.log('[webdirectives] Module loaded');
}

export { default as CustomTemplateDirective } from './CustomTemplateDirective';
export type { CustomTemplateDirectiveOptions } from './CustomTemplateDirective';
export { default as CustomComment } from './CustomComment';
export type { CustomCommentOptions } from './CustomComment';
export { default as CustomCommentRegistry } from './CustomCommentRegistry';
export type { CommentDefinition, CustomCommentConstructor } from './CustomCommentRegistry';
export {
  DefaultCommentParser,
  defaultCommentParser,
  parseCommentOptions,
  parseClosingMarker,
} from './CustomCommentParser';
export type { CustomCommentParser, ParsedCommentDirective } from './CustomCommentParser';
export {
  default as CustomCommentParserRegistry,
  createDefaultCommentParserRegistry,
} from './CustomCommentParserRegistry';

export { collectSlotTemplates, DEFAULT_SLOT } from './multiTemplate';
export type { SlotTemplateMap } from './multiTemplate';
