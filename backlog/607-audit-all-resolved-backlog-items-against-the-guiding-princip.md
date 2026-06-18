---
type: issue
workItem: story
size: 13
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
tags: []
---

# Audit all resolved backlog items against the guiding-principle ruleset (retrospective conformance sweep)

A care-taking retrospective: verify every resolved item **and its shipped result** against the WE rule
catalog, classifying each finding as **slip / pre-rule / drift**. Dual goal — catalogue real slips to
fix later **and** stress-test + harden the audit tooling. Hard constraints: **NO code changes, NO
reopening stories**; output is a findings ledger only.

## Why

DoR today gates on *mechanics* (tier + size + `blockedBy` resolved), not on *principle conformance*. So a
resolved item could have (a) been built **ahead of / without** a governing decision, (b) made a design call
that violates a guiding principle, or (c) been correct when shipped but **drifted** since as the project
moved. None of those are visible to `check:standards`. This audit makes the invisible visible — retrospectively,
without disturbing shipped work. (Origin: the #606 plugs-ownership gap — an architectural call that was never
a ratified decision — surfaced only because a human pushed. This is the systematic version of that catch.)

## The classification taxonomy (the "care" the audit needs)

Every finding **must** be tagged, because not every rule-miss is a fault:

- **slip** — the rule applied *at the time the item was executed* and the work missed it. A real defect to
  note for later fixing (never fixed here).
- **pre-rule** — the item predates the rule (rule ratified after `dateResolved`). **Not a fault.** Note only
  if retrofitting would still pay off; otherwise record-and-move-on.
- **drift** — conformant when shipped, but the project moved since (a ref target relocated, a decision was
  later reversed, a project graduated). **Not a fault of the item.** Note for awareness; the fix (if any) is
  on the *current* state, not the resolved item.

A finding with no defensible tag is not a finding — drop it (keeps the ledger honest, same spirit as the
batch drop-reason classifier).

## The ruleset (what "our rules" means here)

The guiding-principle catalog, organized around the meta-principle **"mandate nothing / offer choice, but be
strict on correctness invariants — strictness allocated by kind."** Full catalog with sources:

