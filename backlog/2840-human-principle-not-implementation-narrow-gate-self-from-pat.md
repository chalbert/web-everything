---
bornAs: xhrni4v
kind: decision
size: 3
status: open
dateOpened: "2026-08-02"
preparedDate: "2026-08-02"
blockedBy: ["2785"]
tags: [governance, review-human, gate-self, principle-surface, stop-the-line, mechanization]
---

# Human = principle, not implementation — narrow gate-self from file PATH to principle-surface

**Principle statement.** A human is required for a **principle**, not for the **implementation** that
carries it. So `review:human` should fire when a diff touches a **principle surface** — a cite-able
statute rule, or an assertion that encodes a guarantee — and NOT merely because the diff edits a file
that happens to sit in the trust chain. Implementation that preserves the encoded guarantees (they stay
green) is **mechanical**, and mechanical work is cleared by the fix↔review convergence loop
(`we:docs/agent/platform-decisions.md#fix-review-convergence-independent-root-cause`), not a person — per
`we:docs/agent/platform-decisions.md#human-required-is-judgment-only`.

This is one of three principle decisions prepared together for a single ratification pass (with
`#2839` — the two-PR rule — and `#2838` — the enforce-flip). Per the discipline those decisions
establish, this is a **principle change**, so it lands in its own decisions-only PR parked `review:human`;
the implementation that narrows the gate is a separate follow-on PR (see `#2839`).

