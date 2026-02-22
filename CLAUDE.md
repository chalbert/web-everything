# Claude Instructions for Web Everything

This file contains instructions for Claude (or any AI agent) when working on this project.

## Project Overview

**Web Everything** is a modular web framework built on native browser APIs. It provides:
- **Plugs**: Core primitives that patch/extend browser APIs (CustomStore, CustomAttribute, InjectorRoot)
- **Blocks**: Reusable implementations built on plugs (SimpleStore, OnEventAttribute, parsers)

The project uses a "plugged" vs "unplugged" mode:
- **Plugged mode**: Bootstrap applies patches, exposes globals on `window`
- **Unplugged mode**: Direct imports without patches, tree-shakeable

## Design-First Development

### The Website IS the Spec

The documentation website (`src/_data/*.json` + `src/_includes/*-descriptions/*.njk`) serves as the **source of truth** for implementation. Before implementing a block or plug:

1. **Check if it's documented** in `src/_data/blocks.json` or `src/_data/plugs.json`
2. **Read the design** in `src/_includes/block-descriptions/{id}.njk`
3. **Follow the documented API** - the njk files define expected behavior
4. **Consult `designDecisions`** in the JSON for rationale

If implementing something not yet documented, **document it first** in the JSON/njk files, then implement.

### Design Decision Examples

The JSON files contain `designDecisions` that explain WHY certain choices were made:

```json
"designDecisions": {
  "magicVariables": {
    "prefix": "$",
    "rationale": "Using $ is common in Vue, Svelte. Creates clear distinction from user data."
  }
}
```

When implementing, **respect these decisions**. If you disagree, discuss with the user before changing.

## Development Workflow

### Starting Development

```bash
npm start              # Starts both Vite (port 3000) and 11ty (port 8080)
```

Access everything at `http://localhost:3000`:
- `/demos/*.html` - Live demos with HMR
- `/blocks/*` - Block documentation
- `/plugs/*` - Plug documentation

### Before Making Changes

1. **Understand existing code** - Read related files before modifying
2. **Check tests** - Look at existing tests to understand expected behavior
3. **Run tests** - Ensure tests pass before AND after changes

### After Making Changes

1. **Run affected tests** - `npx vitest run path/to/module`
2. **Run full test suite** if changes are broad - `npm test`
3. **Update documentation** if API changed

## Testing Strategy

This project uses a **three-tier testing strategy**: Unit, Integration, and E2E tests. Each tier has a specific purpose and coverage responsibility.

### Testing Pyramid Overview

```
        /\
       /  \      E2E Tests (Playwright)
      /    \     - Real browser, real demo
     /------\    - User flows, visual verification
    /        \
   /          \  Integration Tests (Vitest + happy-dom)
  /            \ - Multiple components together
 /              \- Injector chain, registry patterns
/----------------\
|                | Unit Tests (Vitest + happy-dom)
|                | - Single class/function
|                | - Mocked dependencies
------------------
```

### Tier 1: Unit Tests (`.test.ts`)

**Purpose**: Test individual classes/functions in isolation with mocked dependencies.

**What to test**:
- All public methods of a class
- Edge cases and error conditions
- State transitions
- Return values and side effects

**Location**: `{module}/__tests__/unit/*.test.ts`

**Runner**: Vitest with happy-dom environment

**Example**:
```typescript
// blocks/__tests__/unit/stores/SimpleStore.test.ts
import { describe, it, expect, vi } from 'vitest';
import SimpleStore from '../../../stores/simple/SimpleStore';

describe('SimpleStore', () => {
  describe('getItem', () => {
    it('should return value for direct key', () => {
      const store = new SimpleStore({ count: 5 });
      expect(store.getItem('count')).toBe(5);
    });

    it('should return nested value with dot notation', () => {
      const store = new SimpleStore({ user: { name: 'John' } });
      expect(store.getItem('user.name')).toBe('John');
    });

    it('should return undefined for non-existent path', () => {
      const store = new SimpleStore({ user: {} });
      expect(store.getItem('user.missing')).toBeUndefined();
    });
  });

  describe('subscribe', () => {
    it('should notify listener on setItem', () => {
      const store = new SimpleStore({ count: 0 });
      const listener = vi.fn();
      store.subscribe(listener);
      store.setItem('count', 1);
      expect(listener).toHaveBeenCalledWith({ count: 1 });
    });

    it('should stop notifying after unsubscribe', () => {
      const store = new SimpleStore({ count: 0 });
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);
      unsubscribe();
      store.setItem('count', 1);
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
```

