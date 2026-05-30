/**
 * @file blocks/type-ahead/registerTypeAhead.ts
 * @description Registration helper that registers the Type-Ahead behavior
 * with its default attribute name.
 */

import type CustomAttributeRegistry from '../../plugs/webbehaviors/CustomAttributeRegistry';
import TypeAheadBehavior from './TypeAheadBehavior';

/**
 * Register the Type-Ahead behavior with its default name (`type-ahead`).
 *
 * @param attributes - The CustomAttributeRegistry to register the behavior on
 */
export function registerTypeAhead(attributes: CustomAttributeRegistry): void {
  attributes.define('type-ahead', TypeAheadBehavior);
}
