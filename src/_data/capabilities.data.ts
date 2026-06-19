/// <reference types="vite/client" />
// Vite/vitest-side assembler of the per-capability specs (#1157) — the bundler analogue of the node cjs
// loader (scripts/lib/registry-loader.cjs). TS code transformed by Vite (or run under vitest) can't use
// the fs loader, so it imports the per-capability files via import.meta.glob and assembles the same array.
// Sorted by id to match the loader's deterministic order, so the two assemblers never disagree.
//
// Two assemblers exist by necessity (mirrors src/_data/intents.data.ts, #1145): the Eleventy/Node build
// uses the fs glob (registry-loader.cjs); the Vite bundle / vitest uses this import.meta.glob. Both read
// the same src/_data/capabilities/<id>.json files — the single on-disk source of truth — so a per-entry
// edit is reflected everywhere with no monolith.
const modules = import.meta.glob('./capabilities/*.json', { eager: true }) as Record<
  string,
  { default: { id: string } }
>;
export const capabilities = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => String(a.id).localeCompare(String(b.id)));
