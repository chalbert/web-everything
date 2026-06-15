/**
 * @file blocks/data-transfer/registerDataTransferZone.ts
 * @description Registration helper for the Data-Transfer block. Defines the
 * `<data-transfer-zone>` custom element with its default tag name. Idempotent —
 * safe to call more than once (e.g. across HMR or repeated bootstrap).
 */

import DataTransferZoneElement from './DataTransferZoneElement';

/**
 * Register `<data-transfer-zone>` with its default tag name.
 *
 * @example
 * ```typescript
 * import { registerDataTransferZone } from 'blocks/data-transfer';
 * registerDataTransferZone();
 * // …or with a custom tag:
 * customElements.define('drop-zone', DataTransferZoneElement);
 * ```
 */
export function registerDataTransferZone(): void {
  if (!customElements.get('data-transfer-zone')) {
    customElements.define('data-transfer-zone', DataTransferZoneElement);
  }
}
