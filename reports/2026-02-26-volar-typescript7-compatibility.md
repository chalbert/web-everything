# Research Report — Volar & TypeScript 7 (Corsa/tsgo) Compatibility

**Research page**: `/research/volar-typescript7-compatibility/`
**Date**: 2026-02-26

---

## Questions Explored

1. How will Volar interact with TypeScript 7.0 (the Go rewrite)? Will Volar still work?
2. What is the "Corsa API" that TypeScript 7 exposes? Is it IPC-based? Can external tools like Volar use it?
3. Could a Volar language plugin be written in Go for performance?
4. Are there examples of language servers that use native code while integrating with Volar's framework?
5. What is the performance profile of Volar-based language servers? What are the known bottlenecks?
6. Could a Go-based analysis engine communicate with a Volar plugin via IPC/WASM/FFI?

## Recommendations

1. **Do not depend on Volar + tsgo integration in the near term.** The path is blocked on upstream TypeScript Go development (plugin interop) and there is no timeline from the Volar team.

2. **For projects needing TypeScript 7 speed today**, use the side-by-side installation approach: tsgo for type-checking, TypeScript 6.x for Volar/tooling.

3. **For custom language server development**, the IPC subprocess pattern (same as TypeScript 7 uses internally) is the recommended way to integrate a Go-based analysis engine with a Node.js-based language server framework like Volar.

4. **Monitor these issues:**
   - [vuejs/language-tools #5381](https://github.com/vuejs/language-tools/issues/5381) — Volar + tsgo support
   - [microsoft/typescript-go #455](https://github.com/microsoft/typescript-go/discussions/455) — API story for external tools
   - [microsoft/typescript-go #481](https://github.com/microsoft/typescript-go/discussions/481) — Public Go API for embedding

## Key Findings

### 1. Volar + TypeScript 7 Compatibility

- **Status: Incompatible.** Volar monkey-patches the TS language service (JavaScript-based). TypeScript 7 is a Go binary with no JS plugin host.
- Tracked in vuejs/language-tools [#5381](https://github.com/vuejs/language-tools/issues/5381) (labeled `upstream: typescript` + `upstream: volar`).
- Johnson Chu has labeled but not commented with a roadmap.
- An [unofficial Vue extension](https://github.com/hlpmenu/vue-vscode-unofficial) works around this by running a separate tsserver instance alongside tsgo, but is explicitly less efficient than Volar.

### 2. The Corsa API

- **IPC-based architecture.** The Go binary communicates with JavaScript clients via STDIO pipes.
- Two new packages: `@typescript/ast` (AST node types) and `@typescript/api` (Node.js IPC client).
- Uses `libsyncrpc` (Rust-based NAPI module) for synchronous RPC from Node.js to the Go process.
- API is curated (not full compiler surface) — targeting linting, transforms, resolution, and language service embedding.
- The TypeScript team is "increasingly confident" that IPC overhead is "small enough" for practical use.

### 3. Volar Plugins in Go

- **Not feasible today.** Volar is purely Node.js/TypeScript with no out-of-process plugin boundary.
- All plugin interfaces (`LanguagePlugin`, `VirtualCode`, etc.) require in-process TypeScript objects.
- Would require either: (a) Volar exposing an IPC plugin protocol, (b) Go compiled to WASM and loaded as a Node.js module, (c) Go compiled to a native addon via C ABI, or (d) Volar rewritten in Go.

### 4. Native Code in Language Servers

- **Fully native:** rust-analyzer, Biome, Oxlint — standalone native binaries speaking LSP.
- **Hybrid (WASM-in-TS):** Oso compiled Rust → WASM, loaded in a VS Code TypeScript extension. TypeScript manages LSP connection; WASM handles the logic.
- **Hybrid (IPC):** TypeScript 7 itself — Go binary + Rust NAPI bridge + Node.js client.
- **No examples exist** of native code integrated directly into Volar's plugin framework.

### 5. Volar Performance

- Performance ceiling = TypeScript language service speed.
- Main bottlenecks: dual TS instances (fixed in v2 Hybrid mode), virtual code generation overhead, TS AST memory usage proportional to project files, monorepo multi-project scaling.
- Regression in Volar 1.6.x–1.7.x caused 10–20 second diagnostic delays; addressed in later versions.
- TypeScript 7's 7–10x speedup (72s → 6–7s on large codebases) would directly benefit Volar once integration exists.

### 6. Go Engine + Volar via IPC/WASM/FFI

| Pattern | Recommended? | Rationale |
|---------|-------------|-----------|
| **IPC (subprocess)** | **Yes** | Same pattern as TypeScript 7. Language-agnostic. Process isolation. Native Go performance. |
| **WASM (in-process)** | Maybe | Go WASM binaries are large (5–20MB). ~3x overhead vs native. Boundary crossing penalizes chatty APIs. |
| **FFI (native addon)** | No | Overkill for language tooling. C ABI complexity, CGo overhead, platform-specific builds. |

## Files Created/Modified

| File | Action |
|------|--------|
| `we:src/_data/researchTopics.json` | Added `volar-typescript7-compatibility` entry |
| `we:src/_includes/research-descriptions/volar-typescript7-compatibility.njk` | Created research description |
| `we:reports/2026-02-26-volar-typescript7-compatibility.md` | Created this report |
