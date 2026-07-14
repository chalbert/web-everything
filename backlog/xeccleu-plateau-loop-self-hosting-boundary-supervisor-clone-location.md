---
kind: decision
parent: "2445"
status: open
dateOpened: "2026-07-14"
preparedDate: "2026-07-14"
relatedReport: reports/2026-07-14-plateau-loop-self-hosting-boundary.md
tags: [plateau-loop, drain-daemon, self-hosting, supervisor, self-update]
---

# Plateau Loop self-hosting boundary — supervisor clone location, reload primitive, and self-source exclusion

The #2468 supervisor epic's real owed work is **self-update-then-reload**: today the resident drain daemon runs its own source from the user's PRIMARY plateau-app checkout and never self-updates, so every daemon change needs a manual `git pull` + a `restart` — defeating unattended-for-weeks residency. Building the self-update chain (slices L1→L2→L3) is gated on three COUPLED design calls that define the daemon's self-hosting boundary. Each fork states options, tradeoffs, and a **bold default**, grounded in the real daemon source and the WE trust-chain gate, with prior art in the [Plateau Loop self-hosting boundary](/research/plateau-loop-self-hosting-boundary/) research topic.

## Where the daemon runs from today (the grounding)

The daemon runs its **own** source from `PLATEAU_ROOT = resolve(HERE, '..', '..')` — the user's primary plateau-app checkout: `install()` bakes the daemon's own entrypoint path (`join(HERE, …)` → plateau:tools/drain-daemon/daemon.mjs) and `workingDir: PLATEAU_ROOT` into the launchd plist (plateau:tools/drain-daemon/cli.mjs ~L83-101). Separately, the daemon runs the WE **merge sweep** from a DEDICATED single-lane WE clone (pool `we-drain-daemon`, `weClone` points at that pool's `lane-1`, plateau:tools/drain-daemon/lib.mjs `resolveConfig`), provisioned by `ensureWeClone()` via `node we:scripts/lane-pool.mjs provision --name=we-drain-daemon --count=1` (plateau:tools/drain-daemon/cli.mjs ~L69-77). Crucially, `refreshClone()` already `git fetch`es + `git reset --hard origin/main` + `git clean -fdq`s **that WE clone** every pass (plateau:tools/drain-daemon/daemon.mjs `refreshClone`) — so the daemon self-updates the DRAIN code by construction, but never its OWN (daemon) source, because its own source lives in the user's primary tree, which must never be `reset --hard`.

### Recommended path at a glance

Ratify all three rows, or override just the one you'd change.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **A · supervisor clone location** | a DEDICATED single-lane plateau-app clone (mirror `we-drain-daemon`) | keep running from primary *(blocks safe self-update)* | **High** — the invariant is forced |
| **B · reload primitive** | `process.exit(0)` + launchd `KeepAlive` relaunch | `launchctl kickstart -k` | **Med** — the "reuse `restart`" instinct fails on inspection |
| **C · self-source exclusion** | RELY on #2480's engine-tier escalation + a LIGHT in-daemon assertion | promote to policy tier (`review:human`) | **Med** — #2480 is weaker than assumed; the residual is real |

## Fork A — where does the supervisor's own source run from?

**Fork-existence:** forced invariant — a safe self-update MUST `git reset --hard origin/main` the checkout the daemon runs *from*; doing that to the user's primary plateau-app working tree would clobber their uncommitted work. So "self-update" and "run from primary" genuinely cannot coexist — the excluded branch (b) makes safe self-update impossible.

- **(a — recommended) A dedicated single-lane plateau-app clone**, mirroring the existing `we-drain-daemon` clone-pool pattern. A `plateau-app-drain-daemon` pool (`--count=1`) is provisioned once; the launchd plist's `daemonPath`/`workingDir` resolve to that clone; self-update becomes the SAME `fetch` + `reset --hard origin/main` + `clean -fdq` the daemon already runs on its WE clone — applied to its own source, with the user's primary tree untouched. Cost: one more provisioned clone (disk + an `npm ci`), and `install()` must resolve the daemon's own path to the clone rather than `dirname(import.meta.url)`.
- **(b) Keep running from the user's PRIMARY checkout (status quo).** Zero new provisioning, but a self-update `reset --hard` would clobber the user's working tree — so it effectively **blocks** safe self-update. Any "self-update from primary" would have to invent a stash/worktree dance strictly worse than just cloning.

**Default: (a) dedicated clone.** It reuses a proven, already-shipped pattern (the daemon's WE clone is provisioned and refreshed exactly this way), keeps the self-update mechanism identical to the drain-code refresh the daemon already trusts, and preserves the hard rule that a drain runs from an isolated clean clone, never a user tree (#2197/#2123).

Concrete shape (mirrors `ensureWeClone` + `refreshClone`):

```js
// resolveConfig(): the daemon's OWN source clone, sibling to weClone
selfClone: env.DRAIN_DAEMON_SELF_CLONE || join(lanesRoot, 'plateau-app-drain-daemon', 'lane-1'),

// install(): daemonPath resolves to the clone, not dirname(import.meta.url)
writeFileSync(PLIST_PATH, renderLaunchdPlist({
  daemonPath: join(cfg.selfClone, 'tools', 'drain-daemon', 'daemon.mjs'),
  workingDir: cfg.selfClone, /* … */
}));
```

**Skeptic:** SURVIVES. Attack: "a git worktree off primary avoids a second full clone." Refuted — a worktree still shares primary's object store and index locks, and `reset --hard` in a worktree tracking `origin/main` is exactly a full checkout swap under the user; the isolation the invariant demands is a separate clone, and the `we-drain-daemon` pool already pays this cost without issue.
**Screen:** clear. Not an impl detail hidden behind a stable contract — WHERE the resident supervisor's own code executes is an operational-architecture call with a merit difference (safe-self-update possible vs impossible), not prioritization.

## Fork B — reload primitive after a self-update

**Fork-existence:** real either/or — after the clone is updated, the running process is still executing the OLD code in memory; exactly one mechanism resumes on the NEW code, and the candidates differ materially in robustness (clean lease release, no double-run, in-flight child kill). They cannot all be "the" reload path.

- **(a — recommended) `process.exit(0)` and let launchd `KeepAlive` relaunch** from the updated clone. The daemon already owns a clean shutdown path — `releaseAndExit(0)` SIGTERMs the in-flight child BEFORE releasing the lease (so no orphan double-drain) then releases the drain lease (plateau:tools/drain-daemon/daemon.mjs `releaseAndExit`), and the plist carries `RunAtLoad + KeepAlive` (plateau:tools/drain-daemon/lib.mjs `renderLaunchdPlist`). Self-reload is then just "call the shutdown path; launchd relaunches."
- **(b) `launchctl kickstart -k gui/<uid>/<label>`** — the primitive `start` already falls back to (plateau:tools/drain-daemon/cli.mjs ~L410-411). It kills-and-restarts the service; self-issuing it isn't *unclean* (launchd's SIGTERM runs the daemon's own `releaseAndExit(0)` handler, the same clean path (a) uses), but it makes the daemon self-shell `launchctl` under launchd's minimal-PATH environment, redundantly, to trigger a relaunch that `KeepAlive` already gives on a plain exit.
- **(c) exec / re-spawn in place** (`process.execPath` over the updated entrypoint). Bypasses launchd supervision entirely, re-inherits fds and the held lease, and loses the KeepAlive safety net — the riskiest.

**The task's "reuse the proven `restart` primitive" instinct does NOT hold.** The operator `restart` command is `launchctl bootout` + `bootstrap` (plateau:tools/drain-daemon/cli.mjs ~L416-425), an **external-operator** primitive. The daemon cannot cleanly self-invoke it: a self-issued `bootout` kills the daemon at `bootout`, so the following `bootstrap` never runs — self-restart-by-bootout is suicide before relaunch. `restart` is unusable for SELF-reload; only launchd's own supervision (KeepAlive) can relaunch a process that just exited.

**Default: (a) `process.exit(0)` + `KeepAlive`.** It reuses the already-proven `releaseAndExit` clean-release path (lease released, in-flight child killed — the exact double-drain guard the daemon exists to honor) and delegates relaunch to the KeepAlive supervision that already survives crash/reboot/sleep. (a) wins on **simplicity**, not because (b) is unclean: (b) is redundant with KeepAlive and needs the daemon to self-shell `launchctl` for no gain; (c) discards supervision. This is the "research favors exit+KeepAlive" branch the task flagged — and it does, because `restart` is external-only. (One acceptable cost: `ThrottleInterval` is 60s, so a reload can take up to ~a minute of drain downtime — fine for a 60s-cadence queue.)

Concrete shape:

```js
// after refreshClone() reports the daemon's OWN source changed (new HEAD on selfClone):
function selfReloadAfterUpdate() {
  log('self-source updated on the clone — exiting cleanly; launchd KeepAlive relaunches on the new code');
  releaseAndExit(0); // SIGTERMs the in-flight child, releases the lease, then exit(0)
}
```

**Skeptic:** SURVIVES-WITH-AMENDMENT. Attack: "exit(0) mid-queue drops in-flight work." Folded in — `releaseAndExit` already kills the child cleanly and GitHub is the source of truth (unlanded `ready-to-merge` PRs ride the next pass, per the daemon's restart-safety contract), so no work is lost; amendment: the reload must only fire BETWEEN passes (in the loop's delay window), never mid-pass, which the "detect new HEAD in `refreshClone`, act at top of loop" placement already gives. Second attack (folded): "kickstart -k is unclean, so (a) wins on cleanliness" — corrected — kickstart's SIGTERM runs the SAME `releaseAndExit` handler, so (a)'s win is **simplicity** (no self-shelled `launchctl`), not cleanliness.
**Screen:** clear. This is a runtime-robustness call (which resume mechanism), visible in operational behavior (double-run risk, supervision), not an impl detail across the WE↔plateau boundary; the merit difference (self-usable + supervised vs not) survives "both free to build."

## Fork C — self-source exclusion invariant

**Fork-existence:** forced invariant with a genuine residual — the daemon must never auto-land or concurrently lane-edit a PR that changes its OWN source. The fork is whether the existing #2480 machinery already enforces this (→ settled by precedent, no new code) or leaves a residual that a light in-daemon guard should close. This turns entirely on **what #2480 actually guarantees** — which the audit below shows is WEAKER than the epic assumed.

**What #2480 verifiably does (read the code, not the intent):** it registered the daemon's three source files (plateau:tools/drain-daemon/daemon.mjs, plateau:tools/drain-daemon/cli.mjs, plateau:tools/drain-daemon/lib.mjs) in `TRUST_CHAIN` ([we:scripts/lib/gate-config.mjs](scripts/lib/gate-config.mjs) L101-121) — but as **`tier: 'engine'`, NOT `policy`.** The consequence chain:

- `isTrustChainPath(path)` (both tiers) is true → `scoreEscalation` always adds a blast-radius reason → the PR ALWAYS escalates and gets an independent adversarial review panel ([we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) L198).
- BUT `humanRequired = gateSelfFiles.length > 0 || statuteFiles.length > 0`, where `gateSelfFiles` filters on `isGateSelfPath` = `isPolicyCorePath` — the **policy** tier only ([we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) L203-208, `isPolicyCorePath` in [we:scripts/lib/gate-config.mjs](scripts/lib/gate-config.mjs)). Engine-tier files do NOT set `humanRequired`.
- So a self-source PR carries `review:pending` — cleared only when a converged agent panel applies `review:accepted` — **not `review:human`.** The #456 two-tier flip is explicit: engine tier is agent-reviewable and auto-lands on a converged verdict. (Caveat, code-verified: the `redteam:accepted` label is *earned* in [we:scripts/lib/review-core.mjs](scripts/lib/review-core.mjs) but is NOT itself checked as a merge precondition today — the lander gates only on the uncleared-review-label check; enforcing redteam-accept before an engine-tier auto-land is deferred to #2412, unwired. So do NOT lean on redteam-accept as a guarantee.)
- Independently, the daemon **never clears parked reviews itself** — it surfaces them for interactive sessions ("the daemon never clears these", plateau:tools/drain-daemon/cli.mjs `status`; daemon header). So the daemon cannot self-clear-and-merge its own source in one unattended motion; a SEPARATE session's review panel clears it.

**So the epic's premise — "#2480 forces `review:human`, so the daemon already CANNOT auto-land its own source" — is only partly true.** #2480 verifiably guarantees: (1) every self-source PR escalates to an independent adversarial review panel (`review:pending`), and (2) the daemon never silently self-clears its own parked review — so its own source lands only after a SEPARATE session's converged panel applies `review:accepted`. It does NOT guarantee a HUMAN (engine tier is agent-clearable); it does NOT (today) gate on `redteam:accepted` (that enforcement is deferred to #2412); and the trust chain — a *review* gate — says nothing about the daemon **concurrently lane-editing itself** (#2077-style), which is a scheduling concern, not a review one.

- **(a — recommended base) RELY on #2480's engine-tier escalation as the sufficient enforcement of the AUTO-LAND concern.** No new review code. The ratifier accepts the honest residual: a self-source change is agent-clearable (independent panel + no daemon self-clear; a separate session's converged panel must accept it), not human-gated.
- **(b — recommended addition) ADD a LIGHT in-daemon tripwire** — an `isSelfSourceChange(prFiles)` that DEFERS a PR touching the daemon's own source so THIS daemon's pass is never the one to land it. **Key it on the daemon's resolved source DIRECTORY (`dirname(import.meta.url)` → everything under `tools/drain-daemon/`), NOT a basename set** — this is the whole point: the `TRUST_CHAIN` entries are GENERIC basenames slated to be renamed + narrowed ([we:scripts/lib/gate-config.mjs](scripts/lib/gate-config.mjs) L96-100), and a rename would silently stop escalation firing (`scoreEscalation` → `escalate:false` → the lander merges a non-escalated ready PR). A basename-keyed guard would share that exact fragility; a directory-keyed one does not — that is the gap (a) structurally cannot close.
- **(c) PROMOTE the daemon files to POLICY tier (force `review:human` on self-source).** Heavy: contradicts the deliberate #456 engine-tier choice, re-strands the queue on humans, and over-fires on the generic-basename collisions (the daemon's operator-CLI and pure-lib basenames collide with unrelated WE files, [we:scripts/lib/gate-config.mjs](scripts/lib/gate-config.mjs) L96-98). Available as an escalation if the ratifier decides self-source specifically must be human-only.

**Default: (a) + light (b).** Rely on #2480 for the auto-land guarantee (real and sufficient for "no silent self-merge + always an independent adversary panel"), and add the directory-keyed in-daemon tripwire for the one gap engine-tier escalation cannot cover: the rename-fragility of the generic basenames. Present the human question honestly as a deliberate residual — if the ratifier wants self-source to be human-gated, that is the (c) override, not the default. **Explicitly OUT of scope of (b) here:** a concurrent self-lane-edit exclusion (#2077-style). The phase-1 daemon spawns/steers/lane-edits nothing (it only runs merge sweeps — `plateau:tools/drain-daemon/daemon.mjs` charter); there is no self-edit scheduler to exclude yet, so that guard belongs where lane-editing/fanout lands (#2444/#2418), not here.

Concrete shape (the light guard — pure, testable in the daemon's lib):

```js
// key on the daemon's OWN resolved source DIR, not a basename set — a rename would defeat
// the trust-chain roster AND a basename guard identically, so the tripwire keys on LOCATION.
const SELF_SRC_DIR = 'tools/drain-daemon/'; // == dirname(import.meta.url) tail
export function isSelfSourceChange(prFiles = [], selfDir = SELF_SRC_DIR) {
  return (Array.isArray(prFiles) ? prFiles : []).some((f) => String(f).includes(selfDir));
}
// daemon loop: a PR touching the daemon's own source dir is DEFERRED by this daemon —
// it is never the pass that lands its own source; a session / the next reloaded daemon does.
```

**Skeptic:** SURVIVES-WITH-AMENDMENT (a fresh-context skeptic + two-confusion screen ran; three amendments folded). (1) **Factual error struck:** the earlier claim that a `redteam:accepted` "gates the land" is UNENFORCED — it is earned in [we:scripts/lib/review-core.mjs](scripts/lib/review-core.mjs) but never checked as a merge precondition (deferred to #2412); guarantee (2) restated as "converged agent panel applies `review:accepted` + daemon never self-clears." (2) **Guard re-keyed** from the generic basenames to the source DIRECTORY — a basename guard shares the exact rename-fragility it claims to backstop. (3) **Scoped down:** the concurrent-self-lane-edit half is premature (no self-edit scheduler exists in phase 1) — moved to #2444/#2418. Classification: the AUTO-LAND sub-question is largely settled by #2480, so (a) is precedent, not a live pick; the live residual is the directory-keyed tripwire, which keeps this a real fork. Statute-overlap: sets no new `codifiedIn` — records how the daemon composes with the EXISTING #2445/#456 two-tier statute; no collision.
**Screen:** clear. The residual is a real behavioral guarantee difference (agent-clearable vs human-gated; regression-safe vs silently-un-escalated on rename), not impl detail or prioritization — a consumer of the loop sees whether a self-source change can land without a human.

## Coupling, ordering, and what stays out of scope

**Ordering:** Fork A is upstream — it defines the clone the reload primitive (B) acts on and the "self identity" (the clone's own tracked files) that C's guard keys on. Ratify A first; B and C then resolve against A's choice.

**Deferred / out of scope (deliberately).** This decision covers ONLY the **drain-daemon self-update subset** (slices L1 clone → L2 reload → L3 self-exclusion). Durable agent/lane-queue persistence and "the coordinator resumes WITH its agents after a reload" are a different, larger concern entangled with the agent-runner (#2444) and the orchestrator-as-Node-fanout (#2418) — those stay deferred with the rest of the epic's phase-2 scope (`priority: low`, out of auto-select) until the daemon's operating evidence (#2456) lands. Nothing here spawns, steers, or persists agents.
