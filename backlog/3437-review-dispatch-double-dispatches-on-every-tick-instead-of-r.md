---
bornAs: xh0vtzh
kind: task
parent: "3383"
status: resolved
dateOpened: "2026-09-01"
dateStarted: "2026-09-01"
dateResolved: "2026-09-01"
tags: []
scope:
  - we:scripts/conveyor/reconcile-core.mjs
  - we:scripts/conveyor/__tests__/reconcile-core.test.mjs
  - we:scripts/operations/review-dispatch.mjs
---

# review-dispatch double-dispatches on every tick instead of respecting a live review session

**Real, confirmed, cost-burning, found live 2026-09-01.** After re-arming two real bounced PRs (`#1764`,
`#1765`) to `review:pending` mid-`#3383` live-fire test, `we:skills-src/conveyor/runner.mjs`'s mechanical
reconcile-pass wiring spawned a NEW independent `review-<pr>` session on nearly every ~120s tick — SEVEN
distinct real PIDs for `#1765` alone over ~15 minutes (confirmed via `claude agents --json`: `pid 7832,
52017, 82075, 93083, 5162, 14244, 26688`, several genuinely co-live at once, not sequential). None of them
ever posted a verdict; the PR's comment thread shows nothing new after the re-arm marker. This directly
contradicts `we:skills-src/conveyor/runner.mjs`'s own docblock claim: "DOUBLE-DISPATCH IS ALREADY GUARDED,
UPSTREAM, NOT HERE... `we:scripts/conveyor/reconcile-core.mjs`'s own liveness read binds a live session to a
PR (cwd → HEAD sha) and refuses (`live-process`) BEFORE the `review` dispatch decision is ever reached." That
guard did not fire here — the runner (and its live loop) had to be killed by hand, and 10 stalled sessions
stopped by hand (`claude stop`, which DID confirm here, unlike the separate stuck-session issue also found
tonight and already noted in this epic's 2026-09-01 doctrine entry), to stop the bleeding. The FIRST review
round for each PR (before any re-arm) completed correctly with a real verdict — the failure mode is specific
to a RE-ARMED PR (`review:changes → review:pending` via `we:scripts/conveyor/rearm-review.mjs`), not the
mechanism in general.

## Root cause (found 2026-09-01, verified by reading the code — not the re-arm-specific theory guessed above)

**This bug lives in code already on `main`.** `we:scripts/conveyor/reconcile-core.mjs`,
`we:scripts/conveyor/reconcile-pass.mjs`, and `we:scripts/operations/review-dispatch.mjs` are all on `main`
today; only the runner wiring that calls them continuously (`186801a0` on `origin/lane/mechanical-dispatcher`)
is still ungraduated. Branch and fix on `main` directly — no need to touch `lane/mechanical-dispatcher`.

`bindAgents(pr, agents)` in `we:scripts/conveyor/reconcile-core.mjs` binds a live `claude agents --json`
session to a PR by matching `agent.laneHeadOid === pr.headRefOid` (`laneHeadOid` = `git -C <agent.cwd>
rev-parse HEAD`, read by `we:scripts/conveyor/reconcile-pass.mjs#resolveLaneHead`). **This cannot ever match a
review-dispatch session, first round or re-armed, working or not**:

- `we:scripts/operations/review-dispatch.mjs` spawns the review agent via `claude --bg --session-id=<uuid> -n
  review-<pr>` with `cwd: REPO_ROOT` — the checkout `we:scripts/operations/review-dispatch.mjs` itself was
  invoked from, per `we:scripts/operations/dispatch-lane-io.mjs`'s own docblock ("the agent's very first
  instruction is to acquire a lane of its own, and it runs it in the cwd it was started in").
- The review agent's own brief (`we:skills-src/review/review-agent-brief.md`) never `cd`s the agent's shell
  into the lane it acquires. Step 1 runs `LANE=$(node we:scripts/lane-pool.mjs acquire ...)`; step 2 runs `node
  we:scripts/operations/review-loop-cli.mjs --pr=... --repo=... --cwd="$LANE"` — the lane is a **flag to a
  subprocess**, never the agent's own working directory.
- So `claude agents --json`'s `cwd` for a `review-<pr>` session is always the primary checkout's path, never
  the lane doing the review. `resolveLaneHead(cwd)` reads the wrong checkout's HEAD, which essentially never
  equals `pr.headRefOid`. `bindAgents` returns `[]`, `assessLiveness` returns `null` ("nothing live"), and
  `we:scripts/conveyor/reconcile-core.mjs` re-dispatches a fresh review on every tick regardless of one already
  running.
- The "only re-armed PRs fail" observation above is a timing artifact, not a distinct cause: round-1 reviews
  happened to finish inside one ~120s tick tonight, so the bug never got a chance to fire; the re-armed rounds
  ran long enough for multiple ticks to elapse while still live.

**The fix.** Review-dispatch sessions carry a 100%-populated, PR-specific identity the cwd/HEAD-oid proxy
doesn't need: the session `name`. `we:scripts/operations/review-dispatch.mjs#reviewSessionSlug(pr)` returns
exactly `review-${pr}`, passed as `-n <slug>` at spawn — it shows up verbatim as the `name` field on every
`claude agents --json` entry (unlike `pid`/`state`, `name` is on all entries per this session's own live
measurement tonight). Add a name-based bind path in `we:scripts/conveyor/reconcile-core.mjs` for review
dispatches, **unioned with** (not replacing) the existing cwd/oid bind, which stays as the only signal for
build/prepare dispatch kinds (no PR-specific session name exists for those).

Implementation note: `we:scripts/conveyor/reconcile-core.mjs` declares itself `PURE: no fs, no clock, no
process, no network`, and `we:scripts/operations/review-dispatch.mjs` transitively imports
`we:scripts/operations/dispatch-lane-io.mjs` (`node:child_process`/`node:crypto`/`node:fs`) — do not import
`we:scripts/operations/review-dispatch.mjs` from `we:scripts/conveyor/reconcile-core.mjs` directly. Extract
`reviewSessionSlug` into a small pure module both files import with no impure transitive imports (mirror how
`we:scripts/conveyor/reconcile-core.mjs` already imports `countRearmComments` from
`we:scripts/conveyor/rearm-review.mjs`), and re-export it from `we:scripts/operations/review-dispatch.mjs` so
nothing else that imports it today has to change.

## Done when

1. **Executable** — extend `we:scripts/conveyor/__tests__/reconcile-core.test.mjs`: a PR re-armed
   `review:changes → review:pending`, with a still-live `review-<pr>`-named session bound to it (cwd/HEAD-oid
   deliberately NOT matching, to prove the name-based path is what catches it), fed through `planReconcile`
   twice in a row, results in exactly ONE spawn total — the second call refuses `live-process`.
2. Add the name-based bind path described above, unioned with the existing cwd/oid bind. Update
   `we:scripts/conveyor/reconcile-core.mjs`'s own docblock: it currently describes the cwd/oid bind as merely
   producing rare false positives (`#3283`); for a `review` dispatch specifically it essentially never matches
   at all, which is why the second bind path exists — say that plainly.
3. Existing `we:scripts/conveyor/__tests__/reconcile-core.test.mjs` suite (and the repo's standard test +
   `check:standards` gate) stays green.
4. Open a normal PR against `main` — do not merge it, and do not run the continuous
   `we:skills-src/conveyor/runner.mjs` tick loop against it (that would retrigger the very bug being fixed;
   continuous-loop testing is on hold epic-wide until this fix lands and is proven). If validating live, use at
   most a single manual `node we:scripts/operations/review-dispatch.mjs` call, never a loop. Once this fix is
   merged there is nothing to warn about going forward — no new standing doctrine note is needed.
