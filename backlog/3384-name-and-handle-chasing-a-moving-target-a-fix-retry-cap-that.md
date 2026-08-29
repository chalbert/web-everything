---
bornAs: x5y1l6r
kind: decision
status: open
dateOpened: "2026-08-28"
preparedDate: "2026-08-28"
tags: [plateau-loop, delivery, conveyor, retry-cap, observability, care-elevated]
relatedTo: ["3383", "2643", "2666"]
relatedReport: reports/2026-08-28-conveyor-retry-cap-staleness-vs-failure.md
---

# Name and handle chasing a moving target — a fix-retry cap that cannot tell staleness from a real failure

## The observed incident

Landing a fix for a PR triggered a rebase (main had moved). The rebase started fresh CI, which found a
NEW instance of the SAME staleness — because main had moved AGAIN in the time the fix/CI cycle took.
Repeated four times, this read as flapping to whatever was watching, and the PR was closed without
merging. The PR's underlying fix was never actually wrong; it was racing a `main` that moved faster than
one fix-and-verify cycle could complete.

## The mechanism, traced (corrected in prep — it is guard 3b, not guard 3)

The card as filed named `planFixSpawns` (`we:scripts/conveyor/tick-core.mjs:383-417`, "guard 3", the
`review:changes` fix loop) as the blind counter. Prep re-traced the actual causal chain and that
attribution is wrong for the staleness-restart part of the incident, though guard 3 is where the cycle
*starts*:

1. A human/AI review bounces the PR `review:changes`. `planFixSpawns` dispatches a fix agent, bumping
   `fixAttempts[pr]` (`we:scripts/conveyor/tick-core.mjs:383-417`, cap `DEFAULT_FIX_RETRY_CAP = 3` at
   `:121`). This dispatch is **always a genuine repair attempt** — `hasReviewChanges` is the only trigger,
   and it is set by a human/AI naming a real finding
   (`we:skills-src/conveyor/fix-agent-brief.md` has no
   "nothing to fix" branch — the fix agent is always expected to make a real change). So guard 3's own
   counter faithfully counts real attempts; it is not where the blindness lives.
2. On success the fix agent re-pushes and swaps the label `review:changes → review:pending`
   (`we:scripts/conveyor/rearm-review.mjs:1-13`) — `review:pending`
   is a `REVIEW_PARK_LABELS` entry
   (`we:scripts/conveyor/tick-core.mjs:138`). The PR is now review-parked, not `review:changes`.
