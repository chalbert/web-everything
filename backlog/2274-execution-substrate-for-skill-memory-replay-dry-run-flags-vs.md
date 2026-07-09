---
kind: decision
parent: "2268"
status: open
dateOpened: "2026-07-04"
preparedDate: "2026-07-09"
relatedReport: reports/2026-07-09-mutating-skill-replay-substrate.md
tags: [validation-suite, replay, test-isolation, agent-meta, decision]
---

# Execution substrate for skill/memory replay: dry-run flags vs revertible worktree

## Context

The #2268 validation suite must run a **mutating** skill/script and assert on its effect **without leaving
state behind**. The nominal fork: retrofit a faithful `--dry-run` onto every script (Fork A), or replay the
real skill in an ephemeral, revertible checkout (Fork B)?

> **Prep note (2026-07-09, `/prepare all`).** Grounded by research topic
> [`mutating-skill-replay-substrate`](/research/mutating-skill-replay-substrate/) (report
> [we:reports/2026-07-09-mutating-skill-replay-substrate.md](../reports/2026-07-09-mutating-skill-replay-substrate.md)).
> The survey **reshaped the item**: (1) Fork A-vs-B is *already settled* by the parent epic #2268 (which
> prescribes worktree-replay "rather than a per-skill `--dry-run` retrofit"), so this is a **ratify of B**, not
> an open A-vs-B choice; (2) the epic's word "worktree" is **guard-blocked** (#1153) and must be read as a lane
> **clone**; (3) the genuinely-open decision is the **substrate detail**. The first-draft "dedicated cold clone
> per replay" was *refuted* on cost — prepared default is a **leased warm validation-lane pool isolated by a
> throwaway origin** for the push-y skills.

## Grounding digest

