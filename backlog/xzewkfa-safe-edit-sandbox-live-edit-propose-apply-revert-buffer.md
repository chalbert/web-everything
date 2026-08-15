---
kind: story
size: 5
parent: "1650"
status: open
locus: plateau-app
scope:
  - plateau-app:packages/dev-browser/src/safe-edit/types.ts
  - plateau-app:packages/dev-browser/src/safe-edit/buffer.ts
  - plateau-app:packages/dev-browser/src/safe-edit/buffer.test.ts
  - plateau-app:packages/dev-browser/src/safe-edit/index.ts
dateOpened: "2026-08-15"
tags: [dev-browser, safe-edit, sandbox, epic-1650]
---

# Safe-edit sandbox: live-edit propose/apply/revert buffer

Slice 1 of 3 under epic [#1650](/backlog/1650-safe-edit-sandbox-emitting-a-pr/). An in-memory,
fs-free buffer that holds a proposed edit to **one declared rule/intent/token/state value**, authored
in its **own declared form** (a string, not a lowered/compiled representation) — the foundation the
other two slices verify-gate and, once accepted, emit as a PR. Nothing in this slice writes to disk or
opens a network connection; it is pure state + tests, the same "pure orchestrator, injected effects"
shape as `we:scripts/autofix/engine.mjs`, so the later slices can inject it without re-deriving it.

## Scope, including consumers

**Touches (new files only — no existing dev-browser package is edited):**
- `plateau-app:packages/dev-browser/src/safe-edit/types.ts` — `DeclaredEdit`, `EditTarget`, `SafeEditBuffer` contracts.
- `plateau-app:packages/dev-browser/src/safe-edit/buffer.ts` — the pure buffer implementation.
- `plateau-app:packages/dev-browser/src/safe-edit/buffer.test.ts` — vitest coverage.
- `plateau-app:packages/dev-browser/src/safe-edit/index.ts` — public re-export, following the sibling
  packages' pattern (`plateau-app:packages/dev-browser/src/declared-rules/index.ts`,
  `plateau-app:packages/dev-browser/src/intent-inspector/index.ts`).

