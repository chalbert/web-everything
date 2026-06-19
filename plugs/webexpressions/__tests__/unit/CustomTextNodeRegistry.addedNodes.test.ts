/**
 * @file CustomTextNodeRegistry.addedNodes.test.ts
 * @description The MutationObserver `addedNodes` path (#1125) — a subtree inserted AFTER upgrade
 * (innerHTML / insertAdjacentHTML / append into a connected tree) is processed by the add path, so its
 * custom text nodes are upgraded/connected, mirroring the existing removed-node teardown.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import CustomTextNodeRegistry from '../../CustomTextNodeRegistry';
import CustomTextNode from '../../CustomTextNode';

class ExpressionTextNode extends CustomTextNode {
  callbackLog: string[] = [];
  connectedCallback() {
    this.callbackLog.push('connected');
  }
  disconnectedCallback() {
    this.callbackLog.push('disconnected');
  }
}

describe('CustomTextNodeRegistry — addedNodes observer path (#1125)', () => {
  let registry: CustomTextNodeRegistry;
  let container: HTMLDivElement;

  beforeEach(() => {
    registry = new CustomTextNodeRegistry();
    registry.define('expression', ExpressionTextNode);
    // Detached container: the MutationObserver fires on a detached subtree too, and keeping nodes out of
    // `document` avoids a happy-dom focus-tracking crash when a `new`-constructed text node disconnects.
    container = document.createElement('div');
  });

  afterEach(() => {
    registry.downgrade(container);
  });

  const tick = () => new Promise((r) => setTimeout(r, 10));

  it('upgrades a custom text node appended after upgrade()', async () => {
    registry.upgrade(container); // start observing (container is empty)
    const node = new ExpressionTextNode({ children: 'late' });
    container.appendChild(node); // dynamic insertion
    await tick();
    expect(node.callbackLog).toContain('connected');
  });

  it('walks an inserted element subtree and upgrades its custom text descendants', async () => {
    registry.upgrade(container);
    const wrapper = document.createElement('span');
    const node = new ExpressionTextNode({ children: 'deep' });
    wrapper.appendChild(node);
    container.appendChild(wrapper); // element subtree inserted dynamically (the innerHTML case)
    await tick();
    expect(node.callbackLog).toContain('connected');
  });

  it('still tears down removed nodes (no regression to the existing removedNodes path)', async () => {
    const node = new ExpressionTextNode({ children: 'x' });
    container.appendChild(node);
    registry.upgrade(container);
    node.remove();
    await tick();
    expect(node.callbackLog).toContain('disconnected');
  });
});
