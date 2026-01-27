import { DataGrid } from "./lib/Grid";
import { useSortable } from "./lib/traits/Sortable";

// Scenario: A developer reusing the component in their app

const grid = new DataGrid();
grid.sortBy('asc'); // ✅ Compiles!
document.body.appendChild(grid);

// ---------------------------------------------------------
// ATTEMPT 1: Naive Usage (Fails Compilation)
// ---------------------------------------------------------
// grid.sortBy('asc'); 
// ^ Error: Property 'sortBy' does not exist on type 'DataGrid'.
//   (This is good! It protects us from runtime crashes)


// ---------------------------------------------------------
// ATTEMPT 2: Using the Trait Loader
// ---------------------------------------------------------
console.log("Loading Sortable Trait...");

// This single line loads the code AND updates the type
useSortable(grid); 

// TypeScript now knows grid is (DataGrid & SortableTrait)
grid.sortBy('asc'); // ✅ Compiles!
console.log("Is Sorted?", grid.isSorted);
