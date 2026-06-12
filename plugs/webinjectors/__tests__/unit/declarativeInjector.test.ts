/**
 * Unit tests for the declarative `<script type="injector">` domain/Protocol binding (#278).
 * Covers parsing (valid + malformed), subtree install + isolation, explicit `injector="id"`
 * association, idempotency, and resilience to one bad block.
 *
 * @module webinjectors
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import InjectorRoot from '../../InjectorRoot';
import {
  applyDeclarativeInjectors,
  parseInjectorScript,
  resolveDeclaredProvider,
  InjectorScriptError,
} from '../../declarativeInjector';

function injectorScript(id: string | null, body: string): HTMLScriptElement {
  const s = document.createElement('script');
  s.setAttribute('type', 'injector');
  if (id) s.id = id;
  s.textContent = body;
  return s;
}

describe('parseInjectorScript', () => {
  it('parses a valid { domain, provide } body', () => {
    const s = injectorScript('p', '{ "domain": "@date/core", "provide": { "addMonths": "x" } }');
    expect(parseInjectorScript(s)).toEqual({ domain: '@date/core', provide: { addMonths: 'x' } });
  });

  it('honours a falsy provide (null) — only absence is an error', () => {
    const s = injectorScript('p', '{ "domain": "@x/y", "provide": null }');
    expect(parseInjectorScript(s)).toEqual({ domain: '@x/y', provide: null });
  });

  it.each([
    ['', 'empty body'],
    ['not json', 'invalid JSON'],
    ['[1,2]', 'array, not object'],
    ['{ "provide": 1 }', 'missing domain'],
    ['{ "domain": "", "provide": 1 }', 'empty domain'],
    ['{ "domain": "@x/y" }', 'missing provide'],
  ])('throws InjectorScriptError for %s', (body) => {
    expect(() => parseInjectorScript(injectorScript(null, body))).toThrow(InjectorScriptError);
  });
});

describe('applyDeclarativeInjectors', () => {
  let root: InjectorRoot;
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
    root = new InjectorRoot();
    root.attach(document);
  });

  it('installs a binding on the script’s parent subtree, keyed by domain', () => {
    const section = document.createElement('section');
    section.appendChild(injectorScript('dateProvider', '{ "domain": "@date/core", "provide": { "v": 1 } }'));
    host.appendChild(section);

    const result = applyDeclarativeInjectors(root, host);

    expect(result.bindings).toHaveLength(1);
    expect(result.bindings[0].domain).toBe('@date/core');
    expect(result.bindings[0].scope).toBe(section);
    // The provider is installed on the scope's injector.
    expect(root.getInjectorOf(section as never)?.get('@date/core' as never)).toEqual({ v: 1 });
    // And indexed for injector="id".
    expect(result.byId.get('dateProvider')).toBe(root.getInjectorOf(section as never));
  });

  it('resolves the domain for a descendant (implicit subtree inheritance)', () => {
    const section = document.createElement('section');
    const consumer = document.createElement('span');
    section.appendChild(injectorScript('p', '{ "domain": "@math/core", "provide": 42 }'));
    section.appendChild(consumer);
    host.appendChild(section);

    const result = applyDeclarativeInjectors(root, host);

    expect(resolveDeclaredProvider(root, result, consumer, '@math/core')).toBe(42);
  });

  it('isolates the binding to the subtree — a sibling outside the scope does not see it', () => {
    const scoped = document.createElement('section');
    scoped.appendChild(injectorScript('p', '{ "domain": "@math/core", "provide": 42 }'));
    const outside = document.createElement('span');
    host.append(scoped, outside);

    const result = applyDeclarativeInjectors(root, host);

    expect(resolveDeclaredProvider(root, result, outside, '@math/core')).toBeUndefined();
  });

  it('honours explicit injector="id" association regardless of DOM position', () => {
    const scoped = document.createElement('section');
    scoped.appendChild(injectorScript('dateProvider', '{ "domain": "@date/core", "provide": "impl" }'));
    const remote = document.createElement('span'); // NOT a descendant of `scoped`
    remote.setAttribute('injector', 'dateProvider');
    host.append(scoped, remote);

    const result = applyDeclarativeInjectors(root, host);

    expect(resolveDeclaredProvider(root, result, remote, '@date/core')).toBe('impl');
  });

  it('is idempotent — re-applying does not reinstall an already-processed script', () => {
    const section = document.createElement('section');
    section.appendChild(injectorScript('p', '{ "domain": "@x/y", "provide": 1 }'));
    host.appendChild(section);

    expect(applyDeclarativeInjectors(root, host).bindings).toHaveLength(1);
    expect(applyDeclarativeInjectors(root, host).bindings).toHaveLength(0); // already processed
  });

  it('skips one malformed block (with a warning) but installs the rest', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a = document.createElement('section');
    a.appendChild(injectorScript('bad', 'not json'));
    const b = document.createElement('section');
    b.appendChild(injectorScript('good', '{ "domain": "@ok/core", "provide": true }'));
    host.append(a, b);

    const result = applyDeclarativeInjectors(root, host);

    expect(result.bindings).toHaveLength(1);
    expect(result.bindings[0].domain).toBe('@ok/core');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
