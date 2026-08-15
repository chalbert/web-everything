---
bornAs: xn4b7xp
kind: decision
status: open
dateOpened: "2026-08-05"
preparedDate: "2026-08-15"
relatedReport: reports/2026-08-15-agent-behaviour-review-gate-tier-2937.md
tags: []
scope: ["we:scripts/lib/review-escalation.mjs", "we:scripts/lib/gate-config.mjs", "we:scripts/lib/review-policy.contract.json"]
---

# Should the agent-behaviour rules that govern landing and review sit at the statute tier, not plain blast-radius?

#2909 registered the two agent-behaviour trees (`we:skills-src/`, `we:agent-memory-src/`, and both `.claude/` spellings) as **blast-radius**, which makes them **agent-clearable**. But some of those files are the operative rules a *reviewing agent* is itself governed by — the land bar, the review procedure — so an agent clearing a diff that loosens them is policing its own leash. The gate's **code** half is protected against exactly this (`isGateSelfPath('we:scripts/lib/review-escalation.mjs')` is `true` → `review:human`); its **prose** half is not. This decision is whether the governing subset moves up a tier.

## The measurement

Verified at PR #1048's head:

```js
scoreEscalation({ changedFiles: ['agent-memory-src/land-on-no-regression-not-perfection.md'], diffLines: 30 })
// → { escalate: true, humanRequired: false, careLevel: 'elevated' }  ⇒ review:pending
```

`review:pending` is the **agent-clearable** park. A converged agent verdict clears it — including a verdict produced by an agent running under the very rule the diff edits.

## Why it is a real hole and not a hypothetical

`we:agent-memory-src/land-on-no-regression-not-perfection.md` is the rule that defines the land bar. PR #1045 narrowed its test 3 ("no weakened gate") and merged **during its own review**; the panel returned `changes` on both mandatory lenses after the merge. #2909 fixed the *silent* case (no label at all). It did **not** decide who may clear the label. #2909 states the tier question is left open, and #2909 resolves in PR #1048 — so without this item the question leaves the backlog entirely at merge.

## Fork 1 — which clearance tier the *governing* subset of the agent-behaviour trees sits at

**Fork-existence justification:** case (b), a real either/or — a path resolves to exactly one clearance
(`review:pending`, agent-clearable, or `review:human`), and each option below assigns it a different one. The
branches cannot coexist on the same file, so this is not "support both." (a) is additionally forced-invariant
flavored: PR #1045 is a demonstrated *live* failure of leaving the land-bar rule agent-clearable (an agent
narrowed its own test 3 and merged **during its own review**, with the panel returning `changes` on both
mandatory lenses *after* the merge) — it is the excluded/broken branch, not a live contender.

**What "governing" means, concretely — a discriminator, not a finished enumeration.** Not every file under
`we:skills-src/`/`we:agent-memory-src/` is governing; most are project notes or skills unrelated to
review/landing. The subset in scope is the files a **reviewing or landing agent's own procedure treats as an
operative rule it is currently executing** — the land bar, the escalation/clearance test, the review-verdict
procedure — as opposed to a historical record of a design call already executed, or a note about an unrelated
subsystem. Exemplars on each side of that line, each independently read (this session, standalone):

- **Governing (in scope):** `we:agent-memory-src/land-on-no-regression-not-perfection.md` — states the
  three-test land bar itself, and *already documents its own blind spot* at its own `:63-67`: "'policy-tier'
  is the path list in `BLAST_RADIUS`/`isGateSelfPath`/`isStatutePath`, not every file that steers agent
  behaviour. Check the list before citing the gate as protection" — this file already knows it isn't on that
  list. Also `we:agent-memory-src/complete-branch-before-labeling-ready-to-merge.md`,
  `we:agent-memory-src/drain-gated-build-review-resolve-loop.md`,
  `we:agent-memory-src/approve-verdict-sets-review-accepted-label.md`,
  `we:agent-memory-src/sweep-review-findings-to-closure.md`,
  `we:agent-memory-src/record-verdict-before-launching-converge.md`,
  `we:agent-memory-src/humangate-review-is-not-real-escalation.md`,
  `we:agent-memory-src/stop-hardening-an-unachievable-guarantee.md` — each states an operative rule about how
  landing/review/converging is conducted today. Plus the procedure a reviewing/landing/converging agent
  actually *executes*: `we:skills-src/review/SKILL.md`, `we:skills-src/drain/SKILL.md`,
  `we:skills-src/jury/SKILL.md`, `we:skills-src/converge/SKILL.md`, `we:skills-src/pr/SKILL.md`.
