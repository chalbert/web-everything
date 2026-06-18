/**
 * Unit tests for the declarative `<script type="registry">` scoped-registration binding (#901, #854).
 * Covers parsing (valid + malformed), scoped define + lazy-queue, IDREF `extends` composition, the
 * `registry="id"` / `{{ expr }}` association resolve, the shadow map-through, idempotency, and the
 * MOMENT-2 `ScopedRegistryAttribute` binding behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import CustomElement from '../../../webcomponents/CustomElement';
import {
  applyDeclarativeRegistries,
  parseRegistryScript,
  resolveScopedRegistry,
  flushPendingDefinitions,
  applyScopedRegistryToHost,
  getScopedRegistryOf,
  getActiveRegistryResult,
  resetDeclaredRegistries,
  RegistryScriptError,
  type CtorResolver,
} from '../../declarativeRegistry';
import ScopedRegistryAttribute from '../../ScopedRegistryAttribute';

class CardEl extends CustomElement {}
class ButtonEl extends CustomElement {}

/** A resolver backed by a plain map (the test stand-in for the production `{{ expr }}` webexpressions bridge). */
const resolver = (map: Record<string, typeof CardEl>): CtorResolver => (ref) => map[ref] as never;

function registryScript(id: string | null, body: string): HTMLScriptElement {
  const s = document.createElement('script');
  s.setAttribute('type', 'registry');
  if (id) s.id = id;
  s.textContent = body;
  return s;
}

describe('parseRegistryScript', () => {
  it('parses a valid { extends, define } body', () => {
    const s = registryScript('r', '{ "extends": ["base"], "define": { "my-card": "Card" } }');
    expect(parseRegistryScript(s)).toEqual({ extends: ['base'], define: { 'my-card': 'Card' } });
  });

  it('defaults both keys (a registry may declare nothing — pure compose target)', () => {
    expect(parseRegistryScript(registryScript('r', '{}'))).toEqual({ extends: [], define: {} });
  });

  it.each([
    ['', 'empty body'],
    ['not json', 'invalid JSON'],
    ['[1,2]', 'array, not object'],
    ['{ "extends": "base" }', 'extends not an array'],
    ['{ "extends": [1] }', 'extends array of non-strings'],
    ['{ "define": [] }', 'define not an object'],
    ['{ "define": { "x": 1 } }', 'define value not a string'],
  ])('throws RegistryScriptError for %s', (body) => {
    expect(() => parseRegistryScript(registryScript(null, body))).toThrow(RegistryScriptError);
  });
});

