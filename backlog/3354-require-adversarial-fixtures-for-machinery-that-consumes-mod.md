---
bornAs: xuhxkqz
kind: decision
status: open
scaffoldedBy: "prepare-fixture-statute-lane-24-b65dbaef"
dateScaffolded: "2026-08-26"
dateOpened: "2026-08-26"
preparedDate: "2026-08-26"
relatedReport: reports/2026-08-26-adversarial-fixtures-model-output-consumers.md
relatedTo: ["3351", "3352", "2877", "2697"]
tags:
  - testing
  - adversarial-fixtures
  - model-output
  - trust-boundary
  - governance
  - decision-prep
---

# Require adversarial fixtures for machinery that consumes model output

## Digest

PR #1607 (landed as [#3351](/backlog/3351-validate-a-juror-s-cited-file-against-the-net-diff-and-cover/))
added 25 adversarial fixtures to the review pipeline and **six found real defects**. **Not one was a parse
failure.** Every input was structurally valid JSON, so conventional malformed-input testing would have caught
none of them — and, decisively, **none of the six had a bug report, a fix in flight, or a diff that would have
triggered any existing rule.** They were latent, and a pre-emptive fixture set is what surfaced them.

**This is a ratify, not a weigh — and that is the finding, not a shortcut.** Prep opened with three candidate
forks and, grounded in a prior-art survey published as
[/research/adversarial-fixtures-model-output-consumers/](/research/adversarial-fixtures-model-output-consumers/)
(session report linked via `relatedReport`), **all three dissolved** under the fork-existence test, the prep
skeptic and the fresh-context two-confusion screen. What is left is **two forced invariants** — each with a
named broken branch and no coherent rival — plus **one codification amendment**, with the whole enforcement
mechanism carved to a prepared child. The dissolutions, and the attacks that caused them, are recorded in
full under *How the three candidate forks dissolved*; nothing was quietly dropped.

