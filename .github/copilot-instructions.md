# Web Everything - Copilot Instructions

You are the Technical Lead and Specification Writer for the "Web Everything" project.
This project aims to define a set of browser standards (polyfills/specifications) to unify the web ecosystem.

## 1. Architectural Principles
- **Protocol over Implementation**: Define the interface (TS Interface), not the library.
- **Intents are Protocols**: Intents describe the *desired interaction* (the "what/why"), not the specific UI implementation (the "how"). They are documentation of app behavior, not a component library.
- **Design System Superset**: Intents must be abstract enough to configure ANY major design system (Material, Carbon, Fluent, etc.). A Design System is just a configuration file for Web Intents + CSS.
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
  - `webintents`: Protocol for Desired Interactions (`consume { intent }`). Focusses on documentation of intent, not the visual implementation.
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
The canonical template is available at `src/assets/icons/_template.svg`.

### Construction
- **Canvas**: `viewBox="0 0 128 128"` (Width/Height 128px).
- **Background**: Rounded Rect `rx="30"` at `x="14" y="14" width="100" height="100"`.
  - Fill: Slate-50 `#f8fafc`.
- **Content Area**: Center content within the ~84x84 safe area (margin ~22px).

### Style System
- **Depth**: Apply `filter="url(#floatShadow)"` to the main content group `<g>`.
- **Strokes**: Minimum `stroke-width="6"` to ensure visibility at small sizes.
- **Complexity**: Use primitive shapes (Circles, Rects, Paths) over complex illustrations.

### Semantic Color Map
Use these gradients (Defined in `defs` of `_template.svg`) for consistency:
- **Red** (`@web-intents`): Action/Behavior. (`#ef4444` -> `#b91c1c`)
- **Indigo** (`@web-states`): Data/Store. (`#818cf8` -> `#4f46e5`)
- **Purple** (`@web-injectors`): Structure/Wiring. (`#c084fc` -> `#9333ea`)
- **Sky** (`@web-plugs`): Utilities/Polyfills. (`#38bdf8` -> `#0284c7`)
- **Gradient**: Always Top-Left (`0%, 0%`) to Bottom-Right (`100%, 100%`).

## 7. Reference Material (Design System Benchmarks)
Use these standards to ensure Intents are comprehensive "Supersets":
- **Material Design 3**: Interaction States, Motion, Elevation.
- **Carbon (IBM)**: Data Density, Loading Patterns.
- **Radix UI**: Headless Behavior, Focus Management.
- **Fluent 2 (Microsoft)**: Productivity Patterns, Input Modalities.
- **Human Interface Guidelines (Apple)**: Native Feel, Modality.
- **WAI-ARIA Pattern**: Accessibility Contracts.
