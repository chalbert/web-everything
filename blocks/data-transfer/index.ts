/**
 * @file blocks/data-transfer/index.ts
 * @description Public API for the Data-Transfer block — the runtime that implements
 * the Data-Transfer Intent (#007): one zone normalizing drag-drop, clipboard paste,
 * and `<input type=file>` into a single `receive` event under a declared `accepts`
 * contract, plus the copy-out (`emit`) half.
 */

// Element
export { default as DataTransferZoneElement } from './DataTransferZoneElement';

// Registration
export { registerDataTransferZone } from './registerDataTransferZone';

// Pure logic (normalization + acceptance) — DOM-free, reusable
export {
  kindForType,
  typeMatches,
  normalizeDataTransfer,
  normalizeFileList,
  evaluateAccept,
} from './normalize';

// Types
export type {
  PayloadKind,
  TransferFlow,
  Acceptance,
  TransferEffect,
  NormalizedItem,
  NormalizedPayload,
  AcceptSpec,
  RejectReason,
  ReceiveDetail,
  RejectDetail,
  EmitDetail,
} from './types';

export { RECEIVE_EVENT, REJECT_EVENT, EMIT_EVENT, DEFAULT_ACCEPT } from './types';