**The rule is codified as an amendment to an existing anchor, never a new one.** A new anchor would have
duplicated
[#agent-convergence-independent-validation](/docs/agent/platform-decisions.md#agent-convergence-independent-validation)
clause 2, which the first draft of this item under-quoted in its own overlap table.

## What happened, in one table

| # | Defect | Input was | Caught by a JSON-schema check? |
|---|---|---|---|
| 1 | A juror cited a file not in the diff; the verdict acted on it and bounced the PR for a round | valid | **No** — `file` is a string |
| 2 | `line: 0`, `-12` and `3.7` passed a `Number.isFinite` check and rendered into the posted comment | valid | **No** — `line` is a number |
| 3 | `normalizeFindings` coerced a non-array to `[]`, so a juror that narrated its blockers in prose recorded an **accept** — "I would not merge this" sat unread in the summary | valid | **No** — prose is a string |
| 4 | Same coercion for an object-valued `findings` | valid | **No** — an object is an object |
| 5 | A forged `citationScope` would have let a juror withhold its own finding | valid | **No** — a valid enum member |
| 6 | An off-scope downgrade was undone one gate later by `prevention-outstanding` | valid | **No** — no field was wrong at all |

A criterion that reduces to *"test malformed input"* has missed the class. The rule binds on **semantic**
wrongness.

## What you are ratifying — two forced invariants

### Ratify 1 — the class is the trust boundary, never the failure shape

**Code that acts on a value that came from a model is in the model-consuming class, wherever it lives.** The
excluded branch is the failure-shape framing (*"anything whose failure mode is silent rather than loud"*), and
it is excluded because it is **undecidable from a diff**: deciding whether a coercion is silent requires
reasoning about every downstream consumer, and this repo's own criterion ladder already refuses a bar nobody
can check cheaply (`we:docs/agent/backlog-workflow.md:263` — *"anything vaguer … not a criterion. Rewrite it
or drop it"*). There is no coherent rival to weigh.

**One qualification, stated rather than buried, because the first draft got it wrong.** The trust-boundary
predicate is **not** reliably decidable from a single file, and the first draft claimed otherwise and was
wrong on 3 of its own 9 cited examples: `we:scripts/lib/jury-ledger.mjs:252` and
`we:scripts/lib/verdict-ledger.mjs:430` parse **our own JSONL ledger**, and
`we:scripts/conveyor/tick-core.mjs:932` parses **orchestrator bookkeeping from stdin** — none is model output.
Worse, the two files that motivate the rule are the undecidable ones:
`we:scripts/review-core-cli.mjs:178` destructures `findings` from `input || {}` read from `--file`/stdin, so
whether that JSON came from a model is a property of the **caller**; and `we:scripts/lib/jury-core.mjs:444` is
an exported helper taking `@param {*}`. So the statute states the **class**; the *gate* works from a
**declared** set. Those live at different layers and compose — see the delegated child.

### Ratify 2 — the obligation binds on the consumer EXISTING, not only on a fix

**A module in the class carries a standing adversarial fixture set.** The excluded branch is the on-change
trigger — which is not a rival design but **the rule already in force**:
[#agent-convergence-independent-validation](/docs/agent/platform-decisions.md#agent-convergence-independent-validation)
clause 2 requires *"a test that fails on pre-change behavior for logic fixes"*, scoped to *"any
AI-review/convergence surface in the constellation"*. It is excluded because it is **structurally blind to a
latent defect**, and that is not hypothetical: it is all six above, **plus two still live today** —
`we:scripts/lib/jury-core.mjs:480`, where `admitsCitation` fails **open** on an unknown scope value, and the
array refusal at `we:scripts/operations/review-pr.mjs:884` which is absent from
`we:scripts/operations/review-prep.mjs:465`, `we:scripts/operations/explore.mjs:674` and
`we:scripts/review-core-cli.mjs:178,273`. Clause 2 fires on a fix; none of the eight had one. Choosing the
on-change trigger is choosing the rule that was in force while all eight accumulated.

**What qualifies a fixture is the same bar clause 2 already sets, restated for the standing case.** A
standing fixture has no "pre-change behaviour" to fail on, because the guard already exists. So: **a fixture
counts iff there is a named line of guard code whose removal makes it fail** — the `killed` outcome of the
shipped `we:scripts/operations/mutation-check.mjs`, whose three-valued result already closes the obvious
gaming case (a find-pattern that matched nothing reports `unrun`, never `killed`, because that *"would
certify a guard as sound on the strength of a test run that examined the unmodified code"*).

## Supported by default (not decisions)

- **Statute prose · a `check:standards` rule · a shared fixture harness compose; they are not rival
  branches.** The composability probe succeeds outright, and the repo has already shipped all three together
  once: `we:scripts/lib/operation-io-fidelity.mjs` *is* a `check:standards` rule (registered at
  `we:scripts/check-standards.mjs:2270-2274`) codifying statute prose
  (`we:docs/agent/backlog-workflow.md:298-306`) whose satisfying proof is a **static named import of a shared
  harness** (`we:scripts/operations/__tests__/helpers/real-repo.mjs`). Prose is what the check codifies; the
  harness is what the check requires an import of.
- **The five failure kinds are not part of the rule.** Hallucinated reference · silently-coerced shape ·
  summary-vs-detail contradiction · volume · cross-seat disagreement live in the `/research/` topic as a
  prompt for an author. A taxonomy check would admit a fixture that carries the right tag while asserting
  nothing — a correctness hole in the criterion, which is why it is not the criterion.
- **Rollout and run location are already governed.**
  [#gate-rollout-ratchet](/docs/agent/platform-decisions.md#gate-rollout-ratchet) (warn → enforce) and
  [#gate-on-merged-tree-lane-fast-fail](/docs/agent/platform-decisions.md#gate-on-merged-tree-lane-fast-fail)
  (where the authoritative run happens), both cited as supporting context rather than authority.
- **Cross-repo reach is settled *against* extension.**
  [#repo-drain-check-contract](/docs/agent/platform-decisions.md#repo-drain-check-contract) states that
  *"how a repo turns that check green … is repo-private impl, invisible across the repo↔drain boundary"* and
  that *"what WE ratifies is the contract, never a particular job shape."* An earlier draft cited it to
  authorize WE binding a sibling repo's **test content** — the exact thing it forbids. Struck. **This rule
  binds Web Everything's own machinery only.**

## Delegated — the enforcement mechanism

**→ delegated to [#3355](/backlog/3355-gate-the-declared-model-consumer-set-on-standing-adversarial/)
(prepared, `blockedBy` this decision).** *How* the gate identifies members — declared markers plus an
import-graph widener from the single model-entry seam, a two-exit ratchet, the shared fixture module, the
registration shape — is an implementation choice with **no statute output**, and the fresh-context screen
flagged it as such (below). It is not a fork to put in front of a human; it is a build with a recommended
approach, evidence, a scope and executable criteria, which that card carries.

---

## How the three candidate forks dissolved

Prep began with three candidate forks. **All three dissolved**, each for a different documented reason. This
section is the audit trail the decision turn reads instead of re-deriving it.

### Candidate 1 — "what defines the bound class?" → dissolved to **Ratify 1** (forced invariant)

The three candidate branches were *any model-output consumer* · *any declared operation* · *anything whose
failure mode is silent*. The third is broken (undecidable from a diff). The first two do **not** conflict:
one is what the statute says, the other is what the gate can see, and the item's own design puts them at
different layers — which is a composition, so the fork-existence test fails. What remains is one branch with
no coherent rival: a **ratify**, per
`we:docs/agent/backlog-workflow.md:495` (*"forced invariants are stated as a one-line ratify; only genuine
either/or choices get a `## Fork N`"*).

`Skeptic:` **REFUTED as a fork → restated as Ratify 1.** The skeptic showed the composability probe
*succeeds* (the item performed the composition itself), that the failure-shape branch was a straw man nobody
proposed, and — the real damage — that the default's own decidability claim was **empirically false**,
verifying 3 of the 9 cited class members are not model output at all and that the two motivating files are
decidable only by whole-system reasoning. Folded in: the decidability claim is retracted in the ratify text
above, with the three mis-cited files named.

`Screen:` **n/a — dissolved before the second screen; the first screen's `clear` on the earlier framing is
superseded by the skeptic's refutation, which is the stronger finding.**

### Candidate 2 — "where is it enforced?" → dissolved to **support-both**, then to the delegated child

Statute prose · a `check:standards` rule · a shared harness compose (above), so that framing was never a
fork. The residue — *is membership declared or detected?* — was authored as a fork, defaulted to **detected**
on the strength of the lane-lease lesson, then **refuted**, then **flagged**, and is now delegated.

`Skeptic:` **REFUTED → default flipped from *detected* to *declared*.** Run against the tree, both proposed
detector arms miss `we:scripts/review-core-cli.mjs` and `we:scripts/lib/jury-core.mjs` — the two files the
rule exists for — while false-positiving on `we:scripts/operations/step-kinds.mjs`, whose header (`:32`)
declares it a pure leaf. The skeptic also surfaced `we:scripts/lib/operation-io-fidelity.mjs:320-327`, where
this repo already recorded that a source scan for a semantic property *"gets it wrong in both directions (it
did, three times)"* — so the module the first draft cited as the precedent **for** detection in fact resolves
the question toward declaration. And it found a **trap door**: the io-fidelity ratchet has one exit (gain a
test, `:335`), so a module listed in error can never leave, because it has no guard and therefore no possible
fixture. All three findings are carried into the child's recommended approach, including the second
`not-a-model-consumer` exit.

`Screen:` **flagged(impl) → dissolved to a build.** The fresh screen found that once the import-graph widener
is attached, both branches aim at the same target set, so the whole remaining argument is technique accuracy
inside `we:scripts/check-standards.mjs` — a call with no statute output, which the item's own text conceded
by keeping the mechanism out of the anchor. Fix applied: carved to
[#3355](/backlog/3355-gate-the-declared-model-consumer-set-on-standing-adversarial/) with the
recommendation and evidence attached, and removed from the human's desk.

### Candidate 3 — "what must the fixtures contain?" → dissolved to **precedent**, and its residue became Ratify 2

Authored as *named minimum set vs. discrimination vs. author's judgement*. Judgement is unfalsifiable, so not
a criterion; and the choice between the other two turned out to be **already ratified**.

`Skeptic:` **REFUTED — settled by precedent, and the paragraph doing the deciding was a cost argument.**
`#agent-convergence-independent-validation` clause 2 already requires *"a test that fails on pre-change
behavior for logic fixes"*, and the item's own overlap table had quoted that anchor **without clause 2**,
which is how it reached "no collision". The skeptic also caught the bolded paragraph *"this branch is also
the cheap one … 25 fixtures took a full agent session"* choosing the binding unit **on cost** — forbidden
outright by the not-a-prioritization rule. That paragraph is **struck in full**. What survived the attack is
the residue it had been settling in prose: clause 2 fires on a **fix**, and none of the eight defects had
one — which is now **Ratify 2**, decided on the latent-defect evidence rather than on effort.

`Screen:` **flagged(prio) on the interim fork → dissolved to Ratify 2.** The screen found the on-change
branch had no non-cost upside ("fewer fixtures owed" is effort) and an unmitigated downside, so no decider is
choosing between two defensible end-states. Fix applied: restated as a forced-invariant ratify, with the
ratchet's **pace** handed to the child as ordinary build ordering rather than dressed as a branch.

---

## Statute-overlap check

`we:docs/agent/platform-decisions.md` was grepped for same-subject anchors. The first draft proposed a **new**
anchor and claimed no collision. **The prep skeptic found one, and it is real.**

**Resolution — codify as an amendment, not a new anchor.** On resolve, `codifiedIn:` points at
`#agent-convergence-independent-validation`, whose clause 2 gains one sentence:

> Where the code under review **acts on a value that came from a model**, the same requirement binds on the
> consumer's **existence**, not only on a fix: such a module carries a standing adversarial fixture set, and
> a fixture counts only if a named line of guard code, removed, makes it fail. Structural validity is not the
> untrusted part — meaning is; schema validation and constrained decoding do not discharge this.

That sentence states the rule and nothing else, per
[#statute-anchor-states-rule-not-status](/docs/agent/platform-decisions.md#statute-anchor-states-rule-not-status)
(#2854) — the ratchet, the widener, the allowlist and the rollout are **not** in it. The first draft's
230-word anchor carrying allowlist mechanics and error-kind names violated that ruling, and the prep skeptic
and the fresh screen flagged it independently. A **second qualifier beside the #3264 tier-1 note in
`we:docs/agent/backlog-workflow.md`** carries the author-facing form, which is where the #3264 qualifier
itself lives.

Three further anchors sit adjacent and are reconciled:

| Adjacent anchor | Its test | Relationship |
|---|---|---|
| [#gate-rollout-ratchet](/docs/agent/platform-decisions.md#gate-rollout-ratchet) | How a per-route/per-target quality gate rolls warn → enforce | **Supporting context, not authority.** Its reference case is a derived route set that measures green; the enforced set here is a declared set, so the flip trigger transfers only by analogy. |
| [#detection-claim-matches-evidence-tier](/docs/agent/platform-decisions.md#detection-claim-matches-evidence-tier) | How strongly a tool may *phrase* a claim given its evidence | No collision — that governs a tool's **output**, this governs a tool's **input**. |
| [#build-lane-self-review-non-zero-floor](/docs/agent/platform-decisions.md#build-lane-self-review-non-zero-floor) | Every build gets ≥1 adversarial self-review pass | No collision — adversarial **review of a diff by an agent** vs adversarial **fixtures in a suite**. |

**Citation-scope downgrades made after the skeptic's pass** — each was cited as *authority* in the first
draft and does not reach this case:

- **[#repo-drain-check-contract](/docs/agent/platform-decisions.md#repo-drain-check-contract) — struck
  entirely.** It states a repo's test *content* is repo-private and that WE ratifies the contract, *"never a
  particular job shape."* It was cited to authorize the opposite.
- **The #3264 tier-1 qualifier — downgraded to analogy.** Its own text scopes it to *"a shell-out or a
  filesystem effect"*, remedied by *"a real repo, a real directory tree, a real process"*, and calls itself
  *"deliberately narrow."* Model output is neither, and the remedy here is a **fake** model. Its blunt-test
  wording is borrowed as an idiom, not leaned on as authority.
- **[#3352](/backlog/3352-the-lane-lease-is-advisory-so-one-non-participating-consumer/) — downgraded to
  illustration.** It is an open, unratified story that names two candidate fixes without picking one, and its
  force comes from a shared commons with no analogue here: an undeclared model consumer is merely itself
  untested; it voids nothing for anyone else.

## Does this rule belong in this repo at all?

**Yes — as agent-machinery governance, not as a Web Everything standard.** Rule 6 (WE holds zero
implementation) governs the *runtime implementation of WE standards* — blocks, plugs, intents — which lives
in Frontier UI. The subject here is this repo's **own delivery machinery**, which already carries a dozen
anchors in `we:docs/agent/platform-decisions.md` (the drain, the jury, converge, the agent runner,
`#operations-declared-once-callers-generated`). There is no consumer-visible contract, no intent, no protocol
and nothing an independent implementer conforms to, so it is not a WE-side standard with an FUI-side
obligation either. The prep skeptic attacked the placement directly and the fresh screen tested it
independently; both reached the same conclusion.

**But the first draft picked the wrong home *inside* the repo, and that is fixed above.** Test-qualification
is owned by the determinism ladder in `we:docs/agent/backlog-workflow.md` (#2949 / #3264) and the enforcement
clause by `#agent-convergence-independent-validation`. A brand-new anchor would have sat beside two ratified
rules saying overlapping things.

---

## Context

**Where the fixtures live today.** Inline in `we:scripts/operations/__tests__/review-pr.test.mjs:1645-2041` —
a module-local `FAKE_JURORS` frozen object with 11 named entries (`:1676-1732`) and a local `driveFixture`
helper (`:1738`), none of it exported. `we:scripts/lib/__tests__/fixtures/` holds one unrelated text file.
There is no shared adversarial-juror fixture module anywhere. The nearest thing is
`we:scripts/operations/__tests__/helpers/fake-claude.mjs` (`withFakeClaude` at `:134`), whose header (`:28-29`)
already names this gap and leaves the hook: *"The quality of what an agent produces is a different test and a
different budget — this is the harness that makes that test a swap of one binding rather than a new build."*

**The existing fidelity gate's exemption is the same hole from the other side.**
`we:scripts/lib/operation-io-fidelity.mjs:135` permanently exempts `'review-pr'` and `'review-prep'` with the
reason on the line: *"declares a `judge` step: the real mechanism needs a model, not a repo."* That is a true
statement about what a real-repo harness can prove, and it names the half a fake model can.

**Adjacent open work, deliberately not folded in.**
[#2877](/backlog/2877-probe-runner-and-commit-the-probe-as-test-adversarial-reprod/) builds a probe-runner
that executes adversarial inputs against a built head and commits reproducing probes as permanent tests — a
natural downstream consumer of a shared fixture library, but it decides nothing about the class or the
trigger. [#2697](/backlog/2697-built-in-adversarial-red-team-of-the-tool-s-own-proposals/) sharpens what the
jury's red-team *hunts for*; this rule is about what a test suite *contains*.

**[#1646](/backlog/1646-scenario-and-fixture-library-that-doubles-as-e2e-fixtures/) does not overlap —
checked, not assumed.** It is a `locus: plateau-app` dev-browser feature: record a running app's declared
state plus its action trace as a named scenario that doubles as an E2E fixture. Its subject is a *WE
application under test*; this rule's subject is the *agent machinery that reads model answers*. Different
locus, different artifact, no shared mechanism. Neither a duplicate nor a prerequisite.

## Done when

The ruling and its enforcement travel in **two PRs**, per
[#principle-and-impl-two-pr](/docs/agent/platform-decisions.md#principle-and-impl-two-pr): a statute-anchor
edit is a principle surface, so it is human-gated and carries **no** enforcement code, and the impl PR may
only cite an anchor already `status: resolved` on `main`.

1. **Observable (this decision's PR)** — `#agent-convergence-independent-validation` carries the
   model-consumer clause, a second qualifier sits beside the #3264 note in
   `we:docs/agent/backlog-workflow.md`, and this item carries `codifiedIn:` pointing at the anchor. No
   `we:scripts/` file is touched by that PR.
2. **Observable (this decision's PR)** —
   [#3355](/backlog/3355-gate-the-declared-model-consumer-set-on-standing-adversarial/) is unblocked
   (its `blockedBy` on this item clears) and carries the mechanism, its scope and its own executable
   criteria.
3. **Not tier-1, and why** — which invariant the human ratifies is design judgment with no executable form.
   The enforcement that *is* executable lives on the delegated child, which carries three tier-1 criteria of
   its own. Criteria 1–2 prove the ruling was carried out, never that it was right.

### Review jury (provisional — pre-registered #2638)

Care level: `high` (the ruling edits statute). This jury binds against the predicted touch-set and is
re-checked against the real diff at PR open. Per the two-PR rule the touch-set is **split**: this decision's
PR touches `we:docs/agent/platform-decisions.md` and `we:docs/agent/backlog-workflow.md` only; the mechanism's
touch-set (`we:scripts/lib/`, `we:scripts/check-standards.mjs`,
`we:scripts/operations/__tests__/helpers/`) sits on
[#3355](/backlog/3355-gate-the-declared-model-consumer-set-on-standing-adversarial/) as its `scope:`.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| correctness#2 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| security#2 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| simplicity#2 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| standards-conformance#2 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |
| claim-accuracy#2 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |
