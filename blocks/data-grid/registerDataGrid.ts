/**
 * @file blocks/data-grid/registerDataGrid.ts
 * @description Registration helper that registers the Data Grid behavior with its default
 * attribute name (`grid:cell-navigation`), mirroring the nav / type-ahead registration helpers.
 */

import type CustomAttributeRegistry from '../../plugs/webbehaviors/CustomAttributeRegistry';
import DataGridBehavior from './DataGridBehavior';

/**
 * Register the Data Grid behavior with its default name (`grid:cell-navigation`).
 *
 * @param attributes - The CustomAttributeRegistry to register the behavior on
 */
export function registerDataGrid(attributes: CustomAttributeRegistry): void {
  attributes.define('grid:cell-navigation', DataGridBehavior);
}
