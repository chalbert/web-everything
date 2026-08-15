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

> **Review fix (2026-08-15, PR #1355):** the `read`/`write` bullet below originally set
> `read = SafeEditBuffer.get(key)?.after`. Traced against the real engine
> (`we:scripts/autofix/engine.mjs`, lines 326-330), the engine's own revert only ever restores
> `snapshot = read(patch.file)` — the value `read` returned **immediately before** the fixer's write. With
> `read` wired to `.after`, that snapshot is *also* `after` (the fixer's "fix" returns `after` verbatim, so
> nothing ever changes it) — so the "revert" was writing `after` back over `after`: a no-op that never
> reaches `edit.before`. That breaks this card's own Done-when bullet below. Fixed by decoupling `read`
> (now a fixed, immutable source for the engine's snapshot bookkeeping only) from what `verify` actually
> inspects (the buffer's real mutable content) — see the corrected bullets.

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
  against **`SafeEditBuffer.get(key)?.after`** — the buffer's real, mutable, **current** (possibly
  just-reverted) content, read directly from the buffer, *not* via the `read` adapter passed to
  `autofix()` (see next bullet for why those two must differ) — and map its `Finding[]` result to a
  **single synthetic `Failure`** (`{ id: `pending:${key}`, findings }`) when non-empty, or `{ ok: true,
  failures: [] }` when empty. `verify` also stashes the latest `Finding[]` in a closure variable
  (`lastFindings`) each call — `runVerifyGate`'s return value reads from that, not from `autofix()`'s own
  `.ok`/`.applied`/`.gaveUp` (see the `runVerifyGate` bullet below for why). If linkage yields zero vectors
  (an uncovered rule, #1641's own coverage-gap concept), `verify` degrades to `{ ok: true, failures: [] }`
  unconditionally — an edit to an undeclared/uncovered rule cannot be gated by a vector that doesn't exist,
  so it passes vacuously (surfaced to the human via the coverage badge already shipped by #1641's registry,
  not re-invented here).
- **`read`/`write` callbacks — corrected wiring:** these two calls serve **different** purposes inside
  `autofix()` and must not both point at the buffer's live, mutable content:
  - `read` returns the **fixed, immutable pre-edit baseline** — `edit.before`, captured once from
    `buffer.get(key)?.before` before the call, and returned as-is on every call regardless of the buffer's
    live state. The engine uses `read` for exactly one thing that matters here: the pre-write `snapshot`
    it captures right before writing the fixer's patch (`we:scripts/autofix/engine.mjs`, line 329), which
    is exactly what a **revert** restores (same file, lines 347/353). Wiring `read` to the fixed `before`
    means a revert correctly restores `before` — not whatever the buffer most recently held.
  - `write` = `SafeEditBuffer.write(key, content)` — the real, mutable side effect, unchanged from the
    original design. On the pass path this writes `edit.after` back over itself (already there, a
    no-op in content terms); on the fail path the engine's own revert calls `write(file, snapshot)`,
    i.e. `SafeEditBuffer.write(key, edit.before)` — **this is the actual revert**, landing `before` in the
    real buffer.
  - `exists`/`remove` are left at the engine's defaults — `exists` just needs `read` to not throw (it
    never does, `edit.before` is always a real string for an existing pending edit), and `remove` (the
    file-didn't-exist path) is never reached since `existedBefore` is always `true` here.
- **`runVerifyGate`'s `ok`/`findings` come from `verify`'s own `lastFindings`, not from `AutofixResult`.**
  Because the proposed edit may already pass on `autofix()`'s very first internal `verify()` call (before
  any target/fixer is ever touched), the loop can exit at `we:scripts/autofix/engine.mjs`, line 294 with
  `applied: []` and `gaveUp: []` — both empty on a **pass**, which makes `AutofixResult.applied.length > 0`
  / `.ok` unusable as the single-edit pass/fail signal (`.ok` reflects "is the whole run green," a
  different, run-level concept from "did this one edit's content just get reverted"). `runVerifyGate`
  instead returns `{ ok: lastFindings.length === 0, findings: lastFindings }` from the closure `verify`
  populates on its own last call, and calls `autofix()` purely to drive the buffer to the correct settled
  end-state (`after` kept on pass, `before` restored on fail) via its existing keep/revert bookkeeping —
  the reporting and the buffer side-effect are deliberately decoupled.

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
 * Run the verify-gate over one pending edit. Assembles the `verify`/`read`/`write` callbacks — `read`
 * fixed to `edit.before` (the engine's revert-snapshot source), `write` delegating to the buffer, `verify`
 * checking the buffer's live content and stashing its own last `Finding[]` — then delegates the
 * propose/apply/accept/revert mechanics to the shared autofix engine's `autofix()`, which drives the
 * buffer to the correct end-state (`after` kept on pass, `before` restored on fail). The returned
 * `ok`/`findings` come from `verify`'s own last result, not from `autofix()`'s run-level `AutofixResult`.
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
   callback adapters (per the corrected wiring above: `read` fixed to `edit.before`, `verify` reading the
   buffer's live content directly and stashing `lastFindings`), the single synthetic-`Failure` +
   single-purpose fixer, and `runVerifyGate()` (reshaping from `lastFindings`, not `AutofixResult`).
4. Write `plateau-app:packages/dev-browser/src/safe-edit/verify-gate.test.ts` — a green-path case (edit
   passes, `ok: true`, and `buffer.get(key)?.after` still reads the proposed content — unchanged), a
   red-path case (edit fails a fixture vector, `ok: false` with findings, **and** `buffer.get(key)?.after`
   reads back as `edit.before`, confirmed by re-reading the buffer after the call — proves the engine's own
   revert path fired, not a no-op), and the zero-linkage-degrades-to-pass case.
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
