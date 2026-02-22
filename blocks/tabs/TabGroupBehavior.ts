/**
 * @file TabGroupBehavior.ts
 * @description Orchestrator for a tab group. Discovers child triggers and panels,
 * sets up ARIA associations, manages keyboard navigation, and delegates
 * panel visibility to ViewEngine.
 *
 * @example
 * ```html
 * <div tab-group activation="automatic" orientation="horizontal">
 *   <nav tab-list>
 *     <button tab-trigger="counter">Counter</button>
 *     <button tab-trigger="todos">Todo List</button>
 *   </nav>
 *   <div tab-panels>
 *     <section tab-panel="counter">Counter content</section>
 *     <section tab-panel="todos" hidden>Todos content</section>
 *   </div>
 * </div>
 * ```
 */

import CustomAttribute from '../../plugs/webbehaviors/CustomAttribute';
import ViewEngine from '../view/ViewEngine';
import type { ViewHiddenMode } from '../view/ViewEngine';

/** Activation mode for tabs */
export type TabActivationMode = 'automatic' | 'manual';

/** Orientation of the tab list */
export type TabOrientation = 'horizontal' | 'vertical';

/** Detail for tab-change event */
export interface TabChangeEventDetail {
  from: string | null;
  to: string;
  trigger: HTMLElement;
}

/** Internal counter for generating unique IDs */
let tabIdCounter = 0;

/**
 * Orchestrates a tab group. Sets up ARIA associations between triggers and panels,
 * manages keyboard navigation, and delegates panel visibility to ViewEngine.
 *
 * Attribute: `tab-group`
 */
export default class TabGroupBehavior extends CustomAttribute {
  #engine: ViewEngine;
  #triggers: HTMLElement[] = [];
  #panels: HTMLElement[] = [];
  #activeTrigger: HTMLElement | null = null;
  #activationMode: TabActivationMode = 'automatic';
  #orientation: TabOrientation = 'horizontal';

  constructor(options?: ConstructorParameters<typeof CustomAttribute>[0]) {
    super(options);
    this.#engine = new ViewEngine();
  }

  connectedCallback(): void {
    if (!this.target) return;

    this.#readConfig();
    this.#discoverChildren();
    this.#setupARIA();
    this.#setupInitialState();
    this.#setupKeyboard();
  }

  disconnectedCallback(): void {
    if (!this.target) return;
    const tabList = this.target.querySelector('[tab-list]');
    if (tabList) {
      tabList.removeEventListener('keydown', this.#handleKeydown);
    }
    for (const trigger of this.#triggers) {
      trigger.removeEventListener('click', this.#handleTriggerClick);
    }
  }

  /** Get the ViewEngine instance. */
  get engine(): ViewEngine {
    return this.#engine;
  }

  /** Get the current activation mode. */
  get activationMode(): TabActivationMode {
    return this.#activationMode;
  }

  /** Get the current orientation. */
  get orientation(): TabOrientation {
    return this.#orientation;
  }

  /** Get all triggers in this tab group. */
  get triggers(): readonly HTMLElement[] {
    return this.#triggers;
  }

  /** Get all panels in this tab group. */
  get panels(): readonly HTMLElement[] {
    return this.#panels;
  }

  /** Get the currently active trigger. */
  get activeTrigger(): HTMLElement | null {
    return this.#activeTrigger;
  }

  /**
   * Activate a tab by its name (the value of tab-trigger / tab-panel attribute).
   */
  activate(name: string): boolean {
    const trigger = this.#triggers.find(t => t.getAttribute('tab-trigger') === name);
    if (!trigger) return false;
    return this.#activateTab(trigger);
  }

  // ── Private: Setup ─────────────────────────────────

  #readConfig(): void {
    if (!this.target) return;

    const activation = this.target.getAttribute('activation');
    if (activation === 'manual' || activation === 'automatic') {
      this.#activationMode = activation;
    }

    const orientation = this.target.getAttribute('orientation');
    if (orientation === 'horizontal' || orientation === 'vertical') {
      this.#orientation = orientation;
    }
  }

  #discoverChildren(): void {
    if (!this.target) return;

    this.#triggers = Array.from(
      this.target.querySelectorAll<HTMLElement>('[tab-trigger]')
    );