### Tier 2: Integration Tests (`.test.ts`)

**Purpose**: Test multiple components working together through real interactions.

**What to test**:
- Injector chain provider resolution
- Registry + implementation interactions
- Attribute lifecycle with real DOM
- Parser pipeline with multiple parsers

**Location**: `{module}/__tests__/integration/*.test.ts`

**Runner**: Vitest with happy-dom environment

**Example**:
```typescript
// blocks/__tests__/integration/on-event-attribute.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createOnEventAttribute } from '../../attributes/on-event/OnEventAttribute';
import { CallParser } from '../../parsers/call/CallParser';
import { CustomExpressionParserRegistry } from '../../../plugs/webexpressions';
import InjectorRoot from '../../../plugs/webinjectors/InjectorRoot';
import CustomAttributeRegistry from '../../../plugs/webbehaviors/CustomAttributeRegistry';

describe('on-event attribute integration', () => {
  let injectorRoot: InjectorRoot;
  let attributes: CustomAttributeRegistry;
  let parsers: CustomExpressionParserRegistry;

  beforeEach(() => {
    document.body.innerHTML = '';

    // Setup full injector system
    injectorRoot = new InjectorRoot();
    injectorRoot.attach(document);

    // Setup parser registry
    parsers = new CustomExpressionParserRegistry();
    parsers.define('call', new CallParser());

    // Provide parsers via injector
    const docInjector = injectorRoot.getInjectorOf(document);
    docInjector?.set('customExpressionParsers', parsers);

    attributes = new CustomAttributeRegistry();
  });

  it('should call handler on event', () => {
    const clickHandler = vi.fn();
    const docInjector = injectorRoot.getInjectorOf(document);
    docInjector?.set('customContexts:handlers', { click: clickHandler });

    const OnClick = createOnEventAttribute();
    const button = document.createElement('button');
    document.body.appendChild(button);

    const attr = new OnClick({ name: 'on:click', value: 'click($event)' });
    attr.attach(button);
    attr.connectedCallback?.();

    button.dispatchEvent(new MouseEvent('click'));
    expect(clickHandler).toHaveBeenCalled();
  });
});
```

### Tier 3: E2E Tests (`.spec.ts`)

**Purpose**: Test complete user flows in a real browser with the actual demo.

**What to test**:
- User interactions (click, type, navigate)
- Visual state changes (text updates, element visibility)
- Full application flows (add todo, submit form)
- Cross-component communication

**Location**: `plugs/__tests__/e2e/*.spec.ts`

**Runner**: Playwright (Chromium)

**Requires**: Dev server running (`npm start`)

**Example**:
```typescript
// plugs/__tests__/e2e/declarative-spa.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Declarative SPA Demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demos/declarative-spa.html');
    await page.waitForFunction(() => window.demoReady === true);
  });

  test('counter increments on click', async ({ page }) => {
    const counterValue = page.locator('.counter-value');
    await expect(counterValue).toHaveText('0');

    await page.click('button:has-text("Increment")');
    await expect(counterValue).toHaveText('1');

    await page.click('button:has-text("Increment")');
    await expect(counterValue).toHaveText('2');
  });

  test('todo list adds and removes items', async ({ page }) => {
    await page.click('[data-view="todos"]');

    const input = page.locator('input[placeholder*="todo"]');
    await input.fill('Buy groceries');
    await page.click('button:has-text("Add")');

    await expect(page.locator('.todo-text')).toHaveText('Buy groceries');
    await expect(page.locator('.stat-value').first()).toHaveText('1');
  });
});
```

