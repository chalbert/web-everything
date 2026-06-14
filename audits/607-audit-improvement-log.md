# #607 — Audit-improvement log (the stress-test half)

> Every weakness in the audit apparatus (`scripts/audit-backlog-health.mjs` + the judgment method)
> found while running the #607 retrospective sweep. This is the deliberate second goal of #607:
> harden the tool before #608 runs it preemptively on the open pool. Confirmed improvements are
> filed as their own items (column). Generated 2026-06-14. No tool code changed in this run.

## Why this half mattered most

The judgment layer produced 3 G3 "confirmed slips"; adversarial verification then **refuted 2 of
them** because a governing decision existed in prose or one epic-hop up that the tool's
frontmatter-only lineage walk could not see. Run without the verification layer, the tool would
have reported two healthy items as faults. That single failure mode (#1 below) is the highest-value
fix and the reason #608 is now `blockedBy: [612, 613]`.

## Improvements (filed)

### 1 — G3/G2 governance-lineage precision → **#612**
- **G3 lineage walk is too shallow.** It only walks `blockedBy`/`parent` frontmatter, so a slice
  whose governing `type:decision` sits one epic-hop up (parent→epic→decision) or is named only in
  prose ("ratified in #N", "ruled by #N") reads as ungoverned. Of ~40 architectural candidates,
  only 1 survived as a real (drift) finding; the rest carried a decision the tool couldn't see.
  **Fix:** walk `parent`→epic→that epic's decision lineage transitively, **and** extract body `#NNN`
  refs and clear any that resolve to a resolved `type:decision`.
- **G2 trusts backfilled dates.** It compares two frontmatter `dateResolved` values; early-era items
  were bulk-imported (some born `status: resolved` at the repo's first commit, with prior-tracker
  `dateClosed`), so it manufactured 7 artifacts, 0 real. **Fix:** derive *resolved-at* from the
  commit that flips `status: resolved`; exclude items already resolved at the repo's first commit
  ("imported / undatable"); require the `blockedBy`/`parent` edge to **actually exist** before
  asserting a governance link (#21/#29 had none).

### 2 — D1/D3/G1 drift + noise precision → **#613**
- **D1 produced 9 hits / ZERO true dead-refs.** Three suppression sub-classes (one new):
  *(a)* **assertion-of-absence** — a backticked path governed by negation in the same clause
  ("there is no `plugs/package.json`"); *(b)* **will-create / planned file** — a path in an open
  build card's deliverable prose ("a page at `demos/converter.html`"); *(c)* **generated output**
  *(new)* — a path governed by a write/emit verb ("`check:app-conformance` writes
  `reports/…burndown.json`"). Plus **resolution gaps**: resolve a bare suffix against the dir named
  in the same section, and split slash-joined name **enumerations**
  (`blocks/intents/plugs/protocols/projects.json` = five real `src/_data/*.json`) before resolving.
- **D3 fires per-item, not per-project.** All 18 hits are on the *flagged item's* `relatedProject`
  regardless of that item's status, so none is the item's fault. **Fix:** aggregate per project
  (resolved-item count + presence of a live render surface) and flag the *project*; and distinguish
  intentionally-pending status (`webplugs` is correctly `concept` pending #606 — a false positive)
  from stale drift (webadapters/webintents/webblocks/webvalidation, see slips-ledger → #617).
- **G1 PROSE_PREREQ over-matches** (~90% noise, 0 slips). **Fix:** drop `per`/`ruled by` (lineage)
  and `after`/`once` (temporal/prioritization); keep `gated on`/`depends on`/`requires`/`builds on`;
  for `blocked by/on` skip when another `#M` is within ~40 chars to the left; suppress to INFO when
  both ref and host are resolved. 104 → single digits.

### 3 — `graduatedTo` field hygiene → **#614**
- The field is pervasively **prose-polluted** (multi-sentence narratives instead of an entity id)
  and **mixed-convention** (`project:webcompliance` vs bare `webcompliance` vs `webcompliance/gate.ts`
  vs prose). Worse, a project-creation item and its slices graduate to **different strings**
  (`weblifecycle` #353 vs `lifecycle` #380/#391; `webaudit` #357 vs `audit-trail` #399), defeating
  entity-graph joins and the G3 lineage walk. **Fix:** normalizer + `check:standards` rule
  constraining `graduatedTo` to `{project:|protocol:|intent:|block:|adapter:}<id>` or a repo path,
  with narrative moved to the body. (Improvement #1's lineage walk is only as reliable as this field.)

## Method-level note (not a tool bug, a process confirmation)

- **Adversarial verification is load-bearing, not optional.** The refute-by-default pass is what
  turned 3 raw "slips" into 1 drift + 2 cleared. A future run of this audit (or #608) must keep the
  verify stage; the deterministic flags and even the first judgment pass over-report governance
  faults whenever a decision lives in prose/epic. Until #612 lands, treat every G3 hit as a
  *candidate* requiring the prose/epic decision check before it's called a fault.

## Carried forward from standing the tool up (2026-06-14, pre-existing)

Recorded in #607's body when the deterministic sweep was first built; confirmed by this run:
id-normalization (zero-padded filenames vs `#64`/`#064` refs — fixed); audit output must live
outside `reports/` (tripped the hidden-report gate — kept in `audits/`).
