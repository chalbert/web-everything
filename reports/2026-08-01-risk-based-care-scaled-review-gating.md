# Risk-based / care-scaled review gating — always-on floor vs risk-triggered depth, and the flake-and-mute failure

**Date**: 2026-08-01
**Point**: Prior art on where code review runs *always-on* vs *risk-triggered*, and the dominant failure mode of a review that fires low-value findings — it gets muted, taking the high-value findings with it. Both survey lines converge on a hybrid: a *light non-zero floor everywhere* + *depth scaled by risk*, never zero and never uniformly heavy.
**Research page**: `/research/risk-based-care-scaled-review-gating/`
---

## Question

The conveyor's build lanes run a mandatory always-on adversarial self-review on their own diff before opening a PR (delivery-agent brief step 6, plus a step-7 visual pass for UI items). Story #2819 asks whether that self-review should stay **always-on** or become **care-level-scaled** like the escalation rubric. Three options: (a) mandatory full pass on every build; (b) care-scaled only; (c) hybrid — a light always-on floor + depth scaled by care-level. What does the prior art on risk-based review gating say, and what is the failure mode of a review that flakes and gets ignored?

## Recommendation

**Hybrid with a non-zero floor (option c).** Two independent bodies of prior art point the same way:

1. **Nobody who ships fast runs *zero* review.** Every mature high-throughput pipeline keeps a **non-zero floor** on every change and scales *depth/who* above it — never a branch that reaches zero scrutiny. A pure care-scaled dial that maps a "trivial" change to no review is the outlier, and it is the exact hole #2819 was opened to close (a leaf edit whose under-specified brief hid an edge case).
2. **A heavy pass on trivial changes destroys itself.** The best-documented failure mode of over-broad gating is **flake-and-mute**: a check that fires frequent low-value findings trains the reviewer to wave it through, so the *rare high-value* finding is waved through too. This refutes uniform always-on-heavy (option a) — the floor must be **light and high-signal**, not maximal.

So the floor is *non-zero* (kills option b's zero branch) and *light* (kills option a's uniform-heavy branch), and the depth *above* the floor is a config dimension that reuses the existing care dial.

## Key findings

### Where review is always-on vs risk-triggered

| System | Always-on floor | Risk-triggered depth | Ever zero? |
|---|---|---|---|
| Google (change-based review + readability) | every change needs at least one reviewer LGTM | readability reviewer / more eyes for sensitive dirs; OWNERS depth by path | **No** — no change lands unreviewed |
| CODEOWNERS / branch protection (GitHub/GitLab) | required reviewers on protected paths | extra required reviewers on sensitive globs | No for protected paths |
| Risk-based testing (ISTQB) | baseline smoke on everything | test effort *prioritized* by risk exposure | baseline stays |
| Coverity / deep static analysis | fast incremental scan per change | full deep scan nightly / on risky modules | incremental stays |
| CodeRabbit / Graphite Diamond (AI review) | runs on **every** PR | path filters + config tune depth/noise | review runs always; *findings* filtered |
| GCP Change Risk / risk-based IaC review | risk score computed on all changes | high score gets more scrutiny, human desk | score computed on all |

The uniform pattern: risk **prioritizes and deepens** review; it does not **switch it off**. The one place ownership-based hard gating is correct (CODEOWNERS on sensitive paths) is a *floor raised higher*, never a floor of zero. This matches the constellation's own #2563 ruling: a computed risk score is *advisory* (dial the rigor), path/ownership sensitivity is a *gate* — but neither drops below a baseline.

### The flake-and-mute failure mode (the argument against uniform-heavy)

A review signal that fires often but rarely matters gets **muted**, and the mute is indiscriminate:

- **Flaky-test quarantine** (Google, Spotify, Dropbox writeups): tests that cry wolf get `@Ignore`/quarantined; quarantine is sticky and quietly hides real regressions later.
- **Alert fatigue** (SOC / security-ops literature): high false-positive alert streams measurably lower analyst catch-rate on the true positives — the operator stops looking, not just at the noise, but at the channel.
- **Normalization of deviance** (Vaughan, *The Challenger Launch Decision*): repeated low-consequence warnings recalibrate the team to treat the warning class as ignorable — the mechanism by which a heavy, mostly-empty gate becomes background noise.
- **Rubber-stamp review** (large-scale mining-software-repositories code-review studies): reviewers asked to review everything at uniform depth spend near-zero attention on the many trivial diffs, and that low-attention habit bleeds into the diffs that needed attention.

Applied here: an agent forced to run a full adversarial pass on a one-line doc edit learns the pass is theater and rubber-stamps it — then rubber-stamps the pass on the blast-radius change too. **A light floor preserves signal; a heavy floor spends it.** This is the merit defect that survives a zero-cost thought experiment: even if review compute were free, uniform-full is *worse*, not equal, because it dilutes attention.

### Web-standards / platform alignment

There is no W3C/WHATWG surface for review gating (it is process, not a browser standard), so this is an internal governance policy, not a WE standard. The relevant native-first analogue is **progressive enhancement of scrutiny**: a cheap baseline everyone gets, enriched where the input warrants — mirroring how the platform layers capability rather than gating all-or-nothing.

### Reshape of the forks (research changed the framing)

Going in, the framing was "always-on vs scaled" as a cost tradeoff. The survey reshaped it into a **two-sided clamp**, which is why (c) is not a mushy compromise but the only option surviving both failure modes:

- The zero branch of (b) fails the *first* body of prior art (nobody ships zero review).
- The uniform-heavy of (a) fails the *second* (flake-and-mute).
- (c) is the intersection: floor at least one light pass, depth scaled above.

It also split the decision cleanly: the **non-zero floor** is a governance *invariant* (the one genuine policy line), while the **depth dial above it** is a *config dimension* — a throughput knob a repo tunes, reusing the care model. And it exposed a code hazard: reusing `panelRigorForCareLevel` verbatim would inherit its `none -> 0 rounds` mapping, which *is* the zero branch — so the floor needs a distinct `selfReviewDepthForCareLevel` clamped to a non-zero minimum.

## Files Created/Modified

This diff both **prepares and ratifies** the decision — it brings the fork to Definition of Ready *and* rules
it (c) hybrid, codifying the non-zero self-review floor as a binding platform rule.

| File | Action |
|---|---|
| `we:reports/2026-08-01-risk-based-care-scaled-review-gating.md` | created (this report) |
| `we:src/_data/researchTopics/risk-based-care-scaled-review-gating.json` | created (registry entry) |
| `we:src/_includes/research-descriptions/risk-based-care-scaled-review-gating.njk` | created (write-up) |
| the build-lane self-review-scope decision item (under epic #2804) | authored, prepared, **and ratified** — `status: resolved`, `dateResolved`, `codifiedIn`, and a `## Ruling` section added |
| `we:docs/agent/platform-decisions.md` | **new binding statute** — the `#build-lane-self-review-non-zero-floor` anchor (Ratified 2026-08-01) |
| `we:AGENTS.md` | research-topic inventory count bumped (the auto-generated `Research topics` row: 284 (280 open) → 285 (281 open)) |
| the ratify-gate + provenance-hooks story (#2821) | not in this diff — the review-lesson gates landed separately in #2821 (on main); this branch is byte-identical to main at that file |
