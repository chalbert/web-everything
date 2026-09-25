# Multi-host and multi-instance daemons — investigation (2026-09-24)

**Ask (operator, 2026-09-24 ~6:10 PM ET, verbatim):** *"Ask another session to investigate how we could have
multiple daemon work at the same time. I am planning to add a second Mac so there might already be a need for
some of the deamon to run on each, but if we could run multiple instance of deamon coordinated we could put them
on probation before switching"*.

**Decision card:** `we:backlog/xah96oj-multi-host-and-multi-instance-daemons-where-each-daemon-runs.md` (epic 3383).
**Grounded against:** WE `origin/main` at `aad340b97`, plateau-app at `9901a58`. Every `file:line` below was read
or grepped on those heads.

## Summary

- **Every fence is on one machine's disk.** That covers the runner lease, the drain lease, lane leases, session
  bindings and completion records. A second Mac running the same code sees none of them. The daemons already rely
  on GitHub for some state: round counts come from PR marker comments, and review state from labels. But labels
  and comments are not a lock. No write to them checks what was there first.
- **So the first rule for a second Mac is where things run, not a new lock.** Split the daemons into
  **co-location groups**. Each group runs on exactly one host, named in a **host-role map**. A daemon refuses to
  boot on a host the map does not name for it. That is enough to run a second Mac safely, with no new shared
  store.
- **The merge path never gets a second instance, and never fails over automatically.** The merge path is the
  drain daemon plus the `merge-orphan-sweep` pass. The ratified sole-writer rule
  (`we:docs/agent/platform-decisions.md#event-driven-land-is-wake-only` clause 1) already closed any
  second-writer or failover design. A new drain version can only be tried **in shadow**: it plans its lands but
  never merges.