    this.#panels = Array.from(
      this.target.querySelectorAll<HTMLElement>('[tab-panel]')
    );
  }

  #setupARIA(): void {
    // Set up tablist
    const tabList = this.target?.querySelector('[tab-list]');
    if (tabList) {
      tabList.setAttribute('role', 'tablist');
      tabList.setAttribute('aria-orientation', this.#orientation);
    }

    // Set up triggers and panels
    for (const trigger of this.#triggers) {
      const name = trigger.getAttribute('tab-trigger') ?? '';
      const panel = this.#panels.find(p => p.getAttribute('tab-panel') === name);
      if (!panel) continue;

      // Generate IDs if missing
      if (!trigger.id) {
        trigger.id = `tab-trigger-${++tabIdCounter}`;
      }
      if (!panel.id) {
        panel.id = `tab-panel-${++tabIdCounter}`;
      }

      // Set roles
      trigger.setAttribute('role', 'tab');
      panel.setAttribute('role', 'tabpanel');

      // Cross-reference
      trigger.setAttribute('aria-controls', panel.id);
      panel.setAttribute('aria-labelledby', trigger.id);

      // Panel tabindex for keyboard access
      panel.setAttribute('tabindex', '0');

      // Click handler
      trigger.addEventListener('click', this.#handleTriggerClick);
    }
  }

  #setupInitialState(): void {
    if (!this.target) return;

    // Determine initial active tab
    const defaultName = this.target.getAttribute('default');
    let initialTrigger: HTMLElement | null = null;

    if (defaultName) {
      initialTrigger = this.#triggers.find(
        t => t.getAttribute('tab-trigger') === defaultName
      ) ?? null;
    }

    // Fall back to first trigger
    if (!initialTrigger && this.#triggers.length > 0) {
      initialTrigger = this.#triggers[0];
    }

    // Set all triggers to inactive first
    for (const trigger of this.#triggers) {
      trigger.setAttribute('aria-selected', 'false');
      trigger.setAttribute('tabindex', '-1');
    }

    // Hide all panels first
    for (const panel of this.#panels) {
      if (this.#engine.isVisible(panel)) {
        this.#engine.hide(panel);
      }
    }

    // Activate the initial tab
    if (initialTrigger) {
      this.#activateTab(initialTrigger, true);
    }
  }

  #setupKeyboard(): void {
    const tabList = this.target?.querySelector('[tab-list]');
    if (tabList) {
      tabList.addEventListener('keydown', this.#handleKeydown);
    }
  }

  // ── Private: Activation ────────────────────────────

  #activateTab(trigger: HTMLElement, isInitial = false): boolean {
    const name = trigger.getAttribute('tab-trigger') ?? '';
    const panel = this.#panels.find(p => p.getAttribute('tab-panel') === name);
    if (!panel) return false;

    const previousName = this.#activeTrigger?.getAttribute('tab-trigger') ?? null;

    // Skip if already active
    if (this.#activeTrigger === trigger) return false;

    // Fire tab-change event (cancelable, unless initial setup)
    if (!isInitial && this.target) {
      const changeEvent = new CustomEvent<TabChangeEventDetail>('tab-change', {
        bubbles: true,
        cancelable: true,
        detail: {
          from: previousName,
          to: name,
          trigger,
        },
      });
      if (!this.target.dispatchEvent(changeEvent)) return false;
    }

    // Deactivate previous
    if (this.#activeTrigger) {
      this.#activeTrigger.setAttribute('aria-selected', 'false');
      this.#activeTrigger.setAttribute('tabindex', '-1');

      const prevName = this.#activeTrigger.getAttribute('tab-trigger') ?? '';
      const prevPanel = this.#panels.find(p => p.getAttribute('tab-panel') === prevName);
      if (prevPanel && this.#engine.isVisible(prevPanel)) {
        this.#engine.hide(prevPanel);
      }
    }

    // Activate new
    trigger.setAttribute('aria-selected', 'true');
    trigger.setAttribute('tabindex', '0');
    this.#activeTrigger = trigger;

    this.#engine.show(panel);

    return true;
  }

  // ── Private: Event Handlers ────────────────────────

  #handleTriggerClick = (e: Event): void => {
    const trigger = (e.currentTarget ?? e.target) as HTMLElement;
    if (!trigger.hasAttribute('tab-trigger')) return;

    this.#activateTab(trigger);
    trigger.focus();
  };

  #handleKeydown = (e: Event): void => {
    const keyEvent = e as KeyboardEvent;
    const { key } = keyEvent;

    // Only handle relevant keys
    const isHorizontal = this.#orientation === 'horizontal';
    const prevKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';
    const nextKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';

    if (![prevKey, nextKey, 'Home', 'End', 'Enter', ' '].includes(key)) return;

    keyEvent.preventDefault();

    const currentIndex = this.#activeTrigger
      ? this.#triggers.indexOf(this.#activeTrigger)
      : -1;

    let targetIndex = currentIndex;

    switch (key) {
      case prevKey:
        targetIndex = currentIndex <= 0
          ? this.#triggers.length - 1
          : currentIndex - 1;
        break;
      case nextKey:
        targetIndex = currentIndex >= this.#triggers.length - 1
          ? 0
          : currentIndex + 1;
        break;
      case 'Home':
        targetIndex = 0;
        break;
      case 'End':
        targetIndex = this.#triggers.length - 1;
        break;
      case 'Enter':
      case ' ':
        // In manual mode, Enter/Space activates the focused trigger
        if (this.#activationMode === 'manual') {
          const focused = this.#triggers.find(t => t === document.activeElement);
          if (focused) {
            this.#activateTab(focused);
          }
        }
        return;
    }

    const targetTrigger = this.#triggers[targetIndex];
    if (!targetTrigger) return;

    // Focus the target trigger
    targetTrigger.focus();

    // In automatic mode, focus activates the tab
    if (this.#activationMode === 'automatic') {
      this.#activateTab(targetTrigger);
    }
  };
}
