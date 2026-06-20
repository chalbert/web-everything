---
type: decision
workItem: task
status: open
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
relatedReport: reports/2026-06-20-reproduction-conformance.md
preparedDate: "2026-06-20"
tags: []
---

# Program charter — reproduction-conformance: incumbent design systems rebuilt as theme+intents over WE/FUI, parity-gated by the AI-Playwright validator

**Charter, not greenfield.** This program rides five existing pillars; the only genuinely new thing is a
**reproduction-conformance loop** — a sibling forcing function to the exercise-app loop, where the target is
an *existing design system's exact rendered + behavioral output* rather than a business app. The hypothesis
under test: **the difference between any two top design systems is `theme tokens + intents` and nothing
else** — all structure, animation, and behavior is shared WE-standard + FUI-primitive. Reproducing them
exactly, while forbidden from escaping WE standards, turns that hypothesis into a falsifiable measurement and
emits the residue (what `theme+intents` *can't* express) as standards gaps.

**Prepared 2026-06-20.** Forks grounded in a prior-art survey published as the
[`/research/` topic **reproduction-conformance**](/research/reproduction-conformance/) (session report
`relatedReport`). The survey's three findings: (1) the "theme+intents is the only difference" hypothesis is
the **headless-library thesis, already market-proven** (React Aria's 40+ behavior-only hook patterns, Radix
`asChild`, Ark/Base UI) — behavior is shareable, the *branded ceiling* is the residue under test; (2) the
parity oracle must be **layered, not naïve pixel-diff** (pixel diffs throw 30–40% false positives vs <2% for
semantic/VLM; the WPT reftest model uses fuzzy tolerance) — recorded as a supported-by-default design
element below the divider, not a fork; (3) **reproduction-as-conformance IS the WPT/reftest method** (the
incumbent's render = the reference, the FUI repro = the test). The survey hardened Fork 1 and reinforced
Fork 2; it added no new fork.

## The governing rule (the whole point)

The pixel-perfect copy is a **forcing function, never a product**. Each target yields three buckets:

1. **Theme pack** — DTCG tokens (color, type, motion curves, density, elevation) compiled by `we:webtheme/`.
2. **Intent set** — which WE intents (`we:src/_data/intents/`, 66 codified) + defaults are active.
3. **Gap list** — everything reproducible *only* by escaping the standard.

Bucket 3 is the deliverable. **A divergence you can only hit by hand-rolling outside WE/FUI is a gap to file,
never a hack to add** — the direct analogue of the exercise-app loop's *active-bypass = FAIL*
(`we:.claude/skills/exercise-app/SKILL.md`, `we:scripts/check-app-conformance.mjs`). Allowing per-library
escape hatches would buy the screenshots and learn nothing. The discipline *is* the program.

## No assumed quality — every parity claim is a measured fact

Hard constraint (author-stated): **no parity claim may rest on eyeballing or assumption.** Each claim is
gated on a confirmed measurement from the AI-driven Playwright validator now being built
([#1167](/backlog/1167-autonomous-exploratory-ui-testing-tool-fui-owned-engine-that/) engine,
[#1219](/backlog/1219-explorer-cli-npm-script-run-the-autonomous-stress-test-gate-/) CLI,
[#1220](/backlog/1220-stress-test-claude-code-skill-ask-claude-in-natural-language/) skill,
[#1221](/backlog/1221-tier2vlmjudgemodel-wire-the-on-device-tier-2-vlm-as-the-expl/) VLM judge). Parity is a
two-axis measurement, both required:

- **Visual parity** — per component × state × scheme, rendered FUI-themed output vs the incumbent's reference,
  via **fuzzy-tolerance** matching (WPT-reftest model: max per-channel color delta + max differing-pixel
  count), *not* naïve pixel-diff (which throws 30–40% false positives — see the survey).
- **Behavioral parity** — focus order, keyboard, ARIA, transition states, animation timing/curves — via a
  **structural DOM/ARIA diff** (deterministic) plus the explorer (#1167); the VLM judge (#1221) is the
  **advisory** human-equivalence layer, never the sole gate.

The gate fails loud and emits a structured delta idempotently (same diff-against-snapshot shape as the
gap-sweep machine, `we:src/_data/benchmarkCoverage.json`). Until the validator reaches *parity-grade*, no
target is "done."

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 · Validator sequencing | **B — co-evolution: the first target forces the validator to parity-grade; parity *claims* still gate, but the epic is not blocked on a finished validator** | A — hard `blockedBy`: validator reaches parity-grade before any reproduction starts | Med-high |
| 2 · Validation-engine ownership | **Layered split — FUI owns the explorer engine (#1167), Plateau owns the vision/VLM judgment service, WE consumes only pass/fail + gap deltas** | Single FUI-owned engine incl. judgment | Med |

## Fork 1 — does the validator hard-block the program, or co-evolve with it?

*Fork-existence:* the "no assumed quality" constraint is an invariant (below the divider), but it leaves a
real either/or in *sequencing* — the reproduction epic either **waits** for the validator to be
parity-grade, or **builds alongside** it. Both honor the constraint (neither lets an *unmeasured* claim
stand); they differ on whether reproduction work may begin before the instrument is finished.

- **B — co-evolution. [recommended]** Start the first target and the validator together; the target is the
  forcing function that drags the validator to parity-grade (a reproduction target is the hardest possible
  oracle — there *is* a ground-truth rendering to diff against, unlike exploratory testing). Parity *claims*
  still gate on confirmed measurement, so nothing unmeasured ships; what's relaxed is only the prohibition on
  *starting*. Tradeoff (merit): the validator gets specified by a concrete, adversarial target instead of in
  the abstract — and the program isn't idle behind a long pole. Residual: early targets carry provisional
  (explicitly-tagged, unverified) status longer; mitigated by forbidding any "done"/parity assertion until
  the gate is green.
- **A — hard `blockedBy`.** The reproduction epic is blocked until the validator (#1167 chain) is
  parity-grade. Tradeoff (merit): zero risk of a provisional claim leaking as fact. Rejected as default: it
  starves the validator of its best specifying input and stalls the program on a dependency whose own scope
  is still forming — and the constraint is already enforced by the *claim* gate, so the *start* block buys
  little.

**Recommended: B (co-evolution), with the claim-gate as the hard invariant.** *Red-team note for the
decider:* the attack on B is "provisional work masquerades as validated." Answer: the gate is on the
*claim*, not the *work* — every target stays `PLATFORM-GAP`/provisional-tagged until measured, mirroring the
exercise-app tagged-bypass discipline.

## Fork 2 — who owns the validation engine?

*Fork-existence:* the validator is one capability with a real ownership either/or, because two ratified
positions currently point different ways and must be reconciled — #1167 frames an **FUI-owned** explorer
engine; the standing *vision-is-a-Plateau-service, no-leakage* rule
([#475](/backlog/475-vision-is-a-plateau-service/), `we:docs/agent/platform-decisions.md`) says any vision
capability is a Plateau service the WE project consumes as a client. They cannot both wholly own it.

- **Layered split. [recommended]** Reconcile by cutting at the capability seam:
  - **FUI owns the explorer engine** (#1167) — it drives FUI's own components, navigates states, captures
    renders. Impl + rendered display is FUI's per the docs-rendering boundary
    (`we:docs/agent/platform-decisions.md#we-fui-embed-boundary`).
  - **Plateau owns the judgment** — the vision/VLM verdict service (#1221 tier-2 on-device judge), per #475
    no-leakage; the linear-cost-with-revenue rule keeps it on-device/fixed-cost
    ([Linear Cost → On-Device]).
  - **WE consumes only the deltas** — pass/fail + structured gap list become backlog intake; WE never renders
    FUI nor runs the judge, it ingests outputs (same client posture as #475).
  Tradeoff (merit): each piece lands in its ratified home, no boundary is bent. Residual: a three-party seam
  needs a crisp contract for the verdict/delta payload (a small protocol, likely Plateau→WE).
- **Single FUI-owned engine (incl. judgment).** Rejected as default: folds the vision judgment into FUI,
  contradicting #475 (vision never lives outside Plateau) and the on-device cost rule; #1167's "FUI-owned
  engine" is about the *driver*, not the *judge*.

**Recommended: the layered split** — FUI engine, Plateau judgment, WE consumes deltas.

---

## Context

### Supported by default (not decisions)

- **Output shape is already ratified.** A reproduced design system *is* a #747 bundle:
  `{ themeTokens, intentDefaults, traitDefaults }` extending the platform default
  ([#747](/backlog/747-design-system-equals-theme-plus-intents-bundle-manifest-catalog/);
  `material-like` already exists as a POC in `we:design-systems/`). No new composition contract is minted —
  this program *fills* bundles, it doesn't invent the format.
- **Placement follows the standing boundary** (`we:docs/agent/platform-decisions.md#we-fui-embed-boundary`):
  **WE** owns the theme-token contract (`we:webtheme/`), intent standards (`we:src/_data/intents/`), and the
  new **reproduction-parity conformance vectors** (same class as the behavioral-conformance vectors WE owns
  per [#817](/backlog/817-) / #899). **FUI** builds the themed component packs and hosts their demos. **Plateau**
  owns the vision judgment. Only contracts + deltas cross seams; FUI source never enters WE.
- **The target list already exists.** The gap-sweep corpus
  ([#316](/backlog/316-benchmark-corpus-design-systems-ui-libraries/),
  `we:src/_data/benchmarkCorpus.json`) enumerates 26 incumbents with explicit selection criteria — this
  program draws targets from it, and feeds bucket-3 gaps back into the gap-sweep matrix
  (`we:src/_data/benchmarkCoverage.json`). Reproduction-conformance is the *deep* complement to gap-sweep's
  *broad* inventory.
- **The render substrate is proven.** The dogfood epic
  ([#777](/backlog/777-dogfood-the-we-docs-website-on-fui-components-rework-the-sit/)) + mode-C in-document SDK
  (#786) already render FUI components in-process under Shadow-DOM isolation — the same mechanism a
  side-by-side parity harness needs.
- **The loop pattern is proven.** The exercise-app loop (`we:.claude/skills/exercise-app/SKILL.md`,
  [#314](/backlog/314-flagship-exercise-apps/)) is the template: scan a target → rank gaps → fill the top gap
  *in WE/FUI* (never the copy) → re-scan. Reproduction-conformance is the same loop with a parity oracle
  instead of an app-conformance scan.
- **The parity oracle is layered, not a single diff** (survey finding 2 — *support-all-three*, no branch
  excluded, so not a fork): (a) **fuzzy-tolerance pixel** for visual parity (WPT model), (b) **structural
  DOM/ARIA/focus-order diff** for behavioral parity (deterministic, no judgment), (c) an **advisory
  VLM/semantic judge** for the human-equivalence verdict pixels can't settle. Naïve pixel-diff is disqualified
  (30–40% false positives from anti-aliasing/sub-pixel/font-smoothing). This layering also separates the
  deterministic **diff engine** from the **semantic judgment** — the seam Fork 2 cuts on.

### Relationships & graduation

- **Carves an epic on ratification** (kept separate per the no-decision+epic-conflation rule): a
  `reproduction-conformance` umbrella epic, with the validator chain (#1167/#1219/#1220/#1221) as a
  co-evolving dependency (per Fork 1-B) rather than a hard block.
- **First target is a prioritization call, not a fork** (a fork decides best-end-state; *which target first*
  is sequencing). Recommendation for the carve: **shadcn/ui first** (token-driven, Radix behavior, minimal
  proprietary animation → cheapest proof the loop + validator close), **Material 3 second** (richest
  animation/behavior → highest gap yield, hardest stress on the validator). All corpus targets are eventual;
  order is set at prioritization time.
- **Validator dependency:** [#1167](/backlog/1167-autonomous-exploratory-ui-testing-tool-fui-owned-engine-that/)
  and its slices are the measurement instrument; this program is their first concrete, adversarial consumer.
- **Feeds:** gap-sweep ([#315](/backlog/315-competitive-coverage-gap-analysis-program/)) — bucket-3 gaps land
  in the capability matrix as candidate WE/FUI work.
- **Graduation (on ratification):** spin out (1) the reproduction-parity conformance-vector contract +
  verdict/delta payload protocol; (2) the umbrella epic + per-target slices (shadcn first); (3) the validator
  co-evolution dependency edge. These are separately-prioritized builds, not authored here.
