<!-- WEB CASE 3: Composition & Wiring -->
// main.ts
import { definitions } from "./definitions";

export injector main {
    // 1. Contextualize: Map the concrete 'definitions' injector 
    //    to the abstract identifier '@definitions'.
    provide * to '@definitions' from definitions;

    // 2. Include the consumer code into this execution context
    provide * from "./consumer";
}
