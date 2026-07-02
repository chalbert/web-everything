# Project-lifecycle vocabulary — prep research for decision #2134

**Date**: 2026-07-02
**Point**: brings #2134 (project-status vocabulary drift → distinct PROJECT_LIFECYCLE statute amendment) to the Definition of Ready — three-way drift grounded file:line, prior art surveyed, two forks authored with bold defaults, skeptic + two-confusion screen run.
**Research page**: `/research/project-lifecycle-vocabulary/`

---

## Question

The project `status` axis is named by three different vocabularies — the data convention (`concept` 17 / `poc` 24 / `draft` 4 across the 45 `we:src/_data/projects/*.json` entries), the public five-stage ladder (`we:src/project-lifecycle.njk:11-69`), and the descriptor enum `LIFECYCLE = {concept, draft, experimental, active}` (`we:scripts/check-standards-rules.mjs:789`) whose synonym map deprecates `stable` → `active`. The statute deliberately keeps project status outside `LIFECYCLE` (`we:docs/agent/platform-decisions.md:136-143`, rule 6), so closing the drift is a statute amendment: which vocabulary is canonical, and does the gate enforce it?

## Recommendation

- **Fork 1 — canonical vocabulary:** a **distinct `PROJECT_LIFECYCLE = {concept, poc, draft, candidate, stable}`** matching the public ladder, exported beside the descriptor `LIFECYCLE`. Zero migration (45/45 entries already conform), the load-bearing `concept` literal (D3-readiness, `we:src/_data/backlog.js:114-120`) untouched, and per-track ladders match all surveyed prior art — the descriptor enum is self-described as the "Implementation-lifecycle vocabulary" (`we:scripts/check-standards-rules.mjs:784`; Block-scoped `active`⇒`implementedBy` warn at `we:scripts/check-standards.mjs:172`), a meaning a zero-impl WE project (#1282) cannot take.
- **Fork 2 — enforcement:** **enum-validate project `status` in `check:standards`, error severity, day one, no synonym map** — the tier precedent (#2088 Fork 3, `validateProjectTier`) adjacent in the same file; status rules "never warn" by house design.

## Key findings

- The data is clean — the drift is definitional (between the three definitions), not in the entries, so the ladder-matching amendment is zero-migration.
- The render seam is axis-agnostic: the `projectStatus` macro (`we:src/_includes/project-status.njk`) serves both project pages and plug/state descriptor pages, and `we:src/css/style.css:962-969` already provisions meter fills for the union of both vocabularies (incl. `candidate`/`stable`) — no render changes needed.
- A stray **fourth** spelling exists: `"status": "speculative"` in the orphaned pre-#1157 root spec `we:src/_data/webhandlers.json:5` (dead file, no consuming template) — the concrete cost of an unvalidated convention; cleanup filed as a follow-up build on ratification.
- `stable` would be canonical-for-Project while staying a deprecated descriptor synonym — acceptable (checks are kind-keyed) but the amendment text must state the word reuse explicitly.
- Prior art (W3C maturity levels, TC39 stages, Node stability index, USWDS/Polaris/Carbon lifecycles vs the npm dist-tags counter-model): declared value + **one closed normative home** + mechanical validation; distinct tracks keep distinct ladders.
- Skeptic verdicts: both forks SURVIVE-WITH-AMENDMENT. Fork 1 gained **A1** (mechanical kind-guard — `checkStatus`'s deterministic `stable`→`active` reference-autofix must be unreachable for Project files) and **A4** (codification updates the `#portfolio-project-tiering` lineage forward-reference at `we:docs/agent/platform-decisions.md:470-472`). Fork 2 gained **A2** (missing/empty `status` is an error — the `validateProjectTier` required-field shape, not `checkStatus`'s `!status` early-return), **A3** (codification touches the two gate comments the amendment falsifies), and scoped rhetoric (the orphaned `speculative` is structurally invisible to the gate — `loadDataRegistry('projects')` globs only `we:src/_data/projects/*.json`; that instance is closed by the follow-up deletion). Two-confusion screen (fresh-context agent): Fork 1 `flagged(impl) → fix applied` (A1's *mechanism* ratification re-layered down to Supported-by-default — the fork keeps only the invariant that the descriptor autofix is mechanically unreachable for project data), Fork 2 `clear`. Full verdict + screen lines per fork in the item (`we:backlog/2134-project-status-vocabulary-drift-amend-the-statute-with-a-dis.md`).

## Files created/modified

| File | Action |
|---|---|
| `we:backlog/2134-project-status-vocabulary-drift-amend-the-statute-with-a-dis.md` | rewritten to prepared-fork shape (grounding digest, 2 forks, skeptic + screen lines) |
| `we:src/_data/researchTopics/project-lifecycle-vocabulary.json` | new research-topic registry entry |
| `we:src/_includes/research-descriptions/project-lifecycle-vocabulary.njk` | new research write-up |
| `we:reports/2026-07-02-project-lifecycle-vocabulary.md` | this report |