**Consumers (both are the two *other* slices of this epic — checked, not assumed, by reading their
scaffolded bodies before this was written):**
- Slice 2 — [#xv0j8db](/backlog/xv0j8db-safe-edit-sandbox-verify-gate-wiring-over-declared-rules/)
  imports `SafeEditBuffer`'s `read`/`write`/`revert` to inject as the `read`/`write` callbacks of
  `we:scripts/autofix/engine.mjs`'s `autofix()`.
- Slice 3 — [#x00bvy0](/backlog/x00bvy0-safe-edit-sandbox-discard-or-emit-pr-orchestration/) imports
  `SafeEditBuffer.revert()` for "discard" and reads the buffer's current content for "emit".
- **No subprocess/CLI consumer** — this is a browser-runtime module (imported by the dev-browser panel
  UI, not shelled), so the "check subprocess callers too" rule (story-preparation-checklist item 1)
  resolves to "none": grepped `plateau-app:packages/dev-browser` for any `execFileSync`/`node .../safe-edit`
  invocation and found none, because the package doesn't exist yet — this slice is the first thing to
  create it, so there is nothing upstream that could already be calling it.
- **Not yet wired to a live UI or to `element-resolver`.** The element-resolver (#1690,
  `plateau-app:packages/dev-browser/src/element-resolver/`) is what will *populate* `EditTarget` from a
  clicked live element — that wiring is explicitly **out of scope here** (see Tasks) because it needs a
  real panel surface to click from, which does not exist yet and is not this slice's job to build. This
  slice ships the buffer with a hand-constructed `EditTarget` in its tests; the panel wiring is a
  follow-on once a dev-browser panel host exists to mount it in (tracked informally in the epic body,
  not a separate blocking item — there is no open panel-host story to point at yet).

## Decided design

**The buffer is a plain in-memory `Map`, keyed by target identity, holding at most one pending edit per
target.** Considered and rejected: a full undo/redo stack (over-engineered — Fork 2 of the #141 dev-browser
decision ratified "session-only, single pending state," not a multi-step history) and a CRDT/OT structure
(no concurrent-editor requirement exists — this is one developer's own local session).

- **`EditTarget`** identifies *what* is being edited: the `SourceLocation` shape already defined by
  `plateau-app:packages/dev-browser/src/ide-bridge/types.ts` (`{ absPath, line, col? }`) plus the
  `DeclaredRuleKind` the edit targets (`conformance | visibility | validation`, reusing
  `plateau-app:packages/dev-browser/src/declared-rules/types.ts`'s vocabulary) — so Slice 2 can look up
  which declared rule(s)/vectors gate this target without inventing a second identity scheme.
- **`DeclaredEdit`** carries `target: EditTarget`, `before: string` (the current declared-form content
  read once at propose-time), `after: string` (the proposed declared-form content — plain text, e.g. a
  CSS custom-property value or an intent attribute value; never a lowered/compiled form, per the
  authoring-SoT-is-the-standard-form rule cited in #1650's own body), and `proposedAt` (a caller-supplied
  timestamp — the module stays `Date`-free/pure, matching `we:conformance-evidence/provider.ts`'s own
  "PURE — no `Date`; the caller stamps" convention).
- **Why fs-free / no real write here at all (not even a temp file):** the ratified #141 Fork 2 shape is
  "local-session live-verify" — the edit only ever needs to exist in the browser tab's memory until a
  human chooses discard or emit. Writing to a temp file would add a cleanup-on-crash failure mode this
  slice has no reason to take on.

> **Review fix (2026-08-15, PR #1355, round 7) — structural, not another point-patch.** Rounds 4 and 6
> both found the same shape of bug one level up the call chain (`x00bvy0`'s `emitEdit()` trusting a value
> it captured before an `await` instead of the true current state) and fixed it by narrowing what gets
> captured — round 4 pinned the *content*, round 6's bounce showed that still isn't enough because
> `discardEdit()` (`buffer.revert()`) can delete the whole entry out from under an in-flight `emitEdit()`
> with no way for `emitEdit()` to ever notice. Patching `emitEdit()` a third time to also re-read the
> buffer would just relocate the same stale-read shape one line later. The actual missing piece is in
> **this** card: the buffer has no concept of "which edit, specifically" a caller is holding — `read`/`get`
> return content, not identity, so nothing downstream can ever ask "is what I have still the current
> thing?" after an `await`. Fixed by giving every pending edit a **generation token**, so identity — not
> just content — survives an `await` boundary and can be re-checked against the live buffer synchronously
> right before an irrevocable action:
> - **`propose(edit)` assigns a new, strictly increasing generation number to `edit.target.key`.** The
>   counter is per-key and, critically, **never reused for that key, even after `revert()` deletes the
>   entry** — the buffer keeps a separate, permanent "last generation issued" record per key that survives
>   deletion, specifically so a token captured before a `revert()` + re-`propose()` cycle can never
>   coincidentally match the new entry's token. (A naive "generation = 1 on first propose after a delete"
>   scheme would let exactly that collision happen if a revert and a re-propose both land inside the same
>   `await` window a caller is racing against — silently defeating the whole mechanism.)
> - **`revert(key)` deletes the entry, as before — it does not need to bump anything.** Deleting the entry
>   is already enough: a captured token is always a real number, and `token(key)` on an absent key returns
>   `undefined`, so `undefined !== <any real token>` detects the revert without any extra bookkeeping.
> - **`write(key, content)` deliberately does NOT bump the generation.** `write` is Slice 2's internal
>   gate-bookkeeping hook (the autofix engine's own revert-restore and pass-path echo), not a new user
>   proposal — treating it as generation-preserving keeps "has the *user's intent* changed" (propose/revert)
>   cleanly separate from "has the *engine* touched the content as part of gating it" (write), which is
>   exactly the same `read`-vs-`verify` separation round 1's fix already established for a different pair of
>   concerns.
> - This closes `x00bvy0`'s BLOCKER structurally: `emitEdit()` can now capture a `{ content, token }` pair
>   once, do all its `await`ing, and then ask the buffer a factual question — "is `token` still current for
>   `key`?" — synchronously, right before each irrevocable step, rather than trusting that nothing happened
>   in between. See `x00bvy0`'s round-7 fix for how the token is consumed.

## Interfaces and protocol

```ts
// plateau-app:packages/dev-browser/src/safe-edit/types.ts
import type { SourceLocation } from '../ide-bridge/types';
import type { DeclaredRuleKind } from '../declared-rules/types';

export interface EditTarget {
  readonly location: SourceLocation;
  readonly ruleKind: DeclaredRuleKind;
  /** Stable key so the buffer can address one edit per target — `${absPath}:${line}:${col ?? 0}`. */
  readonly key: string;
}

export interface DeclaredEdit {
  readonly target: EditTarget;
  readonly before: string;
  readonly after: string;
  readonly proposedAt: number; // caller-supplied epoch ms — module stays Date-free
}

// plateau-app:packages/dev-browser/src/safe-edit/buffer.ts
export class SafeEditBuffer {
  /** Stage (or replace) the pending edit for `edit.target.key`. Idempotent — re-proposing overwrites. */
  propose(edit: DeclaredEdit): void;
  /** Current staged content for a target, or `undefined` if nothing is pending. */
  read(key: string): string | undefined;
  /** Overwrite the staged content for an existing pending edit (used by the verify-gate's `write`). Throws if no edit is pending for `key`. */
  write(key: string, content: string): void;
  /** Drop the pending edit for `key` — "discard." No-op if nothing was pending. */
  revert(key: string): void;
  /** The full pending edit record for `key`, or `undefined`. */
  get(key: string): DeclaredEdit | undefined;
  /** Every currently-pending edit, in propose order. */
  all(): readonly DeclaredEdit[];

  // --- Added PR #1355 round 7 — generation identity, for callers that must survive an `await` ---

  /**
   * The current generation token for `key`'s pending edit, or `undefined` if nothing is pending.
   * Strictly increases on every `propose()` for `key` (including a re-propose) and is NEVER reused for
   * that key again, even across a `revert()` + later re-`propose()` — a token captured before such a
   * cycle can never coincidentally match the token issued after it. `write()` does not change the token
   * (it mutates content in place for the same generation — see Decided design).
   */
  token(key: string): number | undefined;
  /**
   * Atomically read `key`'s current `after` content together with its generation token, so a caller that
   * needs both (e.g. `emitEdit()`) gets them from a single synchronous call rather than two separately
   * timed reads that could — after a future refactor — end up on either side of an `await` by accident.
   * `undefined` if nothing is pending for `key`.
   */
  snapshot(key: string): { readonly after: string; readonly token: number } | undefined;
  /**
   * True iff `key` still holds the pending edit identified by `token` — i.e., neither `revert()` nor a
   * re-`propose()` has touched `key` since `token` was issued. The primary tool a caller uses to detect,
   * after an `await`, whether it is still safe to act on content it captured before that `await`.
   */
  isCurrent(key: string, token: number): boolean;
}
```

No error case beyond the one documented throw (`write` on an absent key) — everything else is a plain
lookup that degrades to `undefined`/no-op, matching the ide-bridge/forge registries' own
"missing → clear `undefined`/`reason`, never throw" convention *except* `write`, which throws because
Slice 2's verify-gate loop calling `write` on a target nothing `propose`d is a caller bug, not a normal
degradation path (there is no "propose a patch for a target with no baseline" case in the autofix loop).
`token`/`snapshot`/`isCurrent` never throw — same "missing → clear `undefined`/`false`" convention.

## Tasks

1. Write `plateau-app:packages/dev-browser/src/safe-edit/types.ts` — `EditTarget`, `DeclaredEdit`, re-export `SourceLocation`/`DeclaredRuleKind` types as needed.
2. Write `plateau-app:packages/dev-browser/src/safe-edit/buffer.ts` — `SafeEditBuffer` class per the interface above; pure, no imports beyond the two sibling packages' types. Internally, track a per-key "last generation issued" counter that is **never reset**, even when `revert()` deletes the live entry, so `propose()` after a `revert()` always issues a token strictly greater than any token ever issued for that key before (PR #1355 round 7).
3. Write `plateau-app:packages/dev-browser/src/safe-edit/buffer.test.ts` — propose/read/write/revert/get/all, the `write`-on-absent-key throw, re-`propose` overwrite semantics, and (PR #1355 round 7) `token`/`snapshot`/`isCurrent` coverage: `token()` undefined on an absent key; `token()` increases on re-propose; `token()` undefined after `revert()`; **the no-reuse regression test** — `propose()`, capture the token, `revert()`, `propose()` again on the same key, and assert the new token is strictly greater than the captured one (never equal, proving generations are never recycled even across a revert/re-propose cycle); and `write()` leaves `token()` unchanged.
4. Write `plateau-app:packages/dev-browser/src/safe-edit/index.ts` re-exporting the types + buffer modules, matching sibling packages' barrel shape.
5. Run `plateau-app:` `npm test` (vitest) scoped to the new files; confirm no existing test touches the new directory (it doesn't exist yet, so this is a pure add).

## Done when

- `SafeEditBuffer.propose()` followed by `read(key)` returns the proposed `after` content.
- `SafeEditBuffer.revert(key)` followed by `read(key)` returns `undefined`.
- `SafeEditBuffer.write(key, content)` on a key with no prior `propose()` throws.
- `SafeEditBuffer.all()` returns every currently-pending edit and reflects a `revert()` (the reverted
  target is absent from the array).
- **(PR #1355 round 7) `SafeEditBuffer.token(key)` is `undefined` before any `propose()`, a real number
  after, `undefined` again after `revert()`, and — the no-reuse guarantee — strictly greater than any
  previously issued token for `key` after any subsequent `propose()`, including immediately after a
  `revert()` (asserted by the no-reuse regression test above).**
- **(PR #1355 round 7) `SafeEditBuffer.write(key, content)` does not change `token(key)`.**
- **(PR #1355 round 7) `SafeEditBuffer.snapshot(key)` returns `{ after, token }` matching `read(key)` and
  `token(key)` read separately, and `undefined` when nothing is pending; `isCurrent(key, token)` is `true`
  only for the exact token currently live for `key` and `false` for any other value, including a token
  that was valid before a `revert()`.**
- `plateau-app:` `npm test` is green with the new buffer test file included, and no existing
  test file changed.

## Delivery shape

**Lands as one PR, incrementally behind `main`.** It adds a brand-new, unimported directory under
`plateau-app:packages/dev-browser/src/safe-edit/` with no existing file edited — nothing depends on it
yet (Slices 2 and 3 aren't built), so it is dead code from the app's point of view until they land, but
it compiles, tests, and type-checks standalone and changes no runtime behavior. No flag needed.
