# Plug Implementation Migration (Plateau → Web Everything)

## Overview

This document provides comprehensive instructions for migrating polyfill implementations from the Plateau project to Web Everything. This migration enables live demos and real-world usage of Web Everything standards.

**For AI Agents**: This file is consumed by both GitHub Copilot and Claude Code. Follow these instructions carefully across all agent sessions.

---

## Source Material

**Plateau Repository**: `/Users/nicolasgilbert/workspace/plateau/src/plugs/`

### Key Files to Reference

- `custom-elements/Node.patch.ts` (478 lines) - Core injector & context system
- `custom-elements/Element.patch.ts` - innerHTML & insertion methods  
- `custom-elements/HTMLElement.patch.ts` - Constructor wrapping
- `custom-elements/Document.patch.ts` - createElement override
- `custom-elements/DocumentFragment.patch.ts` - Template ownership
- `custom-elements/HTMLTemplateElement.patch.ts` - Content getter
- `custom-registry/CustomRegistry.ts` - Base registry class
- `custom-injectors/HTMLRegistry.ts` - HTML-specific registry
- `custom-elements/pathInsertionMethods.ts` - Critical utility for DOM insertion patching

---

## Architecture Requirements

### Modularization Principle

Split Plateau's monolithic patches into project-specific modules while maintaining interoperability.

### Directory Structure

```
plugs/
├── core/                              # Shared infrastructure (no project affiliation)
│   ├── CustomRegistry.ts              ✅ MIGRATED
│   ├── HTMLRegistry.ts                ✅ MIGRATED  
│   ├── Registry.ts                    ✅ CREATED
│   └── utils/
│       └── pathInsertionMethods.ts    ⚠️ PLACEHOLDER (awaiting dependencies)
│
├── webregistries/                     # @web-registries project
│   ├── index.ts
│   ├── CustomElementRegistry.patch.ts
│   └── __tests__/
│
├── webinjectors/                      # @web-injectors project
│   ├── index.ts
│   ├── InjectorRoot.ts
│   ├── HTMLInjector.ts
│   ├── Node.injectors.patch.ts       # Split from Node.patch.ts lines 55-273
│   ├── Element.innerHTML.patch.ts
│   └── __tests__/
│
├── webcomponents/                     # @web-components project
│   ├── index.ts
│   ├── Node.cloneNode.patch.ts       # Split from Node.patch.ts lines 66-180
│   ├── Element.insertion.patch.ts
│   ├── HTMLElement.patch.ts
│   ├── Document.patch.ts
│   ├── DocumentFragment.patch.ts
│   ├── HTMLTemplateElement.patch.ts
│   └── __tests__/
│
├── webcontexts/                       # @web-contexts project
│   ├── index.ts
│   ├── Node.contexts.patch.ts        # Split from Node.patch.ts lines 274-447
│   ├── CustomContext.ts
│   ├── CustomContextRegistry.ts
│   └── __tests__/
│
├── webbehaviors/                      # @web-behaviors project
├── webdirectives/                     # @web-directives project
├── webexpressions/                    # @web-expressions project
└── webstates/                         # @web-states project
```

---

## Critical Node.patch.ts Split

**Challenge**: Plateau's `Node.patch.ts` contains methods for THREE different projects. Must be carefully decomposed.

### webinjectors/Node.injectors.patch.ts (Lines ~55-273)

- `determined` (getter/setter)
- `getOwnInjector()` - Returns node's own injector
- `hasOwnInjector()` - Boolean check
- `getClosestInjector()` - Traverses DOM hierarchy
- `injectors` (generator) - Yields all ancestor injectors
- `createElement()` - Uses injector's customElements registry
- Node constructor wrapper for `creationInjector` tracking

### webcontexts/Node.contexts.patch.ts (Lines ~274-447)

- `createContext()` - Creates context from registry
- `getContext()` - Finds context in hierarchy
- `ensureContext()` - Gets or creates context
- `getOwnContext()` - Gets node's own context only
- `hasContext()` - Boolean check in hierarchy
- `hasOwnContext()` - Boolean check on node only
- `queryContext()` - Query-based context lookup

### webcomponents/Node.cloneNode.patch.ts (Lines ~66-180)

- `cloneNode()` override - Deep clones preserving:
  - CustomElement prototypes and options
  - CustomComment instances
  - CustomTextNode instances with parsers
  - Undetermined element states