3. If `main` moves again before a human/AI re-review lands, the PR goes `mergeStateStatus: BEHIND`
   (populated live from `gh pr list` — `we:scripts/readiness/conveyor-state.mjs:198,215`). A
   review-parked + BEHIND PR is exactly `isCiHealTarget`'s second trigger
   (`we:scripts/conveyor/tick-core.mjs:207-213`: `isBehind(prRow) && isReviewParked(labels)`), and it
   explicitly **excludes** anything still carrying `review:changes` ("owned by the fix loop, which
   already rebases" — `:210`) — so a re-armed PR that falls behind again is CI-heal's problem, not the fix
   loop's, by construction.
4. `planCiHealSpawns` ("guard 3b", `we:scripts/conveyor/tick-core.mjs:482-516`) dispatches a CI-heal
   agent and bumps a **separate** counter, `ciHealAttempts[pr]`, against its own separate cap
   `DEFAULT_CI_HEAL_RETRY_CAP = 3` (`:125`). This is the counter the observed incident's "four
   rebase-triggered restarts" almost certainly burned through — it has the identical blindness the card
   describes (every dispatch counts the same, rebase-only or not), but it lives in a different function
   than the one the card named.

**Scoping finding (changes what "Done when" should require): only `planCiHealSpawns` needs a fix.**
`planFixSpawns`'s attempts are never rebase-only by construction (step 1 above), so its cap already means
what it claims to mean. Fixing only `planCiHealSpawns` (and `isCiHealTarget`'s `behind` trigger
specifically — see Fork 1) is sufficient to stop this failure mode; touching `planFixSpawns` would be
unnecessary scope.

### The close mechanism — traced, not left open

The card flagged this as untraced. It is now traced, to a negative result: **no code in this repo
auto-closes a PR.** Evidence:
- A repo-wide grep for any PR-close call (`gh pr close`, a `state: closed` mutation, a stale-PR bot) across
  `we:scripts/**/*.mjs` and `we:.github/workflows/*.yml` returns nothing that issues a close — only code
  that *detects* an already-closed PR (`we:scripts/conveyor/pr-watch.mjs:131`: `if (state === 'CLOSED')
  return 'closed';` — read-only classification of `gh pr view`'s state, never a write).
- The conveyor SKILL is explicit that a closed PR is a *human* action to investigate, never a mechanized
  outcome: "**closed (watcher `4`)** — the PR was closed without merging (**a human abandoned it**). The
  runner surfaces it as an **anomaly to investigate**"
  (`we:skills-src/conveyor/SKILL.md:496-497`).
- Both retry-cap surfaces are worded as a hand-off, never a close: `fix-exhausted` → `"run /review N"`
  (`we:scripts/conveyor/tick-core.mjs:405`); `ci-heal-exhausted` → `"run /review N"` (`:503`). Neither
  note, nor anything downstream of it in this repo, calls a close verb.
- No stale-PR GitHub Action exists (`we:.github/workflows/` has no `actions/stale` or equivalent).

So "an automated cleanup closed the PR" in the observed incident was, on this repo's actual code, **a
human closing it in response to a repeated `ci-heal-exhausted` (or `fix-exhausted`) surface** — the
surface did its job (flag a PR that looks stuck), and the human misread "flagged 4× in a row" as "genuinely
broken" because the flag itself couldn't tell staleness from failure. That misreading is the real cost
this decision fixes: not a rogue auto-close to disable, but a false signal that reliably fools whoever
(human or AI) is watching it.

## Why this needs a decision, not a patch

Distinguishing "still behind main, no real regression" from "genuinely broken, same failure twice" needs a
real design choice with real failure-mode tradeoffs (a too-lenient distinguisher lets a genuinely broken PR
loop forever under cover of "just staleness"; a too-strict one reproduces today's bug) — exactly the kind
of fork that should be talked through, not decided solo inside a retry-cap tweak. Prep ran prior art (the
repo already solved an adjacent version of this exact problem — see the fork below), the 7-question
per-fork classification, a skeptic sub-agent attack on the recommended default, and a fresh-context
two-confusion screen; all three are folded into the fork below.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Fork 1 — how `planCiHealSpawns` tells "nothing real happened" from "a real attempt failed"** | **(a) the CI-heal agent self-reports whether it committed anything beyond the mechanical rebase**, recorded on its own durable comment marker | (b) infer it after the fact from a contribution-fingerprint diff (`normalizeContributionFingerprint`) | Med-high — (a) is exact and free; (b) has a documented false-mismatch on this exact path |

## Fork 1 — the classifying signal for `planCiHealSpawns`'s counter

**Fork-existence.** Three candidate signals were on the table when this card was filed: a contribution
fingerprint diff, a which-check-failed comparison, and "split the counter." Per-fork classification
dissolved two of the three:
- "Split the counter" is not a rival signal — it is the *architecture* (a cap that counts only
  budget-worthy attempts) that any of the other two signals would have to feed. It is folded into the
  default below as the delivery mechanism, not offered as its own branch.
- "Which check failed" does not apply to the dominant trigger at all: `isCiHealTarget`'s `behind` reason
  (`we:scripts/conveyor/tick-core.mjs:212`) is a `mergeStateStatus` signal, not a check failure — there is
  no "which check" to compare when nothing failed. For the `red-ci` reason, where a check identity does
  exist, comparing it is a strictly noisier proxy for the same underlying question the fingerprint answers
  exactly (same check name ≠ same underlying cause — flaky/matrix jobs reuse names; a genuinely different
  regression can trip the same-named check twice). It is excluded as dominated, not merely
  deprioritized — see the prep skeptic's axis-0 finding below for the one caveat it leaves open.

That leaves a genuine either/or between **(a)** a direct self-report from the CI-heal agent and **(b)**
an inferred contribution-fingerprint diff — two mechanisms for the same fact ("did this attempt's content
actually change?") that should not both be built: composing them would only let (b)'s false-mismatch (below)
veto (a)'s correct, exact answer.

- **(a — recommended) Self-report on the durable marker.** The CI-heal agent's own brief already
  determines this fact mid-run — "If a clean rebase already fixes it … no code change is needed" vs "If a
  real break remains … repair" — and its commit step is conditional on it: "omit \[the commit\] if the
  rebase alone healed it"
  (`we:skills-src/conveyor/fix-agent-ci-brief.md:89,124`).
  Record that boolean directly on the durable comment
  (`we:scripts/conveyor/ci-heal-mark.mjs`'s `buildCiHealComment`/`CI_HEAL_COMMENT_MARKER`) instead of
  re-deriving it from a diff. `planCiHealSpawns` then binds its cap on a **real**-attempt count — a
  rebase-only heal is still recorded (for observability) but does not consume the human-escalation budget.
- **(b — rejected on merit, not just cost) Contribution-fingerprint diff.** Reuse
  `normalizeContributionFingerprint` (`we:scripts/lib/review-escalation.mjs:1192`), comparing the PR's
  current diff fingerprint to the one stamped on the prior CI-heal comment (mirroring
  `buildReviewedContributionMarker`/`parseReviewedContribution`, same file, `:1445-1489`, already used for
  a different purpose — human-review-clearance survival across drain rebases). The prep skeptic found a
  concrete false-negative on the CI-heal path specifically: the CI-heal brief instructs "regenerate
  derived/generated artifacts" and "take-main for coordination JSON" when resolving a rebase conflict
  (`we:skills-src/conveyor/fix-agent-ci-brief.md:75-76`) —
  and `normalizeContributionFingerprint` special-cases exactly one file (the lane manifest,
  `:1197` `MANIFEST_HEADER`), hashing every other regenerated registry/lockfile verbatim. A purely
  mechanical BEHIND-heal that regenerates a registry during conflict resolution gets a **different**
  fingerprint even though nothing "real" changed — defeating the exemption for the archetypal case it
  exists to catch. The skeptic also found the fingerprint's own documented residual
  (`we:scripts/lib/review-escalation.mjs:1114-1170`) was deliberately widened toward false-*honour* for its
  original use (a relocation with unchanged content/length/run-shape collides — bug `#3021` stays open)
  on the strength of a human already having looked at that content once; this automated retry-cap use has
  no such backstop, so importing the same residual here could let a genuinely-relocated-but-still-broken
  attempt wrongly read as "no change" and loop past the point a human should see it. And its production
  track record (0/201 false divergences) was measured against drain-rebase-survival, not against
  fix-agent/CI-heal attempt cycles — cited scope narrower than the claim leans on.

**Recommended default: (a).** Sketch of the shape:

```js
// we:scripts/conveyor/ci-heal-mark.mjs — extend the durable marker with a direct self-report
export function buildCiHealComment({ actor, reason, committedBeyondRebase }) {
  const why = reason === 'behind' ? 'the branch had fallen BEHIND `main`' : 'a required check had gone red';
  return [
    CI_HEAL_COMMENT_MARKER,
    '',
    `${why}; ${actor} rebased onto current \`main\`${committedBeyondRebase ? ' and repaired the failing check' : ' — the rebase alone resolved it, no content change'}.`,
    // durable, parseable fact the cap reads back — mirrors buildReviewedContributionMarker's stamp shape
    `<!-- ci-heal-committed: ${committedBeyondRebase ? 'true' : 'false'} -->`,
  ].join('\n');
}

// we:scripts/conveyor/tick-core.mjs — planCiHealSpawns binds the cap on REAL attempts only
const attempts = Math.max(Number(nextRealAttempts[pr]) || 0, Number(durableReal[pr]) || 0);
// nextRealAttempts / durableReal come from countCiHealComments' sibling that counts only
// comments whose <!-- ci-heal-committed: --> marker is "true"; a rebase-only heal still posts a
// comment (observability, and it still retires the in-flight ENTRY) but never bumps this count.
```

The CI-heal agent's brief (`we:skills-src/conveyor/fix-agent-ci-brief.md`) gains one instruction: pass
`--committed=<true|false>` to `we:scripts/conveyor/ci-heal-mark.mjs` reflecting whether step 6 actually
committed anything. This is the whole change on the agent side — the brief already computes the fact, it
just wasn't recorded.

**Executable test (Done-when #3, restated against the corrected mechanism):** a test on
`planCiHealSpawns` reproducing the incident's shape — three consecutive `behind`-reason heals, each
posting a `ci-heal-committed: false` comment — that fails before this lands (real+observability count
conflated, cap exhausts on attempt 3, surfaces `ci-heal-exhausted`) and passes after (the cap does not
exhaust; the PR stays in the loop). **Real-failure test (Done-when #4):** a sibling test where each heal
posts `ci-heal-committed: true` (a genuine repair attempt each time, still red) — cap exhausts exactly as
today, at attempt 3, unchanged from current behavior.

Skeptic: SURVIVES-WITH-AMENDMENT — a throwaway skeptic sub-agent attacked the original naive default
(fingerprint-diff reused as-is for *both* `planFixSpawns` and `planCiHealSpawns`) on four axes.
Axis 0 (classification) found "split the counter" was mis-framed as a rival signal rather than the
architecture the winning signal feeds (folded in above); it also flagged that fingerprint-match and
check-identity are not perfectly redundant — a fix agent that pushes genuinely *different* content that
still fails the *same* check is a case neither this fork's default nor the rejected alternative fully
solves (out of scope here — it is a different problem, "detect thrashing between distinct failed
attempts," not "detect a no-op restart"; noted, not solved). Axis 1 (merit) **refuted** the fingerprint
default for the CI-heal path outright on the registry-regeneration false-negative above, and flagged the
unbounded #3021 residual risk of an automated (no human backstop) use. Axis 3 (citation-scope)
**refuted** the track-record citation as measuring a different domain (drain-rebase-survival, not
retry-cap attempt cycles). Axis 2 (statute-overlap) survived clean — no `we:docs/agent/platform-decisions.md`
anchor governs retry-cap classification, and `#deterministic-core-thin-judgment` (cited throughout
`we:scripts/conveyor/tick-core.mjs`) affirmatively supports keeping this classification in the pure core. Net: the fork's
*existence* and the *scoping finding* (CI-heal only) both survived; the *default* changed from (b) to
(a) — the self-report signal sidesteps every finding above because it is a direct fact the agent already
computes, not an inference with a documented failure mode on this exact path.

Screen: clear — (1) implementation vs. standard-side: this fork changes only
`we:scripts/conveyor/*.mjs` and `we:skills-src/conveyor/*.md` — WE's own internal build-automation
retry policy. No intent/block/plug/protocol changes, nothing FUI ever sees or depends on; correctly filed
as implementation, not a standards-layer call. (2) merit vs. prioritization: a genuine merit gap survives
even at infinite budget on the status-quo branch — raising the cap doesn't fix "a busy `main` can burn all
N attempts on pure rebase churn before the fix content is ever retried once," it only delays the same
failure at a higher N; the fingerprint-free self-report default has no such failure mode at any cap size,
so this is not cost/tuning dressed as merit.

## Supported by default (not a fork)

- **The rebase-only tally still posts a durable comment.** Even though it doesn't consume the retry
  budget, `we:scripts/conveyor/ci-heal-mark.mjs` still posts on every heal (real or not) — the in-flight
  ENTRY retirement (`retireCiHealGuards`) and the existing `countCiHealComments` restart-floor both depend
  on that comment existing, and it is free observability (how often is `main` outrunning the heal cycle,
  independent of whether anyone escalates).
- **`planFixSpawns` is unchanged.** Per the scoping finding above, guard 3's counter already counts only
  genuine attempts; nothing here modifies it, its cap, or its tests.

## Context

**Prior art — the repo already solved an adjacent version of this exact problem.** `#2643` (resolved,
`we:backlog/2643-conveyor-auto-fix-retry-cap-must-survive-a-restart-derive-co.md`) is the direct precedent
for "a retry-cap counter must be durable and derived from the PR itself, not in-session state" — this fork
reuses that established pattern (a marker-comment count recovered via `gh pr view --json comments`) rather
than inventing a new state store, consistent with `#deterministic-core-thin-judgment`
(`we:docs/agent/platform-decisions.md`, cited throughout `we:scripts/conveyor/tick-core.mjs`). `#2666` (the
CI-heal loop's own original ship) already documents the exact false-close risk this card observed in
production ("`review:changes` PRs are EXCLUDED — the fix loop already rebases them,"
`we:scripts/conveyor/tick-core.mjs:86`) without yet closing the gap this decision closes. No greenfield
web-standards survey applies — this is WE's own internal delivery tooling, not a new
intent/block/plug/protocol; the "prior art" that grounds it is in-repo precedent, cited above, not MDN/W3C.

**Care level: elevated.** Estimated per `deriveCareLevel`'s own signals
(`we:scripts/lib/review-escalation.mjs:384-397`), ahead of a diff: the predicted touch-set
(`we:scripts/conveyor/tick-core.mjs`, `we:scripts/conveyor/ci-heal-mark.mjs`) is blast-radius
(`^scripts\/` — `we:scripts/lib/review-escalation.mjs:246`, weight 3), and no other scored signal applies
pre-diff (no dismissed findings yet, size unknown, single-repo) — a lone blast-radius signal alone bands to
`elevated` (`CARE_BANDS.elevated = 3`, `we:scripts/lib/review-escalation.mjs:378`). Not `high`: the touched
files are the deterministic tick-core / CI-heal machinery, not the gate-self / declarative-leash trust
chain (`isDeclarativeLeashPath`) that would force `humanRequired`.

### Review jury (provisional — pre-registered #2638)

Care level: `elevated`. This jury binds against the item's predicted scope
(`we:scripts/conveyor/tick-core.mjs`, `we:scripts/conveyor/__tests__/tick-core.test.mjs`,
`we:skills-src/conveyor/SKILL.md`) and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

## Done when

1. **Named.** "Chasing a moving target" appears in `we:scripts/conveyor/tick-core.mjs`'s own comments near
   `planCiHealSpawns` (not `planFixSpawns` — see the scoping finding), so the next reader sees why blind
   attempt-counting there was insufficient.
2. **The close mechanism identified.** Traced to a negative result, evidenced above: no code in this repo
   auto-closes a PR; the observed close was a human acting on a false "genuinely broken" read of a
   staleness-only exhaustion signal. No further tracing needed unless a live recurrence shows an actual
   auto-close code path this pass missed.
3. **A distinguishing signal chosen and built** — Fork 1(a): the CI-heal agent self-reports
   `committedBeyondRebase` on its durable marker; `planCiHealSpawns` caps on real attempts only. Executable
   per the test description under Fork 1.
4. **Real failures still terminate at a human.** Unchanged for `planFixSpawns` (never in scope); for
   `planCiHealSpawns`, the real-failure test under Fork 1 proves the cap still exhausts at 3 on genuine
   repeated repairs.
