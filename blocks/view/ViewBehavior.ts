/**
 * @file ViewBehavior.ts
 * @description CustomAttribute that marks an element as a view target
 * controllable via Invoker Commands (--view-show, --view-hide, --view-toggle).
 *
 * The element is always in the DOM — ViewBehavior only toggles its visibility
 * using the engine's hidden modes.
 *
 * @example
 * ```html
 * <button commandfor="panel-1" command="--view-show">Show</button>
 * <button commandfor="panel-1" command="--view-hide">Hide</button>
 * <button commandfor="panel-1" command="--view-toggle">Toggle</button>
 *
 * <section id="panel-1" view>Panel content</section>
 * ```
 */

import CustomAttribute from '../../plugs/webbehaviors/CustomAttribute';
import ViewEngine from './ViewEngine';

/**
 * Invoker Commands handled by ViewBehavior.
 * Custom commands use the -- prefix per the Invoker Commands spec.
 */
const VIEW_COMMANDS = {
  SHOW: '--view-show',
  HIDE: '--view-hide',
  TOGGLE: '--view-toggle',
} as const;

/**
 * Behavior attribute that enables imperative show/hide via Invoker Commands.
 * Attribute name: `view`
 *
 * Delegates all show/hide mechanics to ViewEngine. Supports:
 * - `hidden-mode` attribute for configurable hidden strategy
 * - `name` attribute for exclusive groups (only one visible at a time)
 * - `view:transition` attribute for View Transitions API
 */
export default class ViewBehavior extends CustomAttribute {
  #engine: ViewEngine;

  constructor(options?: ConstructorParameters<typeof CustomAttribute>[0]) {
    super(options);
    this.#engine = new ViewEngine();
  }

  connectedCallback(): void {
    if (!this.target) return;

    // Listen for Invoker Commands
    this.target.addEventListener('command', this.#handleCommand);
  }

  disconnectedCallback(): void {
    if (!this.target) return;
    this.target.removeEventListener('command', this.#handleCommand);
  }

  /** Get the ViewEngine instance (useful for higher-level components like Tabs). */
  get engine(): ViewEngine {
    return this.#engine;
  }

  #handleCommand = (e: Event): void => {
    const command = (e as any).command as string | undefined;
    if (!command || !this.target) return;

    switch (command) {
      case VIEW_COMMANDS.SHOW:
        this.#engine.show(this.target);
        break;
      case VIEW_COMMANDS.HIDE:
        this.#engine.hide(this.target);
        break;
      case VIEW_COMMANDS.TOGGLE:
        this.#engine.toggle(this.target);
        break;
    }
  };
}
