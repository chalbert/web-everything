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
- **Emit**, in order:
  1. Read the gate-passed content from the buffer (`buffer.get(key)`); refuse (return an error result,
     never partially proceed) if the last `runVerifyGate()` result for this key was not `ok: true` — the
     caller (the future UI) is expected to have already gated the "emit" affordance on that, but this
     function re-checks rather than trusting the caller, per the same "never fake a pass" discipline the
     autofix engine itself uses.
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
 * the PR (forge) with a rendered conformance-evidence body (pr-body). Re-checks gate-passed status itself
 * — never trusts the caller.
 */
export async function emitEdit(opts: {
  buffer: SafeEditBuffer;
  key: string;
  gatePassed: boolean; // the caller's last runVerifyGate() result for this key
  repo: ForgeRepo;
  ideBridge: IdeBridgeRegistry;
  forge: ForgeProviderRegistry;
  credentialSource: CredentialSourceRegistry;
  appId: string;
}): Promise<EmitResult>;
```

## Tasks

1. Write `plateau-app:packages/dev-browser/src/safe-edit/emit.ts` — `discardEdit()`, `emitEdit()`, and
   the small `ConformanceEvidenceManifest` assembly helper described above.
2. Write `plateau-app:packages/dev-browser/src/safe-edit/emit.test.ts` — one case per `EmitFailureReason`
   (fake registries returning unavailable/error), one green-path case asserting the four calls happen in
   order with the right arguments (a spy on each fake registry), and a `discardEdit` case asserting no
   ide-bridge/forge/credential-source call happens at all.
3. Confirm the pr-body renderer's `ConformanceEvidenceManifest` input shape (defined at
   `plateau-app:packages/dev-browser/src/pr-body/renderer.ts`) accepts the fields this slice can actually
   supply (subject/impl/commit are optional per the renderer's own `renderSubject` — already read; no
   renderer change expected, but this is a task, not an assumption, because the renderer file is owned by
   a different resolved item (#601) and this slice must not silently drift from its real shape).
4. Run `plateau-app:` `npm test` scoped to the new files.

## Done when

- `discardEdit()` reverts the buffer and calls none of ide-bridge/forge/credential-source (asserted via
  spies that record zero calls).
- `emitEdit()` with `gatePassed: false` returns `{ ok: false, reason: 'not-gate-passed' }` and calls none
  of the four downstream registries.
- `emitEdit()` with `gatePassed: true` and every fake registry succeeding returns `{ ok: true, url, number }`,
  and the fake ide-bridge/credential-source/forge/pr-body renderer were each called exactly once with the
  edit's real `after` content reaching the ide-bridge `patch` call.
- `emitEdit()` with any one fake registry returning unavailable/error returns the matching
  `EmitFailureReason` and does not proceed to the steps after it (e.g. an unavailable ide-bridge never
  reaches the forge call).
- `plateau-app:` `npm test` is green with the new files included.

## Delivery shape

**Lands as one PR, incrementally behind `main`, once Slices 1 and 2 have landed.** Adds two new files;
imports four existing, already-shipped packages without modifying any of them. Still no live-app wiring
(no panel mounts this), so it remains inert until a future panel-host item calls it — but functionally
complete and independently testable as a library surface. No flag needed.
