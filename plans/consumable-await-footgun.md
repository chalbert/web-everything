# Consumable `await` Footgun

## The Problem

After `consume()`, the Consumable already has a value. But `await consumable` doesn't return it — it waits for the *next* `provide()` call, which may never come.

### Runtime API — What developers will write (broken)

```typescript
import { InjectorRoot, InjectableModule } from 'webeverything/plugs/webinjectors';

const app = new InjectableModule('app', import.meta, (m) => {
  m.provide('customContexts:config', { theme: 'dark' });
});
app.bootstrap();

const injectorRoot = new InjectorRoot();
injectorRoot.attach(document, app.injector);

const injector = injectorRoot.getInjectorOf(document);
const config = injector.consume('customContexts:config', document.body);

// ❌ HANGS FOREVER — consume() already called provide() internally,
//    so await creates a NEW pending promise waiting for the next provide()
const { value } = await config;
console.log(value.theme); // never reached
```

### The asymmetry

| Pattern | After `provide()` already called | Before any `provide()` |
|---------|----------------------------------|------------------------|
| `consumable.value` | ✅ Returns current value | `undefined` |
| `await consumable` | ❌ Hangs (waits for next) | ✅ Waits correctly |
| `for await...of` | ❌ First iteration hangs | ✅ Iterates correctly |

The footgun: `consume()` calls `provide()` internally, so every `await` after `consume()` is in the "after provide() already called" column.

---

## Solution: Make `consume()` async

`consume()` should return `Promise<Consumable>`. The await absorbs the initial provide:

### One-shot (read current value)

```typescript
const config = await injector.consume('customContexts:config', document.body);
console.log(config.value.theme); // 'dark' — guaranteed populated
```

### Pending provider (provider not yet registered)

```typescript
// Provider registered later — consume() waits until it appears
const config = await injector.consume('customContexts:config', document.body);
// Resolves when someone calls injector.set('customContexts:config', ...)
console.log(config.value.theme);
```

### Reactive (watch for changes)

```typescript
const config = await injector.consume('customContexts:config', document.body);

// Use initial value
render(config.value.theme); // 'dark'

// Watch for future changes — for-await now correctly waits for NEXT provide
for await (const { value } of config) {
  render(value.theme);
}
```

### Why this works

1. `consume()` creates the Consumable and (if provider exists) calls `provide()` internally
2. Returning the Consumable through a promise means `await consume()` absorbs the initial thenable resolution
3. After the await, `consumable.value` is populated, and `await consumable` / `for await...of` correctly wait for *future* provides
4. When the provider doesn't exist yet, the promise genuinely waits — no special-casing needed

### Behavioral summary

| Pattern | Provider exists | Provider pending |
|---------|----------------|------------------|
| `await consume()` | Resolves immediately with value | Waits for provider to appear |
| `config.value` after await | ✅ Current value | ✅ Current value |
| `await config` after await | Waits for next `provide()` | Waits for next `provide()` |
| `for await...of` after await | Iterates on future changes | Iterates on future changes |

No asymmetry. No footgun. `await` always means "wait for next".

---

## DSL Equivalent

The DSL (Tier 3) compiles to the async `consume()`:

### One-shot

```
consume config from 'customContexts:config';
console.log(config.theme);
```

Compiles to:

```typescript
const __config = await injector.consume('customContexts:config', document.body);
const config = __config.value;
console.log(config.theme);
```

### Reactive

```
consume config from 'customContexts:config' reactive;
render(config.theme);
```

Compiles to:

```typescript
const __config = await injector.consume('customContexts:config', document.body);
render(__config.value.theme);
(async () => {
  for await (const { value } of __config) {
    render(value.theme);
  }
})();
```

### Side-by-side

| Intent | DSL | Runtime API |
|--------|-----|-------------|
| Read current value | `consume x from 'key'` | `const x = await injector.consume('key', el)` |
| Wait for pending provider | `consume x from 'key'` | Same — awaits until provider exists |
| React to changes | `consume x from 'key' reactive` | `const x = await injector.consume('key', el); for await (const r of x) { ... }` |

---

## Implementation — Blocked

### Why `async consume()` doesn't work

Making `consume()` async was attempted and **fails fundamentally** because Consumable is a thenable (has a `get then()` getter).

Per the Promise specification (Promise Resolution Procedure), when an `async` function returns a value:
1. The runtime checks if the return value has a `.then` property that is callable
2. If so, it calls `.then()` on it — **unwrapping the thenable**
3. This triggers Consumable's `get then()`, which captures the current `#promise` (P2, pending after `provide()`)
4. The async function's returned Promise now adopts P2's state — **pending forever**

This means you literally **cannot return a Consumable from an async function** without it being absorbed by the Promise machinery. The same applies to `Promise.resolve(consumable)` and `.then(() => consumable)`.

```typescript
// This HANGS — the async return unwraps the thenable
async consume(...): Promise<Consumable<any> | null> {
  consumable.provide(provider);
  return consumable; // ← JS runtime calls consumable.then(), which waits for P2 (pending)
}
```

### Options to resolve

**Option A: Remove `get then()` from Consumable**
Replace with an explicit `next()` method. The `for await...of` pattern uses `Symbol.asyncIterator` (not `then`), so it still works.

```typescript
// Instead of: await consumable
// Use:        await consumable.next()
class Consumable<Value> {
  next(): Promise<{ value: Value | undefined }> {
    return this.#promise.then(() => ({ value: this.value }));
  }
  // No get then() — Consumable is no longer thenable
  // [Symbol.asyncIterator] uses this.next() internally
}
```

API becomes:
```typescript
const config = await injector.consume('key', el);  // Works — Consumable not thenable
config.value;                                       // Current value
await config.next();                                // Wait for next provide
for await (const { value } of config) { ... }       // Reactive — still works
```

**Option B: Keep `consume()` sync, document the pattern**
```typescript
const config = injector.consume('key', el);
config.value;              // Current value (synchronous)
// await config;           // ❌ Don't do this — waits for NEXT provide
for await (const x of config) { ... } // ✅ Reactive watching
```

**Option C: Return a wrapper object**
```typescript
consume(...): Promise<{ consumable: Consumable; value: any }> { ... }
const { consumable, value } = await injector.consume('key', el);
```

### Current status

`consume()` remains **synchronous**. All tests pass. This plan documents the design constraint for future resolution.
