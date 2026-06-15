/**
 * @file blocks/data-transfer/normalize.ts
 * @description Pure normalization + acceptance logic for the Data-Transfer block.
 * Kept DOM-free so it is unit-testable in isolation: a `DataTransfer`-shaped object
 * (or a `FileList`) goes in, a {@link NormalizedPayload} comes out, and an
 * {@link AcceptSpec} decides what survives. The element layer (DOM events, a11y,
 * drag feedback) composes these.
 */

import type {
  AcceptSpec,
  NormalizedItem,
  NormalizedPayload,
  PayloadKind,
  RejectReason,
} from './types';

/** Classify a MIME type into the coarse payload kind the intent enumerates. */
export function kindForType(type: string, isFile: boolean): PayloadKind {
  if (isFile) return 'files';
  if (type === 'text/plain' || type === '') return 'text';
  if (type === 'text/html' || type === 'text/uri-list' || type.startsWith('text/')) return 'rich';
  return 'items';
}

/** Match a concrete MIME type against an allow-entry that may be a `type/*` wildcard. */
export function typeMatches(type: string, allow: string): boolean {
  if (allow === type) return true;
  if (allow.endsWith('/*')) return type.startsWith(allow.slice(0, -1));
  return false;
}

/**
 * Collapse a native `DataTransfer` (from a drop or paste) into the unified payload.
 * Reads `items` when present (the richer API), else falls back to `files` + `getData`.
 */
export function normalizeDataTransfer(
  dt: DataTransfer,
  source: NormalizedPayload['source'],
): NormalizedPayload {
  const items: NormalizedItem[] = [];

  // Prefer the typed item list — it distinguishes file vs string kinds.
  if (dt.items && dt.items.length) {
    for (const it of Array.from(dt.items)) {
      if (it.kind === 'file') {
        const file = it.getAsFile();
        if (file) items.push({ kind: 'files', type: file.type || 'application/octet-stream', file, size: file.size });
      } else {
        // String items: capture the type now; the value is resolved synchronously from getData below.
        const type = it.type || 'text/plain';
        const text = typeof dt.getData === 'function' ? dt.getData(type) : '';
        items.push({ kind: kindForType(type, false), type, text });
      }
    }
  } else {
    // Fallback path (older clipboard shapes): files + a plain-text read.
    for (const file of Array.from(dt.files ?? [])) {
      items.push({ kind: 'files', type: file.type || 'application/octet-stream', file, size: file.size });
    }
    const text = typeof dt.getData === 'function' ? dt.getData('text/plain') : '';
    if (text) items.push({ kind: 'text', type: 'text/plain', text });
  }

  return collect(items, source);
}

/** Collapse a `FileList` (from `<input type=file>`) into the unified payload. */
export function normalizeFileList(files: FileList | File[]): NormalizedPayload {
  const items: NormalizedItem[] = Array.from(files).map((file) => ({
    kind: 'files' as const,
    type: file.type || 'application/octet-stream',
    file,
    size: file.size,
  }));
  return collect(items, 'file-input');
}

function collect(items: NormalizedItem[], source: NormalizedPayload['source']): NormalizedPayload {
  return {
    items,
    files: items.filter((i) => i.file).map((i) => i.file as File),
    text: items.find((i) => i.kind === 'text')?.text ?? null,
    source,
  };
}

/**
 * Evaluate a payload against a zone's accept spec. `any` acceptance passes everything;
 * `declared` enforces kinds, types, and per-file size. Returns the offending items so
 * the caller can surface a precise `reject`.
 */
export function evaluateAccept(
  payload: NormalizedPayload,
  spec: AcceptSpec,
): { accepted: boolean; reasons: RejectReason[] } {
  if (spec.acceptance === 'any') return { accepted: true, reasons: [] };

  const reasons: RejectReason[] = [];
  for (const item of payload.items) {
    if (spec.kinds.length && !spec.kinds.includes(item.kind)) {
      reasons.push({ item, rule: 'kind' });
      continue;
    }
    if (spec.types.length && !spec.types.some((t) => typeMatches(item.type, t))) {
      reasons.push({ item, rule: 'type' });
      continue;
    }
    if (spec.maxSize != null && item.size != null && item.size > spec.maxSize) {
      reasons.push({ item, rule: 'size' });
    }
  }
  return { accepted: reasons.length === 0, reasons };
}
