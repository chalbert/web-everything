# #608 — Forward conformance remediation ledger (preemptive sweep on the open pool)

> The **forward** run of the backlog-health audit (#607 was the retrospective half). Where #607
> observed resolved items and changed nothing, #608 runs the same apparatus over the **open** pool and
> **remediates** — the work hasn't shipped, so fixing the card is free and correct. Method:
> deterministic sweep (`npm run check:health`) → multi-agent judgment fan-out over the live risk surface
> (the 37 batchable Tier-A items + 5 Tier-B decisions, clustered by subsystem) against guiding-principle
> catalog A–E + Definition-of-Ready → **verification against precedent before acting** → remediate the
> pure-agent fixes in place, escalate only the irreducible residual. Generated 2026-06-14.

## Headline

The open pool is **healthy**. The deterministic layer (hardened by #612/#613) is near-silent on open
items: 2 soft G1 edges (`low` sev, already-known drift notes), zero open G2/G3/D1/D2. The judgment
fan-out over 42 items produced **zero genuine escalations** — every finding was either a pure-agent
remediation (applied) or a candidate that **cleared on verification**. The single most important result
is methodological: the fan-out's first pass flagged **10 exercise-app phase stories** as "missing
`blockedBy` edges," and **verification against precedent refuted all 10** — the exercise-app loop
sequences phases itself and *every resolved sibling phase story carries no `blockedBy`*, only `parent`.
Applying those edges would have force-fixed the cards via a quiet convention change — exactly the
failure the audit exists to catch. The verify stage remained load-bearing (the #607 lesson held).

## Remediations applied (pure-agent, no judgment call — verified before editing)

| # | finding | catalog | fix applied |
|---|---|---|---|
| **#595** | stray `xx2` appended to the digest line (corrupts `item.summary`) | E (digest integrity) | deleted the trailing `xx2`. |
| **#611** | stray `</content>` tag on the last body line (renders as literal text) | D (hygiene) | deleted the orphaned tag. |
| **#481** | body says "Blocked on **#480**" but `blockedBy: []` is empty | E (DAG honesty) | added `blockedBy: ["480"]` (#480 resolved → stays Tier A; records lineage). |
| **#487** | three stale `file:line` refs + a since-removed "drop the dead review enum" clause | E (concrete refs) | `scaffold.mjs:42-44`→`scripts/backlog/scaffold.mjs:42-44`; `backlog.mjs:156`→`scripts/backlog.mjs:155-177`; `backlog.js:206-209`→`:243-256` (shifted by this item's own loader edit); deleted the review-enum clause (no such enum exists). |
| **#513** | premise "design-refs/ is empty today" is stale (16 captures exist) | E (premise truth) | reworded to "design-refs/items/ holds only ~16 captures today — far below distillation volume"; kept the operational-gate framing. |
| **#504** | sizing note "no Zod adapter exists yet" is stale (`validation-generation/adapters/zod.ts` shipped) | E (premise truth) | reworded — the zod/nativeHtml/pydantic/jsonSchema adapters exist but carry no cross-field `emit()` path; the work is transpiling CEL into them, not adding an adapter. |
| **#134** | pre-flight note still lists reason #1 ("unresolved design fork") as open, contradicting the body's own "resolved by #450" section | E / B | struck reason #1 (resolved by #450 2026-06-13: tier bounded to transfers, enum stays `route\|reload`); only the verification-strategy concern remains. |
| **#086** | swappable-AI-provider shape correct but silent on *where* the AI capability lives | D (#475 no-leakage) | added a placement note: the analyzer/generator are **Plateau-served services consumed as a no-leakage client**; only the neutral-structure contract + generated output are WE-resident. |
| **#100** | same gap as #086 (AI providers' placement unstated) | D (#475 no-leakage) | added the same #475 no-leakage note — WE-resident artifacts are the requirement meta-schema + the webcases they compile to. |

All nine are factual/alignment fixes (stale ref → real path, false premise → corrected, missing
placement → cite an *already-ratified* ruling). None makes or pre-empts a design call.

## Cleared on verification (NOT findings — the value of the verify stage)

| candidate(s) | why it cleared |
|---|---|
| **10 exercise-app phase stories** (#379, #381, #383, #384, #385, #388, #416, #417, #419, #420) | The fan-out flagged each for "missing `blockedBy` build-order edges per the #317/#318 phase matrix." **Refuted by precedent:** #317 carries only a prose *thin-spine* ("S0→S1→S2→S3→S10"), not a per-item prerequisite matrix; and **every resolved sibling phase story (#378, #380, #411, #415, #418) carries no `blockedBy`, only `parent`.** The phase sequence is deliberately **loop-managed** (the exercise-app loop drives phases in order; soft preconditions live in prose, the #367 pattern), not encoded as hard edges. Lifting them would change an established convention via a quiet design call — out of bounds for remediation. **Verdict: PASS, no edit.** |
| **#615, #617, #619, #602, #610, #367** | backlog/tooling cluster, all clean: #615 alias-only (most-flexible-default), #617 data-fix (premises verified against projects.json), #619 mechanical prose-relocation, #602 is the finder/classifier (surfaces forks, doesn't pre-decide), #610 research-grounding, #367 honestly self-flags a *soft* precondition in prose (correct — not faked into `blockedBy`). |
| **#600, #601, #427, #445, #479, #577** | platform/plateau cluster, all builds of *resolved* rulings (#578/#370/#091/#092/#475/#562/#219); placement conforms to the WE→FUI→plateau-app one-way split; blockers + premises probe-verified. |
| **#605, #542, #359, #038, #588** | standards/intents/picker cluster, all clean: refs verified against the live tree, blockers resolved, no buried forks (deferred-to-build-time conditionals and `/split` grooming are not unratified forks). |
| **5 Tier-B decisions** (#606, #549, #616, #564, #584) | all **ready-to-ratify** — truthful `preparedDate`, named options + merit tradeoffs + bold default + concrete refs + a published `/research/` topic each; no decision+epic conflation; the cost/effort tells in rejected branches are correctly framed as prioritization-context or coupling-merit, not fork branches. |

## Escalation residual — the irreducible (already ready-to-ratify nods, not a raw mess)

Zero genuine *new* forks surfaced. The only items needing a human nod are the three soft calls **inside
the already-prepared Tier-B decisions** — these were ready-to-ratify before this sweep; they're listed
so the residual is explicit, not because #608 created them:

- **#606** — the timing of escape-hatch C (WE owns the plugs reference runtime *until* a second independent impl consumes plugs). Default: ratify A (WE owns).
- **#564** — Fork 2 (med confidence): name "persona/preset" in #563's methodology. The one row to actually weigh.
- **#584** — Fork 3 (med-high): two orthogonal retirement markers (reusing #192 `supersededBy`) vs a single `status` enum.

These ratify through the normal decision path (`/next decision` or `/next <NNN>`), unchanged by #608.

## Standing-gate changes (the forward gate is now permanent, not a one-time sweep)

The acceptance's second half — *make principle conformance a standing pre-flight, not just mechanics*:

1. **D3-readiness — automatic in the loader** (`src/_data/backlog.js`). An open `issue`/`idea` whose
   `relatedProject` is a `concept` project **with no shipped surface** (zero resolved items) is
   `projectPending` and **demoted out of Tier A** — the standard must exist first. Precision mirrors the
   #613 D3 fix: a `concept` label over substantial shipped work is status-drift (graduate it — #617),
   not a pending project, so its dependents stay ready. Today this holds **#604, #170** (both
   `webplugs`, 0 resolved, pending the #606 ownership ruling); it does **not** touch builds against
   webdocs/webintents/webadapters/webblocks/webvalidation (drifted-but-shipped concept labels).
2. **`npm run check:health`** — the deterministic decision-governance + ref-drift sweep
   (`scripts/audit-backlog-health.mjs`) is now a first-class npm script, runnable before a long batch.
3. **Surfacing** — `check:readiness --select` lists held items under *"Held — project pending"*;
   `check:standards` emits the same set as one aggregate warning.
4. **Docs** — [backlog-workflow.md](../docs/agent/backlog-workflow.md) → *Principle-conformance
   pre-flight* documents the three-layer gate (D3-readiness / `check:health` / judgment skim) and the
   **remediate-don't-escalate** flow with its hard boundary (*brings to DoR, never decides; never
   force-fixes via a quiet design call*). The batch skill's pre-flight cross-refs it.

## Notes

- **Verification is load-bearing (again).** As in #607, the first judgment pass over-reported — here on
  governance edges (the 10 exercise-app stories). A future forward run must keep the precedent/verify
  step: a flag is a *candidate*, never a verdict.
- The deterministic layer's near-silence on the open pool is the #612/#613 hardening paying off — the
  noise that made #607's run heavy (104 G1, 9 D1 false positives) is gone.
