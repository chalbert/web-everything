---
kind: decision
parent: "2804"
status: resolved
dateOpened: "2026-08-01"
dateResolved: "2026-08-01"
preparedDate: "2026-08-01"
codifiedIn: docs/agent/platform-decisions.md#build-lane-self-review-non-zero-floor
relatedReport: reports/2026-08-01-risk-based-care-scaled-review-gating.md
tags: [conveyor, review, convergence, self-review, care-level, ui-fidelity, slice-uifg-adjacent]
---

# UI-fidelity build self-review scope — always-on vs care-level-scaled

## Ruling (2026-08-01) — Fork 1 = (c) hybrid

Ratified **(c) hybrid**. The **ratifiable core**: every delegated build carries a **non-zero self-review
floor** — even a `none`-care leaf edit gets one fast pass, so no build reaches the PR having run zero adversarial
self-review. The floor is a **non-clearing FIX pass** ([#2439]: the builder never clears its own diff). The
**visual** floor stays **locus-gated, not care-gated**. **Depth above the floor is a config dimension**, not a
fork. Codified as [`#build-lane-self-review-non-zero-floor`](../docs/agent/platform-decisions.md#build-lane-self-review-non-zero-floor),
composing with — not altering — [#2563] and [#2439].

## Grounding digest

Story [#2819](/backlog/2819-review-fix-convergence-runs-in-the-warm-build-lane-daemon-is/) moves the review→fix
convergence into the **warm build lane** (pre-PR, context still loaded) and leaves an open sub-point it wants
ratified separately: *is the build-lane self-review **always-on** or **care-level-scaled**?* #2819's own
recommendation is a **light always-on pass with depth scaled by care-level** ([#2567]).

The build lane runs **two** pre-PR self-review steps today, both mandatory and un-scaled:

- **Step 6 — adversarial code self-review** (`we:skills-src/conveyor/delivery-agent-brief.md:136`): spawn one
  adversarial code-review subagent on the working diff, address every finding to convergence, only then open
  the PR. It is **non-clearing** by design — a builder may not clear its own diff
  ([#2439], `#agent-convergence-independent-validation`), so this pass **fixes, it does not accept**.
- **Step 7 — visual self-review** (`we:skills-src/conveyor/delivery-agent-brief.md:158`): UI-locus items only,
  render + screenshot + by-eye/comparator diff to visual convergence before the PR.

Separately, the conveyor already has a **care-level model** (#2567): `deriveCareLevel`
(`we:scripts/lib/review-escalation.mjs:201`) buckets a PR into `none | low | elevated | high` from the same
blast-radius / size / dismissed-findings / cross-repo signals, and `panelRigorForCareLevel`
(`we:scripts/lib/jury-core.mjs:274`) scales the **downstream independent** AI panel's rigor from that band —
mapping **`none → { rounds: 0, lenses: [], jurorsPerLens: 0 }`**, i.e. *zero*. That model was built to dial the
**Layer-2 independent panel** (#2567 / #2671), not the **Layer-1 author-run self-review** (#2672).

Prior-art (report `we:reports/2026-08-01-risk-based-care-scaled-review-gating.md`, research topic
[`/research/risk-based-care-scaled-review-gating/`](/research/risk-based-care-scaled-review-gating/)) lands a
**two-sided clamp**: (1) every mature high-throughput pipeline (Google change-based review, CODEOWNERS,
risk-based testing, CodeRabbit/Graphite, GCP Change Risk) keeps a **non-zero floor** and scales *depth/who*
above it — **nobody who ships fast runs zero review**; and (2) a **heavy** pass on trivial changes destroys
itself via **flake-and-mute** (flaky-test quarantine, SOC alert fatigue, Vaughan's normalization of deviance,
rubber-stamp review) — frequent low-value findings train the reviewer to wave the *channel* through, so the
rare high-value finding is waved through too.

## The axis

The decision splits, on the #2563 template, into a **fixed invariant** (the non-zero floor — the one
ratifiable line), a **config dimension** (the depth *above* the floor — a throughput knob, not a fork), and
**one genuine fork** (whether that floor exists at all — options (a)/(b)/(c)). What is *not* touched: the
Layer-2 independent clear + land (unchanged), and #2439's non-author invariant (the self-review stays a
non-clearing fix pass).

## Recommended path at a glance

| # | Fork | Options | Default |
|---|------|---------|---------|
| 1 | Build-lane self-review scope — does every build carry a non-zero floor, and how is its depth set? | (a) mandatory full/uniform on every build · (b) care-scaled only (no floor; `none` → nothing) · (c) light non-zero floor + care-scaled depth above it | **(c) — hybrid, non-zero light floor** |

*Not a fork:* the **depth above the floor** is a **config dimension** (`#config-extends-platform-default`) — a
repo tunes rounds/lenses per care band; default = the most-permissive platform flavor (light floor, deepen with
care). The Layer-2 `none → 0` zero-coverage on the *independent* panel is **out of scope** (owned by
#2567/#2563) — flagged as a follow-on, not decided here.

## Fixed invariant (ratifiable core — never a config knob)

- **Every delegated build carries a non-zero self-review floor.** No build reaches the PR having run *zero*
  adversarial self-review — even a `none`-care leaf edit gets **one** fast pass. This is the headline rule: a
  repo may *raise* the floor or deepen above it (see config), but "floor > 0" is the platform default, not one
  value of a preference. It is what closes #2819's root cause (an under-specified-brief leaf edit whose hidden
  edge-case slipped because nothing looked adversarially before the PR), and it is what every fast-shipping
  pipeline in the survey does (risk deepens review, it never switches it off).
- **The floor is a non-clearing FIX pass, not a clearance.** Per #2439 the builder may not clear its own diff;
  the floor converges nits *pre-PR while the lane is warm* and hands a cleaner diff to the **independent**
  Layer-2 clear, which is unchanged. The floor never claims to be the safety net — it shrinks the post-hoc-nit
  rate cheaply.
- **The visual self-review floor stays locus-gated, not care-gated.** Step 7 fires for UI-locus items
  regardless of care band (a small-diff UI tweak can still be visually wrong — the console-board failure class,
  #2804). Care scales its *depth*, never gates its *existence* on a UI item.

## Config dimension (the tunable, not a ratifiable fork)

Per Q4 (both branches are legitimate end-states → `#config-extends-platform-default`), the **depth above the
floor** is a knob: how many extra adversarial rounds / lenses a build earns as care rises. Default = the
**most-permissive platform flavor**: a light floor at `none`/`low`, deepening at `elevated`/`high`. A
conservative repo raises the floor or the per-band depth. The knob reuses the **shape** of the care model
(#2567) but **not its table** — see the citation-scope note in Fork 1.

## Settled (not forks)

- **Layer separation is fixed.** Self-review = Layer 1 (author-run, #2672); independent clear = Layer 2
  (#2567/#2439). This decision governs only Layer 1's floor + depth. The Layer-2 panel's `none → 0` mapping is
  a separate concern under #2567.
- **One shared care model.** `deriveCareLevel` stays the single source of the band; only the *depth table* the
  band feeds differs by layer (Layer 1 gets a floored table; Layer 2 keeps `panelRigorForCareLevel`).

## Fork 1 — Build-lane self-review scope: does every build carry a non-zero floor, and how is its depth set?

*Fork-existence: two coherent branches genuinely cannot coexist as the default — either every build carries a
mandatory non-zero self-review floor or it does not. Option (b)'s zero branch is the **excluded** one: a build
that cost-scales its self-review down to nothing re-opens the exact post-hoc-nit hole #2819 was filed to close,
and no fast-shipping pipeline in the survey ever drops review to zero. So the floor's **existence** is a real
either/or — a ratifiable line, not merely a config value (the depth above it is the config value).*

The care model already exists (`deriveCareLevel`, `panelRigorForCareLevel`); the live call is what the *build
lane's own* self-review does with it.

- **(a) Mandatory full / uniform on every build.** The status quo (step 6/7 run the same adversarial pass
  regardless of size). Simple and safe against the zero-coverage hole — but it is **uniform-heavy**, and the
  survey's flake-and-mute finding says a full pass on a one-line doc edit is *theater that trains the
  rubber-stamp reflex*, degrading attention on the diffs that actually need it. A merit defect that **survives
  a zero-cost thought experiment**: even with free compute, uniform-full is worse, not equal, because it
  dilutes signal.
- **(b) Care-scaled only — no floor.** Reuse the escalation dial so depth tracks risk; a `none`-care leaf edit
  gets minimal/**zero**. Cheapest, and it mirrors the escalation rubric exactly. Rejected: reusing
  `panelRigorForCareLevel` verbatim inherits its `none → 0 rounds` mapping, so a "trivial" build runs **no**
  self-review at all — the outlier the prior art never does, and the reopened #2819 hole. "Looks trivial" is
  precisely where the under-specified brief hides its edge case.
- **(c) Light non-zero floor + care-scaled depth above it.** **Chosen.** A single fast high-signal adversarial
  pass (correctness + the one lens the diff earns) runs on **every** build — never zero — and care-level dials
  **additional** rounds/lenses on top. The floor is *light* (kills (a)'s flake-and-mute) and *never zero*
  (kills (b)'s coverage hole). "Light" = narrow, fast, high-signal — **not** a scaled-down copy of the deep
  pass — which is why it does not itself become mute-inducing theater.

**Citation-scope (downgraded, per #1932).** #2567 / `panelRigorForCareLevel` is cited as **pattern precedent**
(care-scales-rigor is a proven shape), **not as authority** — it was authored to scale the Layer-2 *independent*
panel, a different turf. So the self-review earns a **distinct** `selfReviewDepthForCareLevel` **clamped to a
non-zero floor**, derived on its own merits, rather than reusing the Layer-2 table (which would import the
`none → 0` bug).

```js
// Layer 2 (independent panel) — we:scripts/lib/jury-core.mjs:274. Note none → ZERO review; correct there,
// because the panel is not the only gate and a none-care PR is separately handled.
panelRigorForCareLevel('none');   // → { rounds: 0, lenses: [],           jurorsPerLens: 0 }   // ← the zero (b) inherits

// Fork 1 (c) — a DISTINCT Layer-1 table, FLOORED. Same care band, own mapping; rounds never 0.
export function selfReviewDepthForCareLevel(careLevel) {          // Layer 1: author-run FIX pass (#2672/#2439)
  const table = {
    none:     { rounds: 1, lenses: ['correctness'] },            // the LIGHT floor — one fast high-signal pass
    low:      { rounds: 1, lenses: ['correctness'] },
    elevated: { rounds: 2, lenses: ['correctness', 'earned'] },  // depth scales ABOVE the floor (config dimension)
    high:     { rounds: 2, lenses: ['correctness', 'earned', 'security'] },
  };
  return table[careLevel] ?? table.none;                          // floor is the fallback — never zero, never undefined
}
```

*Skeptic:* SURVIVES-WITH-AMENDMENT (2026-08-01, four amendments folded — a same-session skeptic REFUTED the
original naive "three co-equal options" framing and forced the restructure). (0) *Classification* — the attack
"(a)/(b)/(c) are three values of one knob → pure config dimension, nothing to ratify" is **half-right and
adopted**: the **depth** is now a config dimension; what stays ratifiable is the **floor's existence** (like
#2563 made the human-sample *rate* config but "the decorrelated axis is not nothing" a fixed invariant). (2)
*Statute/layer* — the attack "a floor on the *author's* self-review mislocates the #2439 guarantee" is
**reconciled**: the floor is explicitly a non-clearing *fix* pass (#2819's own framing), not a clearance, and the
Layer-2 `none → 0` coverage hole is split out as a #2567 follow-on, not conflated. (3) *Citation-scope* — the
attack "citing #2567 to scale self-review overreaches" is **adopted**: citation downgraded to precedent, a
distinct floored `selfReviewDepthForCareLevel` introduced. (1) *Merit* — the attack "a light floor is theater
just like (a)" **refuted**: mute comes from *frequent low-value* findings; a single fast *high-signal*
correctness pass on the leaf edits that hide edge-cases is not low-value, and it is far cheaper than (a)'s full
pass. Net: the restructured (c) — floor as invariant, depth as config, distinct floored table — survives.
*Screen:* flagged(impl, prio) → fixed. A fresh-context screen flagged both: (impl) "how deep a self-review
runs" is internal orchestration tuning; (prio) at zero cost you'd run full everywhere, so the disagreement is
"how much compute." **Fix applied:** the depth dial was **re-layered to an explicit config dimension**
(conceding the orchestration-tuning half), leaving the ratifiable line = the **non-zero floor**, whose merit
(signal preservation via flake-and-mute) **survives the zero-cost test** — uniform-full is worse, not equal,
even free — so it is genuine merit, not prioritization in fork costume.

## Make the call tangible

**Known occurrences of the pattern** (a non-zero floor + risk-scaled depth, never zero review): Google's
change-based review (every change gets ≥1 LGTM; readability/OWNERS add depth by path); CODEOWNERS + branch
protection (baseline required review, more reviewers on sensitive globs); ISTQB risk-based testing (baseline
smoke everywhere, effort prioritized by risk); Coverity (incremental scan per change, deep scan on risky
modules); CodeRabbit / Graphite Diamond (AI review on **every** PR, depth/noise tuned by config). The failure
mode the floor's *lightness* avoids is equally shipped: flaky-test quarantine and SOC alert fatigue are the
industry's name for a heavy, mostly-empty gate getting muted along with its rare true positives.

## Codified-in reconciliation (performed at the decision turn)

The decision turn set `codifiedIn` to the **new sibling anchor**
`#build-lane-self-review-non-zero-floor` — the front-matter now carries exactly that value, and the anchor
exists in `we:docs/agent/platform-decisions.md` in this diff. It **composes with**, and does not collide with,
`#blast-radius-advisory-care-not-a-gate` (#2563) and `#agent-convergence-independent-validation` (#2439): #2563
governs which signals route advisorily vs hard-gate a human on the **independent** review; #2439 governs that a
builder may not **clear** its own diff; this governs the **Layer-1 author-run fix pass's floor + depth**. Three
different turfs, one anti-drift rule: the care *band* stays single-sourced in `deriveCareLevel` — this anchor
adds only a **floored depth table** for Layer 1, it does not re-declare the band.

## How this is prevented next time

This one item was bounced in review **twice**, both times for the **same class: provenance/citation
precision** — a reference written from what was *salient* rather than *verified against the source* (its exact
id-space, file, line, or meaning). Round 1 was the `#955`-for-`#2819` mixup; round 2 was **three fresh
citation defects introduced by the round-1 fix**, one of which reproduced the very class this section was
written to prevent. That recursion is the headline finding: **writing the rule down did not change the
outcome.** It is the strongest possible evidence that the guard must be **deterministic** (a hook), not
authorial diligence.

### The class (both rounds, every finding)

**Provenance/citation precision.** A citation — an `#NNN`, a `we:path:line`, or a count/label claim —
asserted without resolving it against the source. Every finding across both bounces is this one class; none
is a typo. Below, each finding carries `{ class · why-the-author-erred · gate-or-process-fix · route }`.

### Round 1 — `#955` (the PR) written where `#2819` (the story) was meant

- **Why the author erred (blameless chain):** the PR that landed the warm-lane story (`#955`) was the salient
  handle → the story got cited by its PR number → in this repo `#NNN` *is* a backlog id, and nothing forced a
  distinct spelling for a PR → the wrong id baked into permanent statute ~15×. Round 1's other two findings
  (the dead `xmhvbvx-…` links) were the *same* renumbering leaking into links the at-land rewrite never covers.
- **Route — gateable, already filed as [#2821].** That story turns this class into deterministic gates: a
  `check:standards` cross-ref rule that hard-errors a PR number cited as `#NNN` and flags a target whose
  kind/title is implausible for the citing sentence, plus widening `findBadBodyLinks` and the at-land hash→NNN
  rewrite to hash slugs outside `we:backlog/` + `we:docs/agent/`. Reference it; do **not** refile.

### Round 2 — three fresh defects the round-1 fix introduced

All three are the **same class**, and all three are **machine-checkable** — yet none was machine-checked
before it shipped.

1. **`#51` written as a backlog `#NNN`** (this section, previously). *Class:* provenance/citation precision.
   *Referent:* **memory rule 51 (hookable-vs-judgment)** — a memory rule, **not** a backlog item; `#51`
   resolves to `we:backlog/051-jsx-event-style-toggle.md`, an unrelated JSX-adapter story. *Why the author
   erred:* "51" was salient as a *rule* number → written in `#NNN` shorthand without checking that id-space →
   nothing forced a memory-rule spelling distinct from a backlog id. *The recursion:* this sat **inside the
   bullet declaring that `#NNN` means a backlog item** — the section committed the exact error it documents.
   *Route — gateable, the same [#2821] gate,* extended to forbid a non-backlog concept (a memory rule) written
   as `#NNN`. Fixed here to the spelled-out "memory rule 51 (hookable-vs-judgment)".
2. **`we:AGENTS.md` inventory row mislabeled** (`we:reports/2026-08-01-risk-based-care-scaled-review-gating.md`).
   *Class:* provenance/citation precision. The counts `283→284, 279→280` are the **research-topic** inventory
   (`Research topics 284 (280 open)` in `we:AGENTS.md`'s auto-generated block); `we:AGENTS.md` carries **no**
   statute/anchor counter. *Why the author erred:* the diff *did* add the new anchor and *did* bump a counter,
   so "statute/anchor" felt right → the label was written from intent, not from the actual hunk. *Route —
   mostly judgment* (which inventory line a prose row describes is not cleanly greppable): a **working-style
   correction** — "verify every cited count and label against the actual diff hunk before writing it" — routed
   to **agent memory (memory rule 9)** as a durable practice, and it belongs in the build/fix brief. The one
   machine-checkable sliver (`we:AGENTS.md` has no "statute/anchor" counter to inventory) is a weak gate at best.
3. **`applyLedger` pointer named the wrong file:line** (this section, previously
   `we:scripts/lane-drain.mjs:596`). *Class:* provenance/citation precision. *Verified in-repo:* `applyLedger`
   is **defined** at `we:scripts/backlog/id.mjs:144` and **called** from `we:scripts/lane-drain.mjs:641`; the
   hash→NNN rewrite *scope* this bullet wants widened is built at `we:scripts/lane-drain.mjs:583-595` (line 596
   is an unrelated `contentByName` Map). *Why the author erred:* a plausible line number was written without
   opening the file → a `we:path:line` citation is a load-bearing claim with **no gate behind it**, and it
   rots on any edit above it even when first correct. *Route — gateable in principle:* a `check:standards`
   rule that verifies each `we:<path>:<line>` resolves (the named symbol appears at the cited line), and a
   convention shift to **symbol-anchored refs** (`we:scripts/backlog/id.mjs` → `applyLedger`) that never
   go stale; until that lands, the same **working-style correction** ("verify every cited file:line against
   the source before writing it") in **agent memory (memory rule 9)** and the build/fix brief.

### Why the just-ratified self-review floor missed all three

First-hand evidence about the rule *this very item ratifies*: the floor is `{ rounds: 1, lenses:
['correctness'] }`, and it cleared a diff carrying three wrong references in the section *about* wrong
references. The defect is **lens mismatch, not round count.** "Correctness" on a citation-heavy *prose* diff
means "does the argument hold" — it does not resolve each cited id/line/count against the source. A
provenance/citation lens (resolve-and-compare) is a *different* check, and no author-run pass reliably
self-applies a lens to its own framing — which is exactly why the durable fix is a deterministic gate
([#2821]), not a deeper self-review. This does not weaken the ratified floor; it **sharpens the config
dimension above it**: a citation-heavy prose diff should *earn* a provenance lens on top of correctness.

### What was actually filed

- **[#2821]** (ratify-gate + provenance hooks) — a real, open story that makes finding 1's class
  script-decidable. Round 1 said "durable hooks are being filed separately"; they are **#2821**. This is the
  forcing function the round-1 reflection lacked: proposing a hook and *filing* it are different acts, and
  only the filed item changes anything.
- **Not yet filed as their own slice:** the `we:<path>:<line>`-verification gate and the symbol-anchored-ref
  convention (findings 2/3). Stated plainly rather than left as an unfiled intention — that unfiled intention
  is the exact failure this whole bounce is about. They belong under the same provenance family as #2821; the
  interim mitigation lives as the working-style practice in **agent memory (memory rule 9)** and the
  build/fix brief.

Prior art on the dangling-ref class this rides: [#2400] and [#2428] (statute-layer hash refs). Per **memory
rule 51 (hookable-vs-judgment)**: the script-decidable tells above (id-space, symbol-at-line, PR-vs-item)
belong in a hook; the judgment — which lens a citation-heavy prose diff earns — stays in context.

## Related

Carved from [#2819] (its ratify-later open sub-point); under epic [#2804] (UI-Fidelity Gate). Reuses the
care-level model [#2567], the non-author invariant [#2439], build-time self-review [#2672], and composes with
[#2563]. Gate-self note: an implementing diff edits `we:skills-src/conveyor/delivery-agent-brief.md` (the build
governance brief) + `we:scripts/lib/` — a system-machinery change, so it rides the normal independent review.

### Review jury (provisional — pre-registered #2638)

Care level: `elevated` (system-machinery: the conveyor's build-governance brief + shared review lib). This jury
binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |

**Predicted touch-set (#2619, seeds any buildable child's `scope:`):** `we:skills-src/conveyor/` (the step-6/7
brief) + `we:scripts/lib/review-core.mjs` (the new `selfReviewDepthForCareLevel`). A child carved at ratify
inherits its own slice of this, already scoped.