### File Naming Conventions

| Extension | Runner | Environment | Purpose |
|-----------|--------|-------------|---------|
| `*.test.ts` | Vitest | happy-dom | Unit & Integration tests |
| `*.spec.ts` | Playwright | Real browser | E2E tests |

### Test File Locations

```
plugs/
  webstates/
    __tests__/
      unit/
        CustomStore.test.ts         # Unit tests for CustomStore
        CustomStoreRegistry.test.ts
      integration/
        store-registry.test.ts      # Registry + store interactions

blocks/
  __tests__/
    unit/
      stores/
        SimpleStore.test.ts         # Unit tests for SimpleStore
      parsers/
        CallParser.test.ts
    integration/
      on-event-attribute.test.ts    # Attribute + parser + injector

plugs/__tests__/e2e/
  declarative-spa.spec.ts           # Full demo E2E tests
  smoke.spec.ts                     # Basic load tests
```

### Running Tests

```bash
# Unit & Integration tests (Vitest)
npm test                           # Run all
npx vitest run blocks/             # Run directory
npx vitest run path/to/file.test.ts # Run specific file
npx vitest watch                   # Watch mode

# E2E tests (Playwright) - requires dev server running
npm start                          # In terminal 1
npm run test:integration           # In terminal 2

# Coverage report
npx vitest run --coverage
```

### Code Coverage Requirements

Coverage is enforced via Vitest configuration with **80% minimum thresholds**:

```typescript
// vitest.config.ts
coverage: {
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 80,
    statements: 80,
  },
}
```

**What's included in coverage**:
- `plugs/**/*.ts` - All plug source files
- `blocks/**/*.ts` - All block source files

**What's excluded from coverage**:
- `**/index.ts` - Re-export files
- `**/__tests__/**` - Test files themselves
- `*.test.ts`, `*.spec.ts` - Test files
- Configuration files

### When to Write Each Test Type

| Scenario | Unit | Integration | E2E |
|----------|------|-------------|-----|
| New class/function | Yes | Maybe | No |
| Bug fix | Yes (reproduce bug) | If cross-component | If user-visible |
| New public method | Yes | If uses injectors | No |
| Parser implementation | Yes | Yes (with registry) | No |
| Attribute implementation | Yes | Yes (with DOM) | Yes (user flow) |
| Store implementation | Yes | Maybe | If in demo |
| Demo feature | No | No | Yes |

### Test Quality Guidelines

1. **Test behavior, not implementation** - Test what the code does, not how
2. **One assertion per concept** - Multiple `expect()` OK if testing same thing
3. **Descriptive test names** - `it('should notify listeners on setItem')` not `it('works')`
4. **Arrange-Act-Assert** - Setup, execute, verify
5. **Clean up after tests** - Use `beforeEach`/`afterEach` to reset state
6. **Mock external dependencies** - Use `vi.fn()` for callbacks, spies for side effects

## Architecture Guidelines

### Plugs vs Blocks

| Layer | Purpose | Location | Window Global | Examples |
|-------|---------|----------|---------------|----------|
| **plugs** | Core primitives, patches, registries | `plugs/` | Yes (via bootstrap) | CustomStore, CustomAttribute, InjectorRoot |
| **blocks** | Reusable implementations | `blocks/` | No (import directly) | SimpleStore, OnEventAttribute, CallParser |

### Key Architectural Patterns

**Injector System**: Dependency injection via DOM tree traversal
```typescript
// Set provider on an element's injector
injector.set('customContexts:handlers', handlers);

// Get provider from ancestor chain
InjectorRoot.getProviderOf(element, 'customContexts:handlers');
```

**Registry Pattern**: Named registration of implementations
```typescript
attributes.define('on:click', OnClickAttribute);
parsers.define('call', new CallParser());
```

**Parser Pipeline**: Composable parsers using reduce pattern
```typescript
// Parsers try in order, wrapping previous results
registry.parse('save($event) | validate');
// CallParser parses 'save($event)', PipeParser wraps it with '| validate'
```

### File Organization

