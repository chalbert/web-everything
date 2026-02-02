/**
 * @file UndeterminedAttribute.ts
 * @description Placeholder for attributes that haven't been resolved yet
 * @source Migrated from plateau/src/plugs/custom-attributes/UndeterminedAttribute.ts
 */

import CustomAttribute from './CustomAttribute';

/**
 * Placeholder class for undetermined custom attributes
 * 
 * Similar to UndeterminedElement, this class wraps attributes that are constructed
 * before their registry is available or before they can be resolved.
 * 
 * @example
 * ```typescript
 * const undetermined = new UndeterminedAttribute(TooltipAttribute, [{ value: 'Help text' }]);
 * // Later, when registry is available, upgrade to TooltipAttribute
 * ```
 */
export default class UndeterminedAttribute extends CustomAttribute {
  /**
   * Create an undetermined attribute wrapper
   * 
   * @param originalConstructor - The target attribute constructor
   * @param originalArguments - Arguments that were passed to the constructor
   */
  constructor(
    public originalConstructor: typeof CustomAttribute,
    public originalArguments: unknown[]
  ) {
    super();
  }
}
