/**
 * @module webbehaviors
 * @description Custom Attribute system for declarative behavior attachment
 * 
 * Web Behaviors enable declarative attachment of custom functionality through
 * HTML attributes, similar to how Custom Elements enable custom tags.
 * 
 * @example
 * ```typescript
 * import { CustomAttribute, CustomAttributeRegistry } from '@web-everything/webbehaviors';
 * 
 * // Define a custom attribute
 * class TooltipAttribute extends CustomAttribute {
 *   attachedCallback() {
 *     this.target.addEventListener('mouseenter', this.show);
 *   }
 * 
 *   detachedCallback() {
 *     this.target.removeEventListener('mouseenter', this.show);
 *   }
 * 
 *   show = () => {
 *     console.log('Showing tooltip:', this.value);
 *   };
 * }
 * 
 * // Register and activate
 * const registry = new CustomAttributeRegistry();
 * registry.define('tooltip', TooltipAttribute);
 * registry.upgrade(document.body);
 * 
 * // Use in HTML
 * // <button tooltip="Click me!">Button</button>
 * ```
 * 
 * @see https://github.com/chalbert/web-everything/tree/main/plugs/webbehaviors
 */

export { default as CustomAttribute } from './CustomAttribute';
export { default as CustomAttributeRegistry } from './CustomAttributeRegistry';
export { default as UndeterminedAttribute } from './UndeterminedAttribute';

export type {
  CustomAttributeOptions,
  ImplementedAttribute,
} from './CustomAttribute';

export type {
  AttributeDefinition,
  CustomAttributeOptions as CustomAttributeRegistrationOptions,
} from './CustomAttributeRegistry';

// Log module load in development
if (process.env.NODE_ENV !== 'production') {
  console.log('[webbehaviors] Custom Attribute system ready');
}
