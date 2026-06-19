/**
 * Integration test for claim-aware strict/flexible context lookup (#1117, webcontexts completion #1091).
 *
 * Sets up a parent + child injector scope, each holding a context of the SAME type, where the child's
 * context DECLINES the query (`claim()===false`) and the parent's claims it. From the child node:
 *   - strict   → the child context (closest match, claim ignored).
 *   - flexible → the parent context (the child declines and defers up-chain — the spec's negotiation).
 * Flexible is the default (#911 Most-Flexible-Default).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyNodeContextsPatch, removeNodeContextsPatch } from '../../Node.contexts.patch';
import { applyNodeInjectorsPatches, removeNodeInjectorsPatches } from '../../../webinjectors/Node.injectors.patch';
import InjectorRoot from '../../../webinjectors/InjectorRoot';
import CustomContext, { type ContextQuery } from '../../CustomContext';

/** A context that owns only `user.*` queries (declines everything else). */
class UserContext extends CustomContext<{ name: string }> {
  initialValue = { name: 'child' };
  override claim(query: ContextQuery): boolean {
    return !!query.expression && query.expression.startsWith('user.');
  }
}
/** A fallback context that claims everything (the up-chain provider). */
class AppContext extends CustomContext<{ name: string }> {
  initialValue = { name: 'parent' };
}

describe('Node.resolveContext — strict vs flexible (#1117)', () => {
  let injectorRoot: InjectorRoot;

  beforeEach(() => {
    applyNodeInjectorsPatches();
    applyNodeContextsPatch();
    injectorRoot = new InjectorRoot();
    injectorRoot.attach(document);
    (window as any).injectors = injectorRoot;
  });

  afterEach(() => {
    injectorRoot.detach(document);
    removeNodeContextsPatch();
    removeNodeInjectorsPatches();
    delete (window as any).injectors;
  });

  function scopedTree() {
    const root = document.createElement('div');
    const child = document.createElement('div');
    root.appendChild(child);
    document.body.appendChild(root);

    // Parent scope: an AppContext (claims everything) under type `profile`.
    injectorRoot.ensureInjector(root);
    const parentCtx = new AppContext();
    injectorRoot.getInjectorOf(root)!.set('customContexts:profile', parentCtx);

    // Child scope: a UserContext (claims only user.*) under the SAME type `profile`.
    injectorRoot.ensureInjector(child);
    const childCtx = new UserContext();
    injectorRoot.getInjectorOf(child)!.set('customContexts:profile', childCtx);

    return { root, child, parentCtx, childCtx };
  }

  it('strict resolves to the child (closest), ignoring claim()', () => {
    const { root, child, childCtx } = scopedTree();
    // A query the child declines — strict still returns the closest context.
    const resolved = (child as any).resolveContext('profile', { expression: 'app.theme' }, 'strict');
    expect(resolved).toBe(childCtx);
    document.body.removeChild(root);
  });

  it('flexible defers past the declining child to the claiming parent', () => {
    const { root, child, parentCtx } = scopedTree();
    const resolved = (child as any).resolveContext('profile', { expression: 'app.theme' }, 'flexible');
    expect(resolved).toBe(parentCtx);
    document.body.removeChild(root);
  });

  it('flexible resolves to the child when the child claims the query', () => {
    const { root, child, childCtx } = scopedTree();
    const resolved = (child as any).resolveContext('profile', { expression: 'user.name' }, 'flexible');
    expect(resolved).toBe(childCtx);
    document.body.removeChild(root);
  });

  it('defaults to flexible (Most-Flexible-Default, #911)', () => {
    const { root, child, parentCtx } = scopedTree();
    const resolved = (child as any).resolveContext('profile', { expression: 'app.theme' });
    expect(resolved).toBe(parentCtx);
    document.body.removeChild(root);
  });

  it('queryContext uses flexible resolution — a declined query subscribes against the parent', () => {
    const { root, child, parentCtx, childCtx } = scopedTree();
    // Spy on which context actually gets subscribed — the child declines `app.theme`, so flexible
    // queryContext must subscribe the parent, not the child.
    let parentSubscribed = false;
    let childSubscribed = false;
    parentCtx.subscribe = (() => { parentSubscribed = true; return { value: undefined, unsubscribe() {} }; }) as any;
    childCtx.subscribe = (() => { childSubscribed = true; return { value: undefined, unsubscribe() {} }; }) as any;

    (child as any).queryContext('profile', 'app.theme');
    expect(parentSubscribed).toBe(true);
    expect(childSubscribed).toBe(false);
    document.body.removeChild(root);
  });
});
