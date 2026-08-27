---
kind: story
size: 5
parent: "3318"
status: open
dateOpened: "2026-08-27"
relatedReport: reports/2026-08-27-review-system-lever-catalogue.md
scope:
  - we:scripts/lib/jury-core.mjs
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/review-core-cli.mjs
  - we:scripts/lib/review-policy.contract.json
tags: [review, jury, governance, configuration]
---

# Three review-gate constants escaped the policy contract, and the contract's gate is bypassable at runtime

A full enumeration of the review system's tunable values — **222 constants and parameters**, rolled into
**65 axes** — found two defects in the repo's ratified `#contract-split-for-tier-ownership` boundary. This
card fixes them. The catalogue that found them is published as
[`/research/review-system-lever-catalogue/`](/research/review-system-lever-catalogue/).

## Digest

**This card was prepared as a decision and is filed as a story. The decision framing did not survive its own
skeptic pass, and that outcome is reported rather than dressed up** — see *What was attempted and what it
cost*.

Two concrete defects, both in the same ratified boundary:

1. **Three constants that decide gate behaviour live outside the policy contract.**
   `PREVENTION_IMPACT_BAR`, `MANDATORY_LENSES` membership, and `EVIDENCE_FLOOR` sit in
   `we:scripts/lib/jury-core.mjs`, which appears nowhere in the trust-chain roster. An agent can weaken them
   and clear its own edit — the #809-class self-approval hole
   [`#contract-split-for-tier-ownership`](/backlog/2625/) exists to close.
2. **The contract's human gate protects the *default*, not the value used.** `scoreEscalation` merges a
   caller-supplied `thresholds` object over the human-gated contract value, and `we:scripts/review-core-cli.mjs`
   accepts `mandatoryLenses` straight from caller JSON. **This is a hole in the ratified pattern itself, not
   only in this instance** — every contract-split gate inherits it wherever the impl exposes the value as a
   defaulted parameter.

Defect 2 is the more consequential of the two and nobody had named it.

## Defect 1 — three constants escaped the contract

Verified with the repo's own predicates (`isPolicySpecPath` / `isPolicyDerivationPath`,
`we:scripts/lib/gate-config.mjs`):

| home | policy tier | clearance on edit |
| --- | --- | --- |
| `we:scripts/lib/review-policy.contract.json` | spec (`leash: 'spec'`) | **human** (`gate-self`) |
| `we:scripts/lib/review-escalation.mjs` | derivation (`leash: 'code'`) | agent (`gate-derivation`) |
| `we:scripts/lib/jury-core.mjs` | **none** | agent (generic `blast-radius` only) |

**The escaped set is exactly three, and an earlier draft of this card overstated it.**

