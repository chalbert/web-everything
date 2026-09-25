---
bornAs: xah96oj
kind: decision
parent: "3383"
status: open
dateOpened: "2026-09-24"
preparedDate: "2026-09-24"
preparedAgainstSha: "aad340b97cfbab097a92ff8fd875422ded4b76e3"
relatedTo: ["3615", "2626", "3214", "4043", "4038", "4041", "3681"]
relatedReport: reports/2026-09-24-multi-instance-daemons.md
tags: [conveyor, daemons, multi-host, probation, decision-prep]
---

# Multi-host and multi-instance daemons: where each daemon runs on two Macs, how instances fence each other, and how a candidate version serves probation

**Operator ask (2026-09-24, verbatim):** *"Ask another session to investigate how we could have multiple daemon
work at the same time. I am planning to add a second Mac so there might already be a need for some of the deamon
to run on each, but if we could run multiple instance of deamon coordinated we could put them on probation before
switching"*.

Full grounding (inventory, incidents, medium comparison, phase plan):
[we:reports/2026-09-24-multi-instance-daemons.md](../reports/2026-09-24-multi-instance-daemons.md).
Prepared against `aad340b97`.

## Digest

- **Every fence today is on one Mac.** It is either a directory on that Mac's disk or an in-memory read of that
  Mac's own sessions:
  - runner and daemon leases, at `we:skills-src/conveyor/runner-lock.mjs:63`;
  - the drain lease, at `we:scripts/readiness/drain-lock.mjs:65`;
  - session bindings. `we:scripts/conveyor/reconcile-core.mjs#bindAgents` reads only this host's
    `claude agents --json`;
  - completion records;
  - lane leases;
  - the verdict ledger.
- **A second Mac running the same code sees none of these fences.** GitHub labels and comments are shared, but no
  write to them checks what was there first, so the last write wins.
- **Three calls:**
  1. What keeps two hosts from stepping on each other (Fork 1).
  2. What a cross-host claim must guarantee before one daemon kind runs on two hosts (Fork 2).
  3. Which new daemon code must pass probation before the incumbent adopts it (Fork 3).

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| 1 — How is a second host fenced? | **Co-location groups move whole.** A committed host-role map is the fence. It is checked **every tick** against a **configured host id**. The merge group moves only by a handoff. Initial placement: the dispatch group goes to Mac 2. That placement is a config value, not part of this ruling. | Place daemons one by one and rely on today's locks (**broken**: every lock is host-local) | High |
| 2 — What must a cross-host claim guarantee? | **One compare-and-set authority per key, with a monotonic fencing token, that fails closed.** Claims *reduce* double-acts. Idempotent, desired-state writes stay the real safety. Backend lean: a Durable Object behind a seam. A git transport ref is allowed as the interim step. | Idempotent writes alone, no claim (**broken**: duplicate agent sessions push to the same branch) | High |
| 3 — Which changes serve probation? | **(c) Every `origin/main` move.** The incumbent runs the promoted sha. The candidate runs in shadow, then as a canary on sharded daemons. Promotion is automatic. Needs amendments to reload-lifecycle clauses 2, 3 and 5(b). | (b) Only changes a classifier marks as daemon code | Medium |

## Axes (grounded)

