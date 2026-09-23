---
bornAs: xtw2rap
kind: story
size: 3
parent: "3925"
status: resolved
scaffoldedBy: "graduation-page-file"
dateScaffolded: "2026-09-22"
scope: ["we:scripts/operations/graduation-progress-report.mjs", "we:scripts/operations/graduation-progress-report-io.mjs", "we:scripts/operations/__tests__/graduation-progress-report.test.mjs"]
relatedTo: ["3690", "3693", "3784", "3893"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
graduatedTo: "we:scripts/operations/graduation-progress-report.mjs"
tags: [delegation, graduation]
---

# graduation-progress-report reads the router and reports each task type graduation state for the page

The read-only operation we:scripts/operations/graduation-progress-report.mjs (#3693) disagrees with the router it describes: it counts any non-null `findings` as a problem, but 14 `landed` rows carry praise there, so it reports a streak of 0 for every triple while `selectSupervisionLevel` (we:scripts/lib/provider-routing.mjs) finds `codex/gpt-6-astra/other` at spot-check evidence. Rule 1 of #delegation-trial-record-graduation binds every read of the record to the same predicates. Rebuild the report on the router and return schema 2 (per-agent triples with state, owed evidence, promotion, criteria status), the data contract the agent graduation page reads.

## What to build

- Keep the op name, registration and compute-only shape. The pure declaration takes injected data
  (`records`, `promotions`, `probation`, `asOfIso`) and does no IO; the io file reads the store (existing
  `readStore`), we:scripts/lib/dispatch-supervision-promotions.json and we:scripts/lib/model-probation.json
  if present (absent file → source `absent`; unparseable/invalid → `invalid`; both promote nothing).
- Per triple, `evidenceLevel`, `cleanStreak`, `hasInformative` and `mostRecentVetoed` come from
  `selectSupervisionLevel`'s own result (level + `auditTrail`) — no second copy of the predicates. Parse the
  streak from the audit trail only if the router exposes nothing better; if you add a structured field to the
  router's return value instead, keep every existing router test green.
- The exact output shape, the `state` rule (first match: `unverified` → `vetoed` → `accruing` →
  `needs-positive-control` → `awaiting-promotion` / `promoted`) and the `criteria` list (rules 3–7 plus open
  decision #3734, each with its status and card) are specified in `plateau:docs/graduation-page.md` →
  "Data contract" and "The bar". Rule statuses that can be detected are detected (rule 4: any row carries an
  `informative` key; rule 5: `DEFAULT_BACKDOWN_THRESHOLDS` has `k`; rule 6: promotions source is `ok`); the rest
  are stated with their card. Never invent a threshold value. Each criterion's `detail` text is derived from
  the same source state as its tag (mock review found a promoted state whose rule-6 tag said "In force" over text
  saying no promotion exists).
- Group triples under `{provider, model}` agents; sort agents by trial count, triples by trial count.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/graduation-progress-report.test.mjs` passes,
   including new cases that fail before this lands: over the real we:scripts/conveyor/run-scorecards.json records,
   the `codex / gpt-6-astra / other` triple reports `evidenceLevel: 'spot-check'`, `effectiveLevel: 'full'`,
   `state: 'awaiting-promotion'`; `antigravity / claude-sonnet-4-6 / other` reports `state: 'vetoed'`;
   `antigravity / gemini-3.8-flash-low / conflict-resolution` reports `state: 'needs-positive-control'`; and for
   every triple `evidenceLevel` equals `selectSupervisionLevel(...).level`.
2. **Executable** — a promotions row naming `codex / gpt-6-astra / other` yields `state: 'promoted'` and
   `effectiveLevel: 'spot-check'`; an `invalid` promotions source yields `effectiveLevel: 'full'` for every triple.
3. **Executable** — `node we:scripts/operations/run.mjs graduation-progress-report --json` (redirected to a
   file under /tmp) succeeds, and its `verdict.schema` is 2 with a non-empty `verdict.agents`.
4. **Clean gate** — `npm run check:standards -- --local` reports 0 errors.
