/**
 * @file plugs/webdirectives/multiTemplate.ts
 * @description Multi-template slot-resolution helper (#1133, webdirectives completion #1098).
 *
 * A bounded, non-invasive subsystem affordance: collect the `<template slot="…">` set that lives inside a
 * directive comment's open/close boundary into a `Map<slotName, HTMLTemplateElement>` for a multi-template
 * directive (`resource:loader`, `switch`) to stamp. It patches no global and reads only the DOM around the
 * boundary — it does NOT define a directive, register anything, or stamp; it just resolves the slot map.
 *
 * The boundary is the webdirectives comment grammar (`we:src/_includes/project-webdirectives.njk:134-209,
 * 452-459`): an opening `<!-- resource:loader … -->` comment and its matching closing `<!-- /resource:loader -->`
 * comment (detected via {@link parseClosingMarker}). Everything between the two — at the sibling level — is
 * scanned for `<template slot="name">` elements; the last one with a given slot name wins (mirrors the
 * native named-slot last-write semantics). A `<template>` with no `slot` attribute is collected under the
 * empty-string default-slot key, matching `<slot>` (no name = default slot).
 */
import { parseClosingMarker } from './CustomCommentParser';

/** The default-slot key — a `<template>` carrying no `slot` attribute (mirrors the native default `<slot>`). */
export const DEFAULT_SLOT = '' as const;

/** The resolved slot map: slot name → the template to stamp for it. */
export type SlotTemplateMap = Map<string, HTMLTemplateElement>;

/**
 * Read a comment node's directive name if it is an OPENING directive comment, else `null`. We treat the
 * leading `namespace:name` token (before any options/whitespace) as the directive name, and reject a
 * closing marker (`/namespace:name`).
 */
function openingDirectiveName(comment: Comment): string | null {
  const text = comment.data.trim();
  if (!text || text.startsWith('/')) return null;
  const token = text.split(/\s+/, 1)[0];
  // a namespaced directive token looks like `namespace:name`; a plain comment has no colon-led token
  return /^[\w-]+:[\w-]+$/.test(token) ? token : null;
}

/**
 * Collect the `<template slot="…">` set inside the open/close boundary of `openComment` into a slot map.
 *
 * @param openComment the opening directive comment (e.g. `<!-- resource:loader name="x" -->`).
 * @returns a `Map` of slot name → template element. Empty if the comment is not an opening directive, or
 *   the region holds no templates. The default slot (a `<template>` with no `slot` attribute) is keyed by
 *   {@link DEFAULT_SLOT}.
 *
 * Boundary rule: scan forward over `openComment`'s siblings until the matching closing comment
 * (`<!-- /namespace:name -->`) or the end of the sibling list. A *nested* opening directive of a different
 * name is stepped over (its own templates belong to it, not to this region) by skipping to its close.
 */
export function collectSlotTemplates(openComment: Comment): SlotTemplateMap {
  const map: SlotTemplateMap = new Map();
  const directiveName = openingDirectiveName(openComment);
  if (!directiveName) return map;

  let node: Node | null = openComment.nextSibling;
  while (node) {
    if (node.nodeType === Node.COMMENT_NODE) {
      const closed = parseClosingMarker((node as Comment).data);
      // The matching closing marker ends this region.
      if (closed && (closed === directiveName || `${closed}` === directiveName)) break;
      // A nested opening directive: skip its whole region so we don't absorb its templates.
      const nestedName = openingDirectiveName(node as Comment);
      if (nestedName && nestedName !== directiveName) {
        node = skipNestedRegion(node as Comment, nestedName);
        continue;
      }
    } else if (node instanceof HTMLTemplateElement) {
      const slot = node.getAttribute('slot') ?? DEFAULT_SLOT;
      map.set(slot, node); // last write wins, like native named slots
    }
    node = node.nextSibling;
  }
  return map;
}

/** Skip past a nested directive region; returns the node AFTER the nested close (or the last sibling). */
function skipNestedRegion(nestedOpen: Comment, nestedName: string): Node | null {
  let node: Node | null = nestedOpen.nextSibling;
  while (node) {
    if (node.nodeType === Node.COMMENT_NODE) {
      const closed = parseClosingMarker((node as Comment).data);
      if (closed === nestedName) return node.nextSibling;
    }
    node = node.nextSibling;
  }
  return null;
}
