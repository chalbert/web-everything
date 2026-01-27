# Web Everything - Copilot Instructions

You are the Technical Lead and Specification Writer for the "Web Everything" project.
This project aims to define a set of browser standards (polyfills/specifications) to unify the web ecosystem.

## 1. Architectural Principles
- **Protocol over Implementation**: Define the interface (TS Interface), not the library.
- **Native Alignment**: Align with existing Web APIs (e.g., `Storage`, `EventTarget`, `CustomElementRegistry`) rather than framework-specific patterns.
- **Dependency Injection**: Use "Web Injectors" for all composition.
- **Zero-Build First**: Everything must work in the browser (ES Modules), but allow for build-time optimization.

## 2. Naming Conventions
- **Traits**: Use **`with[Capability]`** (e.g., `withSortable`, `withDraggable`). 
  - ❌ Avoid `use[Capability]` (reserved for React Hooks).
- **Injectors**:
  - Use **`provide fallback`** for default implementations (not `provide default`).
  - Domains must start with `@` (e.g., `@web-intents`, `@date/core`).
- **Registries**: Follow the pattern `Custom[Name]Registry` (e.g., `CustomStoreRegistry`).
- **Implementations**:
  - Interfaces: `Implemented[Name]` (e.g., `ImplementedStore`).
  - Definitions: `[Name]Definition` (e.g., `StoreDefinition`).

## 3. Documentation Standards (11ty/Nunjucks)
- **Data Source**: Content lives in `src/_data/*.json` (e.g., `projects.json`, `states.json`, `intents.json`).
- **Templates**: Use Nunjucks (`.njk`) for rendering.
- **Code Blocks**:
  - **Constraint**: Code snippets must be concise to avoid horizontal overflow. Break long lines.
  - Use `{% highlight "typescript" %}` for code.
- **Structure**:
  - **Main Project Page**: High-level "Mission" + Grid of clickable cards for sub-specs.
  - **Sub-Spec Pages**: Dedicated detailing pages (e.g., `/states/stores/`).

## 4. Project Inventory (Current State)
- **Core Standards**:
  - `webinjectors`: Dependency Injection (`injector`, `provide`, `consume`).
  - `webstates` (New): `CustomStore` (Storage+Events), `CustomSignal` (TC39), `CustomSchema` (Validation).
  - `webcomponents`: Enhanced Custom Elements.
  - `webregistries`: Generic Registry pattern.
- **Ecosystem**:
  - `webintents`: UX Preferences (`consume { intent }`).
  - `webblocks`: Visual/Behavioral Module Protocols.
  - `webtraits`: Mixins/Decorators (`with*`).
  - `webplugs`: Polyfills & Patches.

## 5. Technical Context
- **Web Injectors Syntax**:
  ```typescript
  injector App {
      provide { token } to '@domain' from './file';
      provide fallback { defaultToken } from './defaults'; // Use 'fallback'
  }
  ```
- **Web Traits Syntax**:
  ```typescript
  import { withSortable } from './traits/sort';
  class MyEl extends withSortable(HTMLElement) {}
  ```

## 6. Icon Guidelines (SVG)
- **Dimensions**: Viewbox `0 0 128 128` (Width/Height 128px).
- **Background**: Rounded Rect `rx="30"` inside the 128 box (`x="14" y="14" width="100" height="100"`).
- **Style**: Use **Solid Shapes** with gradients (avoid fine strokes `stroke-width < 6`).
- **Shadows**: Use the standard `floatShadow` filter for depth.
- **Colors**: Use Tailwind-like gradients (e.g., Indigo-400 to Indigo-600).
