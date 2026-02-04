# Claude Instructions for Web Everything

This file contains instructions for Claude when working on this project.

## Documentation Requirements

### When Creating a New Block

A **block** is a reusable implementation (e.g., `SimpleStore`, `OnEventAttribute`, parsers). When creating a new block:

1. **Add entry to `src/_data/blocks.json`**:
   ```json
   {
     "id": "my-block",
     "name": "MyBlock",
     "status": "active",
     "type": "Store|Parser|Behavior|Directive|Component|Module",
     "summary": "One-line description of the block.",
     "exports": ["MyBlock", "MyBlockOptions"],
     "extendsClass": "BaseClass (if applicable)",
     "sourcePath": "blocks/path/to/MyBlock.ts",
     "designDecisions": {
       "decisionName": {
         "description": "What the decision is",
         "rationale": "Why this approach was chosen"
       }
     }
   }
   ```

2. **Create description template at `src/_includes/block-descriptions/{id}.njk`**:
   ```html
   <h2>Type: BlockName</h2>
   <p>Description of what this block does and when to use it.</p>

   <h3>Features</h3>
   <ul>
     <li><strong>Feature name</strong> - Description</li>
   </ul>

   <h3>Basic Usage</h3>
   <pre><code class="language-javascript">// Code example
   </code></pre>

   <h3>API Reference</h3>
   <table>
     <tr><th>Method</th><th>Description</th></tr>
     <tr><td><code>method()</code></td><td>What it does</td></tr>
   </table>

   <h3>Exports</h3>
   <ul>
     <li><code>ExportName</code> - Description</li>
   </ul>
   ```

### When Creating a New Plug

A **plug** is a core primitive (e.g., `CustomStore`, `CustomAttribute`, `InjectorRoot`). When creating a new plug:

1. **Add entry to `src/_data/plugs.json`**:
   ```json
   {
     "id": "my-plug",
     "name": "MyPlug",
     "status": "implemented",
     "type": "Global|Patch|Registry",
     "summary": "One-line description of the plug.",
     "projects": ["webstates"],
     "patchFile": "plugs/webstates/MyPlug.ts"
   }
   ```

2. **Create description template at `src/_includes/plug-descriptions/{id}.njk`**

### Block Types

| Type | Description | Examples |
|------|-------------|----------|
| Store | State management implementation | SimpleStore |
| Parser | Expression/syntax parser | CallParser, ValueParser, PipeParser |
| Behavior | Attribute-based behavior | OnEventAttribute |
| Directive | Structural DOM manipulation | ForEach, ResourceLoader |
| Component | Custom element | Droplist |
| Module | Utility/helper module | KeyboardShortcuts |

### Block Status Values

- `active` - Implemented and ready to use
- `draft` - Partially implemented or documented
- `concept` - Planned but not yet implemented

## Architecture Guidelines

### Plugs vs Blocks

| Layer | Purpose | Location | Window Global |
|-------|---------|----------|---------------|
| **plugs** | Core primitives, patches, registries | `plugs/` | Yes (via bootstrap) |
| **blocks** | Reusable implementations | `blocks/` | No (import directly) |

### File Organization

```
plugs/
  webstates/
    CustomStore.ts       # Abstract base (plug)
    CustomStoreRegistry.ts
blocks/
  stores/
    simple/
      SimpleStore.ts     # Concrete implementation (block)
      index.ts
    index.ts
```

## Testing Requirements

- Unit tests: `{module}/__tests__/unit/*.test.ts`
- Integration tests: `{module}/__tests__/integration/*.test.ts`
- E2E tests: `plugs/__tests__/e2e/*.spec.ts` (Playwright)

Run tests with:
```bash
npm test                    # Unit tests
npm run test:integration    # E2E tests
```