- **Not governing (excluded by the same test, confirmed by reading):**
  `we:agent-memory-src/producer-opens-pr-drain-reviews.md` reads as a **dated implementation memo**
  ("Agreed direction (user, 2026-07-02)... How to apply: file as backlog item... Do it AFTER batch X
  drains") describing an architecture change since executed — a historical record, not live doctrine a
  reviewing agent consults today; pinning it human-gated forever would block even a stale-link fix for no
  protective purpose. Also `we:skills-src/review-design/SKILL.md` (a design-critique procedure, not a
  landing-gate one) and the hundred-plus `feedback_*`/`project_*` memory files about unrelated subsystems
  (droplist traits, dev-panel plugin, etc.).
- The actual roster is **build-time curation**, per "Done when" below — same as `TRUST_CHAIN` itself is
  hand-curated, not generated, and its own header insists the tier stay **MINIMAL**
  (`we:scripts/lib/gate-config.mjs:82-89`: "a wider policy net just re-strands the queue on humans").

- **(a) Leave it blast-radius (status quo).** *Rejected* — demonstrated live failure, PR #1045 (above).
- **(b) Add the governing subset to `isStatutePath`.** Mechanically: extend `STATUTE_PATHS`
  (`we:scripts/lib/review-escalation.mjs:70-73`) with path patterns for the named governing files.
- **(c) Add them to the policy-core roster (`we:scripts/lib/gate-config.mjs` `TRUST_CHAIN`) instead, `tier: 'policy', leash: 'spec'` (recommended default).**
  Same shape every existing policy-tier entry already uses (`we:scripts/lib/review-policy.contract.json`,
  `we:scripts/lib/gate-config.mjs` itself, `we:scripts/check-standards.contract.json`, …).
- **(d) A third clearance tier** — human-required only when the diff *loosens* the rule. *Rejected*: nobody has made "loosens" script-decidable, and a gate that needs judgment is not a gate. Re-open only if someone brings a decidable predicate.

**(b) vs (c) — the live choice, argued on the real mechanisms, not on the disclaimed "policing its own leash"
framing.** [`#review-human-declarative-leash-only`](docs/agent/platform-decisions.md#review-human-declarative-leash-only)
(#2771) is explicit that `review:human` means *"genuine human judgment is essential... **not** 'an agent might
be policing its own leash'"* — so that phrase is not available as this fork's authority; the case has to be
made on the two mechanisms' actual, current design.

- **Coverage.** `isStatutePath` matches an anchored path **regex**
  (`we:scripts/lib/review-escalation.mjs:70-73`, `^docs\/agent\/platform-decisions\.md$` /
  `^docs\/agent\/.*statute/i`) that would need hand-written new clauses to reach `we:agent-memory-src/`/`we:skills-src/`
  at all, and would not automatically follow a relocation. `TRUST_CHAIN` matches by **basename**
  (`basenameOf`, `we:scripts/lib/gate-config.mjs:362-369`), "enforced by construction... follows the code
  across repos" — so registering `we:land-on-no-regression-not-perfection.md` once covers *every* spelling of
  that file for free, including the `.claude/agent-memory/` symlink and any relocated copy (#2909's dual-spelling
  problem, already solved by this exact mechanism for `BLAST_RADIUS`).
- **Forward-fit with the statute term's own stated direction.** [`#human-is-principle-surface-not-path`](docs/agent/platform-decisions.md#human-is-principle-surface-not-path)
  (#2840) — "the canonical definition [of principle surface] for the whole governance cluster" — states the
  **statute** term is the "one intended narrowing... from whole-file to rule-text edits" once `isPrincipleSurface`
  ships (confirmed unbuilt — no implementation exists yet), while trigger 3's declarative-leash floor (the
  `TRUST_CHAIN` `leash: 'spec'` set) stays **"permanently pinned"** whole-file. Choosing (b) rides the one axis
  this repo's own statute already says will narrow; a governing file registered there risks silently losing
  whole-file protection the day that narrowing ships, for no reason connected to whether it should. (c) rides
  the axis that stays whole-file by design.
- **A concrete, present-day side effect only (c) confers.** `we:scripts/check-standards.mjs`'s provenance/citation
  gate (`we:scripts/check-standards.mjs:1227-1229`) derives its `specHomes` scope **from `TRUST_CHAIN`'s
  `leash: 'spec'` `homes`**, not from `isStatutePath` — a diff to a `we:docs/**/*.md` file is separately in-scope
  via `PROVENANCE_DOC_DIRS`, but a file under `we:agent-memory-src/`/`we:skills-src/` is only pulled into citation
  checking (a stale `#NNN`/symbol reference caught automatically) by being added to `TRUST_CHAIN`. (b) confers
  no such benefit — the citation gate would never see these files.
- **The honest tension (statute-overlap, reconciled here, not left open).**
  [`#blast-radius-advisory-care-not-a-gate`](docs/agent/platform-decisions.md#blast-radius-advisory-care-not-a-gate)
  (#2563) Fork 1 point 2 rules the trust-chain/gate-self test should fire on "a **spec** change... a
  **schema / executable contract, not prose**... prose forces interpretation, and no tool auto-detects prose
  drift." Every governing exemplar above is free-form markdown that *does* admit behaviour-preserving edits
  (a typo fix, a rewording) — a real disanalogy with `TRUST_CHAIN`'s existing `leash: 'spec'` members, which
  are schema/code artifacts with *no* behaviour-preserving edit (#2840 trigger 3's stated premise). This is
  not silently overridden: **(c) is accepted as a deliberate, named, fail-closed interim** — the same posture
  `we:scripts/lib/gate-config.mjs:113-115`'s own authoring guidance already states for an ambiguous new
  member ("if you cannot answer with confidence, leave it `'spec'`... the fail-closed direction is human,
  never committee") and the repo's standing "over-escalating is the safe direction" posture
  (`we:scripts/lib/review-escalation.mjs`, cited by `we:agent-memory-src/land-on-no-regression-not-perfection.md:32-34`
  itself). The follow-on this defers, tracked as residue and **not blocking this ruling**: extend #2840's
  rule-text-vs-whitespace distinction (today code-only, via `@principle`/`@invariant` markers) to markdown
  governing files, so a typo-fix no longer forces a human. Until that lands, whole-file is the safe,
  over-inclusive default — exactly (c)'s current shape.
- **The exemplar list is trimmed on this same standard-vs-implementation-detail scrutiny:**
  `we:agent-memory-src/producer-opens-pr-drain-reviews.md` is dropped from the governing set (see above,
  historical memo, not live doctrine) — a fresh-context read caught this, folded in before the stamp.

**One concrete mechanical wrinkle (c) must solve that (b) does not force.** `TRUST_CHAIN` matches by
**basename**, but every governing **skill** file is literally named `we:SKILL.md`
(`we:skills-src/review/SKILL.md`, `we:skills-src/drain/SKILL.md`, … — 26 of 27 skills in the repo share that
basename). A bare basename entry for `we:SKILL.md` would either escalate *every* skill (over-broad, defeats the
"keep the POLICY tier MINIMAL" guidance) or be unusable if narrowed. The fix: governing **memory** files stay
ordinary `TRUST_CHAIN` basename entries (their names are already unique repo-wide, verified by `find` — the
same accepted, not test-pinned, uniqueness risk `BLAST_RADIUS_ENGINE`'s own header already tolerates for its
basenames); governing **skill** files register via a **path-suffix regex matcher** — anchored the same way
`BLAST_RADIUS` already anchors cross-repo directory patterns with `(^|\/)` in
`we:scripts/lib/review-escalation.mjs`, rather than the shared `basenameOf` Set. This pattern is precedented
*in that file*, but is genuinely new architecture *inside* `we:scripts/lib/gate-config.mjs` — not a copy of
something already there — and its own honest cost: a legitimate skill-directory rename
(`we:skills-src/review/` → `we:skills-src/pr-review/`) silently drops the match, same rename-blindness
`TRUST_CHAIN` already accepts for basenames, extended to a new matcher shape. Illustrative shape (not the
final roster — that is build-time curation):

```js
// gate-config.mjs — illustrative, not the final roster
{
  role: 'land-bar-rule',
  file: 'land-on-no-regression-not-perfection.md',   // basename-unique, travels normally
  tier: 'policy',
  leash: 'spec',
  desc: 'the land bar the reviewing/landing agent is itself governed by',
  homes: ['agent-memory-src/land-on-no-regression-not-perfection.md'],
},
// ...and a parallel PATH-SUFFIX set (not basenameOf) for the governing skills, mirroring BLAST_RADIUS's
// own anchored-regex approach for the same cross-repo trees:
const GOVERNING_SKILL_SUFFIXES = [
  /(^|\/)skills-src\/review\/SKILL\.md$/,
  /(^|\/)skills-src\/drain\/SKILL\.md$/,
  /(^|\/)skills-src\/jury\/SKILL\.md$/,
  /(^|\/)skills-src\/converge\/SKILL\.md$/,
  /(^|\/)skills-src\/pr\/SKILL\.md$/,
];
```

**Bold default: (c).** Not because an agent "polices its own leash" (#2771 explicitly disclaims that as the
citation) but because: `TRUST_CHAIN`'s basename match gives free, symlink-proof coverage across every spelling
of a governing file; the statute term is the axis this repo's own statute already says will narrow toward
rule-text edits while the declarative-leash floor stays permanently whole-file; and registering into
`TRUST_CHAIN` is the only route that also wires these files into the existing citation/provenance gate. The
prose-vs-schema tension with #2563 is real and is accepted here as a named, fail-closed interim, not silently
overridden.

*Rejected:* (a) — demonstrated live failure (PR #1045). (b) — real coverage/forward-fit costs, priced above,
for no offsetting mechanical gain (both routes end at the same `humanRequired: true`).

**Skeptic: SURVIVES-WITH-AMENDMENT.** A throwaway skeptic sub-agent attacked (c)-over-(b) and the `we:SKILL.md`
matcher design directly against the live code and statute. It refuted the draft's original rationale
("policing its own leash," which #2771's own ratified text disclaims as the citation) and supplied the
correct one instead: `TRUST_CHAIN` `leash: 'spec'` is the axis #2840 states stays *permanently pinned*, while
`isStatutePath`'s statute term is the axis #2840 itself names as about to *narrow* toward rule-text-level
gating once `isPrincipleSurface` ships (unbuilt) — a genuine forward-looking asymmetry, not the aesthetic
"more honest classification" framing this fork started with. It surfaced a real, previously-uncited
statute-overlap (#2563 Fork 1 point 2: "schema/executable contract, not prose") that the draft did not
address; folded in above as a named, deliberate, fail-closed interim with a tracked follow-on, not a silent
override. It found one concrete, present-day mechanical benefit unique to (c) (the `we:scripts/check-standards.mjs`
provenance-gate `specHomes` derivation) and confirmed the we:SKILL.md basename collision is real (26/27 skills
share `we:SKILL.md`) and the path-suffix fix, while pattern-precedented in `we:scripts/lib/review-escalation.mjs`,
is genuinely new architecture inside `we:scripts/lib/gate-config.mjs`. It also caught that
`we:producer-opens-pr-drain-reviews.md` (an earlier draft's exemplar) is a historical memo, not live doctrine —
dropped from the list. Every finding is folded into the fork above; the default (c) survives, on the
corrected grounds.

**Screen: clear.** A fresh-context agent that had not seen this session's authoring checked the two standard
confusions. (1) Standard-vs-implementation-detail: **not** an invisible detail — `scoreEscalation` emits
distinct, separately-worded reason tokens for `gate-self` vs `statute` (`we:scripts/lib/review-escalation.mjs:575`
vs `:580`) with different descriptions in `we:scripts/lib/review-policy.contract.json`, and the two matchers
have materially different coverage (basename vs anchored path regex) — a real, consequential difference, not
decoration. (2) Merit-vs-prioritization: a genuine merit difference survives the free-and-instantly-maintained
counterfactual — `TRUST_CHAIN` is the one canonical, closure-invariant-protected roster (editing it is itself
gate-self), so growing `isStatutePath` instead stands up a second, untyped classifier for an adjacent concern,
a structural fork-point independent of maintenance cost; and #2840 canonically defines "principle surface" for
the whole governance cluster in terms `TRUST_CHAIN`'s mechanism already realizes, which `isStatutePath` does
not. One residual noted but not fork-collapsing: neither branch resolves the #2771 "spec is schema not prose"
framing for these prose files — that tension is the one reconciled explicitly above, as a shared, named,
interim acceptance.

## Done when

- The fork is ruled and the ruling codified (statute or `we:docs/agent/*.md`, per the resolve gate for a `kind: decision`).
- If the tier moves: the governing subset is a **named, versioned roster** in `we:scripts/lib/gate-config.mjs`
  `TRUST_CHAIN` — memory files basename-matched, skill files path-suffix-matched (per Fork 1's illustrative
  shape) — never a directory glob over the whole corpus, and `scoreEscalation` on
  `we:agent-memory-src/land-on-no-regression-not-perfection.md` returns `humanRequired: true`, pinned by a
  test (mirroring the conformance-suite pattern the existing entries already use).
- The `blast-radius` and `statute` token descriptions in [`we:scripts/lib/review-policy.contract.json`](scripts/lib/review-policy.contract.json) reflect wherever the line lands.
- Per #2839 (principle and impl never travel in one diff): this decision's codification lands decisions-only;
  the actual `TRUST_CHAIN` roster entries + the skill path-suffix matcher are a separate, human-citable
  follow-on impl item, `blockedBy` this one.

### Review jury (provisional — pre-registered #2638)

Care level: `high` (statute/gate-self-adjacent — the eventual follow-on impl touches the review-escalation
trust chain itself). This jury binds against the item's predicted scope
(`we:scripts/lib/gate-config.mjs`, `we:scripts/lib/review-escalation.mjs`,
`we:scripts/lib/review-policy.contract.json`, `we:docs/agent/platform-decisions.md`) and is re-checked
against the real diff at PR open.

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