```
plugs/
  bootstrap.ts              # Applies patches, creates globals
  core/                     # Shared utilities
  webstates/                # State management primitives
    CustomStore.ts          # Abstract base class
    CustomStoreRegistry.ts  # Registry for stores
  webinjectors/             # Dependency injection
  webbehaviors/             # Custom attributes
  webcontexts/              # Context providers

blocks/
  stores/
    simple/
      SimpleStore.ts        # Concrete store implementation
      index.ts
    index.ts
  parsers/
    call/CallParser.ts
    value/ValueParser.ts
    pipe/PipeParser.ts
  attributes/
    on-event/OnEventAttribute.ts

demos/
  declarative-spa.html      # Main demo
  declarative-spa.css
```

## Documentation Requirements

### When Creating a New Block

1. **Research first** - Before designing, research:
   - **Web standards**: Check MDN, WHATWG, W3C for relevant APIs (current, draft, proposals)
   - **Framework patterns**: Review how React, Vue, Angular, Solid, etc. solve the problem
   - **Terminology**: Use established terms from web standards and major frameworks

2. **Add entry to `src/_data/blocks.json`** with research documented:
   ```json
   {
     "id": "my-block",
     "name": "MyBlock",
     "status": "active",
     "type": "Store|Parser|Behavior|Directive|Component|Module",
     "summary": "One-line description.",
     "exports": ["MyBlock", "MyBlockOptions"],
     "extendsClass": "BaseClass (if applicable)",
     "sourcePath": "blocks/path/to/MyBlock.ts",
     "dependsOn": ["other-block-id"],
     "webStandards": {
       "relevantAPI": {
         "status": "Baseline 2024|Draft|Proposal",
         "pattern": "What the standard provides",
         "adoption": "How we use it",
         "reference": "https://developer.mozilla.org/..."
       }
     },
     "designDecisions": { },
     "frameworkComparison": {
       "react": { "patterns": ["..."], "notes": "..." },
       "vue": { "patterns": ["..."], "notes": "..." }
     }
   }
   ```

3. **Create `src/_includes/block-descriptions/{id}.njk`** with:
   - Overview description with link to Semantics page for terminology
   - **Web Standards Alignment** table (format: Standard | Status | How We Adopt It)
   - **Framework Research** table if applicable (format: Framework | Key Patterns Adopted)
   - Features list and usage examples
   - API reference table
   - Exports list

4. **Add new terms to `src/_data/semantics.json`** if the block introduces new concepts

### Research Section Format (njk files)

Use this table format for web standards:
```html
<h3>Web Standards Alignment</h3>
<table>
  <tr><th>Standard</th><th>Status</th><th>How We Adopt It</th></tr>
  <tr>
    <td><a href="https://...">API Name</a></td>
    <td>Baseline 2024</td>
    <td>Description of adoption</td>
  </tr>
</table>
```

Use this for framework research:
```html
<h3>Framework Research</h3>
<table>
  <tr><th>Framework</th><th>Key Patterns Adopted</th></tr>
  <tr>
    <td><a href="https://...">React Router</a></td>
    <td>Loaders, outlets, useParams pattern</td>
  </tr>
</table>
```

### When Creating a New Plug

1. **Add entry to `src/_data/plugs.json`**
2. **Create `src/_includes/plug-descriptions/{id}.njk`**
3. **Update `plugs/bootstrap.ts`** if it should be a global

### Block Types

| Type | Description | Examples |
|------|-------------|----------|
| Store | State management | SimpleStore |
| Parser | Expression/syntax parser | CallParser, ValueParser |
| Behavior | Attribute-based behavior | OnEventAttribute |
| Directive | Structural DOM manipulation | ForEach |
| Component | Custom element | Droplist |
| Module | Utility/helper | KeyboardShortcuts |

### Status Values

- `active` - Implemented and ready to use
- `draft` - Partially implemented
- `concept` - Planned, not implemented

## Code Conventions

### TypeScript

- Use strict TypeScript
- Export types alongside implementations
- Use `#privateFields` for truly private members
- Prefer interfaces over type aliases for object shapes

