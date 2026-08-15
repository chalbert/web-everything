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

- **Emit**, in order:
  1. Call `runVerifyGate({ buffer, edit, appId, registry, index })` (Slice 2's gate — `emitEdit()` calls it
     directly, itself; it does not accept a caller-supplied `gatePassed` boolean and does not trust one).
     Refuse — return `{ ok: false, reason: 'not-gate-passed' }`, never partially proceed — unless the
     result is `{ ok: true }`. The caller (the future UI) may well have already run the gate once, earlier,
     to decide whether to even show the "emit" affordance — that's fine and expected — but `emitEdit()`
     re-derives the answer itself, against the buffer's real current content, every time it runs, so a
     stale/racy/bypassed caller-side check can never cause a failing edit to reach a real file write or a
     real PR. This is the same "never fake a pass" discipline the autofix engine itself uses, now actually
     wired into the interface rather than only stated in prose.
  2. `IdeBridgeRegistry.patch({ location, contents: edit.after })` — writes the real file via whichever
     provider is available (FS-Access or the VS Code extension; degrades to an error result if neither
     is, exactly like every other ide-bridge caller).
  3. Resolve a `ForgeCredential` via the credential-source registry, then
     `ForgeProviderRegistry.openPullRequest(...)` with a `body` rendered by the pr-body renderer from a
     `ConformanceEvidenceManifest` this function assembles from: the edit's `before`/`after` (verify
     evidence — `before.passed: false` iff the pre-edit content would have failed the same gate,
     `after.passed: true` since emit only runs post-gate), the `autonomy: 'open-pr'` level (the only level
     #141 Fork 2 ratified for v1 — `auto-merge` is not reachable from this slice, by construction, since
     nothing here calls a merge API), and the app/impl identity already available from the declared-rules
     registry's `appId`.
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
2. Write `plateau-app:packages/dev-browser/src/safe-edit/emit.test.ts` — one case per `EmitFailureReason`
   (fake registries returning unavailable/error), one green-path case asserting the four calls happen in
   order with the right arguments (a spy on each fake registry), a `discardEdit` case asserting no
   ide-bridge/forge/credential-source call happens at all, and **the regression test for PR #1355 round
   3**: a case that seeds the buffer with content that genuinely violates a fixture's linked vector (the
   same fixture pattern Slice 2's own red-path test uses), calls `emitEdit()` on it, and asserts it returns
   `{ ok: false, reason: 'not-gate-passed' }` with zero calls to ide-bridge/forge/credential-source —
   proving the rejection comes from `emitEdit()`'s own internal `runVerifyGate()` call against real failing
   content, not from a caller having passed (or forgotten to pass) any boolean.
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
  renderer were each called exactly once with the edit's real `after` content reaching the ide-bridge
  `patch` call.
- `emitEdit()` with any one fake registry returning unavailable/error returns the matching
  `EmitFailureReason` and does not proceed to the steps after it (e.g. an unavailable ide-bridge never
  reaches the forge call).
- `plateau-app:` `npm test` is green with the new files included.

## Delivery shape

**Lands as one PR, incrementally behind `main`, once Slices 1 and 2 have landed.** Adds two new files;
imports four existing, already-shipped packages without modifying any of them. Still no live-app wiring
(no panel mounts this), so it remains inert until a future panel-host item calls it — but functionally
complete and independently testable as a library surface. No flag needed.
