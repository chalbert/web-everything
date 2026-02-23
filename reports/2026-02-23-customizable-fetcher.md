# Research Report — Customizable Fetcher & Cache for Resource Loader

**Plan file**: `plans/customizable-fetcher.md`
**Research page**: `/research/customizable-fetcher/`
**Date**: 2026-02-23

---

## Question

How should the Resource Loader's transport (`fetch` by default) and cache be injectable via the injector system, enabling projects to swap in Axios, GraphQL clients, or custom cache implementations?

## Key Finding

**The architecture already exists.** Web Resources defines three sub-standards that address this directly. This research documents how the separation should be made concrete through the injector system.

## Three Sub-Standards

| Sub-Standard | Interface | What It Swaps |
|-------------|-----------|---------------|
| Custom Clients | `CustomResourceClient` | Transport layer. Default: native `fetch()`. Replaceable with Axios, GraphQL, WebSocket, mock. |
| Custom Middleware | `CustomMiddleware` | Request/response interceptors. Auth, retry, logging, transforms. Chain-of-responsibility. |
| Custom Cache | `CustomCachePolicy` | Cache strategy. Default: browser Cache API. Replaceable with LRU, IndexedDB, Redis proxy. |

## CustomResourceClient Interface

```typescript
interface CustomResourceClient {
    execute(operation: ResourceOperation): Consumable<ResourceResult>;
}

type Consumable<T> = Promise<T> | AsyncIterable<T> | Observable<T>;
```

Three consumption patterns: one-shot (Promise), streaming (AsyncIterable), reactive (Observable).

### Injection Pattern

```typescript
docInjector.set('customContexts:resourceClient', new FetchClient());     // Default
docInjector.set('customContexts:resourceClient', new AxiosClient(instance)); // Axios
docInjector.set('customContexts:resourceClient', new GraphQLClient(endpoint)); // GraphQL
docInjector.set('customContexts:resourceClient', new MockClient(fixtures));  // Testing
```

## Framework Comparison

| Library | Transport Pattern | Swappable? |
|---------|------------------|-----------|
| TanStack Query | `queryFn` per query | Yes (per query). No global abstraction. |
| SWR | `fetcher` function per hook or via `SWRConfig` | Yes (global or per request). No typed interface. |
| Apollo Client | `ApolloLink` chain — transport is terminating link | Yes. HttpLink, WebSocketLink, BatchLink swappable. |
| Axios | `adapter` config option | Yes. Can replace XMLHttpRequest with fetch. |
| **Web Everything** | `CustomResourceClient` via injector | Yes. **Hierarchical scoping** — unique to WE. |

**Web Everything's advantage**: The injector system provides hierarchical scoping that no other library offers. A data grid inside a dashboard can use a different transport client than the rest of the app.

## Key Principles

1. **`fetch()` is the default, not the only option** — zero configuration required
2. **Transport and Policy are independent** — same AuthMiddleware works with any client
3. **Scoped overrides via injector hierarchy** — subsections of the app can use different clients
4. **Adapters are thin** — one method: `execute(operation) → Consumable<ResourceResult>`
5. **Testing is first-class** — MockClient injected at document level replaces all network calls

## Files Created/Modified

| File | Action |
|------|--------|
| `src/_data/researchTopics.json` | Added `customizable-fetcher` entry |
| `src/_includes/research-descriptions/customizable-fetcher.njk` | New file (~360 lines) |
