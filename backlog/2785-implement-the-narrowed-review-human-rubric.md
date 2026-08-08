---
bornAs: xfpxbji
kind: story
size: 3
status: resolved
blockedBy: ["2771", "2844"]
relatedTo: ["2405", "2636"]
scope: ["we:scripts/lib/gate-config.mjs", "we:scripts/lib/review-escalation.mjs", "we:scripts/pr-land.mjs"]
dateOpened: "2026-07-28"
dateStarted: "2026-08-08"
dateResolved: "2026-08-08"
tags: [review, escalation, review-human, trust-chain, gate-self, statute, codification]
---

# Implement the narrowed review:human rubric

Build arm for the ratified decision **#2771** ([`#review-human-declarative-leash-only`](../docs/agent/platform-decisions.md#review-human-declarative-leash-only), adopt b + c). `blockedBy` #2771 — do not start until the ruling is landed. File-level scope; the ruling already fixed the wording, so this is a mechanical realization of two script-decidable rubric changes plus their tests.

## What ships

The escalation rubric today forces a HUMAN on one line — `humanRequired = gateSelfFiles.length > 0 || statuteFiles.length > 0` (`we:scripts/lib/review-escalation.mjs`). #2771 narrows **both** triggers. Two arms:

### Arm A — split the policy tier (Fork A / b)

- In **`we:scripts/lib/gate-config.mjs`**, split the current `POLICY_CORE_BASENAMES` roster into two frozen subsets:
  - **`POLICY_SPEC_BASENAMES`** — the *declarative leash*: `we:review-policy.contract.json` (the machine-diffable spec), `we:gate-config.mjs` (the roster/closure), `we:gate-invariants.test.mjs`, `we:review-policy.conformance.test.mjs`. Add `isPolicySpecPath(path)`.
  - **derivation CODE** — `we:review-escalation.mjs`, `we:review-core.mjs`, `we:review-policy.mjs`, the two land seams (`we:disposition-land-seam.mjs`, `we:auto-land-seam.mjs`). Stays on `isTrustChainPath` (still ESCALATES) but drops out of the human trigger.
- In **`we:scripts/lib/review-escalation.mjs`**, change `humanRequired` to fire on the declarative-leash subset only: `const humanBasisSpec = gateBasis.filter(isPolicySpecPath); const humanRequired = humanBasisSpec.length > 0 || statuteForcesHuman;`. Derivation-code touches now score `review:pending` (full committee), never `review:human`.

### Arm B — codify-shape exemption (Fork B / c)

- In **`we:scripts/pr-land.mjs`** (and the shared scorer it calls in `we:scripts/lib/review-escalation.mjs`), add `isCodificationOnly(diff)`: true when the PR **(i)** flips a `kind:decision` item from a non-resolved status to `status: resolved` with `codifiedIn:` set to a `we:platform-decisions.md#anchor` (or topical-doc anchor), AND **(ii)** the ONLY `we:platform-decisions.md` edit is the addition/extension of exactly that anchor. Then `statuteForcesHuman = statuteFiles.length > 0 && !isCodificationOnly(diff)`.
- A codify PR still ESCALATES to the committee (`review:pending`) — an independent panel checks the anchor faithfully records the resolved decision's ruling. It is NOT auto-merged and NOT human-gated. A `we:platform-decisions.md` diff with no accompanying resolve+`codifiedIn` (a NEW rule) stays `review:human`.

## Retained invariants (do not weaken)

- The final landed diff is signed off by an agent that did NOT author it (#2439); diversity-selection aggregation (strictest juror wins, never majority vote); non-convergence hard-escalates to `review:human`.
- Sticky-veto (#2309/#2365) and no-agent-clears-a-human-label (#2416) keep holding for whatever remains human-gated.
- Any change that alters the gate's *behaviour* must redden the #2566 conformance suite, forcing a contract (declarative-leash) diff, so a genuine policy shift still reaches a human. Green implies implementation implies committee.

## Acceptance

- Update `we:gate-invariants.test.mjs` / `we:review-policy.conformance.test.mjs`: derivation-code basenames escalate but do NOT set `humanRequired`; declarative-leash basenames DO; a synthesized resolve+codifiedIn diff scores `review:pending`; a raw new-rule statute diff scores `review:human`.
- `npm run check:standards` and the review-escalation suite green.
- Composes with, does not alter, [`#blast-radius-advisory-care-not-a-gate`](../docs/agent/platform-decisions.md#blast-radius-advisory-care-not-a-gate) and [`#contract-split-for-tier-ownership`](../docs/agent/platform-decisions.md#contract-split-for-tier-ownership). Authorizes and subsumes the two-file #2573 (which narrows `we:review-core.mjs` + `we:review-escalation.mjs`) — reconcile with it, don't double-build.
