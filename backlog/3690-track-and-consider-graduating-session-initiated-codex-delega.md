---
bornAs: xwzihdg
kind: decision
status: open
dateOpened: "2026-09-14"
relatedTo: ["3654"]
tags: [codex, delegation, model-routing, graduation, scorecard]
---

# Track and consider graduating session-initiated Codex delegation as a trusted capability

Tonight (2026-09-14), for the first time, an interactive orchestrating Claude Code session delegated real work directly to Codex via we:scripts/codex-direct-task.mjs, using a Codex-drafts/Claude-subagent-verifies-and-lands pattern -- because the orchestrating session's own standing rule (ask a subagent, never shell out itself) blocks it from running Codex directly. First live trial: PR #2223 (pid-forwarding fix), in progress. Idea: treat this like a real subagent type earning trust rather than an ad hoc one-off -- track trials, then consider graduating it to a named, trusted capability. See body for the two-part idea and #3654 as precedent.

> **Update (2026-09-15):** the tracking mechanism is now built and today's real trials are backfilled — see
> `## Implementation notes` and `## Progressive backdown plan` below. The graduation decision itself (this
> card's `kind: decision`) is still open and not ratified by this update.

## The idea

1. **Start small and deliberately track outcomes.** Reuse this repo's existing scorecard/graduation-data
   pattern -- we:scripts/conveyor/run-scorecards.json, already used for the mechanical dispatcher's own
   model-probation graduation criteria (#3654) -- to record each session-initiated Codex delegation trial:
   the task given, what Codex produced, what the verifying Claude subagent's scrutiny found (good/bad, and
   specifics), and whether it landed.
2. **Once enough trials accumulate with a clean track record, consider graduating the pattern** --
   formally recognizing session-level delegation to Codex (and eventually other models) as a trusted, named
   capability alongside Claude subagents, rather than an improvised one-off each time. This follows the same
   spirit as #3654's graduation-criteria work (bar scales with role authority, an informative-trial
   requirement, a calibration-miss veto) but applied to a different context: an interactive orchestrator
   delegating ad hoc work, not the autonomous mechanical dispatcher.

## Open questions (left for a future /prepare-decision-item pass)

This filing deliberately does not resolve:

- What counts as "enough" trials before graduation is even considered.
- What the graduation bar should be for this context (interactive session delegation), as distinct from
  #3654's bar for the mechanical dispatcher's autonomous model-probation.
- Whether tracking reuses we:scripts/conveyor/run-scorecards.json directly, or needs its own tracking file
  (that file currently lives only on branch `lane/mechanical-dispatcher`, not yet on `main`).

Per this repo's "never take an unprepared decision" rule, these are left open here and belong to whichever
future session runs `/prepare-decision-item` on this card.

## Implementation notes (2026-09-15)

