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
