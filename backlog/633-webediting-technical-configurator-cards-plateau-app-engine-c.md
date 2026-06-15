---
type: issue
workItem: story
size: 2
parent: "618"
status: resolved
blockedBy: ["629", "631"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: plateau-app/src/technical-configurator/seed-editing-engine.ts
tags: []
---

# webediting Technical Configurator cards (plateau-app) — engine choice, serialization format, substrate-negotiation

## Progress (2026-06-15, resolved)

Added the three Web Editing domains to plateau-app's Technical Configurator, each a seed + provider entry + presets, following the exact pattern of the 6 existing domains (no UI rearchitecture):

- **`seed-editing-engine.ts`** — native contenteditable+InputEvent vs ProseMirror/Lexical/Slate/Quill adapters behind `CustomEditorEngineRegistry` (#629). Axes: document-model portability (correctness), dependency floor, editing power, bundle cost.
- **`seed-serialization-format.ts`** — HTML / Markdown / portable-JSON via `CustomSerializerRegistry` (#631). Axes: round-trip fidelity, cross-tool readability, ingest-safety (correctness), human-readability.
- **`seed-substrate-negotiation.ts`** — contenteditable floor vs EditContext upgrade (#628). Axes: availability (correctness), IME robustness, render control, graceful degradation. Strategies: floor-only, editcontext-only, negotiated (the native-first recommendation).
- **Wiring:** registered all three in `provider.ts`; added `editingEnginePresets`/`serializationFormatPresets`/`substrateNegotiationPresets` to `presets.ts` and `PRESETS_BY_DOMAIN` in `configurator.ts`.

**Validation:** type-clean — `tsc --noEmit` reports **0 errors in the touched files** (29 errors total are all pre-existing, in unrelated files: `intent-configurator/`, `main.ts`, cross-repo `webeverything/blocks/*`).

**Live render NOT confirmed — pre-existing SPA breakage (carry-forward, not this item's scope):** the plateau-app dev SPA currently 500s on `webeverything/plugs/bootstrap.ts` (`virtual:trait-manifest` unresolved) and `vite build` fails on the same — an in-flight plugs migration by another session (which also left `nl-provider*.ts` untracked though HEAD's `configurator.ts` already imports it, and `types.ts` modified). My additions are purely additive data following the proven pattern, so they mount once the SPA boot is fixed. Committed only my files (3 seeds + provider/presets/configurator additive edits); did NOT touch the other session's `types.ts`/`nl-provider*`.

Add three Technical Configurator decision cards to plateau-app (seed + provider entry per domain, per the existing configurator pattern): engine choice (native contenteditable vs ProseMirror/Lexical/Slate/Quill adapter), serialization format (HTML/Markdown/portable-JSON via CustomSerializerRegistry), and substrate-negotiation policy (contenteditable floor vs editcontext upgrade). Cross-repo (plateau-app), the product-side surface of #618's engine Protocol (#629) + serializer plug (#631). Blocked by #629 + #631. Collaboration transport cross-ref'd to webrealtime.

**Graduated to** `plateau-app/src/technical-configurator/seed-editing-engine.ts` — + seed-serialization-format.ts + seed-substrate-negotiation.ts + provider/presets wiring.
