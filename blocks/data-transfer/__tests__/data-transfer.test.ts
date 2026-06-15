/**
 * @file blocks/data-transfer/__tests__/data-transfer.test.ts
 * @description Unit tests for the Data-Transfer block — the pure normalize/accept
 * logic (DataTransfer / FileList → unified payload, accept-spec enforcement) and the
 * `<data-transfer-zone>` element's single-funnel receive/reject behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  kindForType,
  typeMatches,
  normalizeDataTransfer,
  normalizeFileList,
  evaluateAccept,
} from '../normalize';
import type { AcceptSpec } from '../types';
import DataTransferZoneElement from '../DataTransferZoneElement';
import { registerDataTransferZone } from '../registerDataTransferZone';

// A minimal DataTransfer-shaped stub (happy-dom's DataTransfer is incomplete for items).
function mockDataTransfer(opts: {
  files?: File[];
  strings?: Record<string, string>; // type -> value
}): DataTransfer {
  const files = opts.files ?? [];
  const strings = opts.strings ?? {};
  const items = [
    ...files.map((file) => ({ kind: 'file' as const, type: file.type, getAsFile: () => file })),
    ...Object.entries(strings).map(([type]) => ({ kind: 'string' as const, type, getAsFile: () => null })),
  ];
  return {
    items: items as unknown as DataTransferItemList,
    files: files as unknown as FileList,
    getData: (type: string) => strings[type] ?? '',
    setData: vi.fn(),
    dropEffect: 'none',
    effectAllowed: 'all',
  } as unknown as DataTransfer;
}

const fileOf = (name: string, type: string, size: number): File => {
  const f = new File(['x'], name, { type });
  // Pin size for deterministic assertions without allocating `size` bytes.
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

describe('kindForType', () => {
  it('classifies files, text, rich, and custom items', () => {
    expect(kindForType('image/png', true)).toBe('files');
    expect(kindForType('text/plain', false)).toBe('text');
    expect(kindForType('text/html', false)).toBe('rich');
    expect(kindForType('text/uri-list', false)).toBe('rich');
    expect(kindForType('application/x-app-card', false)).toBe('items');
  });
});

describe('typeMatches', () => {
  it('matches exact and wildcard MIME entries', () => {
    expect(typeMatches('image/png', 'image/png')).toBe(true);
    expect(typeMatches('image/png', 'image/*')).toBe(true);
    expect(typeMatches('image/png', 'video/*')).toBe(false);
    expect(typeMatches('text/plain', 'text/html')).toBe(false);
  });
});

describe('normalizeDataTransfer', () => {
  it('collapses a mixed drag payload (file + text) into one shape', () => {
    const png = fileOf('a.png', 'image/png', 2048);
    const dt = mockDataTransfer({ files: [png], strings: { 'text/plain': 'hello' } });
    const payload = normalizeDataTransfer(dt, 'drop');

    expect(payload.source).toBe('drop');
    expect(payload.items).toHaveLength(2);
    expect(payload.files).toEqual([png]);
    expect(payload.text).toBe('hello');
    expect(payload.items[0]).toMatchObject({ kind: 'files', type: 'image/png', size: 2048 });
    expect(payload.items[1]).toMatchObject({ kind: 'text', type: 'text/plain', text: 'hello' });
  });

  it('reads html as a rich item from a paste', () => {
    const dt = mockDataTransfer({ strings: { 'text/html': '<b>hi</b>' } });
    const payload = normalizeDataTransfer(dt, 'paste');
    expect(payload.source).toBe('paste');
    expect(payload.items[0]).toMatchObject({ kind: 'rich', type: 'text/html', text: '<b>hi</b>' });
  });
});

describe('normalizeFileList', () => {
  it('maps a file input selection to file items', () => {
    const payload = normalizeFileList([fileOf('doc.pdf', 'application/pdf', 100)]);
    expect(payload.source).toBe('file-input');
    expect(payload.files).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({ kind: 'files', type: 'application/pdf', size: 100 });
  });
});

describe('evaluateAccept', () => {
  const decl = (over: Partial<AcceptSpec>): AcceptSpec => ({
    acceptance: 'declared',
    kinds: [],
    types: [],
    maxSize: null,
    ...over,
  });

  it('any-acceptance passes everything', () => {
    const payload = normalizeFileList([fileOf('huge.zip', 'application/zip', 1e9)]);
    expect(evaluateAccept(payload, { acceptance: 'any', kinds: [], types: [], maxSize: null }).accepted).toBe(true);
  });

  it('rejects a disallowed kind', () => {
    const payload = normalizeDataTransfer(mockDataTransfer({ strings: { 'text/plain': 'no files here' } }), 'paste');
    const res = evaluateAccept(payload, decl({ kinds: ['files'] }));
    expect(res.accepted).toBe(false);
    expect(res.reasons[0].rule).toBe('kind');
  });

  it('rejects a disallowed MIME type but accepts a wildcard match', () => {
    const png = normalizeFileList([fileOf('a.png', 'image/png', 10)]);
    expect(evaluateAccept(png, decl({ types: ['application/pdf'] })).reasons[0].rule).toBe('type');
    expect(evaluateAccept(png, decl({ types: ['image/*'] })).accepted).toBe(true);
  });

  it('rejects a file over maxSize', () => {
    const big = normalizeFileList([fileOf('big.png', 'image/png', 5000)]);
    const res = evaluateAccept(big, decl({ maxSize: 1000 }));
    expect(res.accepted).toBe(false);
    expect(res.reasons[0].rule).toBe('size');
  });
});

describe('<data-transfer-zone> element', () => {
  beforeEach(() => {
    registerDataTransferZone();
  });

  it('registers idempotently', () => {
    registerDataTransferZone();
    expect(customElements.get('data-transfer-zone')).toBe(DataTransferZoneElement);
  });

  it('parses attributes into a declared accept spec and sets a11y defaults', () => {
    const el = document.createElement('data-transfer-zone') as DataTransferZoneElement;
    el.setAttribute('accepts', 'files');
    el.setAttribute('accept-types', 'image/*,application/pdf');
    el.setAttribute('max-size', '2048');
    el.setAttribute('effect', 'move');
    document.body.append(el);

    expect(el.acceptSpec).toEqual({
      acceptance: 'declared',
      kinds: ['files'],
      types: ['image/*', 'application/pdf'],
      maxSize: 2048,
    });
    expect(el.effect).toBe('move');
    expect(el.getAttribute('role')).toBe('group');
    expect(el.getAttribute('aria-label')).toBeTruthy();
    el.remove();
  });

  it('defaults to the most-permissive `any` acceptance with no constraints', () => {
    const el = document.createElement('data-transfer-zone') as DataTransferZoneElement;
    document.body.append(el);
    expect(el.acceptSpec.acceptance).toBe('any');
    el.remove();
  });

  it('fires a cancelable `receive` for an accepted drop', () => {
    const el = document.createElement('data-transfer-zone') as DataTransferZoneElement;
    el.setAttribute('accepts', 'files');
    document.body.append(el);

    const onReceive = vi.fn();
    el.addEventListener('receive', onReceive);

    const drop = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(drop, 'dataTransfer', { value: mockDataTransfer({ files: [fileOf('a.png', 'image/png', 10)] }) });
    el.dispatchEvent(drop);

    expect(onReceive).toHaveBeenCalledOnce();
    const detail = onReceive.mock.calls[0][0].detail;
    expect(detail.payload.files).toHaveLength(1);
    expect(detail.payload.source).toBe('drop');
    el.remove();
  });

  it('fires `reject` (not `receive`) for a payload that violates the contract', () => {
    const el = document.createElement('data-transfer-zone') as DataTransferZoneElement;
    el.setAttribute('accepts', 'files');
    el.setAttribute('max-size', '5');
    document.body.append(el);

    const onReceive = vi.fn();
    const onReject = vi.fn();
    el.addEventListener('receive', onReceive);
    el.addEventListener('reject', onReject);

    const drop = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(drop, 'dataTransfer', { value: mockDataTransfer({ files: [fileOf('big.png', 'image/png', 9999)] }) });
    el.dispatchEvent(drop);

    expect(onReceive).not.toHaveBeenCalled();
    expect(onReject).toHaveBeenCalledOnce();
    expect(onReject.mock.calls[0][0].detail.reasons[0].rule).toBe('size');
    el.remove();
  });

  it('emit flow writes the queued payload onto an outgoing drag', () => {
    const el = document.createElement('data-transfer-zone') as DataTransferZoneElement;
    el.setAttribute('flow', 'emit');
    document.body.append(el);
    el.setEmitPayload([{ kind: 'text', type: 'text/plain', text: 'dragged' }]);

    const dt = mockDataTransfer({});
    const onEmit = vi.fn();
    el.addEventListener('emit', onEmit);
    const dragstart = new Event('dragstart', { bubbles: true }) as DragEvent;
    Object.defineProperty(dragstart, 'dataTransfer', { value: dt });
    el.dispatchEvent(dragstart);

    expect(dt.setData).toHaveBeenCalledWith('text/plain', 'dragged');
    expect(onEmit).toHaveBeenCalledOnce();
    el.remove();
  });
});
