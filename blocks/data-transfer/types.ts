/**
 * @file blocks/data-transfer/types.ts
 * @description Shared types for the Data-Transfer block — the runtime that
 * implements the Data-Transfer Intent (#007): the typed-payload + `accepts`
 * contract behind the native `DataTransfer` object shared by clipboard and drag
 * events. One zone normalizes drag-drop, clipboard paste, and `<input type=file>`
 * into a single `receive` event, and (for the emit half) writes a typed payload
 * onto an outgoing drag/copy.
 *
 * @module blocks/data-transfer
 */

// -----------------------------------------------------------------------
// Payload taxonomy — mirrors the intent's `payload` dimension
// -----------------------------------------------------------------------

/**
 * The typed content category a `DataTransfer` carries. A zone's `accepts` list is
 * expressed over these (intent dimension `payload`):
 * - `text`   — plain text (`text/plain`).
 * - `rich`   — rich content with a structured MIME (`text/html`, `text/uri-list`, …).
 * - `files`  — one or more `File` objects (`DataTransferItem.kind === 'file'`).
 * - `items`  — app-defined items under a custom/vendor MIME type.
 */
export type PayloadKind = 'text' | 'rich' | 'files' | 'items';

/** Direction of transfer across the zone (intent dimension `flow`). */
export type TransferFlow = 'receive' | 'emit' | 'both';

/** How a receiving zone constrains an incoming payload (intent dimension `acceptance`). */
export type Acceptance = 'declared' | 'any';

/** The copy-vs-move semantics surfaced as the drag `dropEffect`. */
export type TransferEffect = 'copy' | 'move';

// -----------------------------------------------------------------------
// Normalized payload — the single shape every source collapses to
// -----------------------------------------------------------------------

/** One normalized entry, drawn from a drag item, a clipboard item, or a file input. */
export interface NormalizedItem {
  /** The coarse category this item satisfies. */
  kind: PayloadKind;
  /** The concrete MIME type (`text/plain`, `text/html`, `image/png`, …). */
  type: string;
  /** The file, when `kind === 'files'`. */
  file?: File;
  /** The string value, when the item is textual (`text` / `rich`). */
  text?: string;
  /** Byte size when known (files only). */
  size?: number;
}

/** The unified payload delivered by the `receive` event — the whole point of the block. */
export interface NormalizedPayload {
  /** Every normalized item, in source order. */
  items: NormalizedItem[];
  /** Convenience: just the files. */
  files: File[];
  /** Convenience: the first plain-text value, if any. */
  text: string | null;
  /** Where the payload came from. */
  source: 'drop' | 'paste' | 'file-input';
}

// -----------------------------------------------------------------------
// Accept specification + acceptance result
// -----------------------------------------------------------------------

/** What a zone is willing to receive. An empty/`any` spec accepts everything. */
export interface AcceptSpec {
  /** Acceptance mode — `declared` enforces `kinds`/`types`/`maxSize`; `any` waves everything through. */
  acceptance: Acceptance;
  /** Allowed coarse kinds; empty means "any kind". */
  kinds: PayloadKind[];
  /** Allowed concrete MIME types or `type/*` wildcards; empty means "any type". */
  types: string[];
  /** Maximum per-file size in bytes; `null` means unlimited. */
  maxSize: number | null;
}

/** Why a payload was rejected — carried on the `reject` event detail. */
export interface RejectReason {
  /** The offending item. */
  item: NormalizedItem;
  /** The failed constraint. */
  rule: 'kind' | 'type' | 'size';
}

// -----------------------------------------------------------------------
// Event details
// -----------------------------------------------------------------------

/** Detail for the cancelable `receive` event (an accepted payload entered the zone). */
export interface ReceiveDetail {
  payload: NormalizedPayload;
  effect: TransferEffect;
}

/** Detail for the `reject` event (an incoming payload was not accepted). */
export interface RejectDetail {
  payload: NormalizedPayload;
  reasons: RejectReason[];
}

/** Detail for the `emit` event (the zone wrote a payload onto an outgoing drag/copy). */
export interface EmitDetail {
  items: NormalizedItem[];
  effect: TransferEffect;
}

export const RECEIVE_EVENT = 'receive';
export const REJECT_EVENT = 'reject';
export const EMIT_EVENT = 'emit';

/** Default accept spec — `any`, the most-permissive default (the restriction is opt-in). */
export const DEFAULT_ACCEPT: AcceptSpec = {
  acceptance: 'any',
  kinds: [],
  types: [],
  maxSize: null,
};
