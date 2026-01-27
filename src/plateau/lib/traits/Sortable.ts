import { DataGrid } from "../Grid";

// 1. The Trait Interface
export interface SortableTrait {
    sortBy(direction: 'asc' | 'desc'): void;
    isSorted: boolean;
}

// 2. The Runtime Mixin (The actual logic code)
function applySortableMixin(grid: DataGrid) {
    // We cast to any to attach properties that TS doesn't think exist on the base class
    const host = grid as any;

    host.isSorted = false;

    host.sortBy = (direction: 'asc' | 'desc') => {
        console.log(`[SortableTrait] Sorting grid ${direction}...`);
        grid.items.sort((a, b) => direction === 'asc' ? a - b : b - a);
        host.isSorted = true;
        grid.render();
    };
}

// 3. The Assertion Loader (The Magic)
// This function does two things:
// A. Checks validity at runtime
// B. Tells TypeScript "Trust me, this grid IS Sortable now"
export function useSortable(grid: DataGrid): asserts grid is DataGrid & SortableTrait {
    // Runtime Check
    if (!grid.hasAttribute('sortable')) {
        console.warn("Auto-adding 'sortable' attribute...");
        grid.setAttribute('sortable', '');
    }

    // Lazy Load / Mixin Logic
    // In a real app, this might check a WeakMap to see if already applied
    if (!('sortBy' in grid)) {
        applySortableMixin(grid);
    }
}
