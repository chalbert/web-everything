/**
 * Unplugged-mode (non-invasive) test for webexpressions — #637 / #636 backfill.
 *
 * Proves CustomTextNode + CustomTextNodeRegistry work as an opt-in library through plain instantiation
 * and a scoped registry, WITHOUT the plugged clone-handler global registration (`applyPatches()` /
 * `registerCloneHandlers()` are never called here). The unplugged form is the mandatory real-app surface
 * (#606); this is the automated proof the plug does not REQUIRE plugged mode.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import CustomTextNodeRegistry from '../../CustomTextNodeRegistry';
import CustomTextNode from '../../CustomTextNode';

class ExpressionTextNode extends CustomTextNode {
  connectedCallback(): void {
    /* no-op for the registry-resolution test */
  }
}

describe('webexpressions — unplugged (non-invasive) mode', () => {
  let registry: CustomTextNodeRegistry;
  beforeEach(() => {
    registry = new CustomTextNodeRegistry();
  });

  it('defines and resolves a text-node constructor through a scoped registry instance', () => {
    registry.define('expression', ExpressionTextNode);
    expect(registry.get('expression')).toBe(ExpressionTextNode);
  });

  it('constructs a CustomTextNode subclass as a plain Text node (no global patch)', () => {
    const node = new ExpressionTextNode({ children: 'hello' });
    expect(node).toBeInstanceOf(CustomTextNode);
    expect(node).toBeInstanceOf(Text);
    expect(node.textContent).toBe('hello');
  });

  it('keeps two scoped registries independent (non-invasive: no shared global state)', () => {
    const registryB = new CustomTextNodeRegistry();
    registry.define('only-a', ExpressionTextNode);
    registryB.define('only-b', ExpressionTextNode);

    expect(registry.get('only-a')).toBe(ExpressionTextNode);
    expect(registry.get('only-b')).toBeUndefined();
    expect(registryB.get('only-b')).toBe(ExpressionTextNode);
    expect(registryB.get('only-a')).toBeUndefined();
  });
});