- **A-vs-B is settled upstream.** `we:backlog/2268-validation-suite-for-skills-and-memory.md:30-36` prescribes
  *"replaying the real skill in an ephemeral, revertible git worktree … rather than a per-skill `--dry-run`
  retrofit (see #2274)."* So Fork A is rejected by the epic; #2274 ratifies B + decides the substrate.
- **The two tiers** (`we:scripts/lib/invariant-catalogue.json:5-6`): **Tier A** = deterministic scripts, pure
  input→(files/exit code), golden/snapshot (child #2273); **Tier B** = judgment skills (batch/drain/finish/
  next/review-program), no deterministic output, replay + invariant assertion (child #2272).
- **"worktree" is guard-blocked → lane clone.** `{#…isolate-by-clone}`
  (`we:docs/agent/platform-decisions.md:2497-2498`, #1153): the guard *"denies … `worktree add` in the shared
  checkout, forcing clones."* #1996 codified *"isolation = a clone"*
  (`we:reports/2026-07-02-solo-session-worktree-lane-prior-art.md:21`).
- **The clone is cheap and already leased.** `we:scripts/lane-pool.mjs:13-18`: `git clone --reference` shares
  objects, so the clone is near-free — *"the real cost is `npm ci` per lane on a fresh clone."* `acquire`
  (`we:scripts/lane-pool.mjs:287-353`, #2275) leases a free lane **exclusively**; an exclusive lease already
  prevents contention.
- **The `--dry-run` surface is large + unfaithful.** 11/49 `we:scripts/*.mjs` carry it (all already git-mutating,
  e.g. `we:scripts/pr-land.mjs:51`); ~38 would need retrofit, and the heaviest-mutating skills would test a
  *stubbed* path (the proven path ≠ the shipped path). Tier-A pure logic already snapshot-replays in
  `we:scripts/mine-golden-corpus.mjs` (#2270) with no `--dry-run`.

## Axis-framing

The live axis is **the execution substrate for a Tier-B replay** — not A-vs-B (settled) and not literally "git
worktree" (guard-blocked). Running the fork-existence test on the *substrate*: this is a **real fork** because
two coherent substrates for the push-y skills — a shared production-pool lane vs an isolated throwaway-origin
lane — genuinely cannot coexist (a replay of `drain` either hits real GitHub or it doesn't), and the *flawed*
branch (replay in a production-pool lane whose origin is real GitHub) is **broken**: it pushes real `lane/*`
refs + merges real PRs. Which layer: this is an **agent-meta / test-harness** decision — the 7-question web-layer
pass is N/A. The fork turns on concrete harness wiring (lease + origin), so it carries a code example.

## Recommended path at a glance

| Fork | Question | Recommended default (post-skeptic) | Main alternative (excluded) |
| --- | --- | --- | --- |
| 1 | Substrate for a Tier-B mutating-skill replay? | **(b) A leased (#2275) warm validation-lane pool, isolated from production by a throwaway local bare origin for the remote-mutating skills (drain/finish/pr); a plain leased pool lane for non-remote skills (next/review-program). Tier-A: golden/snapshot tests, no `--dry-run`.** | **(a) Retrofit `--dry-run` onto every mutating script/skill** (settled against by #2268; unfaithful stubbed path; ~38-script surface) · a **dedicated cold clone per replay** (loses on cost — cold `npm ci` every replay; contention already solved by #2275) |

## Fork 1 — The Tier-B replay substrate

**Fork exists because** the two substrates for the push-y skills cannot coexist and one is broken: replaying the
*real* `drain`/`finish`/`pr` in a production-pool lane whose `origin` is real GitHub pushes real `lane/*` refs
and merges real PRs (contamination), while an isolated throwaway-origin lane does not — a genuine either/or with
a flawed branch. (Fork A — `--dry-run` retrofit — is excluded upstream by #2268, restated here as the rejected
alternative, not re-litigated.)

- **(b) Leased warm validation-lane pool, isolated by a throwaway origin — default.** For **remote-mutating**
  skills (drain/finish/pr): `acquire` a warm lane from a small **validation** pool (#2275 exclusive lease)
  whose `origin` is a **throwaway local bare repo** seeded from a corpus fixture; run the *real* skill; assert
  the invariant catalogue against the resulting tree; `release`. Isolation is *by origin* (no real-GitHub
  blast-radius), the lease prevents contention, and a warm lane amortizes `npm ci` across replays. For
  **non-remote** skills (next/review-program) a plain leased pool lane suffices. **Tier-A** pure scripts use
  golden/snapshot tests (no `--dry-run`); the git-mutating Tier-A ops (e.g. `we:scripts/backlog.mjs`
  scaffold/resolve) get a cheap `git init` scratch tree, not a full lane.
- **(a) `--dry-run` retrofit (rejected — settled by #2268).** Bolt a `--dry-run` onto every mutating
  script/skill. Rejected upstream and on merit: ~38-script retrofit, and the heaviest-mutating skills test a
  *stubbed* path — a strictly weaker proof (the dry-run branch, not the shipped mutation), and a permanent
  divergence surface in production code. Unnecessary for Tier-A (snapshots run the *real* write path).
- **(excluded — dedicated cold clone per replay).** A fresh `git clone --reference` throwaway per replay.
  *Refuted:* contention it was meant to avoid is already solved by #2275's exclusive lease, and a cold clone
  pays `npm ci` **every** replay where a warm leased lane amortizes it — strictly slower for a suite that
  replays many skills. Isolation belongs at the **origin**, not by discarding the lane.

```js
// (b default) — Tier-B replay of a REMOTE-mutating skill (drain/finish/pr): leased warm lane + throwaway origin
const origin = seedThrowawayBareOrigin(corpusFixture);         // local bare repo — no real GitHub
const lane = acquire({ pool: 'validation', origin });          // we:scripts/lane-pool.mjs (#2275 exclusive lease)
try {
  runRealSkill('drain', { cwd: lane });                        // the REAL skill — pushes to the throwaway origin
  assertInvariantCatalogue(lane);                              // we:scripts/lib/invariant-catalogue.json
} finally { release({ lane }); }                               // warm lane returns to the pool (npm ci amortized)

// (a rejected) — a --dry-run retrofit would instead run a STUBBED path: proves the dry-run branch, not the ship.
```

**Skeptic:** SURVIVES-WITH-AMENDMENT (hostile refutation, four axes). **(0) Classification:** A-vs-B is a
**ratify** (#2268 settled it) — the open content is the substrate; not re-litigated. **(1) Merit:** the
first-draft "dedicated cold clone to avoid lease contention" was **refuted** — contention is solved by #2275's
exclusive lease, and cold `npm ci` per replay loses to a warm leased lane; the real isolation need is **remote
blast-radius** (drain/finish/pr push real refs), fixed by a throwaway origin, not by discarding lanes.
Tier-A-needs-no-isolation was **amended**: git-mutating Tier-A ops get a cheap scratch tree. **(2)
Statute-overlap:** none — the worktree→clone correction is *compelled* by #1153 (`:2497-2498`) and extends the
isolate-by-clone posture; overlayfs/CoW/container declined (a substrate the constellation doesn't use). **(3)
Citation-scope:** #1153 reaches (a clone outside the shared checkout is permitted); #2275's lease reaches — and
refutes — the contention rationale. **Screen:** clear (fresh-context two-confusion). (1) Contract-visible —
whether shipped scripts carry a `--dry-run` flag differs between branches. (2) Merit remains free-of-cost —
faithfulness (replaying the real mutation vs a simulated path) is a proof-strength difference, not
prioritization.

## Downstream

Ratifying (b) shapes child #2272 (Tier-B session-replay): build the throwaway-origin seeding + a `validation`
lane pool over `we:scripts/lane-pool.mjs`'s `acquire`/`release`, and the invariant-assertion driver; child
#2273 (Tier-A) stays golden/snapshot with a cheap scratch tree for the git-mutating ops. No `--dry-run`
substrate is built. Correct the epic #2268 wording "worktree" → "lane clone" on resolve.

---

Prep research:
[we:reports/2026-07-09-mutating-skill-replay-substrate.md](../reports/2026-07-09-mutating-skill-replay-substrate.md);
research topic [`mutating-skill-replay-substrate`](/research/mutating-skill-replay-substrate/).
