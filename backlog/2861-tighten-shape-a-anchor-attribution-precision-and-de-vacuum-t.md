---
bornAs: x4n1gqj
kind: story
size: 2
parent: "2527"
status: resolved
dateOpened: "2026-08-02"
dateStarted: "2026-08-15"
dateResolved: "2026-08-15"
graduatedTo: none
scope:
  - we:scripts/lib/citation-check.mjs
  - we:scripts/__tests__/citation-check.test.mjs
tags: [citation-verification, check-standards, precision, ratify-gate]
---

# Tighten shape-A anchor-attribution precision and de-vacuum the {#anchor} negative test

Gate 10's shape-A matcher fires on any parenthesis that merely **opens** with `#NNN`, and its trailing
`[)\`'"]*` class lets the match step over the closing paren of the anchor's own group — so a number in a
**separate** paren is read as a ruling attribution. That is exactly the exemption shape B was hardened to
honor. Apply the same comma-adjacency requirement to shape A, and fix the one negative test that passes for
the wrong reason.

## Provenance

Filed from the independent `/review` of PR #974 (the CITATION-VERIFICATION gate, a proven subset of #2821).
The blocking multi-owner defect was fixed in that PR and the gate was accepted; this is the deferred
precision residue, which the fix push explicitly scoped out.

## The defect — reproduced, not theoretical

The regex in [we:scripts/lib/citation-check.mjs](scripts/lib/citation-check.mjs) is unchanged by the
multi-owner fix. Run against an owner map where `#foo-anchor` is owned by `#100`:

```
see [foo](#foo-anchor) (#9999 tracks the build slice).
```

fires a shape-`A` finding, even though `#9999` sits in its own parenthetical and attributes nothing. The
module header asserts the opposite ("A trailing PROSE paren … does not match (it does not open with
`#NNN`)"), so the documented precision contract does not hold.

The one live corpus instance —
`composes [monetization](#monetization) (#1590 — Fork 3 restricted *implements* it)` in
[we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md) — no longer produces a *false
positive*, because the multi-owner fix made `#1590` a legitimate owner of that anchor. That is coincidence,
not precision: with the owner map now correct, a separate-paren **non-owner** number is precisely the shape
that fires.

## The vacuous test

In [we:scripts/__tests__/citation-check.test.mjs](scripts/__tests__/citation-check.test.mjs), the case
"does NOT fire on the heading-definition form `{#anchor}`" cites `#2398`, which **is** the anchor's owner.
`record()` short-circuits on the owner check before the shape claim is ever exercised, so the test asserts
0 findings for a reason unrelated to the exclusion it claims to prove. Loosen the character class so
`{#anchor}` starts matching and this test stays green.

## Approach

- Require comma-adjacency between the anchor and the `#NNN` in **shape A**, as shape B already does — a
  number that opens a *different* parenthetical is not an attribution.
- Build the must-fire / must-NOT-fire fixtures as **one shared table** exercised through **both** shape
  phrasings, so a precision guard added to one branch can never silently skip the other.
- Every must-NOT-fire *shape* fixture cites a deliberately **wrong** number, so only the shape stage can
  produce the pass. A negative test for a two-stage predicate (shape match, then owner check) is vacuous
  whenever the second stage would also reject.

## Acceptance

- `see [foo](#foo-anchor) (#9999 …)` produces **no** finding; `(\`#foo-anchor\`, #9999)` still produces one.
- Every must-NOT-fire fixture runs through both shape A and shape B phrasings of the same sentence.
- The `{#anchor}` heading-definition fixture cites a non-owner number and still asserts 0 findings.
- A whole-corpus scan (backlog + docs/agent + reports + the two research dirs) stays at **0 false
  positives** — the bar the multi-owner fix reached.

## Blocks the ERROR promotion

`CITATION_GATES_ENFORCED` must not be flipped to `true` until this item and the historical-corpus triage are
both done — a latent shape-A over-fire becomes a hard `check:standards` error the moment the flag flips.
