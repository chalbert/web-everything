import { SimpleStore, AccordionState } from './store.js';
import { EXPAND_INTENT, ExpandIntent, NAVIGATE_INTENT, NavigateIntent } from './intents.js';
import { withExpanded, withAriaController, withRovingTabindex } from './traits.js';

export class AccordionGroup extends HTMLElement {
    store: SimpleStore<AccordionState>;

    static get observedAttributes() {
        return ['multiple'];
    }

    constructor() {
        super();
        this.store = new SimpleStore<AccordionState>({
            expandedIds: new Set(),
            allowMultiple: false,
            allowCollapseAll: true
        });
    }

    connectedCallback() {
        this.addEventListener('intent:dispatch', this._handleIntent.bind(this) as EventListener);
        this._updateConfig();
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if (name === 'multiple') {
            this._updateConfig();
        }
    }

    _updateConfig() {
        this.store.update({
            allowMultiple: this.hasAttribute('multiple')
        });
    }

    _handleIntent(e: CustomEvent<{ intent: string } & any>) {
        const { intent } = e.detail;
        
        if (intent === EXPAND_INTENT) {
            this._handleExpand(e.detail as ExpandIntent);
            e.stopPropagation(); // Handled
        } else if (intent === NAVIGATE_INTENT) {
            this._handleNavigate(e.detail as NavigateIntent, e.target as HTMLElement);
            e.stopPropagation();
        }
    }

    _handleExpand(payload: ExpandIntent) {
        const id = payload.value;
        if (!id) return;

        this.store.update(state => {
            const next = new Set(state.expandedIds);
            const isExpanded = next.has(id);

            if (isExpanded) {
                if (state.allowCollapseAll || next.size > 1) {
                    next.delete(id);
                }
            } else {
                if (!state.allowMultiple) {
                    next.clear();
                }
                next.add(id);
            }
            return { expandedIds: next };
        });
    }

    _handleNavigate(payload: NavigateIntent, origin: HTMLElement) {
        const headers = Array.from(this.querySelectorAll('accordion-header')) as HTMLElement[];
        const currentIndex = headers.indexOf(origin.closest('accordion-header') as HTMLElement);
        
        if (currentIndex === -1) return;

        let nextIndex = currentIndex;
        const lastIndex = headers.length - 1;

        switch (payload.direction) {
            case 'next':
                nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
                break;
            case 'previous':
                nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
                break;
            case 'first':
                nextIndex = 0;
                break;
            case 'last':
                nextIndex = lastIndex;
                break;
        }

        const target = headers[nextIndex];
        // Focus the button inside or the header itself if it's the interactive part
        const focusable = target.querySelector('button') || target;
        focusable.focus();
    }
}

export class AccordionItem extends HTMLElement {
    // Structural only
}

// Composition of Traits
const HeaderBase = withRovingTabindex(withAriaController(withExpanded(HTMLElement)));

export class AccordionHeader extends HeaderBase {
    // Logic is largely in traits, but we need to inject the store/context

    connectedCallback() {
        super.connectedCallback();
        
        // Find Group Store
        const group = this.closest('accordion-group') as AccordionGroup;
        if (group && group.store) {
            this.store = group.store; // Inject store into withExpanded trait
            
            // Subscribe to reflect expanded state
            this.unsubscribe = this.store.subscribe(state => {
                const isExpanded = state.expandedIds.has(this.panelId!);
                this.setAttribute('expanded', String(isExpanded));
            });
        }

        // Link with Panel
        requestAnimationFrame(() => this._linkPanel());
    }

    disconnectedCallback() {
        if (this.unsubscribe) this.unsubscribe();
    }

    private unsubscribe?: () => void;

    _linkPanel() {
        const item = this.closest('accordion-item');
        if (!item) return;
        
        const panel = item.querySelector('accordion-panel') as AccordionPanel;
        if (panel) {
            // panelId is used by withExpanded to dispatch intents
            this.panelId = panel.id || `panel-${this._id}`;
            panel.id = this.panelId;
            
            // Link Aria (from withAriaController)
            this.link(panel.id, 'controls');
            panel.setAttribute('aria-labelledby', this.id || this._id);
        }
    }
}

export class AccordionPanel extends HTMLElement {
    connectedCallback() {
        this.setAttribute('role', 'region');
        
        const group = this.closest('accordion-group') as AccordionGroup;
        if (group && group.store) {
            this.unsubscribe = group.store.subscribe(state => {
                const isExpanded = state.expandedIds.has(this.id);
                this.hidden = !isExpanded;
            });
        }
    }

    disconnectedCallback() {
        if (this.unsubscribe) this.unsubscribe();
    }

    private unsubscribe?: () => void;
}

// Register
customElements.define('accordion-group', AccordionGroup);
customElements.define('accordion-item', AccordionItem);
customElements.define('accordion-header', AccordionHeader);
customElements.define('accordion-panel', AccordionPanel);
