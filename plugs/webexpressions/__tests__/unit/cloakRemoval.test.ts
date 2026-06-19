/**
 * Unit test for CSS-cloak removal after upgrade (#1124, spec njk:247-268).
 *
 * The v-cloak/x-cloak pattern: an element is hidden via `[cloak]` until its expressions are upgraded,
 * then the registry removes the attribute. Verified on the upgrade path (and an ancestor cloak).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import CustomTextNodeRegistry from '../../CustomTextNodeRegistry';

describe('CustomTextNodeRegistry cloak removal (#1124)', () => {
  let registry: CustomTextNodeRegistry;
  let container: HTMLDivElement;

  beforeEach(() => {
    registry = new CustomTextNodeRegistry();
    container = document.createElement('div');
  });

  it('removes [cloak] from a cloaked element in the upgraded subtree', () => {
    container.innerHTML = '<div cloak>Hello, {{ user.name }}!</div>';
    const cloaked = container.querySelector('div')!;
    expect(cloaked.hasAttribute('cloak')).toBe(true);
    registry.upgrade(container);
    expect(cloaked.hasAttribute('cloak')).toBe(false);
  });

  it('removes [cloak] from the upgrade root element itself', () => {
    const root = document.createElement('section');
    root.setAttribute('cloak', '');
    root.textContent = '{{ x }}';
    registry.upgrade(root);
    expect(root.hasAttribute('cloak')).toBe(false);
  });

  it('removes a nearest-ancestor [cloak] when a nested subtree is upgraded', () => {
    container.innerHTML = '<section cloak><p><span>{{ x }}</span></p></section>';
    const cloaked = container.querySelector('section')!;
    const inner = container.querySelector('p')!;
    // Upgrade only the inner subtree — the ancestor that cloaked it is still revealed.
    registry.upgrade(inner);
    expect(cloaked.hasAttribute('cloak')).toBe(false);
  });

  it('leaves uncloaked elements untouched', () => {
    container.innerHTML = '<div>{{ x }}</div>';
    registry.upgrade(container);
    expect(container.querySelector('div')!.hasAttribute('cloak')).toBe(false);
    expect(container.outerHTML).not.toContain('cloak');
  });
});
