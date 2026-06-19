/**
 * SSR declarative `<script type="context">` reconstruction conformance (#1116, webcontexts completion
 * #1091). Proves the client hydration expectation from the spec (njk:222-247): a server-serialized
 * `<script type="context" context="…">JSON</script>` block reconstructs the context's VALUE on upgrade()
 * — previously the JSON body was dropped (`new Context()` with no initial value at the old :125).
 *
 * Reconstruction/hydration conformance only — NOT an SSR engine (the spec is spec-only). A malformed or
 * empty body must fall back to the class default without breaking hydration (progressive enhancement).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import CustomContext from '../../CustomContext';
import CustomContextRegistry from '../../CustomContextRegistry';
import InjectorRoot from '../../../webinjectors/InjectorRoot';
import { applyNodeInjectorsPatches, removeNodeInjectorsPatches } from '../../../webinjectors/Node.injectors.patch';

interface ThemeState extends Record<string, unknown> {
  primary: string;
  mode: string;
}

class ThemeContext extends CustomContext<ThemeState> {
  initialValue: ThemeState = { primary: '#000000', mode: 'light' };
}

describe('webcontexts SSR <script type="context"> reconstruction (#1116)', () => {
  let registry: CustomContextRegistry;
  let injectorRoot: InjectorRoot;

  beforeEach(() => {
    applyNodeInjectorsPatches();
    injectorRoot = new InjectorRoot();
    injectorRoot.attach(document);
    (window as any).injectors = injectorRoot;
    registry = new CustomContextRegistry();
    registry.define('theme', ThemeContext);
    // Wire the context registry onto the document injector so attach() can resolve the context's local
    // name through the injector chain (the real-app DI wiring; mirrors Node.contexts.patch.test.ts).
    const rootInjector = injectorRoot.getInjectorOf(document as any);
    rootInjector?.set('customContextTypes', registry);
    document.body.innerHTML = '';
  });

  afterEach(() => {
    injectorRoot.detach(document);
    removeNodeInjectorsPatches();
    delete (window as any).injectors;
  });

  /** Build a host with a serialized context script and upgrade it. */
  function hydrate(serialized: string): HTMLElement {
    const host = document.createElement('div');
    host.innerHTML = `<script type="context" context="theme">${serialized}</script>`;
    document.body.append(host);
    registry.upgrade(host);
    return host;
  }

  it('reconstructs the context value from the serialized script body after upgrade()', () => {
    const host = hydrate('{"primary":"#6366f1","mode":"dark"}');
    const ctx = registry.getContextByName(host, 'theme');
    expect(ctx).not.toBeNull();
    expect(ctx!.value).toEqual({ primary: '#6366f1', mode: 'dark' });
  });

  it('the reconstructed value overrides the class default (the SSR value wins)', () => {
    const host = hydrate('{"primary":"#ff0000","mode":"dark"}');
    const ctx = registry.getContextByName(host, 'theme')!;
    expect(ctx.value.primary).toBe('#ff0000'); // not the class default #000000
  });

  it('falls back to the class default for an empty body (no break)', () => {
    const host = hydrate('   ');
    const ctx = registry.getContextByName(host, 'theme')!;
    expect(ctx.value).toEqual({ primary: '#000000', mode: 'light' });
  });

  it('falls back to the class default for unparseable JSON (progressive enhancement, no throw)', () => {
    expect(() => hydrate('{not valid json')).not.toThrow();
    const host = document.body.firstElementChild as HTMLElement;
    const ctx = registry.getContextByName(host, 'theme')!;
    expect(ctx.value).toEqual({ primary: '#000000', mode: 'light' });
  });
});
