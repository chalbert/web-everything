/**
 * Unit tests for TabGroupBehavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import TabGroupBehavior from '../../../tabs/TabGroupBehavior';

/**
 * Helper to create a standard tab group DOM structure.
 */
function createTabGroup(options?: {
  activation?: string;
  orientation?: string;
  defaultTab?: string;
}): HTMLElement {
  const group = document.createElement('div');
  group.setAttribute('tab-group', '');
  if (options?.activation) group.setAttribute('activation', options.activation);
  if (options?.orientation) group.setAttribute('orientation', options.orientation);
  if (options?.defaultTab) group.setAttribute('default', options.defaultTab);

  group.innerHTML = `
    <nav tab-list>
      <button tab-trigger="counter">Counter</button>
      <button tab-trigger="todos">Todo List</button>
      <button tab-trigger="form">Form</button>
    </nav>
    <div>
      <section tab-panel="counter">Counter content</section>
      <section tab-panel="todos">Todos content</section>
      <section tab-panel="form">Form content</section>
    </div>
  `;

  return group;
}

describe('TabGroupBehavior', () => {
  let group: HTMLElement;
  let behavior: TabGroupBehavior;

  beforeEach(() => {
    document.body.innerHTML = '';
    group = createTabGroup();
    document.body.appendChild(group);

    behavior = new TabGroupBehavior({ name: 'tab-group' });
    behavior.attach(group);
    behavior.isConnected = true;
    behavior.connectedCallback?.();
  });

  describe('ARIA roles', () => {
    it('should set role="tablist" on tab-list element', () => {
      const tabList = group.querySelector('[tab-list]');
      expect(tabList?.getAttribute('role')).toBe('tablist');
    });

    it('should set role="tab" on all triggers', () => {
      const triggers = group.querySelectorAll('[tab-trigger]');
      for (const trigger of triggers) {
        expect(trigger.getAttribute('role')).toBe('tab');
      }
    });

    it('should set role="tabpanel" on all panels', () => {
      const panels = group.querySelectorAll('[tab-panel]');
      for (const panel of panels) {
        expect(panel.getAttribute('role')).toBe('tabpanel');
      }
    });

    it('should set aria-orientation on tablist', () => {
      const tabList = group.querySelector('[tab-list]');
      expect(tabList?.getAttribute('aria-orientation')).toBe('horizontal');
    });

    it('should set aria-orientation="vertical" when configured', () => {
      document.body.innerHTML = '';
      const vGroup = createTabGroup({ orientation: 'vertical' });
      document.body.appendChild(vGroup);

      const vBehavior = new TabGroupBehavior({ name: 'tab-group' });
      vBehavior.attach(vGroup);
      vBehavior.isConnected = true;
      vBehavior.connectedCallback?.();

      const tabList = vGroup.querySelector('[tab-list]');
      expect(tabList?.getAttribute('aria-orientation')).toBe('vertical');
    });
  });

  describe('ARIA cross-references', () => {
    it('should set aria-controls on triggers', () => {
      const triggers = group.querySelectorAll('[tab-trigger]');
      for (const trigger of triggers) {
        const controls = trigger.getAttribute('aria-controls');
        expect(controls).toBeTruthy();
        const panel = document.getElementById(controls!);
        expect(panel).toBeTruthy();
        expect(panel?.getAttribute('role')).toBe('tabpanel');
      }
    });

    it('should set aria-labelledby on panels', () => {
      const panels = group.querySelectorAll('[tab-panel]');
      for (const panel of panels) {
        const labelledBy = panel.getAttribute('aria-labelledby');
        expect(labelledBy).toBeTruthy();
        const trigger = document.getElementById(labelledBy!);
        expect(trigger).toBeTruthy();
        expect(trigger?.getAttribute('role')).toBe('tab');
      }
    });

    it('should generate IDs for elements without them', () => {
      const triggers = group.querySelectorAll('[tab-trigger]');
      const panels = group.querySelectorAll('[tab-panel]');

      for (const trigger of triggers) {
        expect(trigger.id).toBeTruthy();
      }
      for (const panel of panels) {
        expect(panel.id).toBeTruthy();
      }
    });

    it('should set tabindex="0" on panels', () => {
      const panels = group.querySelectorAll('[tab-panel]');
      for (const panel of panels) {
        expect(panel.getAttribute('tabindex')).toBe('0');
      }
    });
  });

  describe('initial state', () => {
    it('should activate first tab by default', () => {
      const triggers = group.querySelectorAll('[tab-trigger]');
      const panels = group.querySelectorAll('[tab-panel]');

      // First trigger active
      expect(triggers[0].getAttribute('aria-selected')).toBe('true');
      expect(triggers[0].getAttribute('tabindex')).toBe('0');

      // Other triggers inactive
      expect(triggers[1].getAttribute('aria-selected')).toBe('false');
      expect(triggers[1].getAttribute('tabindex')).toBe('-1');
      expect(triggers[2].getAttribute('aria-selected')).toBe('false');
      expect(triggers[2].getAttribute('tabindex')).toBe('-1');

      // First panel visible, others hidden
      expect(behavior.engine.isVisible(panels[0] as HTMLElement)).toBe(true);
      expect(behavior.engine.isVisible(panels[1] as HTMLElement)).toBe(false);
      expect(behavior.engine.isVisible(panels[2] as HTMLElement)).toBe(false);
    });

    it('should activate tab specified by default attribute', () => {
      document.body.innerHTML = '';
      const dGroup = createTabGroup({ defaultTab: 'todos' });
      document.body.appendChild(dGroup);

      const dBehavior = new TabGroupBehavior({ name: 'tab-group' });
      dBehavior.attach(dGroup);
      dBehavior.isConnected = true;
      dBehavior.connectedCallback?.();

      const triggers = dGroup.querySelectorAll('[tab-trigger]');
      expect(triggers[0].getAttribute('aria-selected')).toBe('false');
      expect(triggers[1].getAttribute('aria-selected')).toBe('true');
      expect(triggers[2].getAttribute('aria-selected')).toBe('false');
    });
  });

  describe('tab activation', () => {
    it('should activate tab on trigger click', () => {
      const triggers = group.querySelectorAll<HTMLElement>('[tab-trigger]');
      const panels = group.querySelectorAll<HTMLElement>('[tab-panel]');

      triggers[1].click();

      expect(triggers[0].getAttribute('aria-selected')).toBe('false');
      expect(triggers[1].getAttribute('aria-selected')).toBe('true');
      expect(behavior.engine.isVisible(panels[0])).toBe(false);
      expect(behavior.engine.isVisible(panels[1])).toBe(true);
    });

    it('should fire tab-change event on activation', () => {
      const listener = vi.fn();
      group.addEventListener('tab-change', listener);

      const triggers = group.querySelectorAll<HTMLElement>('[tab-trigger]');
      triggers[1].click();

      expect(listener).toHaveBeenCalledTimes(1);
      const detail = listener.mock.calls[0][0].detail;
      expect(detail.from).toBe('counter');
      expect(detail.to).toBe('todos');
      expect(detail.trigger).toBe(triggers[1]);
    });

    it('should allow cancelling tab-change event', () => {
      group.addEventListener('tab-change', (e) => e.preventDefault());

      const triggers = group.querySelectorAll<HTMLElement>('[tab-trigger]');
      const panels = group.querySelectorAll<HTMLElement>('[tab-panel]');

      triggers[1].click();

      // Should remain on first tab
      expect(triggers[0].getAttribute('aria-selected')).toBe('true');
      expect(behavior.engine.isVisible(panels[0])).toBe(true);
    });

    it('should activate via the public activate method', () => {
      const result = behavior.activate('todos');

      expect(result).toBe(true);
      const triggers = group.querySelectorAll('[tab-trigger]');
      expect(triggers[1].getAttribute('aria-selected')).toBe('true');
    });

    it('should return false for non-existent tab name', () => {
      const result = behavior.activate('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('keyboard navigation (automatic mode)', () => {
    function pressKey(key: string): void {
      const tabList = group.querySelector('[tab-list]');
      tabList?.dispatchEvent(new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
      }));
    }

    it('should move to next tab on ArrowRight', () => {
      pressKey('ArrowRight');

      const triggers = group.querySelectorAll('[tab-trigger]');
      expect(triggers[1].getAttribute('aria-selected')).toBe('true');
    });

    it('should move to previous tab on ArrowLeft', () => {
      // First go to second tab
      pressKey('ArrowRight');
      pressKey('ArrowLeft');

      const triggers = group.querySelectorAll('[tab-trigger]');
      expect(triggers[0].getAttribute('aria-selected')).toBe('true');
    });

    it('should wrap around at the end', () => {
      pressKey('ArrowRight'); // -> todos
      pressKey('ArrowRight'); // -> form
      pressKey('ArrowRight'); // -> counter (wrap)

      const triggers = group.querySelectorAll('[tab-trigger]');
      expect(triggers[0].getAttribute('aria-selected')).toBe('true');
    });

    it('should wrap around at the beginning', () => {
      pressKey('ArrowLeft'); // -> form (wrap)

      const triggers = group.querySelectorAll('[tab-trigger]');
      expect(triggers[2].getAttribute('aria-selected')).toBe('true');
    });

    it('should jump to first tab on Home', () => {
      pressKey('ArrowRight'); // -> todos
      pressKey('Home');

      const triggers = group.querySelectorAll('[tab-trigger]');
      expect(triggers[0].getAttribute('aria-selected')).toBe('true');
    });

    it('should jump to last tab on End', () => {
      pressKey('End');

      const triggers = group.querySelectorAll('[tab-trigger]');
      expect(triggers[2].getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('keyboard navigation (manual mode)', () => {
    let manualGroup: HTMLElement;

    beforeEach(() => {
      document.body.innerHTML = '';
      manualGroup = createTabGroup({ activation: 'manual' });
      document.body.appendChild(manualGroup);

      const manualBehavior = new TabGroupBehavior({ name: 'tab-group' });
      manualBehavior.attach(manualGroup);
      manualBehavior.isConnected = true;
      manualBehavior.connectedCallback?.();
    });

    function pressKey(key: string): void {
      const tabList = manualGroup.querySelector('[tab-list]');
      tabList?.dispatchEvent(new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
      }));
    }

    it('should not activate tab on arrow key (only moves focus)', () => {
      pressKey('ArrowRight');

      const triggers = manualGroup.querySelectorAll('[tab-trigger]');
      // First tab should still be selected (manual mode)
      expect(triggers[0].getAttribute('aria-selected')).toBe('true');
    });

    it('should activate tab on Enter in manual mode', () => {
      // Move focus to second trigger
      const triggers = manualGroup.querySelectorAll<HTMLElement>('[tab-trigger]');
      triggers[1].focus();

      pressKey('Enter');

      expect(triggers[1].getAttribute('aria-selected')).toBe('true');
    });

    it('should activate tab on Space in manual mode', () => {
      const triggers = manualGroup.querySelectorAll<HTMLElement>('[tab-trigger]');
      triggers[2].focus();

      pressKey(' ');

      expect(triggers[2].getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('vertical orientation', () => {
    let vGroup: HTMLElement;

    beforeEach(() => {
      document.body.innerHTML = '';
      vGroup = createTabGroup({ orientation: 'vertical' });
      document.body.appendChild(vGroup);

      const vBehavior = new TabGroupBehavior({ name: 'tab-group' });
      vBehavior.attach(vGroup);
      vBehavior.isConnected = true;
      vBehavior.connectedCallback?.();
    });

    function pressKey(key: string): void {
      const tabList = vGroup.querySelector('[tab-list]');
      tabList?.dispatchEvent(new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
      }));
    }

    it('should navigate with ArrowDown/ArrowUp instead of Left/Right', () => {
      pressKey('ArrowDown');

      const triggers = vGroup.querySelectorAll('[tab-trigger]');
      expect(triggers[1].getAttribute('aria-selected')).toBe('true');

      pressKey('ArrowUp');
      expect(triggers[0].getAttribute('aria-selected')).toBe('true');
    });

    it('should ignore ArrowLeft/ArrowRight in vertical mode', () => {
      pressKey('ArrowRight');

      const triggers = vGroup.querySelectorAll('[tab-trigger]');
      // Should still be on first tab
      expect(triggers[0].getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('roving tabindex', () => {
    it('should set tabindex="0" on active trigger and "-1" on others', () => {
      const triggers = group.querySelectorAll('[tab-trigger]');

      expect(triggers[0].getAttribute('tabindex')).toBe('0');
      expect(triggers[1].getAttribute('tabindex')).toBe('-1');
      expect(triggers[2].getAttribute('tabindex')).toBe('-1');
    });

    it('should update tabindex when switching tabs', () => {
      const triggers = group.querySelectorAll<HTMLElement>('[tab-trigger]');

      triggers[2].click();

      expect(triggers[0].getAttribute('tabindex')).toBe('-1');
      expect(triggers[1].getAttribute('tabindex')).toBe('-1');
      expect(triggers[2].getAttribute('tabindex')).toBe('0');
    });
  });

  describe('lifecycle', () => {
    it('should clean up on disconnect', () => {
      behavior.disconnectedCallback?.();

      // Click should no longer work
      const triggers = group.querySelectorAll<HTMLElement>('[tab-trigger]');
      const panels = group.querySelectorAll<HTMLElement>('[tab-panel]');

      triggers[1].click();

      // Should still be on first tab (event listener removed)
      expect(triggers[0].getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('public API', () => {
    it('should expose triggers as readonly', () => {
      expect(behavior.triggers).toHaveLength(3);
    });

    it('should expose panels as readonly', () => {
      expect(behavior.panels).toHaveLength(3);
    });

    it('should expose activeTrigger', () => {
      expect(behavior.activeTrigger).toBeTruthy();
      expect(behavior.activeTrigger?.getAttribute('tab-trigger')).toBe('counter');
    });

    it('should expose activationMode', () => {
      expect(behavior.activationMode).toBe('automatic');
    });

    it('should expose orientation', () => {
      expect(behavior.orientation).toBe('horizontal');
    });
  });
});
