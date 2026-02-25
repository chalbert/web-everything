/**
 * @file blocks/navigation/registerNavigation.ts
 * @description Registration helper that registers all navigation behaviors
 * with default names.
 */

import type CustomAttributeRegistry from '../../plugs/webbehaviors/CustomAttributeRegistry';
import NavListBehavior from './NavListBehavior';
import NavSectionBehavior from './NavSectionBehavior';

/**
 * Register all navigation behaviors with default names.
 *
 * @param attributes - The CustomAttributeRegistry to register behaviors on
 */
export function registerNavigation(attributes: CustomAttributeRegistry): void {
  attributes.define('nav:list', NavListBehavior);
  attributes.define('nav:section', NavSectionBehavior);
}
