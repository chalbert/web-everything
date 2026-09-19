# Grounding for "what clears a triggered calibration veto" (backlog #3673)

Prior-art + real-tree grounding gathered for the `/prepare` pass on #3673, so the decision item cites
real code and a real incident instead of an authored abstraction.

## The trigger, precisely

PR #2107 (`WE #3627: replace --bare/--safe-mode with --restricted for the delivery-agent provider`) was
reviewed by two advisory seats under `we:scripts/operations/review-pr.mjs`: Codex's
`judgeCorrectnessAdvisory` step (seat `CORRECTNESS_ADVISORY_LENS = 'codex-correctness'`, branch
`origin/lane/mechanical-dispatcher`, seat `#x8n4crp`) and Claude's mandatory `correctness` juror. Both
found the same real bug — `commitConvergeRound` (`we:scripts/operations/deliver-item-wrapper.mjs`) shells
`git commit -F <msgfile> -- <paths>` with no preceding `git add`, throwing on any round whose accepted
edit adds a brand-new untracked file (per `we:backlog/3383-*.md`'s own 2026-09-12 log, lines 2021–2029:
"Codex looked at the identical diff and found nothing" on the *simplicity* seat's first pass; the
*correctness*-lensed rerun is what actually surfaced the bug, per this item's own filing). Claude's
juror rated it `blocker`; Codex's `codex-correctness` seat rated it `carve-out`.

## The mechanism disposition actually routes through — not a raw severity vibe

`we:scripts/lib/jury-core.mjs` (`origin/lane/mechanical-dispatcher`), `deriveFindingDisposition` (#2950):

```js
// we:scripts/lib/jury-core.mjs — the ONE routing function; a juror never self-declares severity directly
export function deriveFindingDisposition({ introduced, worseThanBase, parallelizable } = {}) {
  const answered = [introduced, worseThanBase, parallelizable].every((a) => typeof a === 'boolean');
  if (!answered) return undefined;
  return (introduced && worseThanBase && !parallelizable) ? DISPOSITIONS.BLOCKER : DISPOSITIONS.CARVE_OUT;
}
```

A `blocker` requires all three of `introduced`, `worseThanBase`, and `!parallelizable` to hold; every
other combination of the same three booleans routes to `carve-out`. So a Codex/Claude disposition split
on the *same finding* is not "one model is stricter" in the abstract — it is at least one of these three
factual sub-answers coming out differently between the two jurors. A root-cause finding that doesn't
identify *which* of the three diverged (and why) has not actually diagnosed the miss — it has re-asserted
that it happened.

## The registry has no calibration-veto field today — the veto is institutional, not yet coded

`we:scripts/lib/model-probation.mjs` + `we:scripts/lib/model-probation.json` (`origin/lane/mechanical-dispatcher`,
not yet on `main`) track only `{provider, model} → {role: status}` (`unvalidated`/`probation`/`trusted`).
Neither the schema (`validateProbationEntry`) nor the live registry entries (`codex`/`gpt-6-astra`,
`antigravity`/`gemini-3.1-pro`) carry a `calibrationMiss` flag, a trial log, or any veto state. `#3654`'s
ratified rule ("a confirmed calibration miss is an INDEPENDENT VETO," `we:docs/agent/platform-decisions.md`
`#model-probation-graduation-criteria` clause 2) exists today only as decision text — the veto PR #2107
triggered is tracked by institutional memory (this item, `#3654`'s Grounding), not by any on-disk flag a
"clearing" mechanism would flip. #3673 rules on the *shape* of clearing; wiring a `calibrationMiss`
field (and whatever clears it) into the registry schema is separately-scoped future build work, the same
"not built here" posture #3654's own "Done when" #3 already took for the graduation bar itself.

## The coverage-vs-calibration distinction, checked against the real trial record

The epic's own 2026-09-12 log (`we:backlog/3383-*.md`, lines 1994–2050) records Codex's `advisory-review`
seat's full contemporaneous trial history against 4 real PRs (#2043, #2147, #2130, #2107): 3 of the 4
came back with **zero findings** (a coverage miss — nothing noticed at all) and only #2107 produced a
finding whose *severity* was then rated differently from Claude's juror on the same bug (a calibration
disagreement, given both graders did notice it). That 3-coverage-miss/1-calibration-disagreement split in
the one contemporaneous, on-disk record is consistent with this session's broader claim (not independently
re-verified against additional historical PRs in this pass — flagged for the reader) that the dominant
disagreement pattern between the two review seats is *coverage* (which bugs each notices at all), not
*calibration* (agreement on severity once a bug is noticed by both).

## The tooling-asymmetry finding and its proposed fix — already filed, cited not restated

`we:backlog/3675-give-codex-s-review-seat-container-scoped-write-access-to-a.md` (filed 2026-09-14, same
session) records: Codex's review seat is read-only by policy while Claude's juror has write tools and
routinely mutation-verifies; a bounded scratch-copy experiment reran 5 historical PRs through Codex
read-only vs. write-mode and found write-mode findings were far more often independently verified (a real
scratch test run) than read-only's frequent "couldn't verify" caveat, including one bug write-mode found
that read-only missed entirely (PR #1924). **This explains a coverage gap, not a severity-calibration
gap** — mutation-verification changes whether a bug is *found and confirmed*, not how a *found* bug's
`introduced`/`worseThanBase`/`parallelizable` triple gets answered once both sides see it. A tool-parity
fix (#3675) is not, by itself, evidence bearing on the #2107 calibration disagreement specifically —
noted here because #3673's Fork 1 leans on exactly this distinction.

## Not decided by this report or by #3673

Whether PR #2107's veto should have fired at all, given the above, is explicitly out of scope for
#3673 (which rules only on how a triggered veto clears, not on re-litigating #3654's veto rule or this
specific trigger) — see #3673's own "What this card does NOT decide."