The third open question above ("does tracking reuse `we:run-scorecards.json` directly, or need its own file?")
is now resolved as an implementation detail, not a governance decision (does not require a full decision
ceremony): **reuse `we:scripts/conveyor/run-scorecards.json`'s existing pattern/shape directly — same file,
same convention — rather than inventing a new file.** Reasoning: less new surface, and it is the direct
precedent this card's own body already cites (`#3654`). Practically, this meant landing the mechanism in a
lane based on `origin/lane/mechanical-dispatcher` (where that file and its store module currently live, not
yet on `main`) rather than the usual `origin/main`-based lane — the tradeoff accepted here is a one-time,
low-severity merge cost (a JSON data conflict on `we:run-scorecards.json`, and this file's own added content)
whenever `lane/mechanical-dispatcher` eventually graduates to `main` (tracked separately, `#3443`), in
exchange for not duplicating the store module or inventing a second, parallel data file.

The mechanism: `we:scripts/conveyor/log-delegation-trial.mjs` (`logDelegationTrial`) — a thin wrapper over the
existing `we:run-scorecard-store.mjs#appendScorecard`, stamping `subjectClass: "work-agent"`,
`dispatchKind: "session-delegation"` on every row, plus this context's own required fields:
`taskDescription`, `taskType` (`bugfix` / `conflict-resolution` / `doc-fix` / `self-fix` / `other`),
`outcome` (`landed` / `rejected` / `reworked`), `verifiedBy` (`claude-subagent` / `independent-claude` /
`other`), and optional `findings` / `item` / `pr` / `retroactive`. No changes were needed to
`we:run-scorecard-store.mjs` itself — its validator already accepts arbitrary extra row properties, and
`subjectClass: "work-agent"` / an arbitrary non-empty `dispatchKind` string were already within its existing
contract.

Tonight's real trials (2026-09-14) were backfilled via `we:scripts/conveyor/backfill-2026-09-14-delegation-trials.mjs`
(kept in the repo as the durable record of how the data got there — see that file for the literal 9
records). Current counts: **Codex 8 trials** (5 clean, landed — a pid-forwarding fix `PR #2223`, a real
conflict resolution `PR #2212`, a self-fix of its own ENOBUFS failure, a NUL-byte fix `#3428`, a doc fix
`#3539` — plus 3 rounds of hardening `we:codex-direct-task.mjs`/`we:gemini-direct-task.mjs`, of which the first
two rounds each had a real finding from independent review, including a filename-quoting bug, fixed before
landing, and the third round was clean); **Gemini 1 trial** (building `we:gemini-direct-task.mjs` itself,
verified only by a live smoke test rather than a Claude-subagent review — see that record's own `findings`
note on why it carries lighter evidentiary weight, and why `we:gemini-direct-task.mjs`'s own lack of a pinned
default model means even the trial's `model` label is a best-effort record, not a confirmed identity, unlike
Codex's pinned `gpt-6-astra`). Gemini's much smaller trial count is expected and accurately reflected, not
padded.

## Progressive backdown plan

**Full verification (the current, standing baseline — what every trial above actually got tonight):** a
Claude subagent reads the real diff before it lands, real tests run and must pass, `check:standards` runs
clean, and a SEPARATE independent-review-for-landing pass (a second Claude subagent, or a fresh `claude -p`
process, per this repo's own escalation pattern) reviews the finished diff before it is allowed to land. This
is mandatory for every trial of a `{model, taskType}` pair that has not yet cleared the bar below, and for
every pair the first time it is ever seen.

**Downgrade bar**, mirroring `#3654`'s already-ratified shape (bar scales with authority / an informative-
trial requirement / a calibration-miss independent veto), applied here with `taskType` standing in for
`#3654`'s "role" as the risk-scaling axis (this context has no role axis; task type is the closest real
proxy for how much damage an unsupervised miss could do):

- **Unit of trust: `{provider, model, taskType}`, never broader.** A clean streak in `{codex, bugfix}` does
  not let `{codex, conflict-resolution}` skip its own accumulation, and a clean streak under one model never
  transfers to a different model from the same provider (mirrors `#3654` Fork 4's "identity never inherits
  trust" principle).
- **N = 5 consecutive clean trials** for that exact `{provider, model, taskType}` triple, counting only
  trials where `verifiedBy` is `"claude-subagent"` or `"independent-claude"` — a trial verified `"other"`
  (e.g. a smoke test, like tonight's one Gemini trial) carries lighter evidentiary weight and does not count
  toward, or break, a streak either way.
- **Informative-trial requirement (mirrors `#3654` Fork 1b):** the triple's streak additionally requires
  that at least one trial EVER recorded for that triple (not necessarily inside the current streak) was
  genuinely informative — i.e. surfaced a real finding from independent review (`findings` non-null on some
  past row) that was then fixed and landed clean. A triple with only ever-trivial, ever-clean trials does not
  qualify at N=5; it needs a real, once-caught-then-fixed data point on record first. (`{codex, bugfix}`
  already has this, from tonight's two hardening-round findings — once it separately accumulates 5
  consecutive clean trials counted from AFTER the most recent finding, it qualifies. It does not yet: its
  current trailing clean streak, as of this backfill, is 1 — round 3 only.)
- **Calibration-miss independent veto (mirrors `#3654` Fork 2b):** ANY confirmed finding from independent
  review on any future trial for a `{provider, model, taskType}` triple immediately resets that triple's
  streak counter to 0 and pulls it back to full verification — a hard reset, not a decayed average, and
  independent of how long the prior streak was.
- **Uniform floor per triple, never loosened by provider reputation (mirrors `#3654` Fork 4a):** Codex and
  Gemini are held to the identical N and identical rules for the same task type; Gemini's smaller trial count
  tonight reflects that it has simply not yet accumulated trials, not that it is held to a stricter or looser
  bar.
- **What downgrading actually changes:** once a triple clears the bar, its future trials get a LIGHTER Claude
  spot-check — verify the acceptance criteria are met and tests pass — and SKIP the separate independent-
  review-for-landing pass (the single subagent diff read at landing time stays; only the extra independent
  pass is dropped). Escalate back to full verification immediately on any finding, per the veto above.

**Current standing, per triple, as of this backfill (none qualify yet — all remain on full verification):**

| Triple | Trials | Trailing clean streak | Ever-informative? | Qualifies? |
|---|---|---|---|---|
| `{codex, gpt-6-astra, bugfix}` | 5 (2 clean pre-hardening + 3 hardening rounds) | 1 (round 3 only — rounds 1-2 broke it) | Yes (2 findings on record) | No — needs 4 more consecutive clean |
| `{codex, gpt-6-astra, conflict-resolution}` | 1 | 1 | No | No |
| `{codex, gpt-6-astra, self-fix}` | 1 | 1 | No | No |
| `{codex, gpt-6-astra, doc-fix}` | 1 | 1 | No | No |
| `{antigravity, gemini-3.1-pro, other}` | 1 (verified `"other"`, does not count) | 0 | No | No |

No numeric N adjustment is proposed here — this states a concrete, usable-now default (mirroring `#3654`'s
own "no ungrounded number, but a real proposed default" posture), not a placeholder. Whoever next reviews a
`we:log-delegation-trial.mjs` call site should compute a triple's live streak straight from
`we:scripts/conveyor/run-scorecards.json` (filter `dispatchKind: "session-delegation"`, group by
`{provider, model, taskType}`, walk records in `scoredAt` order) — no separate rollup file is built by this
card.

## Done when

1. **Executable** — `node we:scripts/conveyor/log-delegation-trial.mjs --help` exits 0 (fails today: the
   file does not exist before this lands), and
   `node -e "const d=require('we:scripts/conveyor/run-scorecards.json'); if (!d.records.some(r=>r.dispatchKind==='session-delegation')) process.exit(1)"`
   exits 0 only once real `session-delegation` rows are present (fails today: zero such rows exist before
   this lands).
2. **Not a ratified decision** — this card's `status` stays `open`; only the tracking mechanism, the
   backfilled trial data, and the progressive backdown plan are delivered here (see `## Implementation
   notes` and `## Progressive backdown plan` above). The graduation call itself is untouched.
