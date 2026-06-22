// @webeverything/contracts/resource-cache — the resource-cache provider's pure-contract surface (#1460 slice B; query intent #1419).
// Type-only re-export (zero runtime emit); the runtime impl (default in-memory cache, dedupe runner,
// revalidation scheduler) is FUI's resource-cache block (#1534). The FUI→WE arrow, like ./resources and
// ./validator-resolution — the swappable runtime-DI cache the running query realization consults.
export type * from '../blocks/resource-cache/contract';
