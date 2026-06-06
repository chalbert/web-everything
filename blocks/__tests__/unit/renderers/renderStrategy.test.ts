/**
 * Unit tests for the Render Strategy layer (Axis-2) — backlog #077.
 *
 * Covers the CustomRenderStrategyRegistry resolution rules (default, nearest-scope-wins,
 * unknown-strategy errors) and the native-first DeclarativeStaticStrategy provider
 * (mount appends, fragment handling, string→text, dispose removes, mount-once feature-detect).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CustomRenderStrategyRegistry,
  DeclarativeStaticStrategy,
  render,
  renderStrategyRegistry,
} from '../../../renderers/jsx/render-strategy';
import type { CustomRenderStrategy, RenderHandle } from '../../../renderers/jsx/render-strategy';

describe('DeclarativeStaticStrategy — the native-first default provider', () => {
  const strategy = new DeclarativeStaticStrategy();

  it('is named declarative-static', () => {
    expect(strategy.name).toBe('declarative-static');
  });

  it('is mount-once: feature-detected by the absence of update()', () => {
    // The whole point of #077 — the eager construct-once behaviour is now an explicit
    // capability advertised by NOT implementing update().
    expect(strategy.update).toBeUndefined();
  });

  it('mounts an element into the host and returns a handle', () => {
    const host = document.createElement('div');
    const el = document.createElement('span');
    const handle = strategy.mount(el, host);

    expect(host.contains(el)).toBe(true);
    expect(handle.strategy).toBe('declarative-static');
    expect(handle.host).toBe(host);
    expect(handle.nodes).toEqual([el]);
  });

  it('mounts a string as a text node', () => {
    const host = document.createElement('div');
    const handle = strategy.mount('hello', host);

    expect(host.textContent).toBe('hello');
    expect(handle.nodes).toHaveLength(1);
    expect(handle.nodes[0].nodeType).toBe(Node.TEXT_NODE);
  });

  it('captures fragment children before insertion so dispose can remove them', () => {
    const host = document.createElement('div');
    const frag = document.createDocumentFragment();
    const a = document.createElement('p');
    const b = document.createElement('p');
    frag.append(a, b);

    const handle = strategy.mount(frag, host);

    // Fragment is emptied by appendChild, but the handle still tracks both children.
    expect(handle.nodes).toEqual([a, b]);
    expect(host.children).toHaveLength(2);

    strategy.dispose!(handle);
    expect(host.children).toHaveLength(0);
  });

  it('dispose removes the mounted nodes', () => {
    const host = document.createElement('div');
    const el = document.createElement('span');
    const handle = strategy.mount(el, host);

    strategy.dispose!(handle);
    expect(host.contains(el)).toBe(false);
  });
});

describe('CustomRenderStrategyRegistry — resolution', () => {
  let registry: CustomRenderStrategyRegistry;

  beforeEach(() => {
    registry = new CustomRenderStrategyRegistry();
  });

  it('first registered strategy in a root registry becomes the default', () => {
    registry.register(new DeclarativeStaticStrategy());
    expect(registry.defaultName).toBe('declarative-static');
    expect(registry.resolve()).toBeInstanceOf(DeclarativeStaticStrategy);
  });

  it('resolves a strategy by explicit name', () => {
    const ds = new DeclarativeStaticStrategy();
    registry.register(ds);
    expect(registry.resolve('declarative-static')).toBe(ds);
  });

  it('throws when resolving an unknown strategy', () => {
    registry.register(new DeclarativeStaticStrategy());
    expect(() => registry.resolve('vdom')).toThrow(/Unknown render strategy: vdom/);
  });

  it('throws when nothing is registered and no default exists', () => {
    expect(() => registry.resolve()).toThrow(/No render strategy registered/);
  });

  it('setDefault rejects an unregistered name', () => {
    registry.register(new DeclarativeStaticStrategy());
    expect(() => registry.setDefault('vdom')).toThrow(/Unknown render strategy: vdom/);
  });

  it('nearest-scope wins: a child override shadows the parent default', () => {
    const parent = new CustomRenderStrategyRegistry().register(new DeclarativeStaticStrategy());

    // A stub alternate strategy registered only in the child scope.
    const stub: CustomRenderStrategy = {
      name: 'stub',
      mount: (tree, host): RenderHandle => ({ strategy: 'stub', host, nodes: [] }),
    };
    const child = new CustomRenderStrategyRegistry(parent).register(stub).setDefault('stub');

    // Child default is its own; parent default is still declarative-static.
    expect(child.defaultName).toBe('stub');
    expect(parent.defaultName).toBe('declarative-static');

    // Child still resolves inherited strategies through the parent (nearest-scope wins,
    // but the chain is walked for names the child doesn't hold).
    expect(child.resolve('declarative-static')).toBeInstanceOf(DeclarativeStaticStrategy);
    expect(child.has('declarative-static')).toBe(true);
    expect(child.resolve().name).toBe('stub');
  });
});

describe('render() — the registry-backed mount path', () => {
  it('mounts through the default registry using declarative-static', () => {
    const host = document.createElement('div');
    const el = document.createElement('em');
    const handle = render(el, host);

    expect(host.contains(el)).toBe(true);
    expect(handle.strategy).toBe('declarative-static');
    expect(renderStrategyRegistry.defaultName).toBe('declarative-static');
  });
});
