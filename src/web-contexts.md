---
title: "Web Contexts: Spec & Implementation Analysis"
description: Comparative analysis of web context APIs, framework implementations, and the HTML Injector approach.
---

# Web Contexts: Spec & Implementation Analysis

## 1. Comparative Table: Context APIs & Frameworks

| Spec/Framework         | Context Propagation         | Scoping/Isolation         | API Shape / Syntax                | Registry/Lookup Model         | Observations / Differences                                  |
|------------------------|----------------------------|---------------------------|-----------------------------------|-------------------------------|-------------------------------------------------------------|
| **Scoped CustomElementRegistry (Proposal)** | DOM subtree (shadow root)         | Shadow DOM boundary, opt-in       | JS API: `attachInternals().customElements` | Per-shadow-root registry         | Registry is per shadow root, not per logical context        |
| **React Context**      | Virtual tree (component)   | Per-provider, explicit     | JS API: `<Provider value={}>`     | JS object, not DOM            | Not observable from DOM, not hierarchical in DOM            |
| **Vue Provide/Inject** | Virtual tree (component)   | Per-provider, explicit     | JS API: `provide/inject`          | JS object, not DOM            | Similar to React, not DOM-based                             |
| **Angular DI**         | Component tree             | Per-injector, explicit     | Decorators, tokens                | Hierarchical injector         | Not observable from DOM, but hierarchical                   |
| **Lit Context (proposed)** | DOM tree (element)          | Per-provider, explicit     | Decorators, JS API                | Context registry per element  | DOM-based, but not a standard                               |
| **Svelte Context**     | Component tree             | Per-provider, explicit     | JS API: `setContext/getContext`   | JS object, not DOM            | Not DOM-based                                               |
| **WebComponents (current)** | DOM tree (event retargeting) | Shadow DOM boundary, opt-in | N/A                               | N/A                          | No context API, only event retargeting                      |
| **HTML Injector (Web Everything)** | DOM tree (attribute/association) | Per-injector, opt-in via attribute | Declarative: `<script type="injector" id="...">` | Registry per injector node, DOM queryable | Closest to DOM-based context, observable, declarative       |

## 2. Analysis: How Close is HTML Injector to a Web Context API?

### What HTML Injector Already Provides
- **DOM-based context association**: Context is attached to DOM nodes via `injector` attribute and `<script type="injector">`.
- **Hierarchical lookup**: Context can be inherited or isolated via the `isolate` attribute, mirroring DOM tree scoping.
- **Declarative and observable**: Context is visible in markup, not hidden in JS closures.
- **Registry model**: Each injector acts as a registry for values, similar to a context provider.

### What a Web Context Standard Might Add
- **Standardized API for context lookup**: e.g., `Element.getContext(type)` or `Element.contextRegistry`.
- **Interop with JS and declarative**: Both imperative (JS) and declarative (HTML) context access.
- **Observable context changes**: Standard events or hooks for context changes (not just static association).
- **Context type safety and protocol negotiation**: Ability to query for context by protocol/interface, not just by name/id.
- **Integration with CustomElementRegistry**: Unified registry for both elements and context values.
- **Lifecycle and fallback**: Standardized fallback, error, and lifecycle handling for context provision/consumption.

### Key Observations
- HTML Injector is already very close to a DOM-native context API, especially in its declarative, observable, and hierarchical nature.
- The main gap is a standardized, browser-native API for context lookup and change observation, and possibly richer protocol/type negotiation.
- Most frameworks use a virtual/component tree, not the DOM tree, and are not observable from outside the framework.
- Scoped CustomElementRegistry is the closest native proposal, but is limited to custom elements, not arbitrary context.

## 3. Summary

- **HTML Injector**: Already provides a declarative, DOM-based, hierarchical context mechanism, which is more observable and interoperable than most framework solutions.
- **Web Context Standard**: Would formalize the lookup, observation, and protocol negotiation aspects, and could unify context and registry patterns for the web platform.

---

## 4. DOM API for Contexts Protocol

This section documents the proposed DOM API extensions needed to implement the contexts protocol. These APIs extend existing DOM interfaces to support hierarchical context lookup and management.