### Naming

- PascalCase for classes: `SimpleStore`, `CallParser`
- camelCase for functions/variables: `createStore`, `parsedResult`
- kebab-case for file names: `simple-store.njk`, `on-event`
- SCREAMING_CASE for constants: `DEFAULT_OPTIONS`

### JSDoc

Add JSDoc to all public APIs:
```typescript
/**
 * Subscribe to store state changes
 *
 * @param listener - Function to call when state changes
 * @returns Function to unsubscribe from updates
 *
 * @example
 * ```typescript
 * const unsubscribe = store.subscribe(state => console.log(state));
 * ```
 */
subscribe(listener: StoreListener<State>): StoreUnsubscribe;
```

### Exports

Each module should have an `index.ts` that re-exports public API:
```typescript
// blocks/stores/simple/index.ts
export { default as SimpleStore } from './SimpleStore';
export type { SimpleStoreOptions } from './SimpleStore';
```

## Common Tasks

### Adding a New Store Implementation

1. Create `blocks/stores/{name}/{Name}Store.ts` extending `CustomStore`
2. Create `blocks/stores/{name}/index.ts` with exports
3. Add to `blocks/stores/index.ts`
4. Add to `src/_data/blocks.json`
5. Create `src/_includes/block-descriptions/{name}-store.njk`
6. Write tests in `blocks/__tests__/unit/stores/{Name}Store.test.ts`

### Adding a New Parser

1. Create `blocks/parsers/{name}/{Name}Parser.ts`
2. Implement `parse(input, context)` returning `ParseResult`
3. Include `evaluate(resolved)` method on parsed expressions
4. Register in `plugs/bootstrap.ts` for plugged mode
5. Document in `src/_data/blocks.json` + njk file

### Adding a New Event Attribute

1. Use `createOnEventAttribute()` factory
2. Register with `attributes.define('on:eventname', AttributeClass)`
3. For common events, add to `registerEventAttributes()`

### Modifying the Demo

The demo at `demos/declarative-spa.html` has two script sections:
1. `<script type="text/plain" id="demo-js-source">` - Shown in code viewer
2. `<script type="module">` - Actual running code

**Keep both in sync** when making demo changes.

## Debugging Tips

### Check Injector Chain

```typescript
// Log what's available at an element
for (const injector of element.injectors()) {
  console.log(injector.providers);
}
```

### Check Parser Results

```typescript
const result = registry.parse('expression');
console.log(result.success, result.expressions, result.remaining);
```

### Check Attribute Lifecycle

```typescript
class DebugAttribute extends CustomAttribute {
  connectedCallback() {
    console.log('Connected:', this.name, this.value, this.target);
  }
  disconnectedCallback() {
    console.log('Disconnected');
  }
}
```

## Keeping This Document Updated

**This is a living document.** As you work on the project, update this file with:

### What to Add

- **New patterns**: When you discover or establish a new coding pattern
- **Debugging tips**: Solutions to tricky problems that might recur
- **Architecture decisions**: Why something was built a certain way
- **Common pitfalls**: Mistakes to avoid, gotchas
- **Workflow improvements**: Better ways to do things

### When to Update

- After implementing a significant feature
- After debugging a non-obvious issue
- When you find the docs missing something you needed
- When a pattern becomes established through repeated use

### How to Update

1. Add to the relevant section (or create a new one)
2. Keep examples concise and practical
3. Explain the "why" not just the "what"
4. Remove outdated information

This ensures future Claude sessions (and other AI assistants) benefit from accumulated project knowledge rather than starting from scratch.

## Related Documentation

- `DEV_GUIDE.md` - Development setup and scripts
- `MIGRATION_PROGRESS.md` - Migration status from old codebase
- `plugs/README.md` - Plugs module overview
- `.github/copilot-instructions.md` - GitHub Copilot instructions (references this file)
- Website at `http://localhost:3000/blocks/` - Block documentation
- `src/_data/semantics.json` - Standardized terminology (add new terms here)
- `src/_data/references.json` - External references organized by category
