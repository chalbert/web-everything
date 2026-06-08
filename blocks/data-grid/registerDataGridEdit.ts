/**
 * @file blocks/data-grid/registerDataGridEdit.ts
 * @description Registration helper for the Data Grid block's editable sub-pattern behavior with its
 * default attribute name (`grid:cell-edit`), mirroring registerDataGrid for the navigation half.
 */

import type CustomAttributeRegistry from '../../plugs/webbehaviors/CustomAttributeRegistry';
import DataGridEditBehavior from './DataGridEditBehavior';

/**
 * Register the Data Grid edit behavior with its default name (`grid:cell-edit`).
 *
 * @param attributes - The CustomAttributeRegistry to register the behavior on
 */
export function registerDataGridEdit(attributes: CustomAttributeRegistry): void {
  attributes.define('grid:cell-edit', DataGridEditBehavior);
}