- **The lock primitive is host-local.** `we:scripts/readiness/file-locks.mjs` builds each lock from `mkdir` plus a
  lock entry file. Only a same-host owner can be fast-reclaimed (#3952, `we:skills-src/conveyor/runner-lock.mjs:102-108`).
  The drain lease uses a TTL only, with no pid probe (`we:scripts/readiness/drain-lock.mjs:278`).
- **Some "watchers" read host-local session or sidecar state.** So they are *not* GitHub-only.
  - `we:scripts/conveyor/orphan-claim-release.mjs:16-20` reads local lane pools and local `claude agents`.
  - `we:scripts/conveyor/parked-pr-progress-watch.mjs:8-14` checks whether a review session ever ran by listing
    local `claude agents --all`.
  - `we:scripts/conveyor/infra-blocked.mjs:26-31` reads the primary checkout's sidecar, which `pr-land` writes.
- **Shard keys already exist in some places.**
  - The per-repo pass entries: `we:skills-src/conveyor/daemon-manifest.mjs:46-52`.
  - The drain's `--this-repo` and `--repos=` flags: `we:scripts/merge-ai-prs.mjs`.
  - The review and fix daemons have no such key. They loop over fixed arrays
    (`we:skills-src/conveyor/review-daemon.mjs:250`, `we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs:104`).
- **Some probation building blocks already exist.**
  - The live smoke gate on self-sync adoption: `we:scripts/lib/daemon-live-smoke.mjs` (#4038, PR #2601).
  - The overlay CLI: `we:scripts/lib/daemon-load-overlay.mjs`.
  - Per-pass `--dry-run` flags.
  - Missing: no daemon has a daemon-level shadow mode.
- **Statute that applies.** All anchors are in `we:docs/agent/platform-decisions.md`:
  - `#resident-daemon-reload-lifecycle`: clause 2 (staleness), clause 3 (clone conditions), clause 5 (overlays);
  - `#drain-daemon-self-hosting-boundary`: clause 3 (independent review);
  - `#event-driven-land-is-wake-only`: clause 1 (one writer);
  - `#state-lives-where-its-nature-dictates`: the 2026-08-17 extension (a single-writer DO lease for the runner
    once runners go multi-host) and the 2026-08-20 extension (the git transport branch as an interim home).

## Settled by statute or supported by default (not forks)

- **The merge path stays one writer on one host.** The merge path is the drain daemon plus `merge-orphan-sweep`.
  - This is `#event-driven-land-is-wake-only` clause 1, cited here, not restated.
  - The sweep no-ops only because it sees the drain's lease (`we:scripts/merge-ai-prs.mjs#decideDrainLeaseGate`).
    So the two must share a host.
  - Probation for the merge path is shadow-only, in a separate clone that never merges. This matches the carve-out
    in reload-lifecycle clause 5(e).
- **The shard assigns the work, and the claim fences it.** These work together; they are not rival designs.
  - The shard (`--repo`, or a hash of the PR number) decides who *should* act.
  - The claim (Fork 2) decides who *may* act, which keeps things correct while membership changes.
  - Labels mirror state and are never the lock.
  - Desired-state label writers stop *redundant* writes. They do not settle two writers that want *contradictory*
    labels, the #4053 case. The claim does that.
- **Lane pools and the App token cache stay per host.**
  - Each Mac holds its own App private key.
  - The installation's rate budget is shared, but `gh-throttle` paces per process.
  - Across hosts, only item and branch ownership has to be coordinated. Item ownership is already
    `status: active` on `main`. Branch ownership comes from the phase-2 claim. Phase 1 has no cross-host guard on
    branches. That is acceptable only because the dispatch group moves whole.

## Fork 1 — How is a second host fenced?

**Why it is a fork (a forced invariant):** the alternative, placing daemons one by one and trusting today's locks,
is **broken**. Every lock is host-local, so nothing stops two hosts running the same daemon kind. Splitting the
dispatch group is also broken: `bindAgents` sees only local sessions, so a fix daemon on one host would dispatch
on top of a delivery session on the other.

**Options:**

- **(a) Co-location groups move whole, with a committed host-role map as the fence ← RECOMMENDED.**
  - **Groups.**
    - **merge**: the drain daemon and `merge-orphan-sweep`.
    - **dispatch**: runner, verify, review daemon, fix-dispatch daemon, `stuck-pr-watch-*`, lease-reaper,
      `lane-pool-health-watch-*`, and the session reaper. It also holds every watcher that reads host-local
      session or sidecar state: `orphan-claim-release`, `parked-pr-progress-watch-*` and `infra-blocked`.
    - **watchers**: GitHub-only passes, namely `ci-queue-watch-*`, `parked-pr-conflict-watch-*`,
      `duplicate-pr-watch` and `branch-drift`.
    - **operator**.
  - **The fence.** A daemon checks the map **every tick**, not only at boot. It exits cleanly when its group is
    not assigned to this host. The host id is a **configured id**, not `os.hostname()`, which changes with the
    network on macOS.
  - **Merge-group handoff.** The new host's merge group may start only after the old host's drain has exited.
    Two ways to know that:
    - a GitHub-visible heartbeat from the old drain stops;
    - or the new host waits out the restart floor plus the lease TTL.

    Without the handoff, the per-tick check on the old host plus the boot check on the new host still leave up to
    one tick with two drains. The handoff closes that window.
  - **Initial placement (a config value, not ruled here).**
    - The dispatch group goes to Mac 2. That moves all Claude-session and build load off the operator's laptop,
      as #3615 intends.
    - Mac 1 keeps the merge group, the watchers and the operator.
    - Remaining risk: an operator session on Mac 1 working a PR is invisible to the fix daemon on Mac 2 until
      phase 2 publishes session presence. Mitigation until then: the existing hold labels.
- **(b) Place daemons one by one and rely on today's locks.** **Excluded as broken**, for the reasons above.
- **Not a fork:** *which* group sits on *which* host. That is a value in the map. Splitting the dispatch group
  becomes buildable once Fork 2's claims and published session presence exist.

```js
// we:skills-src/conveyor/host-roles.mjs (proposed; host ids are configured, never os.hostname())
export const HOST_ROLES = {
  merge:    { host: 'mac-1', members: ['drain-daemon', 'merge-orphan-sweep'] },
  dispatch: { host: 'mac-2', members: ['runner', 'verify-daemon', 'review-daemon', 'reconcile-fix-dispatch-daemon',
                                       'stuck-pr-watch-*', 'lane-pool-health-watch-*', 'orphan-claim-release',
                                       'parked-pr-progress-watch-*', 'infra-blocked'] },
  watchers: { host: 'mac-1', members: ['ci-queue-watch-*', 'parked-pr-conflict-watch-*', 'duplicate-pr-watch', 'branch-drift'] },
};
// Every tick: if (!hostOwns(HOST_ROLES, daemonKind, configuredHostId())) → clean exit + alert (never mid-tick).
```

**Side effect: the verdict ledger splits.** `~/.claude/verdict-ledger`
(`we:scripts/lib/verdict-ledger.mjs:809`) is appended to by `we:scripts/review-set-label.mjs` on the dispatch host
and by the drain on the merge host. Its only reader is the `we:scripts/pr-status.mjs` view. So a split makes that
view incomplete but does not unblock a merge. The fix is a phase-1 slice: move the ledger to a git transport
branch, the fourth home in the 2026-08-20 extension.

Skeptic: SURVIVES-WITH-AMENDMENT. Changes folded in:
- Three misfiled "watchers" moved into the dispatch group.
- The check-at-boot-only fence became a per-tick check.
- `hostname()` replaced by a configured host id.
- A merge-group handoff added.
- The split verdict ledger recorded, verified here as view-only.

Screen: flagged(prio). Fix applied: the fork now rules only the placement policy (groups move whole, and the map
is the fence). Which group sits on which host is recorded as a config value.

## Fork 2 — What must a cross-host claim guarantee before one daemon kind runs on two hosts?

**Why it is a fork (a forced invariant):** two alternatives are **broken**.

- **No claim, relying on idempotent writes alone.** This lets two hosts each spawn a fix session on one PR. The
  sessions then push competing commits to the same branch.
- **A claim on a medium without compare-and-set.**
  - GitHub labels and comments are read-then-edit.
  - A shared network filesystem holding today's lock dirs is also out. `mkdir` is not reliably atomic over
    NFS/SMB, and a pid means nothing on the other host.

**Options:**

- **(a) One compare-and-set authority per key, with a monotonic fencing token, failing closed ← RECOMMENDED.**
  - **Keys.** `<repo>#<pr>:<action>` for per-PR claims, plus one key per singleton lease.
  - **Before any GitHub write,** the holder re-reads the fence and aborts if it has changed.
  - **Claims are advisory about GitHub.** GitHub cannot check a fencing token, and spawned sessions write on their
    own. So a claim *reduces* double-acts but cannot *prevent* them. Every writer must stay idempotent and
    desired-state.
  - **Sleep.** A holder waking from sleep past its TTL must re-read its claim before acting. Its lease has
    already lapsed.
  - **Fail closed.** If the medium is unreachable, take no new claims and let running sessions finish.
  - **Backend: a lean, not a fork.** The seam and the vendor-abstraction rule make the backend swappable.
    - The lean is a single-writer Durable Object, from the 2026-08-17 extension.
    - A compare-and-set on a git ref (`git push --force-with-lease`, following the pattern in
      `we:scripts/lib/git-transport-branch.mjs`) is allowed as the interim step, under the 2026-08-20 extension.
  - **New rows for the shared store.** The 2026-08-17 extension covers only the runner lease's arbitration. So
    this ruling adds per-PR claims and session presence as new rows. It does not treat them as already covered.
- **(b) Idempotent writes alone, with no claim.** **Excluded as broken**, for the reason above.

```js
// we:scripts/lib/coordination-lease.mjs (proposed): a pure core with an injected backend
export async function acquire(store, { key, holder, ttlMs }) {
  const cur = await store.read(key);                       // { holder, fence, expiresAt } | null
  if (cur && cur.expiresAt > store.now() && cur.holder !== holder) return { ok: false, heldBy: cur.holder };
  const next = { holder, fence: (cur?.fence ?? 0) + 1, expiresAt: store.now() + ttlMs };
  return (await store.compareAndSet(key, cur, next)) ? { ok: true, fence: next.fence } : { ok: false, raced: true };
}
// Before a GitHub write: if ((await store.read(key))?.fence !== myFence) abort.
```

Skeptic: SURVIVES-WITH-AMENDMENT. Changes folded in:
- The premise that (b) "would amend the 2026-08-17 extension" was wrong. The 2026-08-20 extension already allows a
  git transport branch as the interim home.
- Citation scope narrowed: per-PR claims and presence are new rows.
- "Claims reduce, not prevent" stated outright.
- Waking from sleep handled.

Screen: flagged(impl). Fix applied: the backend (DO or git ref) is recorded as a lean behind the seam. The fork
now rules only on the guarantees.

## Fork 3 — Which changes must serve probation before the incumbent adopts them?

**Why it is a fork (a real either/or):** an incumbent tracks either `origin/main` or a promoted sha. The two cannot coexist. Clause 2
makes every daemon exit and relaunch whenever its inputs move. Separately, the #4038 smoke gate checks self-sync
adoption. So today nothing ever sits on probation. Any probation must amend clause 2 for the changes it covers.
Once shadow and canary are imagined free to build, the options still differ in coverage and cost, so this is a
merit choice.

**Options:**

- **(a) Opt-in.** An author or the operator flags a change for probation; everything else adopts as today. This is
  coherent but weaker: it catches only what someone thought to flag.
- **(b) Classifier-scoped.** Only changes whose touch-set a classifier puts inside a daemon's own code (its import
  closure) go to probation.
  - Pro: unrelated merges adopt immediately.
  - Con: a miss lets daemon code through unprobated. `we:scripts/lane-pool.mjs`, the #4038 culprit, is a
    transitive dependency that a narrow closure could miss.
- **(c) Every `origin/main` move ← RECOMMENDED.**
  - The incumbent runs the last promoted sha. The candidate runs the newest `origin/main` and stays on it until it
    gets a verdict.
  - **Shadow stage.** The candidate runs the same plan with no claims and no writes, and records decisions for a
    differ. It runs at a lower cadence (every k-th tick), which bounds the extra load on the shared API budget.
  - **Canary stage, sharded daemons only.** The candidate runs for real on a small shard. This is what catches an
    *execution* regression like #4038, which shadow cannot see: shadow spawns no agent, so its decisions would
    have matched.
  - **Fast path.** A change with no shadow difference skips straight to a short canary. Non-sharded daemons get
    shadow plus smoke only.
  - Adoption lag is at most about 2 windows.

**Amendments that (c) needs** (to `#resident-daemon-reload-lifecycle`):

- **Clause 2.** Stale means the *promoted* inputs moved. A candidate is not stale until it has its verdict.
- **Clause 3.** Each candidate runs from its own designated clone, which meets conditions (i) to (iv).
- **Clause 5(b).** An overlay drops once the *promoted* sha contains it, not once `origin/main` does. Otherwise a
  live fix vanishes from the incumbent before promotion. With that change, overlays still skip probation, as the
  operator ratified.
- **Promotion and rollback are automatic.** This *extends* clause 3 ("no person promotes a daemon clone") and
  clause 5(d) ("rollback = removal"). Neither clause authorized a probation verdict before.
- **The self-approval guard, until #4043 rules.** A candidate never takes a review claim on a PR whose diff
  touches its own input delta, meaning the commits between the incumbent's promoted inputs and its own. This does
  not rule #4043's separate question: an *incumbent* running an overlay.

```text
promote  := smoke(#4038) ∧ shadow: ≥ N paired decisions, every disagreement expected-by-diff
          ∧ canary (sharded daemons): no crash, no heartbeat stall, no double fence, bounce/escalation ≤ incumbent
rollback := crash loop ∨ heartbeat stall ∨ smoke fail ∨ unexplained disagreement → candidate removed
(defaults for the build, not codified text)
```

Skeptic: SURVIVES-WITH-AMENDMENT. Changes folded in:
- The #4038 justification was re-based on the canary. Shadow alone would have missed it.
- The clause 5(b) collision was found and an amendment drafted.
- A candidate staleness rule and clone designation were added.
- "Automatic" was relabelled an extension, not settled statute.
- The self-review guard was re-keyed from `TRUST_CHAIN` to the input delta. `TRUST_CHAIN` omits the review, fix,
  pass and verify daemons and `we:scripts/lane-pool.mjs`.
- (a) was relabelled "coherent but weaker", not broken.

Screen: clear. The coverage-vs-cost trade is a real merit difference. The promotion formula stays a build default
and is not codified.

## Follow-on slices (listed, not filed; carved at ratification)

- **Phase 0 (independent of this ruling)**
  1. Correct the false action-store safety claim in `we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs:8-15`
     and `we:skills-src/conveyor/review-daemon.mjs:27`. `we:scripts/operations/action-store.mjs` is not on `main`.
  2. Add the #3952 same-host pid probe to the drain lease.
  3. Stop the review daemon's session reaper from reaping `fix-*` sessions it did not start.
- **Phase 1 (Fork 1)**
  4. The host-role map, the per-tick check and the configured host id.
  5. The merge-group handoff.
  6. Move the verdict ledger to a git transport branch.
  7. The Mac 2 provisioning runbook and plists.
  8. A cross-host `runner-activity` check.
- **Phase 2 (Fork 2)**
  9. The `coordination-lease` seam and its backend.
  10. Per-PR claims with fences, plus desired-state label writers.
  11. Published session presence, fed into `assessLiveness`.
  12. A `--repos` flag on the review and fix daemons.
- **Phase 3 (Fork 3)**
  13. A daemon-level `--shadow` mode, decision records and the differ.
  14. Canary shards.
  15. Automatic promotion and rollback, plus the clause 2, 3 and 5(b) amendments.
  16. The input-delta self-review guard.

## Proposed codified text (draft, for ratification)

> **Daemon placement, instances and probation** `{#daemon-placement-and-probation}`
> 1. **Placement.** Daemons belong to co-location groups: merge, dispatch, watchers, operator. A group runs whole
>    on the one host a committed host-role map assigns it, which each daemon checks every tick by a configured
>    host id. The merge group moves only by handoff (the old writer has exited before the new one starts),
>    consistent with [#event-driven-land-is-wake-only](#event-driven-land-is-wake-only) clause 1.
> 2. **Instances.** One daemon kind runs on two hosts only under one compare-and-set authority per key with a
>    monotonic fence, failing closed, behind a vendor-neutral seam
>    ([#state-lives-where-its-nature-dictates](#state-lives-where-its-nature-dictates); per-PR claims and
>    session presence are new rows of its shared store). Claims reduce double-acts; idempotent writes remain the
>    safety.
> 3. **Probation.** Every `origin/main` move reaches the incumbent only through a candidate: shadow, then canary
>    on sharded daemons, then automatic promotion or rollback. This amends
>    [#resident-daemon-reload-lifecycle](#resident-daemon-reload-lifecycle) clauses 2, 3 and 5(b) as stated in
>    Fork 3. Overlays still skip probation.

## What this card does not decide

- **#4043 (4043):** whether an *incumbent* running an overlay may review that overlay's graduation PR. No default here leans on how #4043 rules. The Fork 3 guard covers only *candidates*, a concept #4043 does not address, so this card is not `blockedBy` #4043.
- **#3615's remote build host:** lanes on one host driven by a dispatcher on another. Fork 1 moves the dispatcher
  together with its lanes.

### Review jury (provisional — pre-registered #2638)

Care level: `elevated`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

## Done when

1. **Executable** — `grep -n '{#daemon-placement-and-probation}' we:docs/agent/platform-decisions.md` finds the anchor: it fails today and passes once the operator rules the three forks and the rule is codified (`codifiedIn` set on this item).
