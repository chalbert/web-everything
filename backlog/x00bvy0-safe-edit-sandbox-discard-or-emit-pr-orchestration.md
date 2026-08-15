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
  is the "throwaway" half of the sandbox: a discarded edit leaves **zero trace on disk or on the forge, with
  one disclosed, bounded exception** — a discard landing while an `emitEdit()` for the same key is already
  in flight, specifically during the ide-bridge `patch()` call's own internal `await`, cannot un-write the
  file that call already committed (checkpoint B still stops the PR from opening; see the round-7 callout
  below for the full mechanism and why this residual window is accepted rather than closed here). A discard
  with no concurrent `emitEdit()` in flight — the common case, and the only case `discardEdit()` alone can
  ever produce — is unaffected and remains truly zero-trace.

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
  > until the *next* propose/emit cycle — correct, since it wasn't gated yet). **(PR #1355 round 9 — see
  > `xv0j8db`'s round-9 review-fix callout for the authoritative, cross-linked statement of exactly when the
  > engine's loop does and does not invoke a fixer or call `write()`, reconciling this paragraph with that
  > card's own `write` bullet; this paragraph now cites that section rather than independently restating the
  > engine's internals, per the round-8 finding that the two cards' independent restatements had drifted
  > apart.)**
  >
  > This buffer-can-mutate-during-emit fact is now stated explicitly, not left implicit, and is enforced by
  > a dedicated test — see Task 2 and the corresponding Done-when bullet below.

  > **Review fix (2026-08-15, PR #1355, round 7) — BLOCKER, closed structurally.** Round 6 found the round-4
  > fix above still false: it captures `content` once and never checks the buffer again, so `discardEdit()`
  > (`buffer.revert(key)`) can run — deleting the entry outright — **while `emitEdit()`'s own `await`s
  > (`runVerifyGate()`, the ide-bridge patch, credential resolution, the forge PR-open) are still in
  > flight**, and the write + PR-open proceed anyway with the pre-discard content. This is round 4's own bug
  > shape (trust a value captured before an `await` instead of the true current state), just on `revert()`
  > instead of `propose()`. Patching `emitEdit()` a fourth time to re-read the buffer one more time would
  > only relocate the same race to whatever new line does the re-reading — this is round 7 precisely because
  > that pattern (narrow the capture, get bounced, narrow again) has now repeated six times. The actual gap
  > is structural: nothing `emitEdit()` captures lets it later ask "is this still the live edit?" — `content`
  > is just a string, indistinguishable from a coincidentally-identical string proposed fresh after a revert.
  >
  > **Fixed by consuming `xzewkfa`'s new generation token (see that card's round-7 fix) instead of adding
  > another re-read.** `emitEdit()`'s step 0 now captures `{ after: content, token }` together, atomically,
  > via `buffer.snapshot(key)` — still exactly one buffer read, still the function's first statement, still
  > before any `await` — and then re-validates that token, synchronously, immediately before each of the two
  > remaining irrevocable actions (the ide-bridge write and the forge PR-open), via `buffer.isCurrent(key,
  > token)`. Because each check is synchronous and immediately followed by the call it's guarding (nothing
  > else can run in between on a single JS thread), "checked current" and "acted on" can never drift apart
  > for that step. If either check fails, `emitEdit()` aborts immediately and returns `{ ok: false, reason:
  > 'stale-edit' }` — no partial write, no partial PR — because between the check and the call there is
  > provably no gap left for the buffer to change again.
  >
  > **Two checkpoints, not one, because there are two irrevocable actions:**
  > - **Checkpoint A** — after `runVerifyGate()` resolves `{ ok: true }`, before `IdeBridgeRegistry.patch()`.
  >   Closes the exact repro in the BLOCKER finding: discard lands during the gate's own (now-confirmed-async,
  >   see `xv0j8db`'s round-7 fix) verify work, and the write never happens.
  > - **Checkpoint B** — after the ide-bridge patch succeeds, before the forge PR-open. **(Round 8 found this
  >   round's original placement — before the credential-resolution call that step 3 also bundled — was not
  >   actually immediately before the PR-open; fixed round 9 by moving checkpoint B to after credential
  >   resolution. See the round-8/9 addendum callout below for the finding and fix; the "before the forge
  >   PR-open" framing in this paragraph was always the intent, just not what the numbered steps delivered
  >   until round 9.)** A discard landing
  >   during the (also-awaited) file-write call itself cannot be intercepted — by the time checkpoint B could
  >   run, `IdeBridgeRegistry.patch()` has already committed the file write, and cancelling an in-flight
  >   provider call is out of scope (ide-bridge is an already-shipped package this slice only calls, never
  >   edits — see Scope above). Checkpoint B is the next available honest opportunity: it stops the PR from
  >   being opened for content that's already been discarded, even though it cannot undo the file write that
  >   raced ahead of it. **This narrower residual window (revert landing exactly during the ide-bridge
  >   `patch()` call's own `await`) is a disclosed, accepted limitation, not a silently-swept-away one** — it
  >   would take ide-bridge itself gaining cancellation support to close, which is a different package's
  >   scope. It is also a materially smaller window than the one this round closes: it requires the discard
  >   click to land inside a single provider I/O call rather than anywhere across the gate's entire
  >   (multi-`await`, oracle-calling) verify sequence.
  >
  > **This also changes — and, on reflection, corrects — round 4's answer for the sibling case, a
  > *re-propose* on the same key during an in-flight emit.** Round 4 chose to ignore a concurrent re-propose
  > and proceed with the originally-captured content, reasoning "a concurrent edit isn't picked up until the
  > next propose/emit cycle." A re-propose bumps the same generation token a revert invalidates (see
  > `xzewkfa`'s round-7 fix — both are "the key's identity changed" from the token's point of view, by
  > design, since distinguishing "reverted" from "re-proposed with different content" would need the buffer
  > to track *why* a generation changed, not just *that* it did, for no real benefit here), so under this
  > round's mechanism the two cases are structurally identical and **both now abort** with `{ ok: false,
  > reason: 'stale-edit' }` rather than one aborting and the other silently proceeding on stale content. This
  > is a deliberate, stated revision of round 4's choice: "silently emit a PR for content the buffer no
  > longer holds because the user kept typing" has the same user-surprise shape as the BLOCKER this round
  > fixes (a PR opens for content the user does not currently see as live), just softer — round 4's own
  > reasoning ("wasn't gated yet") is still true of the *new* proposal, but says nothing about whether it's
  > still correct to act on the *old* one once it's no longer what the buffer holds. Unifying both under one
  > `stale-edit` abort is simpler than a scheme that has to first classify *which* kind of change happened,
  > and closes the whole "buffer changed under an in-flight emit" bug class with one mechanism instead of a
  > carve-out per cause. The caller (the future UI) is expected to just let the user click "emit" again,
  > which will re-capture the buffer's now-current `{ content, token }` and gate that.

  > **Independent reviewer addendum (round 8), fixed round 9 — checkpoint B was not actually "immediately
  > before" the irrevocable forge call.** The numbered steps below previously read step 3 as one bundled
  > step — "resolve a `ForgeCredential` via the credential-source registry, then
  > `ForgeProviderRegistry.openPullRequest(...)`" — with checkpoint B firing *before* both. Credential
  > resolution is itself an `await`ed call; checkpoint B firing ahead of it left an unguarded async window
  > (credential resolution) between the check and the actual irrevocable action, contradicting the
  > `Interfaces` block's stronger prose claim ("immediately before `ForgeProviderRegistry.openPullRequest()`")
  > — the identical shape as the disclosed ide-bridge-`patch()` residual, except undisclosed. A revert or
  > re-propose landing during credential resolution would sail past checkpoint B (already passed by then) and
  > reach `openPullRequest()` for content the buffer no longer holds — the exact BLOCKER round 7 closed,
  > reopened through this second gap.
  >
  > **Fixed by splitting the old bundled step 3 into its two calls and moving checkpoint B to sit between
  > them** — after credential resolution, immediately before `openPullRequest()`, matching what the
  > `Interfaces` block already claimed (that prose did not need to change; the numbered steps did). See the
  > corrected numbered list below. This is strictly *more* protective than the old placement, not a
  > trade-off: `isCurrent()` checks the buffer's current state, not "has anything changed since the last
  > check," so moving the check later still catches everything the earlier placement caught (a revert/
  > re-propose during the ide-bridge write) *plus* the new case (one landing during credential resolution).
  > The one behavioral change this causes: a revert/re-propose landing during the ide-bridge write **or**
  > during credential resolution now lets credential resolution actually run (and be discarded) before the
  > abort, whereas the old placement could skip it entirely when the mutation landed during the ide-bridge
  > write. `ForgeProviderRegistry.openPullRequest()` itself is still never reached in either case — only the
  > (harmless, no external side effect) credential-source call's occurrence differs. Task 2's checkpoint-B
  > test and its Done-when bullet are updated to match — see below.

  > **Independent reviewer addendum (round 8), fixed round 9 — the "zero trace on disk" guarantee above is
  > qualified to match the disclosed residual, not stand uncontradicted a few paragraphs above it.** See the
  > corrected Discard bullet's own text above this callout block — same "unstated-guarantee vs. actual
  > behavior" shape this PR was bounced on twice before.

  > **Independent reviewer addendum (round 10), fixed round 11 — checkpoint B's manifest assembly re-bundles
  > the exact mistake round 8/9 just split apart, just relocated one step later.** The round-9 numbered list
  > folded the `ConformanceEvidenceManifest` assembly — which requires an `await checkContentAgainstVectors(...)`
  > call to compute `before.passed` — into the SAME step as `openPullRequest()`, with only a vague "can run
  > any time before the manifest is assembled" note governing when that `await` may happen relative to
  > checkpoint B. That phrasing resolves *when relative to manifest assembly* the check may run, but never
  > states it must run *before checkpoint B fires* — an implementer following the numbered list literally
  > could place the `await` after checkpoint B and before `openPullRequest()`, reopening an unguarded async
  > window between the check and the true irrevocable call, the identical shape round 8 found (and round 9
  > closed) on the credential-resolution seam.
  >
  > **Fixed by giving manifest assembly its own numbered step, placed strictly before checkpoint B — not
  > "any time before," a fixed position in the sequence.** See the corrected numbered list below: the
  > `ConformanceEvidenceManifest` (including its `before.passed` `await`) is now step 3a, checkpoint B is
  > 3b, and step 4 is nothing but the literal `openPullRequest()` call with the already-assembled manifest —
  > no `await` of any kind sits between checkpoint B and the call it guards, closing this the same way round
  > 9 closed the credential-resolution gap: by moving the check to sit immediately before the one call it is
  > actually meant to protect, rather than "somewhere before it."

  > **Independent reviewer addendum (round 10), fixed round 11 — a resolved-but-discarded live credential
  > has no revoke path (disclosed, not fixed).** See the new "Disclosed residual" bullet below, just above
  > "Emit, in order," for the disclosed residual this callout names.

  > **Review fix (2026-08-15, PR #1355, round 11) — BLOCKER, fixed in `xv0j8db`, threaded through here.** A
  > concurrent `discardEdit()` landing while `runVerifyGate()`'s own internal engine loop is mid-fail-branch
  > used to reach `SafeEditBuffer.write(key, undefined)` and throw uncaught (see `xv0j8db`'s round-11
  > callout for the full trace — `we:scripts/autofix/engine.mjs` lines 291-330). `xv0j8db` fixes this at the
  > source and reports it back via a new `VerifyGateResult.aborted?: 'edit-vanished'` field. `emitEdit()`'s
  > step 1 (below) now checks that field FIRST, before its ordinary `ok`-branch: `aborted === 'edit-vanished'`
  > maps to `{ ok: false, reason: 'stale-edit' }`, never `'not-gate-passed'` — the edit was withdrawn out
  > from under the gate, not rejected by it, and `'stale-edit'` is the reason this interface already uses
  > for every other "the buffer moved out from under you" outcome (checkpoints A and B). This adds no new
  > failure reason and no new checkpoint — it is a third way the SAME `'stale-edit'` reason can be reached,
  > alongside checkpoints A and B, all three driven by the buffer changing under an in-flight `emitEdit()`.

- **Disclosed residual (PR #1355, round 10) — a resolved-but-discarded credential is left to expire, not
  revoked.** Step 3 (below) resolves a `ForgeCredential` via the credential-source registry before
  checkpoint B runs. Checked `plateau-app:packages/dev-browser/src/credential-source/` directly: the
  `github-app-broker` source's `provide()`/`mintToken()` actively mints a real, short-lived installation
  token via a backend call. If checkpoint B then aborts the emit with `stale-edit` immediately after (a
  case this card's own tests exercise — see Task 2's checkpoint-B, credential-resolution-timing case), that
  already-minted credential is simply dropped: no `revoke`/`invalidate` method exists anywhere in the
  credential-source seam (`CredentialSource`, `CredentialOutcome`, and the registry's `resolve`/`provide`
  methods carry none). This is **not treated as a blocker** — the token is short-lived by design and is
  never persisted or logged, so the exposure window is bounded and closes on its own — but it is a live,
  unused, write-scoped credential left to expire naturally rather than being invalidated, and closing it
  would require the credential-source package itself (a different, already-shipped package this slice only
  calls, never edits — see Scope above) to grow a revoke capability, which is out of this slice's scope. A
  follow-up task against that package, not a fix here, is the honest way to close this; naming it explicitly
  (this bullet) is the fix this round actually makes, matching how the ide-bridge-`patch()` write residual
  under Discard above is stated rather than silently absent.

- **Emit**, in order:
  0. Capture `const { after: content, token } = buffer.snapshot(key) ?? {};` as the function's first
     statement — synchronous, before any `await`, and a single atomic buffer call (PR #1355 round 7 —
     `snapshot()` returns `content` and its generation `token` together so they can never be captured on
     either side of a future refactor's `await`). This is the ONLY read of the buffer's content `emitEdit()`
     ever performs; every later step reuses this same `content` local, never `opts.edit.after` and never a
     fresh `buffer.get(key)` call. `token` is used only for the recheck in steps 1a/2a below — it never
     appears in the write or the PR body. (`opts.edit` is still used for `edit.before`, `edit.target`, and
     other non-content fields — only `.after`, the field the write and the gate must agree on, is banned
     from re-use post-capture.)
  1. Call `runVerifyGate({ buffer, edit: { ...opts.edit, after: content }, appId, registry, index })`
     (Slice 2's gate — `emitEdit()` calls it directly, itself; it does not accept a caller-supplied
     `gatePassed` boolean and does not trust one — see the round-3 fix above — and it checks the SAME
     captured `content`, not a value that could have drifted from what step 2 writes — see the round-4 fix
     above). **(PR #1355 round 11)** If the result's `aborted === 'edit-vanished'`, return `{ ok: false,
     reason: 'stale-edit' }` immediately — a concurrent `discardEdit()` raced `runVerifyGate()`'s own
     internal engine loop (see the round-11 callout above); this is checked FIRST, before the ordinary
     `ok`/`not-gate-passed` branch below. Otherwise, refuse — return `{ ok: false, reason: 'not-gate-passed'
     }`, never partially proceed — unless the result is `{ ok: true }`. The caller (the future UI) may well
     have already run the gate once, earlier, to decide whether to even show the "emit" affordance — that's
     fine and expected — but `emitEdit()` re-derives the answer itself, against the captured current
     content, every time it runs, so a stale/racy/bypassed caller-side check can never cause a failing edit
     to reach a real file write or a real PR. This is the same "never fake a pass" discipline the autofix
     engine itself uses, now actually wired into the interface rather than only stated in prose.
  1a. **Checkpoint A (PR #1355 round 7).** Immediately after step 1 resolves `{ ok: true }` and before step
     2 runs: `if (!buffer.isCurrent(key, token)) return { ok: false, reason: 'stale-edit' };` — synchronous,
     with nothing between this check and step 2's call that could let the buffer change again. Catches a
     `discardEdit()` (or a re-propose) that landed anywhere during step 1's `await`s, including inside
     `runVerifyGate()`'s own oracle calls.
  2. `IdeBridgeRegistry.patch({ location, contents: content })` — writes the real file via whichever
     provider is available (FS-Access or the VS Code extension; degrades to an error result if neither
     is, exactly like every other ide-bridge caller). `content` is the exact same value step 1 just gated —
     never `opts.edit.after`, never a fresh buffer re-read (see the round-4 fix above for why either of
     those would reopen the TOCTOU gap).
  3. Resolve a `ForgeCredential` via the credential-source registry. (PR #1355 round 9 — split out of the
     old bundled step 3 below, so checkpoint B can sit *after* this `await`, not before it; see the round-8
     addendum callout above.)
  3a. **Assemble the `ConformanceEvidenceManifest` in full (PR #1355 round 11 — its own step, pinned strictly
     before checkpoint B, not "any time before the manifest is assembled").** Build the manifest from
     `edit.before` and the captured `content`: `before.passed` computed by `await
     checkContentAgainstVectors({ ruleKind: edit.target.ruleKind, appId, content: edit.before, registry,
     index })` (the helper `xv0j8db` exports, PR #1355 round 7 — the same check the gate itself runs,
     applied to the pre-edit baseline instead of the proposed content), setting `before.passed = result.length
     === 0`; `after.passed: true` since emit only runs post-gate, and `after`'s content is `content`, the
     same captured value that was gated and written — not `opts.edit.after`; the `autonomy: 'open-pr'` level
     (the only level #141 Fork 2 ratified for v1 — `auto-merge` is not reachable from this slice, by
     construction, since nothing here calls a merge API); and the app/impl identity already available from
     the declared-rules registry's `appId`. This step's `await` is a pure check against the fixed
     `edit.before` string, not the mutable buffer, so it carries none of the token/staleness risk the
     content-bearing steps above do — but it MUST still complete, in full, before checkpoint B (next) runs:
     nothing async may sit between checkpoint B and step 4's literal `openPullRequest()` call, the same
     discipline round 9 already applied to credential resolution.
  3b. **Checkpoint B (PR #1355 round 7, relocated round 9, position re-pinned round 11).** Immediately after
     step 3a completes and before step 4 runs: `if (!buffer.isCurrent(key, token)) return { ok: false,
     reason: 'stale-edit' };` — the same synchronous check as checkpoint A, now genuinely immediately before
     the true irrevocable action (`openPullRequest()`), matching the `Interfaces` block's claim, with nothing
     — not credential resolution, not manifest assembly — awaited between this check and that call. Cannot
     undo the file write step 2 already made (a disclosed, accepted residual limitation — see the round-7
     callout above for why) but does stop a PR being opened for content the buffer no longer holds, whether
     the staleness landed during step 2's ide-bridge write, step 3's credential resolution, or step 3a's
     manifest assembly.
  4. `ForgeProviderRegistry.openPullRequest(...)` with a `body` rendered by the pr-body renderer from the
     `ConformanceEvidenceManifest` already assembled in step 3a — no further `await` of any kind happens in
     this function between checkpoint B and this call.
  5. Return the `PullRequestRef` (url + number) on success, or a typed failure naming which step failed
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
import { runVerifyGate, checkContentAgainstVectors } from './verify-gate'; // Slice 2 — emitEdit() calls runVerifyGate() itself, never a caller-supplied boolean; checkContentAgainstVectors is the round-7 before.passed helper
import type { DeclaredRuleRegistry, VectorIndex } from '../declared-rules';
import type { IdeBridgeRegistry } from '../ide-bridge';
import type { ForgeProviderRegistry, ForgeRepo } from '../forge';
import type { CredentialSourceRegistry } from '../credential-source'; // resolves the ForgeCredential
import { renderPrBody } from '../pr-body/renderer';

export type EmitFailureReason =
  | 'not-gate-passed'
  | 'stale-edit' // buffer.isCurrent(key, token) failed at checkpoint A or B (PR #1355 round 7), OR
                 // runVerifyGate() reported `aborted: 'edit-vanished'` (PR #1355 round 11) — three
                 // distinct trigger points, one reason, all meaning "the buffer moved under you"
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
 * Emit a gate-passed edit as a PR: write the real file (ide-bridge), resolve the forge credential, assemble
 * the conformance-evidence manifest, open the PR (forge) with a body rendered from it (pr-body). Calls
 * `runVerifyGate()` itself against the buffer's real current content before doing anything else — takes no
 * `gatePassed` boolean from the caller, so there is nothing for a stale/racy/bypassed caller-side check to
 * get wrong; if that call reports `aborted: 'edit-vanished'` (a concurrent `discardEdit()` raced its own
 * internal engine loop — PR #1355 round 11), that maps to `{ ok: false, reason: 'stale-edit' }` immediately,
 * ahead of the ordinary `ok`/`not-gate-passed` check.
 * Reads the buffer exactly ONCE, as its first (synchronous, pre-`await`) statement, via `buffer.snapshot(key)`,
 * into a local `content` + `token` pair — `content` is the SAME value that gets gated (`runVerifyGate()`)
 * and written (`IdeBridgeRegistry.patch()` and the PR-body evidence); `opts.edit.after` and any later
 * `buffer.get(key)` read are never used for content past that point (PR #1355 round 4 — the buffer has no
 * lock and a live user can keep editing while this function's several `await`s are in flight, so a second
 * read could observe different content than the gate checked). `token` guards the two irrevocable actions
 * that follow: immediately before `IdeBridgeRegistry.patch()` and immediately before
 * `ForgeProviderRegistry.openPullRequest()` — note credential resolution AND the (also-`await`ing)
 * conformance-evidence-manifest assembly both sit *between* the ide-bridge write and the PR-open, so the
 * second check runs after BOTH of them, immediately before `openPullRequest()` and nothing else (PR #1355
 * round 8/9 for credential resolution, round 11 for manifest assembly — the check must be genuinely
 * immediately before the irrevocable call, not merely before the step that contains it, and every `await`
 * that produces an input the irrevocable call needs must be pinned to a fixed position relative to the
 * check, never left as "any time before") — `emitEdit()` synchronously re-checks `buffer.isCurrent(key,
 * token)` and aborts with `{ ok: false, reason: 'stale-edit' }` if the buffer's pending edit for `key` was
 * reverted OR re-proposed since the snapshot was taken (PR #1355 round 7 — closes the BLOCKER where a
 * `discardEdit()` landing while this function's `await`s are still in flight left the write and the
 * PR-open to proceed anyway; see `xzewkfa`'s generation-token addition and this card's round-7 callout for
 * the full mechanism and its one disclosed residual limitation).
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
   **(PR #1355 round 11)** If that call's result has `aborted === 'edit-vanished'`, `emitEdit()` must return
   `{ ok: false, reason: 'stale-edit' }` immediately, checked BEFORE the ordinary `ok`/`not-gate-passed`
   branch.
   `emitEdit()` must read `buffer.snapshot(key)` exactly ONCE, destructuring `content`/`token` locals, as its
   first (synchronous, pre-`await`) statement, and use that SAME `content` for both the `runVerifyGate()`
   call and the `IdeBridgeRegistry.patch()`/`ConformanceEvidenceManifest` content — never `opts.edit.after`,
   never a second `buffer.get(key)` read (PR #1355 round 4). `emitEdit()` must synchronously re-check
   `buffer.isCurrent(key, token)` at checkpoint A (immediately before `IdeBridgeRegistry.patch()`) and
   checkpoint B (immediately before `ForgeProviderRegistry.openPullRequest()`), returning `{ ok: false,
   reason: 'stale-edit' }` and doing nothing further if either check fails (PR #1355 round 7). The
   `ConformanceEvidenceManifest` assembly must compute `before.passed` via
   `checkContentAgainstVectors({ ruleKind: edit.target.ruleKind, appId, content: edit.before, registry,
   index })`, never leave it unset/hardcoded (PR #1355 round 7, the round-6 spec-completeness finding).
   **(PR #1355 round 11)** This manifest-assembly `await` must run to completion, in code, strictly BEFORE
   checkpoint B's `isCurrent()` check — the manifest is a fully-built value by the time checkpoint B runs,
   never an in-flight `await` straddling it, so nothing async separates checkpoint B from the literal
   `openPullRequest()` call it guards.
2. Write `plateau-app:packages/dev-browser/src/safe-edit/emit.test.ts` — one case per `EmitFailureReason`
   (fake registries returning unavailable/error), one green-path case asserting the four calls happen in
   order with the right arguments (a spy on each fake registry), a `discardEdit` case asserting no
   ide-bridge/forge/credential-source call happens at all, **the regression test for PR #1355 round
   3**: a case that seeds the buffer with content that genuinely violates a fixture's linked vector (the
   same fixture pattern Slice 2's own red-path test uses), calls `emitEdit()` on it, and asserts it returns
   `{ ok: false, reason: 'not-gate-passed' }` with zero calls to ide-bridge/forge/credential-source —
   proving the rejection comes from `emitEdit()`'s own internal `runVerifyGate()` call against real failing
   content, not from a caller having passed (or forgotten to pass) any boolean — and, **superseding round
   4's regression test with round 7's corrected expectation** (round 4 asserted the write proceeds with the
   originally-captured content on a concurrent re-propose; round 7's callout above explains why that is now
   treated the same as a revert, i.e. an abort, not a silent proceed):
   - **The regression test for PR #1355 round 7, finding 1 (the BLOCKER) — revert during in-flight emit:** a
     case where the fake `runVerifyGate` (or a hook inside it) itself calls `buffer.revert(key)` on the SAME
     key *during* `emitEdit()`'s in-flight `await`, simulating a `discardEdit()` click landing mid-gate.
     Assert `emitEdit()` returns `{ ok: false, reason: 'stale-edit' }` and that NEITHER `ideBridge.patch` NOR
     any forge/credential-source call happened — proving checkpoint A actually stopped the write, not just
     that some later assertion caught a bad body.
   - **The regression test for PR #1355 round 7 — re-propose during in-flight emit:** a case where the fake
     `runVerifyGate` (or a hook on the fake ide-bridge/forge dependency) itself calls `buffer.propose(key, {
     ...edit, after: 'mutated-after-gate' })` on the SAME key during the in-flight `await`. Assert
     `emitEdit()` returns `{ ok: false, reason: 'stale-edit' }` with zero downstream calls — this is round
     4's old scenario, now asserting the corrected (abort, not proceed) outcome.
   - **A checkpoint-B case, ide-bridge-write timing:** the fake `ideBridge.patch` succeeds but, as a side
     effect before returning, calls `buffer.revert(key)` on the same key. Assert `emitEdit()` returns
     `{ ok: false, reason: 'stale-edit' }` and that `forge.openPullRequest` never happened, proving
     checkpoint B (not just checkpoint A) is wired in. **(PR #1355 round 8/9 correction:** because checkpoint
     B now sits *after* credential resolution, not before it, `credentialSource`'s resolve call MAY have
     already happened by the time this fires — assert on `forge.openPullRequest` never being called, not on
     the credential-source call count.)
   - **A checkpoint-B case, credential-resolution timing (new, round 9):** the fake credential-source
     resolver succeeds but, as a side effect before returning, calls `buffer.revert(key)` on the same key.
     Assert `emitEdit()` returns `{ ok: false, reason: 'stale-edit' }` and that `forge.openPullRequest` never
     happened — this is the specific case round 8 found unguarded under the old checkpoint-B placement
     (before credential resolution): a mutation landing *during* credential resolution used to sail past
     checkpoint B and reach `openPullRequest()`; this test fails against that old placement and passes
     against the corrected one.
   - **A checkpoint-B case, manifest-assembly timing (new, round 11):** the fake `checkContentAgainstVectors`
     (called during manifest assembly, step 3a, to compute `before.passed`) succeeds but, as a side effect
     before resolving, calls `buffer.revert(key)` on the same key. Assert `emitEdit()` returns `{ ok: false,
     reason: 'stale-edit' }` and that `forge.openPullRequest` never happened — this is the case round 10
     found unguarded under a design that only pinned manifest assembly "any time before" checkpoint B: a
     mutation landing during manifest assembly's own `await` must still be caught by checkpoint B, which
     requires the assembly to have already fully completed (and checkpoint B to run immediately after it,
     immediately before step 4) rather than the two racing arbitrarily.
   - **The vanished-edit mapping case (new, round 11):** a fake `runVerifyGate` that resolves to `{ ok:
     false, findings: [...], aborted: 'edit-vanished' }` (standing in for a concurrent `discardEdit()` having
     raced `runVerifyGate()`'s own internal engine loop — the scenario `xv0j8db`'s own Task 4c exercises
     against the real engine). Assert `emitEdit()` returns `{ ok: false, reason: 'stale-edit' }`, NOT `{ ok:
     false, reason: 'not-gate-passed' }`, and that zero downstream calls (ide-bridge/forge/credential-source)
     happened — proving `emitEdit()` checks `aborted` before falling through to the ordinary
     `not-gate-passed` branch.
   - **A true green-path case, unchanged:** no buffer mutation during the `await`s — `emitEdit()` succeeds
     normally, both checkpoints pass, and the write/PR-open both carry the originally captured `content`.
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
- **`emitEdit()`'s write always reflects the exact content that was gated, on the true green path where the
  buffer is untouched while `emitEdit()` is in flight** — the `IdeBridgeRegistry.patch()` call and the
  `ConformanceEvidenceManifest`'s `after` evidence must both carry the content captured at `emitEdit()`'s
  start, never the caller's original `opts.edit.after` (PR #1355 round 4's original guarantee, still true on
  the no-mutation path).
- **(PR #1355 round 7, finding 1 — the BLOCKER, superseding round 4's now-corrected expectation; checkpoint
  B's placement corrected round 8/9) `emitEdit()` aborts with `{ ok: false, reason: 'stale-edit' }`, and
  `forge.openPullRequest` is never called, whenever the buffer's pending edit for `key` is reverted OR
  re-proposed at any point between `emitEdit()`'s initial snapshot and the true irrevocable forge call** —
  covering: a revert during the gate call (checkpoint A, the literal BLOCKER repro), a re-propose during the
  gate call (checkpoint A — this is round 4's old scenario, now asserting abort instead of silent-proceed), a
  revert landing after the ide-bridge write succeeds but before credential resolution, and a revert landing
  during credential resolution itself (checkpoint B — now positioned immediately after credential resolution
  and immediately before `openPullRequest()`, per the round-8/9 fix, so it catches both of the latter two
  cases; `credentialSource`'s resolve call itself MAY still occur before the abort in either case, since it
  is not the irrevocable action being guarded).
- **(PR #1355 round 10, fixed round 11) Checkpoint B also catches a revert landing during manifest
  assembly's `before.passed` `await`, not just during credential resolution or the ide-bridge write** — the
  checkpoint-B manifest-assembly-timing test asserts `emitEdit()` returns `{ ok: false, reason: 'stale-edit'
  }` and `forge.openPullRequest` is never called when the revert lands inside `checkContentAgainstVectors`'s
  own `await` during step 3a; this requires manifest assembly to be fully complete, and checkpoint B to run
  immediately after it with nothing else awaited in between, per the round-11 fix to the numbered steps
  above — a design that left manifest assembly "any time before the manifest is assembled" could let this
  land after checkpoint B and still reach `openPullRequest()`.
- **(PR #1355 round 11, finding 1 — closes the BLOCKER `xv0j8db`'s own internal engine loop could otherwise
  throw uncaught) `emitEdit()` returns `{ ok: false, reason: 'stale-edit' }`, never `'not-gate-passed'` and
  never a rejected promise, whenever `runVerifyGate()` reports `aborted: 'edit-vanished'`** — the
  vanished-edit mapping test asserts this against a fake `runVerifyGate()` returning that shape, with zero
  downstream calls; the real end-to-end trigger (a `discardEdit()` racing the gate's own internal engine
  loop) is exercised directly against the real engine by `xv0j8db`'s own Task 4c, so this card's test covers
  the mapping, not a re-simulation of the internal race.
- **(PR #1355 round 7, finding 3 — the cosmetic spec-completeness gap) The
  `ConformanceEvidenceManifest`'s `before.passed` field is actually computed, not left for an implementer to
  guess:** `emitEdit()` calls `checkContentAgainstVectors()` (exported from `xv0j8db`'s
  `plateau-app:packages/dev-browser/src/safe-edit/verify-gate.ts`) against `edit.before` and sets
  `before.passed` to whether that check returned zero findings, asserted by a test that seeds a fixture
  where `edit.before` itself would fail the gate and confirms the assembled manifest's `before.passed` is
  `false` even though the emit as a whole succeeds (because gating only ever runs against `content`/`after`).
- `plateau-app:` `npm test` is green with the new files included.

## Delivery shape

**Lands as one PR, incrementally behind `main`, once Slices 1 and 2 have landed.** Adds two new files;
imports four existing, already-shipped packages without modifying any of them. Still no live-app wiring
(no panel mounts this), so it remains inert until a future panel-host item calls it — but functionally
complete and independently testable as a library surface. No flag needed.