**Blocked-by / precondition, not just lineage.** The four anchors this decision reasons over
(`#human-required-is-judgment-only`, `#fix-review-convergence-independent-root-cause`,
`#deterministic-oracle-clears-slice`, `#orchestrator-stops-line-never-absorbs`) do NOT yet exist on `main`
— they land via `xzc1sc5` (PR #982, the stop-the-line conveyor-governance statute cluster, itself
`review:human`). Only `#review-human-declarative-leash-only` currently resolves. So **`xzc1sc5` (PR #982)
is a hard land-order precondition**: this item must land AFTER it or every lineage cite here 404s. It is
NOT in the `blockedBy` frontmatter because `xzc1sc5`'s file is not yet in this lane's tree and
`we:scripts/check-backlog-item.mjs` errors on a `blockedBy` target that does not resolve to a present item
— so the ordering is stated here in prose and must be honored at land (the drain lands #982 first).
`check:standards` will not otherwise catch the dangling prose cites — `we:scripts/lib/validate-rules-anchors.cjs`
validates `codifiedIn:` **frontmatter** cites only and explicitly excludes prose-body references.

## Relationship to the already-ratified #2771 narrowing (read first)

This decision does **not** re-open a settled call — it **composes with and extends** it, and must be read
against it:

- **#2771 (`#review-human-declarative-leash-only`, ratified 2026-07-28)** already ruled that policy-tier
  *derivation code* routes to the sized independent committee (not `review:human`), and reserved
  `review:human` for the **declarative leash** — the policy contract
  (`we:scripts/lib/review-policy.contract.json`), the roster (`we:scripts/lib/gate-config.mjs`), the
  invariant/conformance suites — plus a raw new statute rule or an un-ratified decision. Its **specified
  mechanic**: narrow `humanRequired` from *any `isPolicyCorePath`* to *any `POLICY_SPEC` basename* (a
  frozen declarative-leash subset). Its impl follow-on is **#2785** (`status: open`) — which is why the
  code today still reads `isGateSelfPath = isPolicyCorePath` (the un-narrowed path gate).
- **This decision (`#2840`) is the second-stage narrowing.** #2785 narrows the human gate by *path* to
  the declarative-leash files. `#2840` adds a second, orthogonal axis: a `@principle`/`@invariant`-marked
  **guarantee** is human-gated **wherever it lives** — including in an engine/committee-tier file #2785
  drops to the committee — and, conversely, a trust-chain file that carries **no** marked guarantee this
  diff (a behaviour-preserving refactor) is *not* human-gated just for its path. The leash files stay
  human-gated as whole files (see the pin below); markers extend the gate, they never shrink it.
- **Therefore #2840 depends on #2785 landing first** (`blockedBy: 2785`). Building #2840 on the
  un-narrowed `isGateSelfPath = isPolicyCorePath` base would re-derive #2771's ruling instead of extending
  it.

## Current state

`isGateSelfPath` is an alias of `isPolicyCorePath` (`we:scripts/lib/review-escalation.mjs#isGateSelfPath`,
`we:scripts/lib/gate-config.mjs#isPolicyCorePath`). It fires on a **file PATH**: a diff whose changed-file
basename is in `POLICY_CORE_BASENAMES` (`we:scripts/lib/gate-config.mjs#POLICY_CORE_BASENAMES`) — the
escalation rubric, the disposition router, the policy contract + its loader, both land seams, the roster
itself, and the invariant/conformance suites — sets `humanRequired: true` in `scoreEscalation`
(`we:scripts/lib/review-escalation.mjs#scoreEscalation`). Any edit to those files, **behaviour-preserving
or not**, forces `review:human`. The trust-chain path IS the trigger.

#2785 (open) narrows that path gate to the declarative-leash subset, so the pure *derivation-code* cost —
a refactor of `we:scripts/lib/review-escalation.mjs` that changes no guaranteed behaviour still stranding
the queue on a human — is **already addressed by #2785**, not by this decision. What #2785 does **not**
address, and what remains after it lands:

- A guarantee ENCODED as an invariant **outside** the leash files (asserted in an engine or test file that
  #2785 routes to the committee) has no human gate at all — a real principle change can slip through as
  "mechanical" because the gate keys on file location, not on the guarantee.
- There is no way to say "this specific edit changed a guarantee" versus "this edit reflowed a comment":
  the gate is all-or-nothing per path.

`#2840` closes both by making the *encoded guarantee itself* — a `@principle`/`@invariant` marker — a
human trigger independent of path.

**Marker inventory today: ZERO.** There are currently no `@principle` or `@invariant` markers anywhere in
the repo. So on adoption day the marker axis fires on nothing, and the human gate is exactly #2785's
declarative-leash path gate. The marker axis delivers narrowing/tightening **only as guarantees get
encoded** — which makes marker-seeding an explicit precondition of any behaviour change here (see
Preconditions), not a same-day effect.

## The change

`review:human` fires on a **principle surface**, defined as the union of three triggers (the third is the
permanent floor, not a temporary one):

1. A **statute-anchor edit** — a diff to `we:docs/agent/platform-decisions.md` (or any statute doc) that
   adds, removes, or alters an `### … {#anchor}` rule heading or its ruling body. This replaces the current
   path-only `isStatutePath` term: a whitespace/reflow/typo edit that changes no rule text no longer fires.
2. An edit to a **`@principle` / `@invariant`-marked** assertion that **already exists on the base** — a
   guarantee ENCODED as a machine-checkable invariant, tagged so the gate can find it. Editing or removing
   an existing marked guarantee is editing the principle; it is human-gated. (Note the "already exists on
   the base" grain — *adding* a new marked invariant that enforces an already-ratified anchor is
   *implementation*, mechanical, per `#2839`; only touching a pre-existing one is the principle step.)
3. The **declarative-leash path floor (permanent).** Every file in #2785's `POLICY_SPEC` declarative-leash
   set — the policy contract, the roster, the invariant/conformance suites — stays human-gated **as a whole
   file, by path, permanently**. These files *are* the encoded principle; there is no behaviour-preserving
   edit to them, and their guarantees are not yet (and may never all be) expressible as line-level markers.
   This floor is **pinned**, not a "until-encoded" floor.

Everything else on a trust-chain file — a derivation-code file outside the leash, carrying no marked
guarantee this diff — is **engine-tier**: it still escalates (`review:pending`) and runs the full
independent committee (per #2785), but a converged agent verdict may clear it, because keeping the marked
invariants green is a mechanical bar, not a judgment call.

## Mechanical enforcement design (the concrete gate)

Compose a **principle-surface** trigger on top of #2785's narrowed path gate in `scoreEscalation`:

- Introduce `isPrincipleSurface(changedFile, diffHunks)` in `we:scripts/lib/gate-config.mjs`, the union of:
  - **`isStatuteAnchorEdit(changedFile, diffHunks)`** — the changed file matches `isStatutePath` AND a
    touched hunk overlaps an `### … {#anchor}` heading line or the ruling body under one (not merely a
    whitespace/reflow line). Reuses the anchor grammar `we:scripts/lib/validate-rules-anchors.cjs` reads
    (it delegates the parse to `extractAnchors` in `we:scripts/lib/rules-loader.cjs`), so "did a rule
    change?" is the same deterministic read the anchor validator makes.
  - **`isMarkedInvariantEdit(changedFile, diffHunks)`** — a touched hunk overlaps a block tagged
    `@principle` or `@invariant` **that is present in the base version of the file** (a leading marker
    comment on the `test(...)` / `expect(...)` / exported assertion). The marker set is greppable and its
    owning file need not be in the trust chain. Requiring base-presence is what keeps *adding* an enforcing
    invariant out of this trigger (that is `implTouch` under `#2839`).
  - **`isDeclarativeLeashPath(changedFile)`** — the changed-file basename is in #2785's `POLICY_SPEC` set
    (the pinned floor, item 3 above). This is the ONE path-based term that survives; it is permanent.
- **Diff-content plumbing is a prerequisite, not a no-op.** `isStatuteAnchorEdit` and `isMarkedInvariantEdit`
  read hunk **content**, but `scoreEscalation` today is declared
  `{ changedFiles, diffLines, humanBasisFiles, dismissedFindings, crossRepo, thresholds }` — file **names**
  and a line **count**, never hunk content — and both call sites (`we:scripts/pr-land.mjs`,
  `we:scripts/merge-ai-prs.mjs`) pass exactly that. So the impl PR **must first** thread `diffHunks` (or a
  base-vs-head content signal) into `scoreEscalation`/`producerReviewLabel` and both call sites. Until that
  plumbing lands, `isStatuteAnchorEdit`/`isMarkedInvariantEdit` would evaluate against undefined content and
  return false — the gate would *under-fire on exactly the class it exists for*. This producer-side
  diff-content plumbing is a named precondition of the impl PR (see Preconditions), NOT "same shape,
  unchanged."
- In `scoreEscalation`, the human trigger becomes
  `humanRequired = gateBasis.some(f => isPrincipleSurface(f, diffHunks(f)))`. This subsumes **both** current
  path terms: the old `statuteFiles = gateBasis.filter(isStatutePath)` term is replaced by
  `isStatuteAnchorEdit` (content-gated), and the old `gateSelfFiles = gateBasis.filter(isGateSelfPath)` term
  is replaced by `isDeclarativeLeashPath` (the pinned leash) plus the marker axis. Both independent
  path-based OR-terms in today's `humanRequired = gateSelfFiles.length > 0 || statuteFiles.length > 0` are
  handled — leaving either intact would keep whitespace edits to
  `we:docs/agent/platform-decisions.md`, or engine refactors, forcing a human against the intent.
- A trust-chain file that is NOT a principle surface this diff still ESCALATES (via `isBlastRadiusPath` /
  `isTrustChainPath`, unchanged) but no longer sets `humanRequired` — it routes to the committee.

**Why the floor is per-file-PINNED, not per-marker.** A declarative-leash file such as
`we:scripts/lib/review-policy.contract.json` carries many independent guarantees (`landMode`, the dissent
threshold, the resolution mode, the overridable-keys set, the bands). If the floor dropped a file the
moment *any one* guarantee got a marker, the remaining un-encoded guarantees in that same file would fall
out of the human gate in the same diff — and a `check:standards` *presence* test would not catch it (it
tests that a marker exists, not that every guarantee is covered). So the leash files are pinned as whole
files; the marker axis only ever *adds* human-gating outside them. Narrowing a leash file itself from
whole-file gating to marker-grain is explicitly **out of scope** for this decision — it would require full
per-guarantee marker coverage of that file plus a per-guarantee coverage check, and is a future decision.

## RISK

**An encoded principle outside the leash is mis-tiered.** The marker axis is only as good as the markers.
If a guarantee that lives outside the declarative-leash files is *not* marked, a behaviour change to it
routes to the committee, not a human — a real principle change slipping through as "mechanical." And
because there are zero markers today, on adoption day this axis protects nothing new; the protection grows
only as guarantees are encoded.

## SAFEGUARD

The design can only ever **over-gate to a human** (the safe direction), never under-gate below today's
line, because the human trigger is a **superset** of #2785's gate: (i) the declarative-leash floor is
**pinned** — every leash file stays human-gated as a whole file, so the enforce-flip contract, the roster,
and the suites never leave the human gate (this is what `#2838` depends on); (ii) the marker axis only
*adds* human-gating for encoded guarantees outside the leash; (iii) statute edits stay human-gated, now
content-scoped so only real rule changes fire. Marker-seeding is deliberate and per-guarantee: a guarantee
gains its marker in the impl PR that also carries its enforcing invariant (`#2839`), and a
`check:standards` rule can assert leash-file guarantees are never *removed* from the gate. The un-encoded
state is the *stricter* state (leash pinned + statute + no marker narrowing), so nothing loses its gate by
default.

## Options

| Option | Trigger | Verdict |
|--------|---------|---------|
| **A — principle-surface over #2785's narrowed gate (recommended)** | statute-anchor edit (content) ∪ pre-existing `@principle`-marked invariant edit ∪ pinned declarative-leash path floor | behaviour-preserving impl outside the leash is mechanical → committee; principle change (statute, marked guarantee, or any leash-file edit) → human |
| B — status quo path gate (`isGateSelfPath = isPolicyCorePath`) | any edit to a trust-chain file | every refactor strands on a human — the smart-glue cost `#human-required-is-judgment-only` rejects; also blocks #2771/#2785 |
| C — drop the leash floor, markers-only | statute-anchor ∪ marked-invariant only, no path floor | REJECT — with zero markers today, and leash guarantees (e.g. `landMode`) not yet encodable line-by-line, the enforce-flip and roster lose their human gate; this is exactly finding-3/finding-7 realized |

## Recommendation

**Adopt A.** It is the direct mechanization of
`we:docs/agent/platform-decisions.md#human-required-is-judgment-only` on the review gate, layered on
#2771/#2785: #2785 sheds the derivation-code toil by path, and `#2840` makes the *encoded guarantee*
the trigger so a human keeps every genuine principle change wherever it lives, while the declarative-leash
files (contract, roster, suites) stay pinned to the human gate. The pinned floor makes the transition safe
without a per-file "until-encoded" race, so findings 3 and 7 never open. The implementation — the
`diffHunks` plumbing (precondition), the `isPrincipleSurface` composition, the leash-pin `check:standards`
rule, and the first `@principle` invariants — is a separate follow-on PR under the two-PR rule (`#2839`)
— this PR only authors the principle.

## Preconditions (impl PR, under `#2839`)

1. **`xzc1sc5` (PR #982) landed** — the four anchors this decision cites exist on `main` (prose land-order
   precondition; not a frontmatter `blockedBy` because the file is not yet in this tree).
2. **#2785 landed** — the base narrowing to `POLICY_SPEC` this decision extends. (`blockedBy`.)
3. **Producer-side diff-content plumbing** — `diffHunks` threaded into `scoreEscalation` /
   `producerReviewLabel` and both call sites (`we:scripts/pr-land.mjs`, `we:scripts/merge-ai-prs.mjs`);
   without it the content triggers under-fire. This is new plumbing, not a no-op.
4. **Marker-seeding** — encode the first guarantees as `@principle`/`@invariant` invariants (the marker
   axis is inert until then). Each seeding rides its own impl PR per `#2839`.

**Lineage:** mechanizes `we:docs/agent/platform-decisions.md#human-required-is-judgment-only`; **extends**
`we:docs/agent/platform-decisions.md#review-human-declarative-leash-only` (#2771 — narrowed the gate by
*path* to the declarative leash; #2840 adds the *edit/guarantee* axis on top, impl follow-on #2785); and
composes `we:docs/agent/platform-decisions.md#fix-review-convergence-independent-root-cause` (the mechanical
clearer the shed work routes to). Current mechanism:
`we:scripts/lib/review-escalation.mjs#isGateSelfPath`, `we:scripts/lib/gate-config.mjs#isPolicyCorePath`,
`we:scripts/lib/gate-config.mjs#POLICY_CORE_BASENAMES`.
