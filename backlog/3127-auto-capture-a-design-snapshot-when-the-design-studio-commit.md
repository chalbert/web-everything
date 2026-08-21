---
bornAs: xmio19r
kind: story
size: 3
parent: "2676"
status: open
locus: plateau-app
blockedBy: ["2688"]
dateOpened: "2026-08-15"
tags: []
---

# Auto-capture a design snapshot when the design-studio committee run ratifies

Once the design-studio product surface (#2676: request-intake, committee-run, ratify) actually exists, wire it to call plateau-app's design-snapshot capture (#2688: `plateau-app:scripts/record-design-snapshot.mjs` / `plateau-app:src/feature-tracker/design-snapshots.ts`) automatically on ratify, instead of requiring a human to run the CLI by hand. Deferred out of #2688 because #2676 has no product surface yet to call from — this card exists so that gap is a named, sequenced follow-up rather than a silently dropped half of the original design.

Not given a `blockedBy` edge: #2676 is explicitly unsliced ("kept unsliced for now... a future /slice candidate") and this item is one of its own eventual children, so its real prerequisite — a real committee-run build slice under #2676 — does not exist as a filed item yet. Revisit when #2676 is sliced and point `blockedBy` at whichever slice lands the ratify step.

## Prerequisite state, checked 2026-08-21

- **#2688 is `status: open`** — so `plateau-app:scripts/record-design-snapshot.mjs` and
  `plateau-app:src/feature-tracker/design-snapshots.ts`, the capture this card calls, **do not exist yet**.
  That is a hard prerequisite (this item consumes an artifact #2688 produces), so a `blockedBy: ["2688"]` edge
  is now declared. The card previously reasoned only about #2676's missing edge and left this one in prose.
- **#2676 is `status: open` and still unsliced**, exactly as the body says — so the real second prerequisite
  (a committee-run/ratify build slice) is still unfilable. Leave that edge off until #2676 is sliced, then
  point it at whichever slice lands ratify. The note below stays accurate.
- `locus: plateau-app` is now declared so the item gates with `npm test` in the product repo rather than
  inheriting WE's `check:standards` by tag inference (its `tags` are empty, which would have inferred
  `webeverything`).

## Design

**Wire it as an injected port, not a direct import.** The ratify step must not shell out to a CLI, and it must
not hard-depend on the snapshot module: the design-studio surface (#2676) and the snapshot capture (#2688) are
separate builds under separate epics, and a direct call couples their release order. The shape this repo uses
for exactly this problem — a pure orchestrator with injected effects — is the one
`we:scripts/autofix/engine.mjs` follows and that `plateau-app:packages/dev-browser/src/safe-edit/buffer.ts`
(#3139, resolved) was built against.

**Match #2688's ACTUAL filed vocabulary, not an invented one.** #2688 as filed ships a CLI
(`plateau-app:scripts/record-design-snapshot.mjs`, invoked with `--epic=<NNN> --kind=<shipped|current|draft>
--file=<path>`) plus pure sync helpers (`snapshotsFor(index, epicId)`, `validateSnapshotEntry(entry)`) in
`plateau-app:src/feature-tracker/design-snapshots.ts`. It **explicitly ruled** "key by epic id, not the future
`kind:feature` id", its `DesignSnapshot` shape has no `runId` and no `snapshotId`, and it exposes no importable
async capture function at all. So the port must speak `epicId` + `kind` + `file`, and the gap between "a CLI
that writes a dated folder" and "a function a handler awaits" is a **named adapter**, not an assumption:

```ts
/** Injected by the host. Speaks #2688's OWN vocabulary — epicId + kind + a captured image path. */
type CaptureDesignSnapshot = (input: {
  readonly epicId: string;           // #2688's key. NOT a featureId — #2688 ruled against that spelling.
  readonly kind: 'shipped' | 'current' | 'draft';
  readonly file: string;             // the captured artifact the CLI copies into the epic's dated folder
  readonly ratifiedAt: number;       // caller-supplied epoch ms — the handler stays Date-free
}) => Promise<{ ok: true; entry: unknown } | { ok: false; reason: string }>;
```

**Who builds the adapter, and where.** #2688 owns no in-process entry point, so *this* card ships the thin
adapter that shells `plateau-app:scripts/record-design-snapshot.mjs` (or calls whatever in-process seam #2688
has grown by then) and returns the shape above. That adapter is the only place that knows #2688's CLI exists;
the ratify handler sees the port and nothing else. **Confirm #2688's actual shipped interface before writing
it** — it is `status: open`, so the filed design may still move.

The ratify handler takes `captureDesignSnapshot` as a dependency with a **no-op default**, so the surface can
ship and behave correctly before #2688 lands, and the real capture is swapped in with no handler change.

**Three behaviours worth deciding now, because getting them wrong is what makes auto-capture worse than the
manual CLI:**

- **Capture failure must NOT fail the ratify.** A ratify is a human decision that has already happened;
  losing it because a screenshot pipeline hiccuped is strictly worse than a missing snapshot. Capture is
  best-effort, its failure is reported on the ratify result, and the manual CLI stays as the recovery path.
- **Exactly one snapshot per ratify — and the dedup key must be DURABLE, not an in-process `Set`.** A re-ratify
  or a retried run must not append a second snapshot; the filmstrip is a design-increment record and a
  duplicated frame is a false increment. #2688's `DesignSnapshot` carries **no** run identifier to dedup
  against, so this card must either (a) add one to #2688's entry schema (a change to *that* card's artifact,
  which must be agreed there, not assumed here), or (b) dedup on what #2688 *does* persist — `(epicId, date,
  kind)` — accepting that two genuinely distinct ratifies of the same epic on the same day collapse to one
  frame. **(b) is the smaller change and is the default**; take (a) only if same-day re-ratify turns out to
  matter. Either way an in-memory `Set` is NOT sufficient: it does not survive a process restart, which is
  exactly when a retried ratify happens.
- **The manual CLI stays.** This card replaces the *requirement* to run it by hand, not the entry point;
  #2688's script remains the recovery and backfill path.

## Done when

1. **Executable** — `npm test` in `plateau-app:` is green with a case asserting the ratify handler calls its
   injected `captureDesignSnapshot` exactly once, with the ratified **epic id** (#2688's key), a valid `kind`,
   and a caller-supplied timestamp. Fails before (nothing calls capture on ratify); passes after.
2. **Executable** — a case asserts a **failing** capture (rejects, or returns `{ ok: false }`) leaves the
   ratify itself successful, with the failure reported on the result rather than thrown.
3. **Executable** — an idempotence case that survives a restart: two ratify invocations resolving to the same
   durable dedup key produce exactly one capture call **when the second runs against a freshly-constructed
   handler** (no in-process state carried over), proving the check reads persisted snapshots rather than an
   in-memory `Set`.
4. **Executable** — a default-wiring case: with no `captureDesignSnapshot` injected the handler still
   completes and reports capture as not-configured, so the surface can ship ahead of #2688 without a stub that
   silently claims a snapshot was taken.
5. **Observable** — the ratify path contains **no** `execFileSync`/`spawn` of
   `plateau-app:scripts/record-design-snapshot.mjs`: the capture arrives as an injected function. One `grep`
   over the handler's module for the script name returns nothing.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **interface** (NOT addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — 3127's Design section defines CaptureDesignSnapshot as an async, importable function keyed by featureId/runId returning {ok:true, snapshotId} — but #2688's own filed Interfaces section (we:backlog/2688-capture-dated-design-snapshots-per-feature-feed-the-design-i.md) ships only plateau-app:scripts/record-design-snapshot.mjs (an explicit-invocation CLI, not an importable function) plus pure sync helpers (snapshotsFor/validateSnapshotEntry) in plateau-app:src/feature-tracker/design-snapshots.ts, with entries keyed by epicId and no runId or snapshotId field anywhere in the DesignSnapshot shape. blockedBy:['2688'] is treated in 3127's own 'Prerequisite state' section as sufficient once #2688 resolves, but the artifact #2688 as filed cannot satisfy this port without an unscoped adapter layer (id generation, runId bookkeeping, epicId<->featureId translation) that neither card names or schedules. Disposition: introduced by this card (it invents the featureId/runId/snapshotId vocabulary); not worse-than-base on an honest reading — a bare stub with no design is not better than a design with a fixable vocabulary/adapter gap, and the gap is bridgeable (a rename plus a small adapter module), not a structural impossibility (Done-when #5 only forbids the spawn from the handler's own module, so an adapter module could still legally shell out to the CLI underneath). It is also parallelizable: the fix is a text edit to this same card's Design section, and since #2676 remains unsliced (no real ratify handler exists yet to build against), there is no pressure to build against the mismatched shape before someone reconciles it. Routes to carve-out, not blocker. Impact if left unfixed until build time: degraded-to-broken — a future implementer either silently violates 3127's own 'no spawn from the handler' intent or has to redo the port's vocabulary and add unaccounted-for id/idempotency bookkeeping, recoverable only by someone reading both cards side by side and noticing the mismatch. No test exists to mutate (no code has been written for either side yet), so there is nothing to redden — this is a pure spec-level inconsistency, not a shipped-code defect. Root cause: the port shape was designed from DI best-practice conventions (mirroring we:scripts/autofix/engine.mjs) without re-reading #2688's own already-decided Interfaces section for name/shape compatibility. Prevention: a deterministic check that a card's 'consumes artifact of #NNN' claim is cross-checked against the referenced item's own scope/Interfaces section for field-name and return-shape compatibility — no such gate exists today (would need to be filed as a future backlog item, not captured).
- **premise** (NOT addressed; strategy: check by mutation or reversion ahead of the build) — Same root cause as the interface risk: the 'Prerequisite state' section treats blockedBy:['2688'] as the complete prerequisite ('this item consumes an artifact #2688 produces'), but the specific artifact shape 3127's own Design section requires (an importable async capture function) is not what #2688 is scoped to build (a CLI script plus unrelated pure helpers). The premise that landing #2688 alone unblocks this card's stated design is not fully verified against #2688's actual filed interfaces. Same carve-out disposition as above — fixable in this card's own text, well before #2676 is ever sliced.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — The design explicitly makes capture failure surface rather than hide: a failed capture is 'reported on the ratify result rather than thrown' (Done-when #2), and the no-op default 'reports capture as not-configured' rather than silently claiming a snapshot was taken (Done-when #4) — directly matches 3103's legibility strategy of asserting the failure surfaces, not just that it occurs.
- **decorative-guard** (NOT addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The idempotence requirement ('exactly one snapshot per ratify, idempotent on the run id') is tested only by Done-when #3 ('two ratify invocations carrying the same runId produce exactly one capture call'), which is satisfiable by an in-process, in-memory dedup Set with no durability story — and #2688's actual DesignSnapshotIndex/DesignSnapshot schema (we:backlog/2688-capture-dated-design-snapshots-per-feature-feed-the-design-i.md) has no runId field to persist or check against, so nothing in either card's design shows how the idempotency guarantee would survive a process restart or a genuinely retried ratify. Carve-out: introduced by this card, but not worse than the base (which has zero automation and thus zero duplication risk at all — this at least states the requirement), and fully fixable at actual build time, long before which #2676 must first be sliced. Impact if unfixed: degraded (a duplicated filmstrip frame is a false-but-recoverable increment, not data loss).

**Corrections applied by this review:**

- The `CaptureDesignSnapshot` port keys its input on `featureId`, but #2688 (we:backlog/2688-capture-dated-design-snapshots-per-feature-feed-the-design-i.md) explicitly decided "key by epic id, not the future kind:feature id" — the two cards disagree on the identifier for the same underlying concept.

The sequencing/status work is careful and verified against the live repo (the blockedBy/locus additions, #2688/#2676 status, and the we:engine.mjs/buffer.ts precedent citations all check out against the actual uncommitted lane diff), but the injected-port design commits to a vocabulary and function shape that its own cited prerequisite (#2688) does not actually provide, and that mismatch is never acknowledged.

_Recorded through the declared `review-prep` operation._

**Applied by the lane, 2026-08-21.** All three NOT-addressed findings share one root cause and are correct:
the port invented a `featureId`/`runId`/`snapshotId` vocabulary that #2688 does not provide. Verified against
we:backlog/2688-capture-dated-design-snapshots-per-feature-feed-the-design-i.md — it explicitly rules "key by
epic id, not the future `kind:feature` id", ships a CLI plus pure sync helpers with no importable async
capture, and its `DesignSnapshot` shape has no `runId`. The Design now speaks #2688's own
`epicId`/`kind`/`file` vocabulary, names the thin adapter this card must ship to bridge the CLI, and replaces
the un-persistable `runId` idempotence key with a durable `(epicId, date, kind)` default plus the explicit
alternative of amending #2688's schema. `## Done when` items 1 and 3 are rewritten to match, with item 3 now
requiring the dedup to hold across a freshly-constructed handler so an in-memory `Set` cannot satisfy it. No
finding was judged wrong.

