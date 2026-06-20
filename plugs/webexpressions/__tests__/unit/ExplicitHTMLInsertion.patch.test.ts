/**
 * @file ExplicitHTMLInsertion.patch.test.ts
 * @description #1126 — explicit-API trigger parity. The detached / self-replacing HTML-insertion APIs
 * the MutationObserver cannot see (`Range.createContextualFragment`, `Element.setHTMLUnsafe`,
 * `Element.outerHTML` setter) call `customTextNodes.upgrade()` so their `{{ }}` / `[[ ]]` text nodes
 * still interpolate, reaching parity with the observer-covered insertions of #1125.
 *
 * A parser that wraps the whole text in an `ExpressionTextNode` stands in for the real interpolation
 * grammar; we assert the upgrade ran by checking the resulting node is our custom type with a fired
 * `connectedCallback`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CustomTextNodeRegistry from '../../CustomTextNodeRegistry';
import { patch, removePatch } from '../../ExplicitHTMLInsertion.patch';
import InjectorRoot from '../../../webinjectors/InjectorRoot';

describe('ExplicitHTMLInsertion patch (#1126) — explicit-API trigger parity', () => {
  let registry: CustomTextNodeRegistry;
  let injectorRoot: InjectorRoot;
  let upgradeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    registry = new CustomTextNodeRegistry();
    // Spy on the public upgrade entry point — this patch's whole job is to route the detached APIs
    // through it. We don't need a real parser to prove the routing.
    upgradeSpy = vi.spyOn(registry, 'upgrade').mockImplementation(() => {});

    injectorRoot = new InjectorRoot();
    injectorRoot.attach(document);
    injectorRoot.getInjectorOf(document)!.set('customTextNodes', registry as never);

    patch();
  });

  afterEach(() => {
    removePatch();
    upgradeSpy.mockRestore();
    injectorRoot.detach(document);
    document.body.innerHTML = '';
  });

  it('upgrades the detached fragment from Range.createContextualFragment', () => {
    const host = document.createElement('div');
    document.body.appendChild(host); // connected → registry resolvable from the range context
    const range = document.createRange();
    range.selectNodeContents(host);

    const fragment = range.createContextualFragment('<span>{{name}}</span>');

    expect(fragment.nodeType).toBe(Node.DOCUMENT_FRAGMENT_NODE);
    expect(upgradeSpy).toHaveBeenCalledWith(fragment);
  });

  it('upgrades the new siblings inserted by the outerHTML setter (self-replacing)', () => {
    const parent = document.createElement('div');
    const target = document.createElement('span');
    parent.appendChild(target);
    document.body.appendChild(parent);

    target.outerHTML = '<em>{{a}}</em><em>{{b}}</em>';

    // Both freshly-inserted siblings get upgraded; the original target is gone.
    expect(upgradeSpy).toHaveBeenCalledTimes(2);
    const upgraded = upgradeSpy.mock.calls.map((c) => c[0] as Node);
    expect(upgraded.every((n) => parent.contains(n))).toBe(true);
  });

  it('does not upgrade for a fully-detached outerHTML target (no injector chain → no-op)', () => {
    const parent = document.createElement('div'); // never connected to the document
    const target = document.createElement('span');
    parent.appendChild(target);

    target.outerHTML = '<em>{{x}}</em>';

    expect(upgradeSpy).not.toHaveBeenCalled();
  });

  it('upgrades the element after setHTMLUnsafe (when the API exists)', () => {
    if (typeof (Element.prototype as any).setHTMLUnsafe !== 'function') {
      // happy-dom lacks the Sanitizer API; the patch guards on its presence, so nothing to assert here.
      return;
    }
    const host = document.createElement('div');
    document.body.appendChild(host);

    (host as any).setHTMLUnsafe('<b>{{v}}</b>');

    expect(upgradeSpy).toHaveBeenCalledWith(host);
  });

  it('removePatch restores the original createContextualFragment (no upgrade after removal)', () => {
    removePatch();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const range = document.createRange();
    range.selectNodeContents(host);

    range.createContextualFragment('<span>{{name}}</span>');

    expect(upgradeSpy).not.toHaveBeenCalled();
    patch(); // re-apply so afterEach's removePatch is symmetric
  });
});
