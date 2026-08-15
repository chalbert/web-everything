---
kind: story
size: 5
parent: "1650"
status: open
locus: plateau-app
blockedBy: ["xzewkfa"]
scope:
  - plateau-app:tsconfig.json
  - plateau-app:packages/dev-browser/src/safe-edit/verify-gate.ts
  - plateau-app:packages/dev-browser/src/safe-edit/verify-gate.test.ts
dateOpened: "2026-08-15"
tags: [dev-browser, safe-edit, sandbox, epic-1650, autofix]
---

# Safe-edit sandbox: verify-gate wiring over declared rules

Slice 2 of 3 under epic [#1650](/backlog/1650-safe-edit-sandbox-emitting-a-pr/). Blocked on Slice 1 —
[#xzewkfa](/backlog/xzewkfa-safe-edit-sandbox-live-edit-propose-apply-revert-buffer/) — for the
`SafeEditBuffer` this wraps. Reuses `we:scripts/autofix/engine.mjs`'s pure, already-shipped
propose->apply->verify->accept/revert loop (backlog #095, resolved) **directly, by cross-repo import**,
against a live app instead of `check:standards`: a new `verify` callback runs the app's own
declared-rules registry (#1689) + the runtime `ConformanceVectorOracle` over the buffer's pending
content, so a proposed edit is gated by the app's own declared rules before Slice 3 can offer to emit it.

## Scope, including consumers

**Touches:**
- `plateau-app:tsconfig.json` — add one new `paths` alias, `@webeverything/autofix-engine`, pointing at
  `we:scripts/autofix/engine.mjs` (as a sibling-repo relative path), following the **already-established
  pattern** of every other `@webeverything/*` alias already in this file (e.g. line 80:
  `@webeverything/conformance-vectors/schema` pointing at `we:conformance-vectors/schema.ts` the same
  way) — read directly from `plateau-app:tsconfig.json` before writing this card, so this is not a new
  cross-repo mechanism, only a new entry in an existing table.
- `plateau-app:packages/dev-browser/src/safe-edit/verify-gate.ts` — the `verify`/`read`/`write` callback
  adapters + a thin `runVerifyGate()` wrapper around `autofix()`.
- `plateau-app:packages/dev-browser/src/safe-edit/verify-gate.test.ts` — vitest coverage, including a
  fixture app registered in the declared-rules registry so the gate has something real to check against.

**Consumers:**
- Slice 3 — [#x00bvy0](/backlog/x00bvy0-safe-edit-sandbox-discard-or-emit-pr-orchestration/) calls
  `runVerifyGate()` and only offers "emit" once its result reports the edit `applied` (gate-passed), never
  on a `gaveUp`/`skipped` result.
- **No other consumer exists yet** — same reasoning as Slice 1: the directory is new, nothing shells it,
  and no other package imports `safe-edit/` today (confirmed by the grep already run in Slice 1's card).

**A genuinely open interface risk, de-risked here rather than left for the build** (per the
story-preparation-checklist item 8 — de-risk during prep, not during the build): does a **pure, `.mjs`,
no-fs, no-process, no-network** module actually resolve cleanly when imported from a Vite/vitest
TypeScript project via a sibling-repo path alias, the same way the existing `.ts` `@webeverything/*`
aliases do? `we:scripts/autofix/engine.mjs`'s own header states it is "PURE — no fs, no process, no
network" and its only imports are sibling files in the same directory, declared pure by the same header —
so there is no reason it *wouldn't* resolve the same way a `.ts` sibling-repo import does; the residual
risk is purely mechanical (Vite's default `server.fs.allow` root restriction, which the existing
`@webeverything/*` aliases already had to clear for this workspace to build at all — so it is already
cleared, not a fresh unknown). This is recorded as a **task**, not a design fork: confirm it with a
one-line smoke import before writing the real adapter, and if it fails, the fallback (documented, not
silently taken) is to vendor a copy of the two exported pure functions this slice actually calls
(`autofix` and its `VerifyState`/`AutofixOptions` shapes; `registerReferenceFixers` is NOT needed — no
reference fixers are registered here) rather than block the slice on a cross-repo build fix.

## Decided design

**Reuse the engine unmodified — write only a new `verify` callback (and `read`/`write` adapters over
Slice 1's buffer), never a second verify-gate implementation.** This is a deliberate reuse decision, not
a default: `we:scripts/autofix/engine.mjs`'s own design note states the loop is "pure — no fs, no
process, no network... takes injected `verify`/`read`/`write` callbacks, so the SAME loop runs against
the real suite... or against an in-memory fixture" — i.e. the engine was already built to be
injected-into for exactly this kind of second consumer, so building a parallel "live-edit autofix loop"
in plateau-app would duplicate a loop that already exists and is already tested (6 vitest cases at
`we:scripts/autofix/__tests__/engine.test.mjs`).

- **No `Fixer`/`fixerRegistry` is registered.** This slice never *proposes* a patch — Slice 1's buffer
  already holds the human/AI-proposed `after` content. `autofix()`'s `verify -> apply -> accept/revert`
  loop still runs, but with the fixer registry populated by exactly **one hand-written, single-purpose
  fixer registered just for this call**, whose job is to return the buffer's already-known `after`
  content verbatim for a **single synthetic `Failure`** meaning "there is a pending edit for this
  target" — the "fix" is a no-op lookup, not generation, so the loop's own verify/accept/revert machinery
  does all the real work unmodified.
- **`verify` callback:** given the target's `ruleKind` and the app id, call
  `plateau-app:packages/dev-browser/src/declared-rules/registry.ts`'s `linkage(appId, index)` to find the
  vector ids gating this rule, then run `ConformanceVectorOracle`
  (`plateau-app:packages/core/src/conformance-engine/conformanceVectors.ts`) scoped to those vector ids
  against the buffer's **current** (possibly just-reverted) content, and map its `Finding[]` result to the
  engine's `VerifyState` shape (`{ ok: boolean; failures: Failure[] }`) — `ok` is `findings.length === 0`.
  If linkage yields zero vectors (an uncovered rule, #1641's own coverage-gap concept), `verify` degrades
  to `{ ok: true, failures: [] }` — an edit to an undeclared/uncovered rule cannot be gated by a vector
  that doesn't exist, so it passes vacuously (surfaced to the human via the coverage badge already shipped
  by #1641's registry, not re-invented here).
- **`read`/`write` callbacks:** `read` = `SafeEditBuffer.get(key)?.after` — the currently-proposed
  content; `write` = `SafeEditBuffer.write(key, content)`. Both delegate straight to Slice 1's buffer; no
  new storage.

## Interfaces and protocol

```ts
// plateau-app:packages/dev-browser/src/safe-edit/verify-gate.ts
// autofix() imported via the new tsconfig alias @webeverything/autofix-engine (see Scope above)
import { autofix } from '@webeverything/autofix-engine';
import type { SafeEditBuffer, DeclaredEdit } from './buffer';
import { DeclaredRuleRegistry, type VectorIndex } from '../declared-rules';
import { ConformanceVectorOracle } from '@plateau/core/conformance-engine'; // existing in-repo import, unchanged

export interface VerifyGateResult {
  /** Gate passed and the edit is kept in the buffer, unchanged from its proposed `after`. */
  readonly ok: boolean;
  /** Findings from the failing run, when `ok` is false — surfaced to the human, never silently dropped. */
  readonly findings: readonly { readonly detail: string }[];
}

/**
 * Run the verify-gate over one pending edit. Delegates the propose/apply/accept/revert mechanics
 * entirely to the shared autofix engine's `autofix()` — this function only assembles the
 * `verify`/`read`/`write` callbacks and reshapes the single-edit result.
 */
export async function runVerifyGate(opts: {
  buffer: SafeEditBuffer;
  edit: DeclaredEdit;
  appId: string;
  registry: DeclaredRuleRegistry;
  index: VectorIndex;
}): Promise<VerifyGateResult>;
```

`runVerifyGate` never throws on a failing gate — a failing verify is the **expected, common outcome**
(the whole point of the gate), reported via `VerifyGateResult.ok === false` with `findings` populated. It
throws only on a programming error (e.g. `edit.target.key` has no entry in `buffer` — mirrors Slice 1's
own `write`-on-absent-key throw contract).

## Tasks

1. Add the `@webeverything/autofix-engine` path alias to `plateau-app:tsconfig.json`, next to the
   existing `@webeverything/conformance-vectors/*` block.
2. Smoke-test the import in isolation (a throwaway `vite-node` one-liner is enough — not committed) to
   confirm the cross-repo `.mjs` import resolves before writing the real adapter; record the outcome in
   the PR description either way.
3. Write `plateau-app:packages/dev-browser/src/safe-edit/verify-gate.ts` — the `verify`/`read`/`write`
   callback adapters, the single synthetic-`Failure` + single-purpose fixer, and `runVerifyGate()`.
4. Write `plateau-app:packages/dev-browser/src/safe-edit/verify-gate.test.ts` — a green-path case (edit
   passes, `ok: true`), a red-path case (edit fails a fixture vector, `ok: false` with findings, and the
   buffer's content is reverted to `before` — confirmed by re-reading the buffer after the call), and the
   zero-linkage-degrades-to-pass case.
5. Run `plateau-app:` `npm test` scoped to the new files.

## Done when

- `runVerifyGate()` against a fixture edit that satisfies its linked vectors returns `{ ok: true, findings: [] }`.
- `runVerifyGate()` against a fixture edit that violates a linked vector returns `{ ok: false, findings: [...] }`
  **and** the buffer's content for that target is back to `before` (proves the engine's own revert path
  fired, not a no-op).
- `runVerifyGate()` against an edit whose `ruleKind` has zero linked vectors returns `{ ok: true, findings: [] }`.
- `plateau-app:` `npm test` is green with the new files included.

## Delivery shape

**Lands as one PR, incrementally behind `main`, once Slice 1 has landed.** Adds one
`plateau-app:tsconfig.json` path entry (additive, no existing alias touched) plus two new files in the
still-unwired `safe-edit/` directory; still nothing imports this package from the live app, so it remains
dead code from the running app's point of view until Slice 3 lands. No flag needed.