---

## Patch Application Strategies

### Plugged Mode (Global patching)

```typescript
// plugs/index.ts - All-in-one entry point
import '@web-registries/patch';
import '@web-injectors/patch';
import '@web-components/patch';
// Immediately patches native prototypes
```

### Unplugged Mode (Safe library usage)

```typescript
// Each project exports non-patching APIs
import { ScopedRegistry } from '@web-registries';
import { createInjector } from '@web-injectors';
// No side effects
```

### Selective Plugging (On-demand activation)

```typescript
// Each project exports applyPatches() function
import { applyPatches as applyInjectorPatches } from '@web-injectors';
import { applyPatches as applyContextPatches } from '@web-contexts';

if (needsPolyfills()) {
  applyInjectorPatches();
  applyContextPatches();
}
```

---

## Testing Requirements

### Minimum Coverage: 80%

Any plug with less than 80% test coverage cannot be marked as "implemented" status.

### Test Structure

```
webinjectors/
├── __tests__/
│   ├── unit/
│   │   ├── Node.injectors.test.ts      # Vitest unit tests
│   │   └── HTMLInjector.test.ts
│   └── integration/
│       └── injector-hierarchy.spec.ts   # Playwright integration tests
```

### Unit Tests (Vitest + happy-dom)

- Test each patched method in isolation
- Verify prototype properties are correctly added
- Test with and without patch applied
- Mock DOM structure for hierarchy tests

### Integration Tests (Playwright)

- Test full "undetermined → upgraded" flow
- Test cross-project interactions (e.g., injectors + contexts)
- Test with real browser DOM
- Test cases from `src/cases/` directory

### Critical Test Scenarios

1. **Patch Application**: Verify methods exist on prototypes after patching
2. **Hierarchy Traversal**: `getClosestInjector()` walks up correctly
3. **Undetermined Upgrade**: Elements without registry definition get upgraded on insertion
4. **Clone Preservation**: `cloneNode(true)` preserves custom options and states
5. **Registry Isolation**: Scoped registries don't leak across boundaries
6. **Context Propagation**: Contexts resolve through injector hierarchy

---

## Migration Constraints & Gotchas

### ⚠️ MUST PRESERVE

- **pathInsertionMethods** pattern - Used by multiple patches, lives in `core/utils/`
- **InjectorRoot.creationInjector** global - Critical singleton for upgrade flow
- **"undetermined" state** pattern - Elements created without registry must defer upgrade
- **Prototype chain order** - Patches must apply in dependency order

### ⚠️ KNOWN CHALLENGES

- **Global Singletons**: `InjectorRoot.creationInjector` makes testing harder (consider scoping in tests)
- **Tight Coupling**: Hard to use one project without others (document minimum requirements)
- **No Rollback**: Patches are permanent once applied (consider `removePatches()` for testing)
- **Constructor Wrapping**: All HTMLElement constructors wrapped via `HTML_CONSTRUCTORS` array

### ⚠️ PLATEAU GAPS (Current POC limitations)

- **Zero tests for patches** - Plateau has NO tests for any `.patch.ts` files
- **All-or-nothing loading** - No selective activation mechanism
- **Undocumented dependencies** - Implicit assumptions about load order
- **Missing edge cases** - `cloneNode` may not handle all CustomElement scenarios

---

## Migration Dependency Graph

### Phase 1: Core ✅ COMPLETED

- `core/CustomRegistry.ts` ✅ MIGRATED + TESTED
- `core/HTMLRegistry.ts` ✅ MIGRATED + TESTED
- `core/Registry.ts` ✅ CREATED
- `core/utils/pathInsertionMethods.ts` ⚠️ PLACEHOLDER

### Phase 2: webregistries (depends on Core)

- `CustomElementRegistry.patch.ts`

### Phase 3: webinjectors (depends on webregistries, Core)

- `InjectorRoot.ts`
- `HTMLInjector.ts`
- `Node.injectors.patch.ts` (split from Plateau)
- `Element.innerHTML.patch.ts`

### Phase 4: webcomponents (depends on webinjectors)

- `Node.cloneNode.patch.ts` (split from Plateau)
- `Element.insertion.patch.ts`
- `HTMLElement.patch.ts`
- `Document.patch.ts`
- `DocumentFragment.patch.ts`
- `HTMLTemplateElement.patch.ts`

