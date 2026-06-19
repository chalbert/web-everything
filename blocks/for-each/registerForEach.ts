/**
 * Register the for-each directive with the custom attribute registry.
 *
 * @module blocks/for-each
 */

import type CustomAttributeRegistry from '@frontierui/plugs/webbehaviors/CustomAttributeRegistry';
import ForEachBehavior from './ForEachBehavior';

export function registerForEach(attributes: CustomAttributeRegistry): void {
  attributes.define('for-each', ForEachBehavior);
}
