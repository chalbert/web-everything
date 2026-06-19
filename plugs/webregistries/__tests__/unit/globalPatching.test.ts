/**
 * Unit test for the plugged-mode global patching API (#1100, slice A of #1088).
 *
 * applyPatches/removePatches/isPatched: swap window.CustomElementRegistry + window.customElements to the
 * scoped class, patch attachShadow to associate a scoped registry with its host, and restore on removal.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { applyPatches, removePatches, isPatched } from '../../index';
import CustomElementRegistry from '../../CustomElementRegistry';
import { getScopedRegistryOf } from '../../declarativeRegistry';

describe('webregistries global patching (#1100)', () => {
  afterEach(() => {
    if (isPatched()) removePatches();
  });

  it('isPatched() toggles across apply/remove', () => {
    expect(isPatched()).toBe(false);
    applyPatches();
    expect(isPatched()).toBe(true);
    removePatches();
    expect(isPatched()).toBe(false);
  });

  it('swaps window.CustomElementRegistry + window.customElements to the scoped class, then restores', () => {
    const nativeRegistry = window.CustomElementRegistry;
    const nativeCustomElements = window.customElements;

    applyPatches();
    expect(window.CustomElementRegistry).toBe(CustomElementRegistry);
    expect(window.customElements).toBeInstanceOf(CustomElementRegistry);

    removePatches();
    expect(window.CustomElementRegistry).toBe(nativeRegistry);
    expect(window.customElements).toBe(nativeCustomElements);
  });

  it('patched attachShadow associates a scoped registry with the host', () => {
    applyPatches();
    const scoped = new CustomElementRegistry();
    const host = document.createElement('div');
    const root = (host as any).attachShadow({ mode: 'open', customElements: scoped });
    expect(root).toBeTruthy();
    expect(getScopedRegistryOf(host)).toBe(scoped);
  });

  it('attachShadow without a scoped registry leaves the host unassociated, and restores natively', () => {
    const nativeAttachShadow = Element.prototype.attachShadow;
    applyPatches();
    const host = document.createElement('div');
    (host as any).attachShadow({ mode: 'open' });
    expect(getScopedRegistryOf(host)).toBeUndefined();
    removePatches();
    expect(Element.prototype.attachShadow).toBe(nativeAttachShadow);
  });

  it('is idempotent — a second applyPatches warns and does not re-save originals', () => {
    applyPatches();
    const patchedRoot = window.customElements;
    applyPatches(); // second call: no-op
    expect(window.customElements).toBe(patchedRoot);
    removePatches();
    // After one remove, fully restored (the second apply did not corrupt the saved originals).
    expect(isPatched()).toBe(false);
  });
});
