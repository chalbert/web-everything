---
bornAs: xlze0p9
kind: story
size: 3
parent: "2562"
status: open
locus: plateau-app
scope:
  - plateau-app:src/backlog-view/proof-tiers.ts
  - plateau-app:src/backlog-view/proof-tiers.css
  - plateau-app:src/backlog-view/proof-tiers.test.ts
dateOpened: "2026-07-28"
tags: []
---

# Proof provenance-tier spine + agent-asserted tier + review surface

Establish the provenance-tier spine every proven criterion rides. Define the three-tier enum — harness-owned probe > agent-authored, harness-replayed > agent-asserted — and stamp each proven criterion with its tier. Render the tier on the review surface (the review modal's evidence rows, #2555) and add the per-requirement proof bundle: each requirement (R1..Rn, per the F3 schema #2561) deep-links to its evidence artifact (test run / log / screenshot / trace). 

Adds the launch/merge gate's minimum-tier config knob (unenforced until the producer tiers land). Ships the agent-asserted tier as the base producer — today's self-claim, now formalized and visibly labelled as the lowest trust rung. Foundation the tier producers and the pre-PR harness wiring ride on.

## Design

**The contract this hangs off is already ratified — do not re-open it.** [#2561](/backlog/2561-console-substrate-contract-forks-f1-f4/)
(`status: resolved`) Fork 3 ruled the **frozen requirement rows R1..Rn** to be the machine-checkable
conformance contract, with the shape:

```ts
requirements: [
  { id: "R1", text: "invalid input shows the inline error", source: "acceptance-p2", proof: null },
  { id: "R2", text: "retry re-runs the submit",             source: "acceptance-p3", proof: null },
]
```

`proof: null` is the explicit hole this item fills — #2561 wrote it that way *for* #2562. So the row ids are
the stable attach point; this item does **not** invent an identity scheme.

**Mirror #2561's own precedent for the tier ordering.** Fork 2 of the same decision ratified a
provenance-tagged `confidence` field with `by ∈ agent|human|derived` and **nearest-wins precedence**
`human > derived > agent`, plus the rule that a recompute never silently overwrites a higher-precedence
value — it surfaces a *disagreement flag*. The proof tier is the same pattern one layer over: a strictly
ordered enum, a comparison helper, and a "higher tier never silently replaced by a lower one" rule.

```ts
// plateau-app:src/backlog-view/proof-tiers.ts
/** Strictly ordered, weakest → strongest. The ORDER is the contract; the strings are labels. */
export const PROOF_TIERS = ['agent-asserted', 'agent-authored-harness-replayed', 'harness-owned-probe'] as const;
export type ProofTier = typeof PROOF_TIERS[number];

/** −1 / 0 / +1 on the ladder. The ONLY place tier order is encoded. */
export function compareTier(a: ProofTier, b: ProofTier): number;

/** A proof attached to one requirement row. `evidenceHref` deep-links the artifact (test run / log /
 *  screenshot / trace); a proof with no resolvable evidence is NOT a proof. */
export interface RequirementProof {
  readonly requirementId: string;      // 'R1' — the frozen #2561 row id
  readonly tier: ProofTier;
  readonly evidenceHref: string;
  readonly assertedAt: number;         // caller-supplied epoch ms; module stays Date-free
}

/** The launch/merge gate's minimum-tier knob. UNENFORCED until the producer tiers land (#2562) —
 *  it is read and reported, and `enforce:false` is the shipped default. */
export interface MinTierPolicy { readonly minTier: ProofTier; readonly enforce: boolean; }
export function gateVerdict(proofs: readonly RequirementProof[], requirementIds: readonly string[], policy: MinTierPolicy):
  { readonly ok: boolean; readonly below: readonly string[]; readonly unproven: readonly string[]; readonly enforced: boolean };

/**
 * THE WRITE SEAM — the one function #2562's producers and #2555's review modal call to attach a proof.
 * Pure and immutable: it returns a NEW proof set, never mutates. This is where the no-silent-downgrade rule
 * lives, so it cannot be reimplemented differently by each producer.
 *   • no existing proof for `requirementId` ⇒ recorded, `outcome: 'recorded'`
 *   • the new proof's tier is STRONGER ⇒ it replaces, `outcome: 'upgraded'`
 *   • equal tier ⇒ replaces (a fresher run of the same rung), `outcome: 'refreshed'`
 *   • WEAKER ⇒ the stronger proof STAYS and the conflict is surfaced, `outcome: 'disagreement'` with
 *     `kept`/`rejected` both returned so the review surface can render both sides. Never silently dropped,
 *     never silently applied — the same posture #2561 Fork 2 ratified for a `derived` confidence value that
 *     disagrees with a `human` override.
 *   • an empty/absent `evidenceHref` ⇒ rejected at this seam, `outcome: 'invalid'` (see below).
 */
export function recordProof(
  proofs: readonly RequirementProof[],
  next: RequirementProof,
): {
  readonly proofs: readonly RequirementProof[];
  readonly outcome: 'recorded' | 'upgraded' | 'refreshed' | 'disagreement' | 'invalid';
  readonly kept?: RequirementProof;
  readonly rejected?: RequirementProof;
  readonly reason?: string;
};
```

**Three rules that keep this honest and are the ones worth testing:**

- **Fail closed on absence.** A requirement row with no proof is `unproven`, never "assumed agent-asserted".
  An unknown tier string is treated as weaker than every known tier, not stronger.
- **Never silently upgrade.** Recording a proof at a LOWER tier than one already recorded for the same
  `requirementId` does not overwrite it; it surfaces a disagreement, mirroring #2561's confidence rule.
- **`enforce: false` is the shipped default.** The knob is read and rendered from day one and blocks nothing,
  exactly as the digest says ("unenforced until the producer tiers land").

**Ship `agent-asserted` as the only producer.** It is today's self-claim, formalized — the point is that it
renders *at its true trust rung* on the review surface rather than as unlabelled certainty. Do not stub the
other two producers; leave them to the #2562 follow-on so a stub cannot be mistaken for a real probe.

**Render layer, and what the stylesheet in scope is for.** #2555 (`status: open`) owns the review modal itself. This
item ships the **badge and its styles** — the tier label at its true trust rung, in
`plateau-app:src/backlog-view/proof-tiers.css`, which is why that file is in scope — but it does **not** build
a second modal to host them. The badge is mounted into #2555's evidence rows when that surface lands; until
then it is a styled, tested component with no mount point. Do not invent a placeholder surface to render it
in.

## Done when

1. **Executable** — `npm test` in `plateau-app:` is green with new cases in
   `plateau-app:src/backlog-view/proof-tiers.test.ts` pinning `compareTier` across all three tiers in both
   directions (`agent-asserted < agent-authored-harness-replayed < harness-owned-probe`, antisymmetric,
   reflexive on equality) and pinning that an unknown tier string sorts BELOW every known tier. Fails today —
   the module does not exist.
2. **Executable** — the same suite pins `gateVerdict`: a requirement id with no proof lands in `unproven`
   (never silently `ok`); a proof below `policy.minTier` lands in `below`; with `enforce: false` the verdict
   reports `ok: true, enforced: false` while STILL populating `below`/`unproven`, so the knob is observable
   before it is enforcing.
3. **Executable** — `recordProof` is pinned across all five outcomes: `recorded` on a first proof,
   `upgraded` on a stronger tier, `refreshed` on an equal tier, `invalid` on an empty `evidenceHref`, and —
   the no-silent-downgrade rule — `disagreement` on a weaker tier, with the stronger proof still present in
   the returned set and BOTH `kept` and `rejected` populated. Asserted on the returned value, not on a
   mutation, since the function is pure.
4. **Observable** — a proof with an empty or missing `evidenceHref` never enters the proof set: it is rejected
   at the `recordProof` seam (`outcome: 'invalid'`) rather than rendered as an unlinked claim, so there is one
   place to check rather than every producer.
5. **Executable** — `npm test` in `plateau-app:` is green overall and no existing test file changed (this is
   an additive module; the #2555 review-modal wiring is the only consumer and is tracked there).

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: check by mutation or reversion ahead of the build) — Verified against the live repo: we:backlog/2561-console-substrate-and-contract-forks.md is status:resolved with the exact F2/F3 text the card cites; we:backlog/2555-real-launch-review-console-board.md is status:open; plateau-app:src/backlog-view/proof-tiers.ts does not exist; no `confidence`/`requirements`/`ProofTier` field exists anywhere in plateau-app/src or we:web-everything/contracts/backlog.ts. All load-bearing premises hold.
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — The only gate-like surface (MinTierPolicy/gateVerdict) ships with enforce:false as the hard default and is not wired into any real launch/merge script in this card's scope, so nothing can fire broadly yet.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Confirmed no existing plateau-app file imports or defines compareTier/gateVerdict/MinTierPolicy/PROOF_TIERS, so this is genuinely additive with the single named future consumer (#2555) correctly deferred rather than hidden.
- **interface** (NOT addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — Done-when #3 requires a 'record a second proof, keep the stronger tier, report the disagreement' behavior, but the Design section's code block pins signatures only for compareTier and gateVerdict — no function signature is given for recording/upserting a proof against the no-silent-downgrade rule, leaving the seam future producers (#2562) and the review modal (#2555) will call unspecified.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — enforce:false is an honest, tested no-op (Done-when #2 requires the verdict to still report ok:true, enforced:false while populating below/unproven) rather than a guard dressed up as real protection.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Done-when #4 requires construction-time rejection of a proof with no evidenceHref, and #2/#3 require unproven/disagreement to be reported in the return value rather than silently absorbed.

**Corrections recommended:**

- none — the preparation held up as written.

The provenance-tier spine's design is well-grounded in the live repo (ratified #2561 schema, open #2555 surface, no pre-existing proof-tiers module or confidence field to conflict with), but it under-specifies the one function its own acceptance criteria most depend on and over-scopes a CSS file its own design text says shouldn't be built yet.

_Recorded through the declared `review-prep` operation._

**Applied by the lane, 2026-08-21.** The finding is correct: `## Done when` item 3 depended on a
record/upsert behaviour that no signature in the Design pinned, leaving the seam #2562's producers and
#2555's modal will call unspecified. The Design now carries a full `recordProof` signature with all five
outcomes (`recorded` / `upgraded` / `refreshed` / `disagreement` / `invalid`), pure and returning a new set,
and items 3-4 are rewritten to assert against it. The juror's second observation — that
`plateau-app:src/backlog-view/proof-tiers.css` is over-scoped relative to the Design text — is answered by
correcting the DESIGN rather than the scope: this item does ship the badge and its styles (the digest asks for
the tier to be rendered at its true trust rung); what it does not ship is a host surface, which is #2555's.
That is now stated explicitly. No finding was judged wrong.

