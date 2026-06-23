---
kind: decision
status: resolved
preparedDate: "2026-06-22"
dateOpened: "2026-06-18"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: 1661
codifiedIn: one-off
tags: []
---

# Session file-claim registry — precision upgrade for gate attribution if claim-baseline leak bites

Fork 2-C from #949: should the concurrent-session gate-attribution use a precise file-claim registry, or
accept the shipped git-baseline (#952, Fork 2-A) residual?

## Grounding digest

- **2-A is shipped** (#952): `check:standards --scope` attributes gate failures to a session via a
  **claim-time git-baseline snapshot**. It has a known **fail-unsafe** hole ([#949:83](/backlog/949-concurrent-session-gate-attribution-scope-the-batch-gate-to-/)):
  a file *already dirty at my claim* (so in my "theirs" baseline) that **I then also edit** is
  mis-attributed as **foreign** and stepped over — i.e. I can build on a real gate-red I wrongly believe is
  someone else's.
- **2-C** would extend the session reservation registry ([`we:.claude/skills/batch-backlog-items/reservations.json`](../.claude/skills/batch-backlog-items/reservations.json),
  already session-keyed, TTL-pruned) to record each edited file against the session via a `PostToolUse`
  hook on Edit/Write — the most precise fix (no snapshot-diff race); orphan-claim cleanup on a dead session
  is handled by the existing TTL prune.
- No new `/research/` topic — this re-rules a residual-acceptance call from #949 against the real
  concurrency model, prior-art-settled.

## Axis framing — accept a silent fail-unsafe residual vs fix it

#949 deferred 2-C as "the precision upgrade *if* 2-A's leak bites," on the read that the overlap is *rare*.
The skeptic pass overturned that read on the merits: the fail-unsafe trigger lands precisely on the
**shared data registries** (`we:capacity.json`, `we:claims.json`, `we:reservations.json`, `we:intents.json`,
blocks data) that concurrent batch sessions touch **constantly** (claim/release/reserve is the batch
heartbeat) — so the overlap is the *modal* case, not a corner — and those files *do* trip the gate (the
intents-registry mixed-escaping footgun, the body-less `relatedReport` footgun). Worse, the fault is **silent**
(you step over a real red believed foreign with no signal), so "wait until it demonstrably bites" is
unobservable-by-design — it collapses to *never*. And the fix is **near-free** (the reservation registry is
already session-keyed + TTL-pruned). A silent, modal-frequency, correctness fault with a near-free fix is
not gold-plating to defer — it is a seatbelt to install.

## Recommended path at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| **Fork 1** — accept 2-A residual vs build 2-C | **(b) build 2-C now** — the fail-unsafe hole is modal (shared registries), silent (unobservable trigger), and near-free to fix (the reservation registry is already session-keyed/TTL-pruned) | (a) accept the residual until it "demonstrably bites" — excluded: the fault is silent, so the trigger can never be observed → "never build it" in disguise | **med-high** — flipped on the modal+silent finding |

## Fork 1 — accept the 2-A residual, or build the 2-C file-claim registry

**Fork-existence justification:** forced invariant on a correctness hole — branch (a) "accept the residual
until it demonstrably bites" is the *flawed* branch: the fault is **fail-unsafe and silent** (you build on a
real red believed foreign, with no signal), so its trigger is **unobservable**, making "wait" equivalent to
"never" for a dangerous fault on the *modal* shared-registry path. (Justification is correctness — silent
fail-unsafe on the common path — not cost/prioritization.)

**Crux:** the cheap git-baseline mis-attributes exactly the always-contended shared registries, and does so
*silently* — so the residual cannot be safely "watched," it must be closed.

**Options:**

- **(b) Build 2-C now — the session file-claim registry** *(recommended default — flipped)* — extend the
  session reservation registry (`we:.claude/skills/batch-backlog-items/reservations.json`) to record each
  edited file against the session via a `PostToolUse` hook on Edit/Write; attribution becomes exact (no
  snapshot-diff race), orphan claims pruned by the existing TTL. **One honest cost (skeptic-acknowledged):**
  a hook on every Edit/Write adds latency + a small failure surface on the hottest path — bounded and
  *observable*, unlike the silent fault it removes.
- **(a) Accept the 2-A residual until it demonstrably bites** — *Rejected (flawed branch).* Rests on the
  overlap being rare; it is the *modal* case (shared registries, touched every claim/release), the tripping
  files *do* trip the gate, and the fault is **silent** so "demonstrably bites" can never be observed —
  "wait" becomes "never" for a dangerous fault.

**Recommended default: (b) build 2-C now.**

**Skeptic:** REFUTED → the accept-residual default was overturned. "Bounded/rare" was a sleight of hand —
the fail-unsafe trigger hits the shared data registries concurrent sessions edit *constantly* (the modal
case), which *do* trip the gate; the fault is **silent**, so "build only if it demonstrably bites" requires
observability the fault denies (→ effectively never); and 2-C's cost is near-zero (the reservation registry
is already session-keyed + TTL-pruned). **Default flipped to (b) build 2-C now**, carrying the one honest
counter-cost (hook latency on the Edit/Write hot path — bounded and observable). #952 (2-A) is resolved, so
2-C is unblocked; ratifying this files the build.

## Ratification (2026-06-23)

**Ruling: (b) build 2-C** — the session file-claim registry. The fail-unsafe hole was verified in the
real tree: [we:scripts/readiness/claimScope.mjs:153](../scripts/readiness/claimScope.mjs) computes
`mineFiles = currentFiles − baseline`, so a file **already dirty at claim** (in the baseline) that **this
session then breaks** stays classified `external` → demoted to a non-failing note → stepped over. (The
module header's "NEVER a foreign red mistaken for clean" claim is therefore inaccurate for the
own-edit-of-baseline-file case — exactly the residual this fork closes.)

**Two amendments to the build spec, surfaced at ratification (mechanism red-team, not a flip of the
direction):**

1. **Mechanism = UNION, never replacement.** The successor build must compute
   `mineFiles = (currentFiles − baseline) ∪ (explicitly-recorded touches)`. The file-claim registry only
   ever *adds* files to "mine" — so attribution is a **monotonic tightening** of 2-A's baseline-diff and
   can never be worse than the shipped behaviour. This removes any risk in replacing one model with another.
2. **Bash/CLI mutations are in scope (the honest residual).** A `PostToolUse` hook on Edit/Write is
   **blind to files mutated via Bash** — `we:scripts/backlog.mjs` claim/resolve/scaffold, `sed`, `node -e`
   splices. Several shared registries (and the backlog `.md` body-less-`relatedReport` footgun) are mutated
   through the backlog CLIs, so an Edit/Write-only hook would *miss part of the cited modal case*. The
   backlog CLIs already write through `we:scripts/backlog.mjs`, so they can append to the registry directly
   (no hook needed) — cheaper and more complete than the hook alone. The build closes the Bash slice via
   that direct CLI recording; any mutation path outside both Edit/Write and the CLIs (raw `sed` on a
   registry) honestly rides the baseline-diff residual and is documented as such.

**Successor build filed as #1661** (`blockedBy: none` — #952/2-A shipped, so 2-C is unblocked). This
decision item graduates to that build.
