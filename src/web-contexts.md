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

*This analysis can be extended with deeper dives into specific APIs or proposals as needed.*
