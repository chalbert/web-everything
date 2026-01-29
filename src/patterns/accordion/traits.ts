import { AccordionState, Store } from './store.js';
import { EXPAND_INTENT, ExpandIntent, NAVIGATE_INTENT, NavigateIntent } from './intents.js';

type Constructor<T = HTMLElement> = new (...args: any[]) => T;

/**
 * State Reflection Trait
 * - Reflects `expanded` state to `aria-expanded`
 * - Toggles `aria-disabled` if interaction is forbidden
 */
export function withExpanded<T extends Constructor>(Base: T) {
    return class WithExpanded extends Base {
        // Expected to be provided or injected
        store?: Store<AccordionState>;
        panelId?: string;

        static get observedAttributes() {
            return ['expanded', 'disabled'];
        }

        connectedCallback() {
            // @ts-ignore
            if (super.connectedCallback) super.connectedCallback();
            
            this.addEventListener('click', this._handleTrigger.bind(this));
            this.addEventListener('keydown', this._handleTriggerKey.bind(this));
        }

        attributeChangedCallback(name: string, oldValue: string, newValue: string) {
            // @ts-ignore
            if (super.attributeChangedCallback) super.attributeChangedCallback(name, oldValue, newValue);
            
            if (name === 'expanded') {
                this.setAttribute('aria-expanded', newValue === 'true' ? 'true' : 'false');
            }
        }

        _handleTrigger(e: Event) {
            this._dispatchExpand();
        }

        _handleTriggerKey(e: KeyboardEvent) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this._dispatchExpand();
            }
        }

        _dispatchExpand() {
            if (this.hasAttribute('disabled')) return;

            const intent: ExpandIntent = {
                value: this.getAttribute('arg-id') || this.panelId || null
            };

            this.dispatchEvent(new CustomEvent('intent:dispatch', {
                bubbles: true,
                composed: true,
                detail: {
                    intent: EXPAND_INTENT,
                    ...intent
                }
            }));
        }
    };
}

/**
 * Accessibility Relationship Trait
 * - Links `aria-controls` (Header) <-> `aria-labelledby` (Panel)
 * - Generates unique IDs if missing
 */
export function withAriaController<T extends Constructor>(Base: T) {
    return class WithAriaController extends Base {
        _id: string;

        constructor(...args: any[]) {
            super(...args);
            this._id = `acc-${Math.random().toString(36).substr(2, 9)}`;
        }

        connectedCallback() {
            // @ts-ignore
            if (super.connectedCallback) super.connectedCallback();
            
            if (!this.id) this.id = this._id;
        }

        link(targetId: string, type: 'controls' | 'labelledby') {
            const attr = type === 'controls' ? 'aria-controls' : 'aria-labelledby';
            this.setAttribute(attr, targetId);
        }
    };
}

/**
 * Focus Management Trait (Roving Tabindex)
 * - Manages tabindex="0" vs "-1"
 * - Dispatches NavigateIntent on arrow keys
 */
export function withRovingTabindex<T extends Constructor>(Base: T) {
    return class WithRovingTabindex extends Base {
        connectedCallback() {
            // @ts-ignore
            if (super.connectedCallback) super.connectedCallback();
            
            this.addEventListener('keydown', this._handleNavigation.bind(this));
            
            // Default to not focusable until activated by group
            if (!this.hasAttribute('tabindex')) {
                this.setAttribute('tabindex', '-1');
            }
        }

        _handleNavigation(e: KeyboardEvent) {
            const orientation = this.closest('accordion-group')?.getAttribute('orientation') || 'vertical';
            let direction: NavigateIntent['direction'] | null = null;

            switch (e.key) {
                case 'ArrowDown':
                case 'ArrowRight':
                    direction = 'next';
                    break;
                case 'ArrowUp':
                case 'ArrowLeft':
                    direction = 'previous';
                    break;
                case 'Home':
                    direction = 'first';
                    break;
                case 'End':
                    direction = 'last';
                    break;
            }

            if (direction) {
                e.preventDefault();
                this.dispatchEvent(new CustomEvent('intent:dispatch', {
                    bubbles: true,
                    composed: true,
                    detail: {
                        intent: NAVIGATE_INTENT,
                        direction,
                        orientation
                    }
                }));
            }
        }
    };
}
