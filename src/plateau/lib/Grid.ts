// The Core Component
// Notice: No mention of 'Sortable' here. Pure logic.
export class DataGrid extends HTMLElement {
    items: any[] = [];
    
    constructor() {
        super();
        this.items = [1, 5, 2];
    }

    render() {
        console.log('Rendering Grid:', this.items);
    }
}

customElements.define('data-grid', DataGrid);