- **Several instances of the same daemon need one shared lease medium.** The ratified
  `#state-lives-where-its-nature-dictates` (its 2026-08-17 extension, #2626) already names it: a single-writer
  Durable Object lease behind a vendor-neutral seam, for when runners go multi-host. This report confirms that
  choice against the alternatives. Two things build on it: per-PR claims that carry a fencing token, and
  published session presence.
- **Probation** means a candidate instance on new code runs beside the incumbent on promoted code. It goes
  through three stages. First **shadow**: it computes decisions and diffs them, but never acts. Then **canary**:
  it owns a small shard through the claim store. Then automatic promotion or rollback. This fits the ratified
  overlay rules with one change: an incumbent on probation must not adopt new code the moment `origin/main`
  moves. That change is an amendment to `#resident-daemon-reload-lifecycle` clause 2.

## 1. What is host-local today (the inventory)

| State | Where | Owner key | Dead-owner detection | Second host sees it? |
|---|---|---|---|---|
| Runner / daemon singleton leases | `~/.claude/conveyor-runner-locks` (`we:skills-src/conveyor/runner-lock.mjs:63`) | `host:pid:kind` (`:76`) | 15-min TTL. The #3952 fast reclaim runs only when the owner's host equals this host (`:102-108`). | No |
| Drain whole-process lease (per repo, #3440) | `~/.claude/drain-locks` (`we:scripts/readiness/drain-lock.mjs:65`, `drainLeasePathFor` `:104`) | `host:pid:drain` (`:83`) | TTL only. `acquireDrainLease` always passes `'unknown'` liveness (`:278`). | No |
| JIT numbering mutex | same root (`we:scripts/readiness/drain-lock.mjs:69`) | host:pid | TTL | No. Two hosts could mint the same number. |
| Lock primitive | `we:scripts/readiness/file-locks.mjs` (`mkdir` plus a lock entry file; reclaim deletes the dir, then recreates it) | — | `reclaimDecision` | Local filesystem only |
| PR session bindings | in memory, from `claude agents --json` (`we:scripts/conveyor/reconcile-core.mjs#bindAgents` `:351`, `#assessLiveness` `:471`) | lane cwd/HEAD matched against `headRefOid`, or the session name `review-<pr>`/`fix-<pr>` | pid probe | No. Mac B sees no live `review-<pr>` for a session on Mac A. |
| Completion records | `<checkout>/.operations/completions/<session>` (`we:scripts/operations/completion-store.mjs`) | session slug | — | No |
| Lane leases | a `.lane-lease` file in each lane's `.git`, under `~/workspace/.lanes` (`we:scripts/lane-pool.mjs`, `we:scripts/lib/lane-lease.mjs`) | session/holder slug, with the host recorded | TTL (240 min) plus the #2748 reaper | Pools are per host, so they never collide. But two hosts could work the same item or push the same `lane/*` branch. |
| GitHub App token cache | `~/.claude/github-app-token/` (`we:scripts/lib/github-app-auth-env.mjs`) | — | expiry minus 10 min | Per host, which is fine: each host mints its own token. Each host needs its own copy of the App private key, and both share the installation's rate budget. |
| Verdict ledger | `~/.claude/verdict-ledger` (`we:scripts/lib/verdict-ledger.mjs`) | host:pid | — | No. The merge-authority ledger would split in two. |

**Already independent of the host (lives on GitHub):**
- Review labels: `review:*`, `ready-to-merge`, `merge-status:conflicting`.
- Marker comments: reviewed-sha, stand-down, rearm, conflict-fix, ci-heal, stuck-dispatch.
- The `ops/pr-views` and `ops/review-requests` branches. `we:scripts/lib/git-transport-branch.mjs` pushes them
  without force, so GitHub rejects any push that isn't a fast-forward. That is a real server-side
  compare-and-set: a write that only succeeds if nobody changed the value first.

**Labels and comments give no such guarantee.** `we:scripts/lib/review-label-provider.mjs` reads the labels, then
edits them, with no version check. Adding a label is idempotent. When two hosts interleave, the last write wins.
Posting a marker comment only appends, so two hosts can both post "dispatched".

**Two findings worth fixing whatever is ruled here:**

1. **A wrong safety claim.** `we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs:8-15` says two copies are
   "SAFE by construction" because of the ledger in `we:scripts/operations/action-store.mjs`.
   - That module is **not on `main`**. It exists only on an unmerged lane branch.
   - `we:scripts/conveyor/reconcile-fix-dispatch.mjs:43-49` says the opposite: liveness is checked by session
     name, and there is no ledger.
   - The header must be corrected before anyone relies on it to run two copies.
2. **The drain lease never checks whether its holder is alive.** It skips the pid probe
   (`we:scripts/readiness/drain-lock.mjs:278`), so a crashed drain holds its repo for the full TTL. #3952 fixed
   this for the runner lease, not for the drain.

## 2. Today's incidents are all "two actors, one thing"

From the 2026-09-23/24 cards under 3383:

- **Two daemons, one clone.** The review and fix-dispatch daemons share `wev-review-daemon`.
  - Whichever daemon self-synced first moved the tree. The other ran stale code for hours (PR #2558, bornAs
    xulwmqi).
  - A lock failure treated as a merge conflict can run `merge --abort` and undo another daemon's merge (#4041).
  - The review daemon's session reaper also reaps `fix-*` sessions started from the same working directory
    (`we:skills-src/conveyor/review-daemon.mjs:355`, `:367`).
- **A new daemon version went live with no live check.** A lane-pool regression shipped through self-sync and
  broke every review-daemon session. This led to the live smoke gate (#4038, PR #2601,
  `we:scripts/lib/daemon-live-smoke.mjs`), the first "probation" building block.
- **Two label writers on one PR** left both hold labels live (#4053).
- **A shared token cache** trusted a token that GitHub had already revoked (#4039).

Each is a single-host version of the problem a second Mac makes worse: two actors that cannot see each other's
fence.

## 3. The daemons and their co-location groups

A **co-location group** is a set of daemons whose safety depends on sharing local state. The rule for a second
Mac: **a group moves whole or not at all.**

| Group | Members | Local state they share | Can it move? |
|---|---|---|---|
| **M — merge** | drain daemon (`plateau:tools/drain-daemon/daemon.mjs`), `merge-orphan-sweep` pass (`we:skills-src/conveyor/daemon-manifest.mjs:127`) | the per-repo drain lease. The sweep only no-ops because it sees the drain's lease (`we:scripts/merge-ai-prs.mjs#decideDrainLeaseGate`, `:1782`). | **Pinned to one host.** It moves only as a deliberate role change landed by PR, never by automatic failover (`#event-driven-land-is-wake-only` clause 1). Splitting the two across hosts creates a second merger. |
| **D — agent dispatch** | runner/dispatcher, verify daemon, review daemon, fix-dispatch daemon, `stuck-pr-watch-*`, lease-reaper, `lane-pool-health-watch-*`, the session reaper, plus the passes that read host-local session or sidecar state: `orphan-claim-release`, `parked-pr-progress-watch-*`, `infra-blocked` | `claude agents --json` liveness, completion records, lane pools, the shared daemon clone | Moves **whole**. Splitting it, say runner on Mac 2 and fix daemon on Mac 1, means Mac 1 cannot see Mac 2's delivery session on a PR and dispatches a fix on top of it. |
| **W — GitHub-only watchers** | `ci-queue-watch-*`, `parked-pr-conflict-watch-*`, `duplicate-pr-watch`, `branch-drift` | GitHub state only (labels, comments) | Each **kind** runs on exactly one host, and which host does not matter. |
| **O — operator** | interactive sessions | primary checkouts, `.conveyor/queue` sidecar | Stays on the operator's machine. |

**Moving whole groups still leaves one risk.** The operator's interactive sessions and group D's dispatches can
act on the same PR from different hosts.
- Today they share a host, and the liveness check sees background agents there.
- With group D on Mac 2, an operator session on Mac 1 that is working a PR is invisible to the fix daemon.
- Until session presence is published (phase 2), the defence is the existing hold labels: an operator session
  working a PR sets `review:human` or a hold label.

The risk is bounded but real. The phase plan lists it.

## 4. Question 1 — a second Mac

**Which daemons can run on either host?** Every group can, as long as the whole group runs on **exactly one**
host. For now, no daemon needs a lease shared across hosts: the **host-role map is the fence**.

**The shared coordination medium, compared:**

| Medium | Compare-and-set? | How a dead holder is spotted | Goes down when GitHub goes down? | Verdict |
|---|---|---|---|---|
| (a) Single-writer Durable Object lease behind a store seam (`#state-lives…`, 2026-08-17) | Yes: one object per key, run on one thread | alarms plus heartbeat; a fencing counter is easy | No: it is a second vendor that can fail on its own | **Recommended for phase 2.** The ratified direction. Strongly consistent, about 50 ms per call. |
| (b) Compare-and-set on a git ref at origin (`git push --force-with-lease` on an `ops/lease/*` ref) | Yes, on the server | the holder heartbeats by pushing; readers judge expiry | Yes. When GitHub is down the daemons are idle anyway. | A credible rival, with costs: every heartbeat is a push, about 10 keys × 1 per minute ≈ 14k pushes/day. Branch pushes may trigger workflows. Whether GitHub accepts custom `refs/*` names is unverified. |
| (c) GitHub labels, comments or check runs as leases | **No**: read-then-edit, last write wins | — | Yes | **Rejected as a lock.** Fine as a visible mirror of a lease. |
| (d) A shared filesystem (NFS/SMB over Tailscale) holding today's lock dirs | `mkdir` is not reliably atomic over network filesystems. The pid probes in the `heavy-admission` slots and `file-locks-cli` have no host check. | Broken: a pid means nothing on the other host | — | **Rejected.** It spreads today's single-host bugs across hosts. |
| (e) A small self-run coordination service (etcd or Consul on one Mac) | Yes | Yes | No | **Rejected.** It puts a new single point of failure on one of the two Macs. It is (a) without a managed service underneath. |

**Answers for each piece of state:**
- **Lane pools** stay per-host directories and never need sharing. The cross-host question is who owns an item
  and who owns a branch:
  - Item ownership is already `status: active` on `main` (Rule 105).
  - Branch ownership comes from the per-PR claim in phase 2.
- **The App token cache** stays per host. Each Mac keeps its own copy of the App private key and mints its own
  tokens. Watch the installation's shared rate limit: `gh-throttle` paces per process, not per installation.
- **Completion records and session bindings** stay per host in phase 1. That is safe because group D moves
  whole. In phase 2:
  - Each host **publishes** a presence record to the shared store: which PR each live session is on, plus a
    heartbeat.
  - `assessLiveness` then treats a fresh remote presence exactly like a local `live-process`.
- **The single-merger invariant (#2290)** stays where it is: group M on one host, with
  `we:scripts/lib/pr-merge-gate.mjs` accepting only `caller === 'drain'`.
  - The host-role map adds a check at boot.
  - The JIT numbering mutex stays safe because only that one host mints numbers.

## 5. Question 2 — several coordinated instances of one daemon

**Topologies:**
- **Sharding** (by repo, or by a hash of the PR number) is cheap and predictable.
  - The `--repo=<slug>` shard key already exists on every per-repo pass
    (`we:skills-src/conveyor/daemon-manifest.mjs:46-52`) and on the drain (`--this-repo`/`--repos=`).
  - The review and fix daemons loop over fixed arrays and need a `--repos` flag. The arrays are
    `REVIEW_DAEMON_REPOS` (`we:skills-src/conveyor/review-daemon.mjs:250`) and `FIX_DISPATCH_DAEMON_REPOS`
    (`we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs:104`).
- **Active/standby** is simple, but half the capacity sits idle. The rule already closes it for the drain.
  Elsewhere, per-PR claims make it unnecessary.
- **Work-stealing** falls out of per-PR claims: whoever claims first acts.

These are not rival choices: **the shard assigns the work, and the claim fences it.** The claim is what keeps
things correct while membership changes, for example when a canary joins or an instance dies.

**The per-PR claim (the action-store idea on a shared medium):**

```text
claim key : <repo>#<pr>:<action>          (action = review | fix | ci-heal | conflict-fix | stuck-inspect)
claim body: { instance, host, fence, sessionId, expiresAt, inputs:{mainSha, overlays[]} }
acquire   : compare-and-set on the key; the store bumps `fence` on every grant
before any GitHub write: re-read the claim; if fence != mine, abort (a newer holder took over)
dispatch marker comment: carries `fence`, so a reader can tell a stale actor's comment from the live one
release   : on session completion, or on expiry when no presence heartbeat is seen
```

**Making label writes idempotent:**
- Every label writer becomes **desired-state**: compute the target set, add what is missing, remove only what is
  present. `we:scripts/review-set-label.mjs:1083` already checks removals against the live labels.
- Guard each write with the fence re-check above.
- Labels stay a mirror of the state, never the lock.

**Guarding against a double dispatch**, in order:
1. Take the claim.
2. Bind the session to it.
3. Write a marker comment that carries the fence.
4. The upstream liveness check counts remote presence as well as local sessions.

This closes the same-host race window that `we:skills-src/conveyor/review-daemon.mjs:26-34` admits to today, and
it closes the cross-host one too.

## 6. Question 3 — probation

**Shadow mode (every daemon).**
- The candidate runs the same plan step as the incumbent (`planReconcile`, the drain's land plan, each pass's
  decision).
- It writes a decision record keyed by `(daemon, repo, pr, tick-window)`.
- It takes no claim, writes nothing to GitHub, and spawns no agent.
- A differ pairs the candidate's records with the incumbent's.
- Much of this already exists as per-pass `--dry-run`: `merge-ai-prs`, `stuck-pr-watch`,
  `parked-pr-progress-watch`, `lease-reaper`, `verify-dispatch`, and the drain's `once --dry-run`.
- Still missing:
  - a daemon-level `--shadow` on `review-daemon`, `reconcile-fix-dispatch-daemon`, `verify-daemon`,
    `pass-daemon` and `runner`;
  - the decision-record writer;
  - the differ.

**Canary mode (sharded daemons only).**
- The candidate owns a small shard through the claim store, for example `repo=plateau-app`, or every PR whose
  number is a multiple of 10.
- The incumbent skips claims the candidate holds.
- **Never used for group M:** a canary drain would be a second writer.

**Promotion and rollback: automatic**, because `#resident-daemon-reload-lifecycle` clause 3 says no person
promotes a daemon clone.
- **Promote** when all of these hold:
  - the live smoke gate passes (`we:scripts/lib/daemon-live-smoke.mjs`, #4038);
  - shadow agreement meets a threshold over at least N decisions, and every disagreement is *expected by the
    diff*, meaning it touches code the candidate changed;
  - the canary window shows no crash, no stalled heartbeat, and no double-act (two fences on one key);
  - the canary's bounce and escalation rates are no worse than the incumbent's.
- **Roll back** on a crash loop, a stalled heartbeat, a smoke failure, or a disagreement the diff does not
  explain. The candidate is removed, exactly like the overlay removal in clause 5(d).

**How this fits the ratified overlay rules.**
- **Clause 5 overlays keep working unchanged.** An overlay runs a fix live before `main` has it. It is simply a
  candidate whose probation is skipped because the operator asked for it live.
- **One amendment is needed, to clause 2.**
  - Today, stale means the inputs the daemon booted from have moved: `origin/main` plus the overlays.
  - Under probation, the incumbent's input becomes the **promoted** sha, not `origin/main`. Otherwise every merge
    would swap the incumbent, and nothing would ever be on probation.
  - The candidate tracks `origin/main`.
- **Clause 5(e)'s carve-out already keeps group M `main`-only.** Its probation is shadow-only, run in a separate
  clone that never merges. That is consistent.
- **Decision xcw0nxo (#4043): can the review daemon review a fix it is running?**
  - With two instances, #4043's option (b) becomes cheap. A PR whose diff touches the candidate's own inputs is
    claimed by the **other** instance. Those inputs are its overlay commits, or daemon source it has not been
    promoted onto.
  - This report does not rule #4043. It notes that running multiple instances turns option (b) from impractical
    into a routing rule.
  - Until #4043 is ruled, the candidate never takes a review claim on a PR whose diff touches its own input
    delta, meaning the commits between the incumbent's promoted inputs and its own. That is the conservative
    reading of `#drain-daemon-self-hosting-boundary` clause 3. (`TRUST_CHAIN` in `we:scripts/lib/gate-config.mjs`
    is too narrow a key: it does not list the review, fix, pass or verify daemons.)

## 7. Question 4 — the phased plan

**Phase 0 — make the fences honest (no second Mac needed)**
1. Correct the false action-store safety claim in `we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs:8-15`
   and `we:skills-src/conveyor/review-daemon.mjs:27`.
2. Give the drain lease the same-host pid probe from #3952.
3. Stop the review daemon's session reaper from reaping `fix-*` sessions it did not start. The shared-clone lock
   is already covered by #4041.

**Phase 1 — the second Mac, split by static assignment**

4. Commit a **host-role map** that assigns each group to a host.
   - Each daemon checks it every tick, using a configured host id, and exits cleanly with an alert on a host the
     map does not assign it to. The merge group moves only by handoff: the old drain must have exited first.
   - The heartbeat and lease record publish the host, as clause 6 requires.
5. Mac 2 takes **group D whole**: runner, verify, review, fix, stuck-pr-watch and the lane reapers, with its own
   daemon clone and lane pool.
   - That moves all Claude-session and build load off the operator's machine, matching what #3615 intends for a
     build host.
   - Mac 1 keeps **group M** (pinned), **group W**, and the operator.
6. Provision Mac 2:
   - the App private key and the `gh` shim;
   - launchd plists made from the checked-in `*.plist.example` files;
   - its own `~/workspace/.lanes`.
7. Add a runbook check, `runner-activity` across both hosts, that proves no daemon kind runs on two hosts.

**Phase 2 — coordinated instances**

8. Build the coordination-lease seam, a pure core plus a thin I/O shell, with the Durable Object backend. This
   follows the vendor-abstraction amendment of 2026-08-17.
9. Add per-PR claims with fencing tokens, reviving the action-store design on top of the seam. Make the label
   writers desired-state, with a fence re-check before each write.
10. Publish session presence and add it to `assessLiveness`. This closes the operator-session gap from §3.
11. Add a `--repos` flag to the review and fix daemons, and assign shards through the claim store.

**Phase 3 — probation**

12. Add a daemon-level `--shadow` mode, a decision-record writer, and a differ.
13. Run canary shards through the claim store (never for group M).
14. Make promotion and rollback automatic. Amend `#resident-daemon-reload-lifecycle` clause 2 to "the promoted
    inputs".
15. Route PRs that touch daemon source away from the candidate. This feeds #4043.

## 8. Changes after the adversarial round

One separate Opus reviewer attacked the defaults and screened the framing. What changed, all of it folded into the
decision card:

- **Three passes are not GitHub-only, so they belong to group D.**
  - `we:scripts/conveyor/orphan-claim-release.mjs` reads local lane pools and local `claude agents`. On the wrong
    host it would release items that are live on the other host.
  - `we:scripts/conveyor/parked-pr-progress-watch.mjs` reads local `claude agents --all`. On the wrong host it
    would post false findings.
  - `we:scripts/conveyor/infra-blocked.mjs` reads the primary checkout's sidecar, which `pr-land` writes.

  The table in §3 now shows them in group D.
- **How the host-role map is enforced.**
  - The map is checked **every tick**, not only at boot.
  - Hosts are identified by a **configured host id**, because `os.hostname()` changes with the network on macOS.
  - The merge group moves only by a **handoff**: the old drain must have exited before the new one starts.
- **The verdict ledger** (`we:scripts/lib/verdict-ledger.mjs:809`) splits across hosts. Its only reader is the
  `we:scripts/pr-status.mjs` view, so the split degrades that view and blocks nothing. Fix: move the ledger to a
  git transport branch, the fourth home in the 2026-08-20 extension of `#state-lives-where-its-nature-dictates`.
- **The lease medium.**
  - The fork now rules only the guarantees: one compare-and-set authority per key, a monotonic fence, and failing
    closed.
  - The backend is a lean, not a ruling. The lean is a Durable Object.
  - The 2026-08-20 extension already allows a git transport ref as the interim step.
  - Claims *reduce* double-acts but cannot prevent them, because GitHub cannot check a fence. Idempotent writes
    stay the real safety.
- **Probation.**
  - The #4038 regression would have passed shadow mode unseen, because shadow spawns no agent. It is caught by
    the canary.
  - The candidate needs its own staleness rule and its own designated clone. These amend clauses 2 and 3.
  - Clause 5(b) must drop an overlay against the *promoted* sha, or a live fix vanishes from the incumbent.
  - The self-review guard is keyed on the candidate's own input delta, not on `TRUST_CHAIN`. `TRUST_CHAIN` does not
    list the review, fix, pass or verify daemons.

## Sources

- **Statute:** these anchors in `we:docs/agent/platform-decisions.md`:
  - `#resident-daemon-reload-lifecycle`
  - `#drain-daemon-self-hosting-boundary`
  - `#event-driven-land-is-wake-only`
  - `#state-lives-where-its-nature-dictates`
- **Cards:**
  - 3615: distributed build capacity across 2+ machines
  - 2626: the operational state store, including the Durable Object lease once runners are multi-host
  - 4043 (bornAs xcw0nxo)
  - 4038: the live smoke gate
  - 4041: the per-clone lock
  - 4053, 4039 and 4030
- **PRs:** #2558 and #2601.
- **Code:** as cited inline.