### 4.1 Node Interface Extensions

The `Node` interface (inherited by all DOM nodes) is extended with the following methods and properties:

#### Injector Methods

- **`node.getOwnInjector(): HTMLInjector | null`**
  - Returns the injector owned by this specific node, or `null` if the node doesn't have its own injector
  - Only returns an injector if this node explicitly defines one (via injector attribute or script type="injector")

- **`node.hasOwnInjector(): boolean`**
  - Returns `true` if this node has its own injector, `false` otherwise
  - Convenience method equivalent to `Boolean(node.getOwnInjector())`

- **`node.getClosestInjector(): HTMLInjector | null`**
  - Returns the closest injector in the DOM tree hierarchy, walking up from this node
  - Searches through parent elements, shadow roots, and template boundaries
  - Returns `null` if no injector is found in the ancestry

- **`node.injectors(): Generator<HTMLInjector>`**
  - Returns a generator that yields all injectors in the hierarchy, starting from the closest
  - Each iteration yields the next ancestor injector, walking up to the root
  - Useful for exhaustive searches across multiple context layers

#### Context Creation & Lookup

- **`node.createElement(tagName: string, options?: ElementCreationOptions): HTMLElement`**
  - Creates an element using the context-aware custom element registry
  - Searches through the injector hierarchy for custom element definitions
  - Falls back to standard `document.createElement()` if no custom definition is found

- **`node.createContext(contextType: string): CustomContext | undefined`**
  - Creates a new context instance of the specified type
  - Searches through the injector hierarchy for registered context constructors
  - Returns `undefined` if the context type is not registered in any ancestor injector

- **`node.getContext(contextType: string): any | undefined`**
  - Retrieves the closest context instance of the specified type
  - Searches through the injector hierarchy from closest to root
  - Returns the first matching context found, or `undefined` if none exists

- **`node.ensureContext(contextType: string): CustomContext`**
  - Gets an existing context or creates a new one if it doesn't exist
  - First checks for an owned context via `getOwnContext()`
  - If not found, creates a new context using `createContext()` and attaches it to this node
  - Returns the existing or newly created context

- **`node.getOwnContext(contextType: string): any | null`**
  - Returns the context of the specified type owned by this node
  - Only returns a context if this specific node provides it
  - Returns `null` if this node doesn't own a context of that type

#### Context Queries

- **`node.hasContext(contextType: string): boolean`**
  - Returns `true` if a context of the specified type exists in the hierarchy
  - Searches from this node up through all ancestor injectors
  - Convenience method equivalent to `Boolean(node.getContext(contextType))`

- **`node.hasOwnContext(contextType: string): boolean`**
  - Returns `true` if this specific node owns a context of the specified type
  - Only checks the node's own injector, not ancestors
  - Convenience method for owned context checking

- **`node.queryContext(contextType: string, query: any): any`**
  - Queries a context with a custom query parameter
  - Allows contexts to support advanced query protocols
  - Returns the result of the context's query handler, or `undefined` if not found

### 4.2 Usage Examples

```javascript
// Get the closest injector
const injector = element.getClosestInjector();

// Create a custom element from context
const customEl = element.createElement('my-component');

// Get or create a theme context
const theme = element.ensureContext('theme');

// Check if a context exists
if (element.hasContext('auth')) {
  const auth = element.getContext('auth');
  // Use auth context
}

// Query a context with parameters
const user = element.queryContext('auth', { userId: '123' });

// Iterate through all injectors
for (const injector of element.injectors()) {
  console.log('Found injector:', injector);
}
```

### 4.3 Key Design Principles

- **Hierarchical**: All context lookups traverse the DOM tree hierarchy
- **Lazy**: Contexts are created on-demand via `ensureContext()`
- **Scoped**: Each node can own its own contexts and injectors
- **Traversal-aware**: Context lookup respects shadow DOM and template boundaries
- **Generator-based**: The `injectors()` API uses generators for efficient iteration

---

*This analysis can be extended with deeper dives into specific APIs or proposals as needed.*
