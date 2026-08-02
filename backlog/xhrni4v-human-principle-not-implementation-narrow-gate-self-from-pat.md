---
kind: decision
size: 3
status: open
dateOpened: "2026-08-02"
preparedDate: "2026-08-02"
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
`#x84bjrx` — the two-PR rule — and `#x2w4qbf` — the enforce-flip). Per the discipline those decisions
establish, this is a **principle change**, so it lands in its own decisions-only PR parked `review:human`;
the implementation that narrows the gate is a separate follow-on PR (see `#x84bjrx`).

## Current state

`isGateSelfPath` is an alias of `isPolicyCorePath` (`we:scripts/lib/review-escalation.mjs#isGateSelfPath`,
`we:scripts/lib/gate-config.mjs#isPolicyCorePath`). It fires on a **file PATH**: a diff whose changed-file
basename is in `POLICY_CORE_BASENAMES` (`we:scripts/lib/gate-config.mjs#POLICY_CORE_BASENAMES`) — the
escalation rubric, the disposition router, the policy contract + its loader, both land seams, the roster
itself, and the invariant/conformance suites — sets `humanRequired: true` in `scoreEscalation`
(`we:scripts/lib/review-escalation.mjs#scoreEscalation`). Any edit to those files, **behaviour-preserving
or not**, forces `review:human`. The trust-chain path IS the trigger.

The cost: a refactor of `we:scripts/lib/review-escalation.mjs` that changes not one guaranteed behaviour —
renaming a local, splitting a helper, tightening a type — still strands the queue on a human. That is
exactly the "convergent review treated as human work" that
`we:docs/agent/platform-decisions.md#human-required-is-judgment-only` names as smart glue: the criteria
are known (keep the invariants green), the loop terminates, no new judgment is created.

## The change

Fire `review:human` on a **principle surface**, not the trust-chain path:

1. A **statute-anchor edit** — a diff to `we:docs/agent/platform-decisions.md` (or any statute doc) that
   adds, removes, or alters an `### … {#anchor}` rule heading or its ruling body. (This is the statute
   half `isStatutePath` already covers — kept.)
2. An edit to a **`@principle` / `@invariant`-marked** test or assertion — a guarantee ENCODED as a
   machine-checkable invariant, tagged so the gate can find it. Editing the marked guarantee is editing the
   principle; it is human-gated.

Everything else on a trust-chain file is **engine-tier**: it still escalates (`review:pending`) and runs
the full independent committee, but a converged agent verdict may clear it (the fix↔review convergence
loop), because keeping the marked invariants green is a mechanical bar, not a judgment call.

## Mechanical enforcement design (the concrete gate)

Replace the PATH trigger with a **principle-surface** trigger in `scoreEscalation`:

- Introduce `isPrincipleSurface(changedFile, diffHunks)` in `we:scripts/lib/gate-config.mjs`, the union of:
  - **`isStatuteAnchorEdit`** — the changed file matches `isStatutePath` AND the diff touches an
    `### … {#anchor}` heading line or the body under one (not merely a whitespace/reflow line). Reuses the
    anchor grammar `we:scripts/validate-rules-anchors.cjs` already parses, so "did a rule change?" is the
    same deterministic read the anchor validator makes.
  - **`isMarkedInvariantEdit`** — the diff touches a hunk inside a block tagged `@principle` or
    `@invariant` (a leading marker comment on the `test(...)` / `expect(...)` / exported assertion). The
    marker set is greppable and its owning file need not be in the trust chain.
- In `scoreEscalation` (`we:scripts/lib/review-escalation.mjs#scoreEscalation`), swap the
  `gateBasis.filter(isGateSelfPath)` human trigger for `gateBasis.filter(isPrincipleSurface)`. A
  trust-chain file that is NOT a principle surface this diff still ESCALATES (via `isBlastRadiusPath` /
  `isTrustChainPath`, unchanged) but no longer sets `humanRequired` — it routes to the committee.
- **`isGateSelfPath` does not vanish — it becomes the migration floor.** `isPrincipleSurface` unions the
  two detectors above with `isGateSelfPath` **restricted to files that carry NO `@principle`-marked
  invariant yet**. A policy-core file whose guarantees are not yet encoded stays path-gated exactly as
  today; it leaves the path gate only when its guarantee is encoded as a marked invariant. The migration is
  therefore **per-principle and deliberate**, file by file, never a blanket flip.

The trigger stays a pure function over `{changedFiles, diffHunks}` — same shape `scoreEscalation` /
`producerReviewLabel` already consume — so the producer applies the correct label at PR-open, unchanged.

## RISK

An **unencoded principle silently becomes mechanical.** If a policy-core file is dropped from the path
gate before its guarantee is actually encoded as a `@principle` invariant, a behaviour change to that
guarantee would route to the committee instead of a human — a real principle change slipping through as
"mechanical." The blast radius is a governance guarantee losing its human gate without anyone deciding to
remove it.

## SAFEGUARD

The narrow gate **only works once principles are ENCODED as invariants.** The `isGateSelfPath` migration
floor (above) is the safeguard: until a file's guarantee is encoded as a `@principle`-marked invariant,
that file **stays path-gated** — it cannot leak into the mechanical tier. Migration is per-principle and
deliberate: a file leaves the path gate in the SAME diff that adds its marked invariant, and a
`check:standards` rule asserts the two never separate (a policy-core file removed from the floor with no
corresponding `@principle` invariant present is a hard error). So the queue can only ever
**over-gate to a human** (the safe direction) for a principle not yet encoded — never under-gate.

## Options

| Option | Trigger | Verdict |
|--------|---------|---------|
| **A — principle-surface (recommended)** | statute-anchor edit ∪ `@principle`-marked invariant edit ∪ (path gate for not-yet-encoded files) | behaviour-preserving impl is mechanical → committee; principle change → human |
| B — status quo (path gate) | any edit to a trust-chain file | every refactor strands on a human — the smart-glue cost `#human-required-is-judgment-only` rejects |
| C — drop the path gate entirely now | statute-anchor ∪ marked-invariant only | REJECT — unencoded principles lose their human gate with no migration floor (the RISK, unmitigated) |

## Recommendation

**Adopt A.** It is the direct mechanization of
`we:docs/agent/platform-decisions.md#human-required-is-judgment-only` on the review gate: the human keeps
every genuine principle change (statute + encoded guarantee) and sheds the mechanical refactor toil. The
`isGateSelfPath` migration floor makes the transition safe and per-principle, so C's hole never opens. The
implementation (the `isPrincipleSurface` swap + the migration-floor `check:standards` rule + encoding the
first principles as `@principle` invariants) is a separate follow-on PR under the two-PR rule (`#x84bjrx`)
— this PR only authors the principle.

**Lineage:** mechanizes `we:docs/agent/platform-decisions.md#human-required-is-judgment-only` and composes
`we:docs/agent/platform-decisions.md#review-human-declarative-leash-only` (#2771 — the
declarative-leash-only narrowing this extends from "which files" to "which *edits*") and
`we:docs/agent/platform-decisions.md#fix-review-convergence-independent-root-cause` (the mechanical
clearer the shed work routes to). Current mechanism:
`we:scripts/lib/review-escalation.mjs#isGateSelfPath`, `we:scripts/lib/gate-config.mjs#isPolicyCorePath`.