describe('applyDeclarativeRegistries', () => {
  let host: HTMLElement;

  beforeEach(() => {
    resetDeclaredRegistries();
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('builds a scoped registry and scoped-defines a resolvable reference (dom-less registration)', () => {
    host.appendChild(registryScript('cardScope', '{ "define": { "my-card": "Card" } }'));
    const result = applyDeclarativeRegistries(host, { resolveCtor: resolver({ Card: CardEl }) });

    expect(result.bindings).toHaveLength(1);
    const reg = result.byId.get('cardScope')!;
    expect(reg.has('my-card')).toBe(true);
    expect(reg.get('my-card')).toBe(CardEl);
    expect(result.bindings[0].pending).toHaveLength(0);
  });

  it('queues a reference that does not resolve yet, then flushes it (lazy queue, MOMENT 2)', () => {
    host.appendChild(registryScript('lazyScope', '{ "define": { "my-card": "Card" } }'));
    const result = applyDeclarativeRegistries(host, { resolveCtor: () => undefined });

    const reg = result.byId.get('lazyScope')!;
    expect(reg.has('my-card')).toBe(false);
    expect(result.bindings[0].pending).toEqual([{ tag: 'my-card', ref: 'Card' }]);

    const applied = flushPendingDefinitions(result, resolver({ Card: CardEl }));
    expect(applied).toBe(1);
    expect(reg.get('my-card')).toBe(CardEl);
    expect(result.bindings[0].pending).toHaveLength(0);
  });

  it('composes `extends` by local IDREF (a child registry resolves a parent definition)', () => {
    host.appendChild(registryScript('base', '{ "define": { "my-button": "Button" } }'));
    host.appendChild(registryScript('cards', '{ "extends": ["base"], "define": { "my-card": "Card" } }'));
    const result = applyDeclarativeRegistries(host, { resolveCtor: resolver({ Button: ButtonEl, Card: CardEl }) });

    const cards = result.byId.get('cards')!;
    expect(cards.get('my-card')).toBe(CardEl); // own
    expect(cards.get('my-button')).toBe(ButtonEl); // inherited from base via extends
  });

  it('is idempotent — a re-scan does not double-install the same script', () => {
    host.appendChild(registryScript('s', '{ "define": { "my-card": "Card" } }'));
    const first = applyDeclarativeRegistries(host, { resolveCtor: resolver({ Card: CardEl }) });
    const second = applyDeclarativeRegistries(host, { resolveCtor: resolver({ Card: CardEl }) });
    expect(first.bindings).toHaveLength(1);
    expect(second.bindings).toHaveLength(0); // already processed
  });

  it('skips one malformed block without throwing; the rest install', () => {
    host.appendChild(registryScript('bad', 'not json'));
    host.appendChild(registryScript('good', '{ "define": { "my-card": "Card" } }'));
    const result = applyDeclarativeRegistries(host, { resolveCtor: resolver({ Card: CardEl }) });
    expect(result.bindings).toHaveLength(1);
    expect(result.byId.has('good')).toBe(true);
    expect(result.byId.has('bad')).toBe(false);
  });
});

describe('resolveScopedRegistry', () => {
  beforeEach(() => { resetDeclaredRegistries(); document.body.innerHTML = ''; });

  it('resolves the local IDREF (`registry="id"`, #900)', () => {
    const host = document.createElement('div');
    host.appendChild(registryScript('scope', '{ "define": { "my-card": "Card" } }'));
    document.body.appendChild(host);
    const result = applyDeclarativeRegistries(host, { resolveCtor: resolver({ Card: CardEl }) });

    const consumer = document.createElement('my-card');
    consumer.setAttribute('registry', 'scope');
    expect(resolveScopedRegistry(result, consumer)).toBe(result.byId.get('scope'));
  });

  it('bridges a `{{ expr }}` raw-object reference via the supplied object resolver (#854 E form)', () => {
    const result = applyDeclarativeRegistries(document.createElement('div'), {});
    const foreign = result.byId.get('scope'); // undefined — but we drive the bridge directly
    const consumer = document.createElement('my-card');
    consumer.setAttribute('registry', '{{ myRegistry }}');
    const reg = result.byId; // any registry object would do; use a marker
    const resolved = resolveScopedRegistry(result, consumer, (expr) =>
      expr === 'myRegistry' ? (reg as never) : undefined,
    );
    expect(resolved).toBe(reg);
    expect(foreign).toBeUndefined();
  });

  it('returns undefined when the consumer carries no registry= attribute', () => {
    const result = applyDeclarativeRegistries(document.createElement('div'), {});
    expect(resolveScopedRegistry(result, document.createElement('my-card'))).toBeUndefined();
  });
});

describe('applyScopedRegistryToHost / getScopedRegistryOf', () => {
  beforeEach(() => { resetDeclaredRegistries(); document.body.innerHTML = ''; });

  it('records the scoped registry on the host (consumption map-through key)', () => {
    const host = document.createElement('div');
    host.appendChild(registryScript('scope', '{ "define": { "my-card": "Card" } }'));
    document.body.appendChild(host);
    const result = applyDeclarativeRegistries(host, { resolveCtor: resolver({ Card: CardEl }) });
    const reg = result.byId.get('scope')!;

    applyScopedRegistryToHost(host, reg);
    expect(getScopedRegistryOf(host)).toBe(reg);
  });
});

describe('ScopedRegistryAttribute (MOMENT-2 binding behavior)', () => {
  beforeEach(() => { resetDeclaredRegistries(); document.body.innerHTML = ''; });

  it('binds the host to its declared registry on attach', () => {
    const host = document.createElement('div');
    host.appendChild(registryScript('scope', '{ "define": { "my-card": "Card" } }'));
    document.body.appendChild(host);
    applyDeclarativeRegistries(host, { resolveCtor: resolver({ Card: CardEl }) });

    const consumer = document.createElement('my-card') as HTMLElement;
    consumer.setAttribute('registry', 'scope');
    document.body.appendChild(consumer);

    const behavior = new ScopedRegistryAttribute();
    behavior.attach(consumer as never);

    expect(behavior.bound).toBe(true);
    expect(getScopedRegistryOf(consumer)).toBe(getActiveRegistryResult()!.byId.get('scope'));
  });

  it('does not bind when no declaration has been scanned (consumer-before-declaration tolerance)', () => {
    const consumer = document.createElement('my-card') as HTMLElement;
    consumer.setAttribute('registry', 'missing');
    document.body.appendChild(consumer);

    const behavior = new ScopedRegistryAttribute();
    behavior.attach(consumer as never);
    expect(behavior.bound).toBe(false);
  });
});
