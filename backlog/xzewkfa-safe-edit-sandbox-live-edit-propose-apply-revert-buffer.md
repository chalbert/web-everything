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
}
```

No error case beyond the one documented throw (`write` on an absent key) — everything else is a plain
lookup that degrades to `undefined`/no-op, matching the ide-bridge/forge registries' own
"missing → clear `undefined`/`reason`, never throw" convention *except* `write`, which throws because
Slice 2's verify-gate loop calling `write` on a target nothing `propose`d is a caller bug, not a normal
degradation path (there is no "propose a patch for a target with no baseline" case in the autofix loop).

## Tasks

1. Write `plateau-app:packages/dev-browser/src/safe-edit/types.ts` — `EditTarget`, `DeclaredEdit`, re-export `SourceLocation`/`DeclaredRuleKind` types as needed.
2. Write `plateau-app:packages/dev-browser/src/safe-edit/buffer.ts` — `SafeEditBuffer` class per the interface above; pure, no imports beyond the two sibling packages' types.
3. Write `plateau-app:packages/dev-browser/src/safe-edit/buffer.test.ts` — propose/read/write/revert/get/all, the `write`-on-absent-key throw, and re-`propose` overwrite semantics.
4. Write `plateau-app:packages/dev-browser/src/safe-edit/index.ts` re-exporting the types + buffer modules, matching sibling packages' barrel shape.
5. Run `plateau-app:` `npm test` (vitest) scoped to the new files; confirm no existing test touches the new directory (it doesn't exist yet, so this is a pure add).

## Done when

- `SafeEditBuffer.propose()` followed by `read(key)` returns the proposed `after` content.
- `SafeEditBuffer.revert(key)` followed by `read(key)` returns `undefined`.
- `SafeEditBuffer.write(key, content)` on a key with no prior `propose()` throws.
- `SafeEditBuffer.all()` returns every currently-pending edit and reflects a `revert()` (the reverted
  target is absent from the array).
- `plateau-app:` `npm test` is green with the new buffer test file included, and no existing
  test file changed.

## Delivery shape

**Lands as one PR, incrementally behind `main`.** It adds a brand-new, unimported directory under
`plateau-app:packages/dev-browser/src/safe-edit/` with no existing file edited — nothing depends on it
yet (Slices 2 and 3 aren't built), so it is dead code from the app's point of view until they land, but
it compiles, tests, and type-checks standalone and changes no runtime behavior. No flag needed.