> **Retracted.** This card first claimed that `PREVENTION_IMPACT_BAR`, `MANDATORY_LENSES`, `EVIDENCE_FLOOR`
> **and every round cap** were ungated because `we:scripts/lib/jury-core.mjs` carries no policy tier. The path
> classification is right; the *effect* claim was wrong for the round caps. The care→jury conformance suite
> imports `panelRigorForCareLevel` and `PANEL_LENSES` and pins each band's `lenses`, `jurorsPerLens` and
> `roundCap === rounds` (`we:scripts/lib/__tests__/review-policy.conformance.test.mjs:56` and `:628`) — and
> that suite is itself `leash: 'spec'`, so weakening `NEGOTIATION_ROUND_CAP` below a band value reddens it and
> forces a human. The backstop is indirect but real. **Reasoning from the path roster alone, without checking
> what the conformance suite pins, is exactly the overclaim [#3362](/backlog/3362/) names** — recorded here
> because a card in this cluster that ships an uncorrected completeness claim is the failure the parent
> programme was opened to catch.

**Why the three genuinely escape.** The suite pins band `lenses ⊆ PANEL_LENSES`, and
`PANEL_LENSES = [...MANDATORY_LENSES, ...ADVISORY_LENSES]` — so moving `security` from the mandatory list to
the advisory list leaves `PANEL_LENSES` byte-identical and the suite green, while removing the security
lens's power to block. `PREVENTION_IMPACT_BAR` and `EVIDENCE_FLOOR` appear in no pin at all.

**The fix is patterned, not novel.** `#contract-split-for-tier-ownership` already rules this class: keep the
impl in the engine tier, move the **definition** into a policy-tier `*.contract.json` with a conformance suite
proving the impl realizes it. Its own "How to apply" clause says this should resolve fast as a patterned
micro-decision. That is why this card carries no forks.

## Defect 2 — the gate protects the default, not the value used

`we:scripts/lib/review-escalation.mjs:585` and `:589` merge caller-supplied thresholds over the contract:

```js
// Today — the contract value is a DEFAULT a caller silently outranks.
export function scoreEscalation({ thresholds = {}, /* … */ } = {}) {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };   // DEFAULT_THRESHOLDS === the contract's values
  // … size escalates at t.diffLines
}
```

So `thresholds.diffLines` is human-gated *where it is written* and freely overridable *where it is read*. The
same shape holds for `bar` (`PREVENTION_IMPACT_BAR`), `floor` (`EVIDENCE_FLOOR`), `roundCap` and
`mandatoryLenses` — each is a module constant **and** a defaulted parameter — and `we:scripts/review-core-cli.mjs:183`
takes `mandatoryLenses` from caller JSON, with `derivePanelVerdict` validating only that it is non-empty
(`we:scripts/lib/jury-core.mjs:1353`, `:1358`). A reduce payload naming `["simplicity"]` therefore yields a
structurally valid panel verdict in which the security lens no longer blocks.

**This is a finding about the ratified pattern, not about this instance.** `#contract-split-for-tier-ownership`
reasons that "a diff to the contract trips the policy-tier path test and forces `review:human`" — which is
true, and insufficient, wherever the engine also accepts the value as an argument. The fix is a guard at the
seam: a caller override of a **policy** field is refused, not merged.

```js
// The fix — a policy field has ONE home, and the engine enforces that at the boundary.
export function scoreEscalation({ thresholds = {}, /* … */ } = {}) {
  assertNoPolicyOverride(thresholds);  // throws, naming the field and the contract as its only home
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
}
```

## What was attempted and what it cost

**Reported because the brief required an honest verdict, and because a framing that changes nothing should be
reported as such.**

This work was commissioned as a decision: catalogue the review system's levers as an *axis space*, and rule a
test separating platform invariants from per-consumer settings. The catalogue was built and is published. The
**test and its three forks were refuted**, and the refutations were checked against the tree rather than
accepted on assertion:

- **The proposed test mis-classifies the ratified case one card away.** It offered four questions, the first
  of which admitted any lever "any consumer could coherently set differently" and allowed **only incoherence**
  as an exclusion. Run on [#3320](/backlog/3320/)'s refuse-at-*N* threshold, it returns *"a repo-scope
  consumer setting"*. #3320 ruled the opposite: *"It is not even a config dimension… **There is no value of it
  that is correct, so the knob is not built**."* The exclusion ground #3320 used — domain-misapplication of the
  underlying proxy — is neither cost nor incoherence, so the test has no output for it.
- **Two of the three forks were already settled by statute.** "Where does the blocking-lens list live" and
  "where do the care-derivation numbers live" are both *"which trust tier owns X"*, whose default path
  `#contract-split-for-tier-ownership` already fixes — and whose "How to apply" clause explicitly says this
  class should **not** run through a full prepare cycle. Convening them as forks re-ratified #2625.
- **The third fork was prioritization in fork costume.** "Does classifying a lever oblige homing it as data"
  decomposes into a YAGNI sequencing rule plus `#thin-container-graduation-trigger`.
- **[#3338](/backlog/3338/) had already done the scope analysis the framing claimed as its output**, in its
  own words and dated earlier: *"Per-surface variation in blocking power … would let one gate stop a PR that
  another gate clears on the identical finding, which is incoherence rather than configurability"*, and
  *"a `blockingAdvisoryLenses` contract entry would be its natural home."*

**One claim this card retracts outright.** An earlier draft argued that measured per-reviewer size effects
reconcile #3320 with [#3326](/backlog/3326/), and that *"neither card says this"*. Both halves are wrong.
#3326's opening line already states the reconciliation — *"A large diff earns more reviewers, never fewer
lines (#3320)"* — and #3326 explicitly **forbids** the remedy the argument implied: *"Truncating a juror's
diff to its shard would reintroduce exactly the blindness the fan-out exists to remove"*. The citation argued
for the thing the design rejects.

**Net:** the enumeration was worth the spend; the framing was not. Zero of the four open cards
(#3338, #3339, #3364, #3326) would be ruled differently for it. The survey stands as a research artifact and
the two defects above stand as work.

## What the catalogue records that is not work

Kept in the report, not filed as cards — inventory, not leverage:

- **Three seated-lens rosters, two values.** `PANEL_LENSES` (5), the parked-PR loop's `LENSES` (4), and
  `REVIEW_PANEL_LENSES` (4) at `we:scripts/lib/jury-ledger.mjs:170`, whose charter table holds only four
  entries — so a fifth juror would be seated with no charter.
- **Two independent impact bars** — `PREVENTION_IMPACT_BAR` (`broken`) and `EVIDENCE_EXEMPT_IMPACT_BAR`
  (`unrecoverable`), settable in opposite directions with nothing relating them.
- **Duplicate round-cap constants** — `NEGOTIATION_ROUND_CAP` and `DEFAULT_ROUND_CAP`, same file, same value,
  independent derivations, nothing pinning them equal, read by different reducers.
- **Divergent juror defaults** — effort `medium` in the engine against `high` in the review operation; budget
  `1.5` USD against `null`; a 20-minute timeout described in two comments as 10 minutes.
- **`REVIEW_JUROR_TOOLS` is never forwarded by `judgePanel`**, so a panel seat runs with no tools.
- **Levers with no home** — the ship bar for a candidate corpus gate (*"at least 80% recall of its class and
  zero false fires"*) exists only as prose and is unenforced.
- **Two axes with production evidence that are not modelled** — seat accountability (jurors are anonymous
  positions) and what occupies the first position of a diff (alphabetical, by accident). Both are recorded in
  the research topic with their measured effects **and their null results**, because the obvious
  implementation of the second has one.

Each of these is a candidate card for whoever wants it. **None is filed, and that is stated plainly rather
than as "tracked elsewhere"** — a deferral with no id is not a hand-off.

## Not in scope

- **Which lenses belong in the blocking set** — that is [#3338](/backlog/3338/), which is marked do-not-rule
  pending a severity-calibration preparation. This card does not touch its membership question, its fork, or
  its default.
- **Where card gates run and at what severity** — [#3364](/backlog/3364/) owns it, including its own *gate*
  severity call. Note for whoever writes the severity-calibration card: #3364's severity is **gate** severity;
  juror **finding** severity is a different subject and must say so.
- **Shard cutting and fan-out breadth** — [#3326](/backlog/3326/).
- **The evidence floor's value** — [#3312](/backlog/3312/) built the dial and ships it permissive, which is the
  correct shape; nothing here raises it.
- **Minting a new statute anchor.** The fix cites `#contract-split-for-tier-ownership`; it does not extend or
  reword it. If defect 2 warrants amending that anchor — because the pattern as ratified does not close the
  runtime seam — that is a separate `kind: decision`, and it is **not filed yet**.

## Done when

1. **Executable** — a test proves a caller cannot override a policy field:
   `npx vitest run we:scripts/lib/__tests__/review-policy.conformance.test.mjs` fails before the change (no
   such assertion) and passes after, asserting that `scoreEscalation` **refuses** a `thresholds.diffLines`
   override rather than merging it, and that `reduceReview` refuses a `mandatoryLenses` that is not the ruled
   set.
2. `PREVENTION_IMPACT_BAR`, `MANDATORY_LENSES` and `EVIDENCE_FLOOR` have their **values** in
   `we:scripts/lib/review-policy.contract.json`, imported by `we:scripts/lib/jury-core.mjs` rather than
   declared there, with the conformance suite pinning each to its live constant — the same bridge the care→jury
   bands already use.
3. The conformance suite pins `MANDATORY_LENSES` **membership** directly, not only via `PANEL_LENSES` — the
   partition is what the current pin misses.
4. `npm run check:standards` passes.
