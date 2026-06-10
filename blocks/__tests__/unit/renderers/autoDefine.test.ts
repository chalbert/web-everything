/**
 * Conformance suite for the Auto-Define contract (#241) — the native-baseline self-registration
 * mechanic. Covers the `defineElement` helper (idempotent / collision-safe / HMR-safe), the
 * `AutoDefineStrategy` contract's `explicit` baseline, and that generated classes carry the
 * `static tagName` the JSX class path resolves through.
 *
 * Spec: /projects/webcomponents/#protocol-auto-define-strategy
 */
import { describe, it, expect } from 'vitest';
import { defineElement, explicitAutoDefine } from '../../../renderers/auto-define';
import {
  parseDefinition,
  generateClassSource,
  defineFromDefinition,
} from '../../../renderers/component/declarativeComponent';

// customElements.define is one-shot per tag for the process — uniquify so tests don't collide.
let uid = 0;
const freshTag = () => `ad-test-${++uid}`;

describe('defineElement — idempotent self-registration', () => {
  it('registers a tag exactly once', () => {
    const tag = freshTag();
    class A extends HTMLElement {}
    defineElement(tag, A);
    expect(customElements.get(tag)).toBe(A);
  });

  it('is a no-op on a duplicate tag (re-import / HMR re-run does not throw)', () => {
    const tag = freshTag();
    class A extends HTMLElement {}
    class B extends HTMLElement {} // a second module re-run defining the same tag
    defineElement(tag, A);
    expect(() => defineElement(tag, B)).not.toThrow();
    // The first registration wins — the platform's one-shot-per-tag semantics, just non-fatal.
    expect(customElements.get(tag)).toBe(A);
  });
});

describe('explicitAutoDefine — the native-first baseline strategy', () => {
  it('exposes the contract shape: key, trigger import, define; and NO resolve (no inference)', () => {
    expect(explicitAutoDefine.key).toBe('explicit');
    expect(explicitAutoDefine.trigger).toBe('import');
    expect(typeof explicitAutoDefine.define).toBe('function');
    // The baseline does not infer unknown tags — the module is already imported.
    expect(explicitAutoDefine.resolve).toBeUndefined();
  });

  it('define() registers via the idempotent helper', () => {
    const tag = freshTag();
    class A extends HTMLElement {}
    explicitAutoDefine.define(tag, A);
    expect(customElements.get(tag)).toBe(A);
    expect(() => explicitAutoDefine.define(tag, A)).not.toThrow();
  });
});

describe('static tagName — the tag↔class source of truth', () => {
  it('the generated wc-class source declares static tagName and an idempotent registration', () => {
    const def = parseDefinition('<component name="x-card"><p>hi</p></component>');
    const src = generateClassSource(def);
    expect(src).toContain("static tagName = 'x-card';");
    // Self-contained: the inline `defineElement` expansion, no import-map seam, no bare define.
    expect(src).toContain("customElements.get('x-card') ?? customElements.define('x-card', XCard);");
  });

  it('the runtime twin carries static tagName matching its registered tag', () => {
    const tag = freshTag();
    const def = parseDefinition('<component name="x-twin"><p>hi</p></component>');
    defineFromDefinition(def, tag);
    const ctor = customElements.get(tag) as (CustomElementConstructor & { tagName?: string });
    expect(ctor.tagName).toBe(tag);
  });
});