### Phase 5: webcontexts (depends on webinjectors)

- `Node.contexts.patch.ts` (split from Plateau)
- `CustomContext.ts`
- `CustomContextRegistry.ts`

### Phase 6+: webbehaviors, webdirectives, webexpressions, webstates

Depends on multiple previous phases.

---

## Working Rules for AI Agents

### When migrating a plug:

1. ✅ Copy from Plateau with attribution comment: `// Ported from plateau/src/plugs/[file]:lines`
2. ✅ Create comprehensive unit tests BEFORE marking as "implemented"
3. ✅ Write integration tests for cross-project interactions
4. ✅ Update `plugs.json` with new status and file paths
5. ✅ Document any deviations from Plateau implementation
6. ❌ DO NOT implement new functionality - only port existing behavior
7. ❌ DO NOT skip tests - 80% coverage minimum required
8. ❌ DO NOT merge patches into monoliths - keep project boundaries clean

### When encountering gaps:

1. ✅ Document the gap clearly in code comments: `// TODO: Missing edge case - [description]`
2. ✅ Add failing test cases for the gap (mark as `.skip()`)
3. ✅ Raise the gap in agent report for user review
4. ❌ DO NOT attempt to fill gaps without user input
5. ❌ DO NOT assume Plateau's behavior is complete

### When writing tests:

1. ✅ Test the patch CAN be applied (no errors)
2. ✅ Test the patch DOES what it claims (functionality)
3. ✅ Test the patch DOESN'T break native behavior (regression)
4. ✅ Test with and without the patch applied (isolation)
5. ✅ Use cases from `src/cases/` as integration test fixtures

---

## Testing Infrastructure

### Configuration Files

- `vitest.config.ts` - Vitest configuration with happy-dom environment
- `playwright.config.ts` - Playwright configuration for cross-browser testing
- `tsconfig.plugs.json` - TypeScript configuration for plug compilation

### Test Commands

```bash
npm run test              # Run tests in watch mode
npm run test:unit         # Run unit tests once
npm run test:integration  # Run integration tests with Playwright
npm run test:coverage     # Generate coverage report (must hit 80%+)
npm run build:plugs       # Compile TypeScript plugs
```

---

## Documentation Integration

### Update src/_data/plugs.json

```json
{
  "id": "node-injector-patch",
  "name": "Node",
  "patchFile": "webinjectors/Node.injectors.patch.ts",
  "sourceReference": "plateau/src/plugs/custom-elements/Node.patch.ts:55-273",
  "packagePath": "@web-injectors",
  "status": "implemented",
  "coverage": "95%"
}
```

### Link Live Demos

Each project page should link to working demos powered by the plugs.

---

## Current Migration Status

### ✅ Phase 1: Core (COMPLETED)

- [x] Directory structure created
- [x] Testing framework configured (Vitest + Playwright)
- [x] `CustomRegistry.ts` migrated with 100% test coverage
- [x] `HTMLRegistry.ts` migrated with 100% test coverage
- [x] `Registry.ts` interface created
- [x] `pathInsertionMethods.ts` placeholder (awaiting dependencies)

### ⏳ Phase 2: webregistries (NEXT)

- [ ] Port `CustomElementRegistry` from Plateau
- [ ] Create unit tests for registry operations
- [ ] Create integration tests for scoped registries
- [ ] Document "plugged" vs "unplugged" modes

### 📋 Remaining Phases

- Phase 3: webinjectors
- Phase 4: webcomponents  
- Phase 5: webcontexts
- Phase 6+: webbehaviors, webdirectives, webexpressions, webstates

---

## Questions for Review

1. **Missing Coverage**: Plateau has NO tests for patches. Target 80%+ before "production-ready"?
2. **Global State**: `InjectorRoot.creationInjector` is hard to test. Refactor or accept tradeoff?
3. **Patch Rollback**: Implement `removePatches()` for dynamic enable/disable?
4. **Additional Plugs**: Migrate Phase 6+ plugs now or wait for core battle-testing?
5. **Distribution**: Separate npm packages or monorepo subpath exports?

---

**Last Updated**: February 1, 2026  
**Phase**: 1 of 6+ (Core infrastructure complete)
