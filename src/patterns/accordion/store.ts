export interface AccordionState {
    /** Set of currently expanded panel IDs */
    expandedIds: Set<string>;
    /** Whether multiple panels can be expanded simultaneously */
    allowMultiple: boolean;
    /** Whether all panels can be collapsed (at least one must be open if false) */
    allowCollapseAll: boolean;
}

// Minimal Store Interface (compatible with Web States)
export interface Store<T> {
    state: T;
    subscribe(listener: (state: T) => void): () => void;
    update(partial: Partial<T> | ((prev: T) => Partial<T>)): void;
}

export class SimpleStore<T> implements Store<T> {
    state: T;
    private listeners = new Set<(state: T) => void>();

    constructor(initialState: T) {
        this.state = initialState;
    }

    subscribe(listener: (state: T) => void): () => void {
        this.listeners.add(listener); // Register
        listener(this.state); // Immediate call
        return () => this.listeners.delete(listener); // Unsubscribe
    }

    update(updater: Partial<T> | ((prev: T) => Partial<T>)): void {
        const partial = typeof updater === 'function' ? (updater as any)(this.state) : updater;
        this.state = { ...this.state, ...partial };
        this.listeners.forEach(l => l(this.state));
    }
}