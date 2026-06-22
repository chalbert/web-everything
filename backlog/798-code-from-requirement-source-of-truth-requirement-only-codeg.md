---
kind: decision
size: 2
parent: "099"
status: parked
parkedReason: deferred
preparedDate: "2026-06-22"
dateOpened: "2026-06-16"
tags: [requirement-as-code, code-generation, ai, evergreen, vision]
crossRef: { url: /backlog/100-requirement-as-code/, label: "Requirement-as-code (#100)" }
relatedProject: webcases
---

# Code-from-requirement source-of-truth — requirement-only (codegen) vs AI-proposes/dev-validates

Capability 3 of requirement-as-code (#100), de-buried from its body: what **source-of-truth model** does
code-from-requirement target?

## Grounding digest

- **Placement is settled, not in scope** — the AI code-proposer is a Plateau-served swappable provider the
  tool consumes as a [no-leakage client](docs/agent/platform-decisions.md#no-leakage-client) (#475); only
  the requirement meta-schema (#100 slice A) and the webcases it compiles to
  ([#797](/backlog/797-requirement-to-webcase-compiler-deterministic-1-n-projection/)) are WE-resident.
- **The governing philosophy is ratified** — *AI is a dev-time layer over a **codified contract**; the
  disposable-artifact pattern (wandb/openui) is the anti-pattern*, and WE's stated moat is **"AI proposes,
  the standard verifies."** The codified contract here is the requirement meta-schema (#100) + the webcase
  conformance gate (#797).
- **The vision this serves** is the evergreen app (#099): *no hand-written code to drift* — the requirement
  is the single source of truth.
- No new `/research/` topic — this ratifies an end-state against already-ruled philosophy (#099/#100/#475)
  and the #797 verifier, a prior-art-settled call.

## Axis framing — which SoT model is the *end-state*

The fork is *which source-of-truth model is the end-state*, and the evergreen vision pins it: (a)
requirement-only keeps the **requirement** as the single source of truth (codegen *from* the meta-schema —
the contract IS the truth, the purest form of "AI over a codified contract", not the disposable-artifact
anti-pattern); (b) AI-proposes/dev-validates lets a developer **edit the generated code**, which makes that
edited code a *second* source of truth that drifts from the requirement — the exact failure mode #099
exists to eliminate. So (b) cannot be the *end-state* without negating the capability's reason to exist; it
is coherent only as a **bootstrap phase** while the generator + the #797 verifier mature. The remaining real
question is therefore not "a or b" but *the cutover gate and the bootstrap discipline* that keep the
requirement authoritative at every phase.

## Recommended path at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| **Fork 1** — end-state source-of-truth model | **(a) requirement-only as the end-state**, reached *via* (b) as a gated bootstrap phase (cutover gated on measured #797 conformance coverage; under (b), dev edits feed back as requirement/webcase amendments, never persisted hand-written code) | (b) AI-proposes/dev-validates *as the permanent end-state* — excluded: it manufactures a second, drift-prone source of truth, negating the #099 evergreen vision | **med-high** — end-state is clear from #099; the gate threshold is the empirical unknown |

## Fork 1 — source of truth for generated code (end-state)

**Fork-existence justification:** forced invariant on the *end-state* — branch (b)-as-permanent is the
*flawed/excluded* branch: the moment a developer's edit persists as hand-written code, requirement ≠ code
and the next regeneration either clobbers the edit or is blocked by it, re-introducing exactly the drift
the evergreen vision (#099) is built to kill. (a) and a *permanent* (b) are mutually-exclusive end-states;
(b) survives only as a transitional phase, so this is a **ratify (a)** with a sequencing discipline, not an
open a/b weigh.

**Crux:** "AI proposes, the standard verifies" only delivers the no-drift evergreen vision if the
*requirement* stays authoritative. A persisted human edit breaks that; a regenerated artifact gated by a
strong #797 verifier preserves it.

**Options:**

- **(a) Requirement-only — the requirement is the single source of truth; code is generated from it.**
  *(recommended end-state)* The strongest form of the evergreen vision (no hand-written code to drift) and
  the purest expression of "AI over a codified contract" — the requirement meta-schema (#100) IS the
  contract, so codegen-from-it is *not* the disposable-artifact anti-pattern. Its one risk — "a wrong
  generation ships silently" — is exactly what the #797 requirement→webcase conformance gate catches; (a)'s
  viability rises with the verifier's coverage, and disbelieving the verifier here would contradict the
  very moat WE invests in.
- **(b) AI-proposes / dev-validates — the AI proposes a code change a developer validates/edits.**
  *Ratified only as the **bootstrap phase**, not the end-state.* Lower-risk while the generator + verifier
  are immature; #100's body flagged it as the more-likely *near-term* shape. **Two binding constraints:**
  (1) the cutover to (a) is gated on a **measured #797 conformance-coverage threshold** for the
  requirement's generation class — not a calendar date; (2) under (b), a developer's edits are captured as
  **amendments to the requirement (or its webcases)**, never persisted as free hand-written code — so the
  requirement stays the single source of truth in every phase. As a *permanent* model it is **Rejected**
  (drift, per the fork-existence justification).

**Recommended default: (a) requirement-only as the end-state, via the gated (b) bootstrap above.**

**Skeptic:** SURVIVES-WITH-AMENDMENT (default **flipped** from the original "(b)") → the original card
defaulted to (b), but the skeptic showed that answers a *sequencing* question with an *end-state* verdict
(R1) and re-introduces the drift #099 exists to kill (R4); it also mis-applied the "AI-over-contract"
principle to reject (a), when (a) — codegen from the requirement *contract* — is that principle's purest
form (R2); and (b)'s "wrong generation ships silently" risk assumes a weak #797 verifier WE is separately
building to be strong (R3). **Amendment folded in (now the default):** the end-state SoT is **(a)
requirement-only**; (b) is ratified **only as the bootstrap phase** with the two binding constraints above
(cutover gated on measured #797 coverage; dev edits captured as requirement amendments, never persisted
code). Without that reframe the as-written "(b)-as-end-state" default is **refuted**.

## Parked — when this is ratified

Parked `deferred`: code-from-requirement is the furthest, hardest capability of the evergreen-app vision
(#099), gated on the Plateau-served codegen capability existing. Deferral governs *when* we ratify, not
*whether* the fork is tracked — the fork is at DoR now (prepared, end-state ruled). **Un-park** when the
Plateau-served codegen capability is real and slice C (code-from-requirement) is picked up.
