---
kind: story
size: 3
parent: "1650"
status: open
locus: plateau-app
blockedBy: ["xzewkfa", "xv0j8db"]
scope:
  - plateau-app:packages/dev-browser/src/safe-edit/emit.ts
  - plateau-app:packages/dev-browser/src/safe-edit/emit.test.ts
dateOpened: "2026-08-15"
tags: [dev-browser, safe-edit, sandbox, epic-1650]
---

# Safe-edit sandbox: discard-or-emit-PR orchestration

Slice 3 of 3 under epic [#1650](/backlog/1650-safe-edit-sandbox-emitting-a-pr/). Blocked on both prior
slices — [#xzewkfa](/backlog/xzewkfa-safe-edit-sandbox-live-edit-propose-apply-revert-buffer/) (the
buffer) and [#xv0j8db](/backlog/xv0j8db-safe-edit-sandbox-verify-gate-wiring-over-declared-rules/) (the
gate). Takes a verify-gate-passed edit and wires it to the **already-shipped** dev-browser
ide-bridge/forge/pr-body/credential-source packages: **discard** reverts the buffer, **emit** writes the
real file, opens a branch + PR with a rendered conformance-evidence body. This slice is almost entirely
glue over existing, tested infrastructure — nothing here re-implements git, GitHub, or credential
handling; every one of those already has a resolved backlog item and a shipped package.

## Scope, including consumers

**Touches (two new files; four existing packages imported, none edited):**
- `plateau-app:packages/dev-browser/src/safe-edit/emit.ts` — `discardEdit()` and `emitEdit()`.
- `plateau-app:packages/dev-browser/src/safe-edit/emit.test.ts` — vitest coverage with fake providers
  (the same fake-provider-injection pattern the sibling packages' own tests already use — e.g.
  `plateau-app:packages/dev-browser/src/forge/registry.ts`'s tests inject a fake `ForgeProvider`).

**Reads from (no edits, verified each contract by opening the file before writing this card):**
- `plateau-app:packages/dev-browser/src/ide-bridge/` — `IdeBridgeRegistry`'s `patch(write: PatchWrite):
  Promise<BridgeOutcome>`, the highest-precedence *available* provider, for the real file write.
- `plateau-app:packages/dev-browser/src/forge/` — `ForgeProviderRegistry.openPullRequest(req:
  PullRequestRequest): Promise<ForgeOutcome>` for the PR.
- `plateau-app:packages/dev-browser/src/pr-body/renderer.ts` — the markdown renderer, which takes a
  `ConformanceEvidenceManifest` (type imported from `we:conformance-evidence/provider.ts`) and returns the
  PR body string.
- `plateau-app:packages/dev-browser/src/credential-source/` — resolves the `ForgeCredential` (a token plus
  identity) the forge write authenticates with.
- `plateau-app:packages/dev-browser/src/safe-edit/verify-gate.ts` — Slice 2's `runVerifyGate()`
  (already a hard `blockedBy` dependency of this slice, see front matter), called directly by `emitEdit()`
  itself — not merely by some future caller — per the correction below.

**Consumers:**
- **None yet inside the repo** — this is the terminal slice; its consumer is a dev-browser panel/UI
  surface (the "discard" / "emit" buttons a human clicks) that does not exist as a filed item today. That
  UI is explicitly **out of scope for this epic** (see the epic body's own scope note) — #1650 and its
  three slices ship the *mechanism*; mounting it behind a clickable panel is separate, deferred work with
  no open card to point at yet (same reasoning Slice 1 gives for the element-resolver wiring).

## Decided design

**`emitEdit()` sequences four already-independent calls; it invents no new git/PR/auth logic.**
Considered and rejected: giving `safe-edit/` its own forge client or git-plumbing (would duplicate
`plateau-app:packages/dev-browser/src/forge/` and `credential-source/`, which the #598/#600 decisions
already settled and shipped specifically so later consumers wouldn't re-invent them).

- **Discard** = `SafeEditBuffer.revert(key)`. Nothing else runs — no file write, no branch, no PR. This
  is the "throwaway" half of the sandbox: a discarded edit leaves **zero trace** on disk or on the forge.

  > **Review fix (2026-08-15, PR #1355, round 3):** the `emitEdit()` step 1 bullet below originally took a
  > caller-supplied `gatePassed: boolean` and refused only when that boolean was `false` — the interface
  > never called `runVerifyGate()` itself. The prose said "this function re-checks rather than trusting the
  > caller," but the actual `Interfaces` block just re-read a value the caller computed and handed in, with
  > no independent verification. That is the identical failure mode rounds 1 and 2 already had to fix
  > inside `xv0j8db` (a failing edit reported/treated as passing), just relocated to this sibling card: if a
  > future implementer builds this exactly to spec and the caller's `gatePassed` is ever stale, cached, or
  > wrong (a race, a bug, a bypassed UI check), `emitEdit()` writes the real file and opens a real PR for
  > content that never actually passed the declared-rules gate. Fixed by having `emitEdit()` call
  > `runVerifyGate()` itself — see the corrected step 1 and the `Interfaces` block below. `emitEdit()` no
  > longer accepts a `gatePassed` boolean at all; there is nothing left for a caller to get wrong.

  > **Review fix (2026-08-15, PR #1355, round 4) — BLOCKER.** Round 3 closed the *boolean* channel
  > (`gatePassed`) but left a *content* channel open: step 2 below still wrote the caller-supplied
  > `opts.edit.after` snapshot, not `buffer.get(key)?.after` — the buffer's live content that
  > `runVerifyGate()` (step 1) had just gated. Nothing tied the verify call's subject to the write call's
  > subject; they were two independently-sourced reads that merely happened to usually agree. `xzewkfa`'s
  > buffer is a plain, unlocked, in-memory `Map` (see its "Decided design" — no lock is described anywhere
  > in the sandbox), and this is a **local, single-user, live-editing** tool: the same user can keep typing
  > (re-`propose()`-ing to the same key) while `emitEdit()`'s several awaited steps (`runVerifyGate()`, the
  > ide-bridge patch, credential resolution, the forge PR call) are in flight — nothing in the design pauses
  > or locks input during an in-flight emit. So the buffer genuinely CAN mutate between the gate call and
  > the write call. If it does, step 2 wrote a stale pre-mutation (or even superseded/reverted) snapshot to
  > a real file and step 3 opened a real PR from it — content the gate never actually checked.
  >
  > **Fixed by capturing the buffer's content ONCE and threading that single captured value through both
  > the gate call and the write call — never re-reading the buffer afterward, and never using
  > `opts.edit.after` for the write.** Concretely, `emitEdit()`'s first statement (synchronous, before any
  > `await`) is `const content = buffer.get(key)?.after;`. This same `content` local is what step 1 passes
  > to `runVerifyGate()` (via `edit: { ...opts.edit, after: content }`, so the gate's own `verify` callback —
  > which, per `xv0j8db`'s corrected design, reads `buffer.get(key)?.after` live on its first call,
  > essentially synchronously after this capture with no intervening `await` in between — is checking this
  > exact value) and what step 2 passes to `IdeBridgeRegistry.patch({ contents: content })`. `opts.edit.after`
  > (the argument the caller originally passed in, possibly captured well before `emitEdit()` was even
  > invoked) is never read again after this point; `content` is the single source of truth for the rest of
  > the function, including the `ConformanceEvidenceManifest`'s `after` evidence field in step 3 (previously
  > also sourced from `edit.after` — same divergence risk found while tracing the fix, same remedy: the
  > PR-body evidence must describe the content that was actually gated and written, not a separately-sourced
  > caller snapshot).
  >
  > Why capturing once, synchronously, before the gate call is sufficient (not merely convenient): on the
  > only path that reaches the write (`ok: true`), the engine's own loop (`we:scripts/autofix/engine.mjs`)
  > exits at its very first `verify()` call with no fixer ever invoked (`if (before.ok) break` — a passing
  > edit is never written or reverted internally), so nothing *internal* to `runVerifyGate()` changes the
  > buffer's content on the pass path; the only thing that could make the write's subject differ from what
  > was gated is an *external* mutation racing the async window, and capturing once + never re-reading is
  > exactly what makes that impossible for an already-in-flight emit (a concurrent edit isn't picked up
  > until the *next* propose/emit cycle — correct, since it wasn't gated yet).
  >
  > This buffer-can-mutate-during-emit fact is now stated explicitly, not left implicit, and is enforced by
  > a dedicated test — see Task 2 and the corresponding Done-when bullet below.

- **Emit**, in order:
  0. Capture `const content = buffer.get(key)?.after;` as the function's first statement — synchronous,
     before any `await`. This is the ONLY read of the buffer's content `emitEdit()` ever performs; every
     later step reuses this same local, never `opts.edit.after` and never a fresh `buffer.get(key)` call.
     (`opts.edit` is still used for `edit.before`, `edit.target`, and other non-content fields — only
     `.after`, the field the write and the gate must agree on, is banned from re-use post-capture.)
  1. Call `runVerifyGate({ buffer, edit: { ...opts.edit, after: content }, appId, registry, index })`
     (Slice 2's gate — `emitEdit()` calls it directly, itself; it does not accept a caller-supplied
     `gatePassed` boolean and does not trust one — see the round-3 fix above — and it checks the SAME
     captured `content`, not a value that could have drifted from what step 2 writes — see the round-4 fix
     above). Refuse — return `{ ok: false, reason: 'not-gate-passed' }`, never partially proceed — unless
     the result is `{ ok: true }`. The caller (the future UI) may well have already run the gate once,
     earlier, to decide whether to even show the "emit" affordance — that's fine and expected — but
     `emitEdit()` re-derives the answer itself, against the captured current content, every time it runs, so
     a stale/racy/bypassed caller-side check can never cause a failing edit to reach a real file write or a
     real PR. This is the same "never fake a pass" discipline the autofix engine itself uses, now actually
     wired into the interface rather than only stated in prose.
  2. `IdeBridgeRegistry.patch({ location, contents: content })` — writes the real file via whichever
     provider is available (FS-Access or the VS Code extension; degrades to an error result if neither
     is, exactly like every other ide-bridge caller). `content` is the exact same value step 1 just gated —
     never `opts.edit.after`, never a fresh buffer re-read (see the round-4 fix above for why either of
     those would reopen the TOCTOU gap).
  3. Resolve a `ForgeCredential` via the credential-source registry, then
     `ForgeProviderRegistry.openPullRequest(...)` with a `body` rendered by the pr-body renderer from a
     `ConformanceEvidenceManifest` this function assembles from: `edit.before` and the captured `content`
     (verify evidence — `before.passed: false` iff the pre-edit content would have failed the same gate,
     `after.passed: true` since emit only runs post-gate, and `after`'s content is `content`, the same
     captured value that was gated and written — not `opts.edit.after`), the `autonomy: 'open-pr'` level
     (the only level #141 Fork 2 ratified for v1 — `auto-merge` is not reachable from this slice, by
     construction, since nothing here calls a merge API), and the app/impl identity already available from
     the declared-rules registry's `appId`.
  4. Return the `PullRequestRef` (url + number) on success, or a typed failure naming which step failed
     (`patch-unavailable` / `auth-unavailable` / `forge-unavailable` / `forge-error`) — never a bare thrown
     exception, matching every sibling registry's own `{ ok, reason }` outcome shape.
- **No auto-merge, no deployed-app patch.** Both are explicitly out of scope per the #141 Fork 2
  resolution ("live-patching a *deployed* app is out of scope for v1... spun out... as #410") and per
  Fork 2's ratified autonomy default (`open-pr`, not `auto-merge`) — `emitEdit()` has no code path that
  could reach either, so this isn't a runtime guard, it's simply absent.

## Interfaces and protocol

```ts
// plateau-app:packages/dev-browser/src/safe-edit/emit.ts
import type { SafeEditBuffer, DeclaredEdit } from './buffer';
import { runVerifyGate } from './verify-gate'; // Slice 2 — emitEdit() calls this itself, never a caller-supplied boolean
import type { DeclaredRuleRegistry, VectorIndex } from '../declared-rules';
import type { IdeBridgeRegistry } from '../ide-bridge';
import type { ForgeProviderRegistry, ForgeRepo } from '../forge';
import type { CredentialSourceRegistry } from '../credential-source'; // resolves the ForgeCredential
import { renderPrBody } from '../pr-body/renderer';

export type EmitFailureReason =
  | 'not-gate-passed'
  | 'patch-unavailable'
  | 'auth-unavailable'
  | 'forge-unavailable'
  | 'forge-error';

export interface EmitResult {
  ok: boolean;
  url?: string;
  number?: number;
  reason?: EmitFailureReason;
  detail?: string;
}

/** Discard a pending edit — reverts the buffer, writes nothing, opens nothing. Always succeeds. */
export function discardEdit(buffer: SafeEditBuffer, key: string): void;

/**
 * Emit a gate-passed edit as a PR: write the real file (ide-bridge), resolve the forge credential, open
 * the PR (forge) with a rendered conformance-evidence body (pr-body). Calls `runVerifyGate()` itself
 * against the buffer's real current content before doing anything else — takes no `gatePassed` boolean
 * from the caller, so there is nothing for a stale/racy/bypassed caller-side check to get wrong.
 * Reads the buffer exactly ONCE, as its first (synchronous, pre-`await`) statement, into a local `content`
 * — the SAME value is what gets gated (`runVerifyGate()`) and what gets written (`IdeBridgeRegistry.patch()`
 * and the PR-body evidence); `opts.edit.after` and any later `buffer.get(key)` read are never used for
 * content past that point (PR #1355 round 4 — the buffer has no lock and a live user can keep editing while
 * this function's several `await`s are in flight, so a second read could observe different content than the
 * gate checked).
 */
export async function emitEdit(opts: {
  buffer: SafeEditBuffer;
  key: string;
  edit: DeclaredEdit;
  appId: string;
  registry: DeclaredRuleRegistry; // passed through to runVerifyGate()
  index: VectorIndex;             // passed through to runVerifyGate()
  repo: ForgeRepo;
  ideBridge: IdeBridgeRegistry;
  forge: ForgeProviderRegistry;
  credentialSource: CredentialSourceRegistry;
}): Promise<EmitResult>;
```

## Tasks

1. Write `plateau-app:packages/dev-browser/src/safe-edit/emit.ts` — `discardEdit()`, `emitEdit()`, and
   the small `ConformanceEvidenceManifest` assembly helper described above. `emitEdit()` must call
   `runVerifyGate()` (imported from `./verify-gate`, Slice 2) itself as its first step — it must not accept
   or trust a caller-supplied `gatePassed` boolean; there is no such parameter in the corrected interface.
   `emitEdit()` must read `buffer.get(key)?.after` exactly ONCE, into a `content` local, as its first
   (synchronous, pre-`await`) statement, and use that SAME local for both the `runVerifyGate()` call and the
   `IdeBridgeRegistry.patch()`/`ConformanceEvidenceManifest` content — never `opts.edit.after`, never a
   second `buffer.get(key)` read (PR #1355 round 4).
2. Write `plateau-app:packages/dev-browser/src/safe-edit/emit.test.ts` — one case per `EmitFailureReason`
   (fake registries returning unavailable/error), one green-path case asserting the four calls happen in
   order with the right arguments (a spy on each fake registry), a `discardEdit` case asserting no
   ide-bridge/forge/credential-source call happens at all, **the regression test for PR #1355 round
   3**: a case that seeds the buffer with content that genuinely violates a fixture's linked vector (the
   same fixture pattern Slice 2's own red-path test uses), calls `emitEdit()` on it, and asserts it returns
   `{ ok: false, reason: 'not-gate-passed' }` with zero calls to ide-bridge/forge/credential-source —
   proving the rejection comes from `emitEdit()`'s own internal `runVerifyGate()` call against real failing
   content, not from a caller having passed (or forgotten to pass) any boolean — and **the regression test
   for PR #1355 round 4**: a case where the fake `ideBridge.patch` (or a hook on the fake `runVerifyGate`/
   forge dependency) itself calls `buffer.propose(key, { ...edit, after: 'mutated-after-gate' })` on the
   SAME key *during* `emitEdit()`'s in-flight `await` (simulating the live user continuing to edit while the
   emit is outstanding), then asserts the fake `ideBridge.patch` was actually called with the ORIGINAL,
   gated content, not `'mutated-after-gate'` — proving the write is pinned to what was captured/gated, not
   re-read from a buffer that can and does keep changing underneath an in-flight emit.
3. Confirm the pr-body renderer's `ConformanceEvidenceManifest` input shape (defined at
   `plateau-app:packages/dev-browser/src/pr-body/renderer.ts`) accepts the fields this slice can actually
   supply (subject/impl/commit are optional per the renderer's own `renderSubject` — already read; no
   renderer change expected, but this is a task, not an assumption, because the renderer file is owned by
   a different resolved item (#601) and this slice must not silently drift from its real shape).
4. Run `plateau-app:` `npm test` scoped to the new files.

## Done when

- `discardEdit()` reverts the buffer and calls none of ide-bridge/forge/credential-source (asserted via
  spies that record zero calls).
- `emitEdit()` called against buffer content that genuinely fails the gate (verified independently by
  calling `runVerifyGate()` on the same fixture in the test and asserting `ok: false` first) returns
  `{ ok: false, reason: 'not-gate-passed' }` and calls none of the four downstream registries — **this is
  the regression test for PR #1355 round 3**: it must hold with no `gatePassed` argument anywhere in the
  call, because `emitEdit()` derives the answer itself from the buffer's real content via its own internal
  `runVerifyGate()` call, not from anything the caller claims.
- `emitEdit()` called against buffer content that genuinely passes the gate, with every fake registry
  succeeding, returns `{ ok: true, url, number }`, and the fake ide-bridge/credential-source/forge/pr-body
  renderer were each called exactly once with the same captured `content` (the buffer's `after` at the time
  `emitEdit()` was invoked) reaching the ide-bridge `patch` call and the manifest's `after` evidence.
- `emitEdit()` with any one fake registry returning unavailable/error returns the matching
  `EmitFailureReason` and does not proceed to the steps after it (e.g. an unavailable ide-bridge never
  reaches the forge call).
- **`emitEdit()`'s write always reflects the exact content that was gated, even if the buffer is mutated
  again (via `buffer.propose()` on the same key) while `emitEdit()` is still in flight** — this is the
  regression test for PR #1355 round 4: the `IdeBridgeRegistry.patch()` call and the
  `ConformanceEvidenceManifest`'s `after` evidence must both carry the content captured at `emitEdit()`'s
  start, never a later, possibly-mutated re-read of the buffer and never the caller's original
  `opts.edit.after`.
- `plateau-app:` `npm test` is green with the new files included.

## Delivery shape

**Lands as one PR, incrementally behind `main`, once Slices 1 and 2 have landed.** Adds two new files;
imports four existing, already-shipped packages without modifying any of them. Still no live-app wiring
(no panel mounts this), so it remains inert until a future panel-host item calls it — but functionally
complete and independently testable as a library surface. No flag needed.
