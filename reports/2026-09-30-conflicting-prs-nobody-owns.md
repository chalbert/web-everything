# Conflicting PRs Nobody Owns (Diagnosis)

## Root Causes & Evidence

**1. How the phase is derived (`we:scripts/conveyor/reconcile-core.mjs` phase logic)**
The phase is derived in `we:scripts/progress-board.mjs` by `classifyPr`, which evaluates labels in strict precedence: `review:changes` (`bounced`) > `review:human` (without `review:accepted` → `needs-human`) > `ci:failed` (`ci-red`) > `mergeStateStatus === 'DIRTY'` (`conflicted`) > `review:pending` (`needs-review`) > `review:accepted` (`queued`).

**2. Why a conflicting PR with `review:changes` read as `queued`**
It didn't. The log lines the user observed (`reconcile-refused nothing-owed chalbert/web-everything PR #3176 — phase 'queued'`) occurred *before* the PRs received `review:changes`. GitHub event logs confirm that PR 3215 was labeled `review:accepted` at `22:51:01Z` and PR 3176 was similarly labeled earlier. Because `review:accepted` supersedes `review:human` in `classifyPr`, they evaluated to `queued`. Once `we:scripts/conveyor/parked-pr-conflict-watch.mjs` subsequently applied `review:changes` (at `22:56:15Z` for 3215), `classifyPr` correctly returned `bounced`. Today, they evaluate to `bounced` and are correctly dispatched as `fix` targets (currently blocked only by `scope-overlap` with PR #3209 in `we:scripts/conveyor/reconcile-fix-dispatch.mjs`).

**3. Are `review:human` PRs deliberately skipped by conflict repair?**
No. They are explicitly handled by `we:scripts/conveyor/parked-pr-conflict-watch.mjs` under `#xu2krte Fork 2 (review-human statute amendment)`. The `recheckCandidate` branch (line 1509) specifically targets parked, conflicting PRs with `review:human`.

**4. Is the contradictory label set (`review:human` AND `review:changes`) a bug?**
No, it is the intentional design of Fork 2. The conflict watcher posts a finding (which applies `review:changes`) to dispatch a mechanical conflict fix, but explicitly preserves `review:human` so the final merged result still undergoes human review (`we:scripts/conveyor/parked-pr-conflict-watch.mjs`, line 1240: "do **not** touch any `review:*` label — `review:human` stays").

**5. What "live pid" session was bound to #3176?**
The `live-process` refusal happens when a PR has a stale `review-status:reviewing` label or an active claim. PR 3176 received `review-status:reviewing` at `20:32:52Z` and it was not cleared until `23:00:37Z`, preventing dispatch during that window.

## Fix Design
No code changes are required for the phase logic or label set, as they are functioning as designed. However, the orchestrator should:
1. Ensure stale `review-status:reviewing` labels are swept more aggressively to prevent false `live-process` blocks.
2. Consider adding log clarity when a PR transitions from `queued` to `bounced` to avoid operator confusion.