- **A — Mandate-nothing / offer-choice:** support-all-coherent + fork-existence test (`we:backlog-workflow.md:243`),
  most-flexible default, dimension-vs-fixed-mechanic, native-first default (`we:AGENTS.md` hard-rule 6),
  config-extends-platform-default, intent-UX-only→Configurator, conventions-never-mandated (#436/#437),
  don't-reimplement (registry+provider, `we:design-first.md:133`).
- **B — Strict-where-it-matters:** forced-invariant=ratify (`:243a`), design-first / website-is-the-spec,
  term-first + naming, conformance-demo-required, single-substrate / Baseline-2024 (#031).
- **C — Lock-in & escape hatches:** minimize-lock-in / protocol-is-the-only-lock, adapter-as-normalization-hub
  (bidirectional), impl-is-not-a-standard (#020/#291), runtime-DI-vs-devtools-provider-seam.
- **D — Decomposition & placement (constellation):** WE→FUI→Plateau one-way arrow; placement test
  (contract/impl/product); bias-to-separation (`:247`); no-leakage client (#475); managed-offering decomposes
  across layers (#091). **The #606 class lives here.**
- **E — Decision discipline:** decisions-are-work-items; fork-is-not-prioritization (#465); prepared-fork-shape =
  DoR + truthful `preparedDate`; explicit-ratification-only (`:222`); concrete `file:line` refs (`:227`);
  no decision+epic conflation.

The subtle class to hunt hardest: **mis-allocated strictness** — a mandate where a choice belonged
(over-strict / fake invariant) or a choice where one branch is broken (under-strict / fake fork).

## Method (two layers, the apparatus already exists)

1. **Deterministic sweep** — `we:scripts/audit-backlog-health.mjs` (read-only, regenerable to
   `we:audits/backlog-health-audit.md`). Catches what the gate can't: G1 edge-gaps, G2 built-ahead-of-ruling,
   G3 ungoverned-build candidate pool, D1 dead-file-refs, D2 dangling-item-refs, D3 stale-project. First run
   (2026-06-14, 591 items): **G1=104 (0 HIGH), G2=7, G3=219, D1=8, D2=0, D3=18**.
2. **Judgment layer** — read each resolved item *and what it graduated to* against catalog A–E, confirm/clear
   each G3 candidate, apply the slip/pre-rule/drift tag. This is the bulk of the work; it does not script.
   Scale (~500 resolved items × catalog) makes it a natural multi-agent fan-out — decide mechanism at run time.

## Deliverables (the only outputs — no code, no reopen)

1. **Slips ledger** — confirmed slips, each tagged + dated + with the violated rule and the *current-state* fix
   it implies. Real fixes are filed as their own backlog items (separately prioritized), **never applied here**.
2. **Audit-improvement log** — every weakness in the audit tooling found while running it (the stress-test
   half). Confirmed improvements spin out as small items against `we:scripts/audit-backlog-health.mjs`.

### Audit-improvement log — seeded from building the deterministic sweep (2026-06-14)

Already collected while standing the tool up (these ARE the stress-test's first yield):

- **id normalization** — filenames are zero-padded (`064-…`) but body refs vary (`#64`/`#064`); ref-matching
  must `parseInt`-normalize both. *(found + fixed; keep as a regression note.)*
- **D1 false positives** — three sub-classes still leak: (a) **planned files** an open build card describes as
  *to-create* read as "dead"; (b) **assertions of absence** (`#606` citing "no `we:plugs/package.json`"); (c)
  shorthand include-dir prefixes (partially handled). Improvement: distinguish *should-exist* refs (past-tense /
  "see") from *will-create* refs.
- **G2 date-trust** — `dateResolved` on early-era items may be backfilled, so "built ahead of ruling" can be a
  stamping artifact. Improvement: cross-check git history before calling a G2 a slip.
- **G3 precision** — 219 is a coarse pool, not findings; most are ordinary builds that needed no decision.
  Improvement: narrow to *architectural* graduations (registry / layer-ownership / protocol) vs ordinary builds.
- **PROSE_PREREQ breadth** — "after #N" / "needs #N" catch non-prereq prose → G1 noise. Improvement: tighten
  to true-prereq phrasings or require proximity to a blocker cue.
- **gate interaction** — audit output must live outside `reports/` (it tripped the hidden-report gate); kept in
  `audits/`.

## Out of scope / guardrails

- **No code changes, no reopening resolved items.** The audit observes; it never edits shipped work.
- A would-be fix that requires reversing a resolved item → file a *new* item; do not touch the old one.
- Respect the slip/pre-rule/drift tag before calling anything a fault — pre-rule and drift are **not** slips.

## Follow-on

Once this run has hardened the audit, **#608** runs it *preemptively* on the open pool (forward-looking
conformance gate). This item is closed-item retrospective; #608 is open-item pre-flight.

## Progress

- **Status:** resolved — both ledgers delivered, follow-ons filed.
- **Deliverables:**
  - [`we:audits/607-slips-ledger.md`](../audits/607-slips-ledger.md) — judgment-confirmed findings, post-verification.
  - [`we:audits/607-audit-improvement-log.md`](../audits/607-audit-improvement-log.md) — tool weaknesses (the stress-test half).
  - Deterministic input: [`we:audits/backlog-health-audit.md`](../audits/backlog-health-audit.md).
- **What the sweep found** (596 items; deterministic G1=104/0-HIGH, G2=7, G3=219, D1=9, D2=0, D3=18):
  - **G2 ×7 → 0 slips** (all date artifacts — backfilled/born-resolved-at-import frontmatter, false lineage, or correctly-deferred forward-ref).
  - **G3 → 1 drift, 2 refuted.** Judgment proposed 3 ungoverned-arch slips (#353/#355/#357); **adversarial verification killed 2** (#355 governed by decision #409, #357 by the #314 charter — both prose/epic links invisible to the frontmatter-only tool) and **downgraded #353** (weblifecycle) slip→drift (carve-rule co-dated the commit). ~40 other arch candidates cleared.
  - **Strictness hunt (110 resolved decisions): 0 slips, 4 pre-rule** mis-allocations (#023 conflation, #045 fake-invariant, #107/#183 fork-as-prioritization).
  - **D1 ×9 → all false-positives; D3 ×18 → 4 genuine project-status drift; G1 ×104 → ~90% noise, 0 slips.**
  - **Net: zero clean slips.** Real yield = pre-rule mis-allocations + current-state drift + a hardened-tool backlog.
- **Follow-ons filed:** tool — #612 (G3/G2 governance-lineage precision; the verify-load-bearing fix), #613 (D1/D3/G1 drift+noise precision), #614 (graduatedTo hygiene). Current-state fixes — #615 (`shadowrootmode` alias / #045), #616 (retroactively ratify weblifecycle / #353), #617 (graduate 4 `concept` projects / D3). #608 re-pointed `blockedBy: [607, 612, 613]`.
- **Guardrails honored:** no code changed, no item reopened — ledgers only; every fix is a separately-prioritized new item.
