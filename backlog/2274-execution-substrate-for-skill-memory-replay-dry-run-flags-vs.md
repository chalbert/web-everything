---
kind: decision
parent: "2268"
status: open
dateOpened: "2026-07-04"
preparedDate: "2026-07-09"
tags: [validation-suite, replay, worktree, tiering]
---

# Execution substrate for skill/memory replay: dry-run flags vs revertible worktree

> **Prep note (2026-07-09, `/prepare all`).** No `/research/` topic — this ratifies a substrate choice over
> shipped internal machinery, not a greenfield standard, so the concrete-refs grounding stands in for a web
> survey. **A hostile skeptic pass moved the default's *mechanism*** (see Skeptic below): the substrate is a
> per-test **throwaway clone** (`mkdtempSync` + `git init`/`git clone`, discarded via `rmSync`) — the pattern
> already shipping in `we:scripts/__tests__/lane-drain-numbering.test.mjs` — **not** the shared lane pool. The
> lane pool (`we:scripts/lane-pool.mjs`) is production infra that dies in CI, force-resets to `origin/main`
> (hostile to fixture seeding), and strands 4-hour leases — it must **not** be the test substrate. Two other
> corrections folded: the tiering is already ratified (`we:scripts/lib/invariant-catalogue.json`, #2271), and
> the substrate serves the **deterministic mutation-replay**; driving an LLM *judgment* skill deterministically
> is #2272's separate, unsolved problem, not settled here.

## Grounding digest

- **The shipped pattern is a throwaway repo running a real mutation — Fork B in miniature.**
  `we:scripts/__tests__/lane-drain-numbering.test.mjs` `mkdtempSync`s a scratch git repo (`:26`), `git init`s +
  seeds a synthetic fixture (`:27-42`), drives the **real** mutating `numberPendingHashes(repo)` which renames
  files and **commits** (`:44`), asserts on the resulting tree (`:47-55`), and `rmSync`s in `afterEach` (`:34`).
  Siblings: `we:scripts/__tests__/lane-pool-refresh-guard.test.mjs:30`,
  `we:scripts/validation-normalize/__tests__/live-config.test.mjs`. "Run the real thing, assert on the tree,
  discard" is an established repo pattern — low novelty risk — **and it uses `mkdtemp`, not the lane pool.**
- **The lane pool cannot be the test substrate (three hard failures).** (1) **Dies in CI:** `cmdAcquire` fails
  when no pool exists (`we:scripts/lane-pool.mjs:474`, keyed off `existsSync(poolDir)` under `LANE_POOL_ROOT`) —
  a fresh CI runner has no pool. (2) **Force-resets, hostile to fixtures:** acquire does `fetch` +
  `reset --hard origin/<branch>` + `clean -fd` (`we:scripts/lane-pool.mjs:508-511`), deleting any seeded
  synthetic corpus; a replay needs a *fabricated historical* tree, which then trips the pool's own dirty/ahead
  guard. (3) **Strands leases / contends with the drain:** a crashed test holds its lease to TTL (default 240
  min), and the pool's documented consumers are drain/merge/batch/solo/prepare — a test-suite lease consumer
  can starve a live drain. So the substrate is a `mkdtemp` throwaway clone, **never** the pool.
- **Fork A's fidelity is inherently compromised on the mutating skills.** The scripts that issue mutating git
  verbs — `we:scripts/lane-drain.mjs`, `we:scripts/merge-ai-prs.mjs`, `we:scripts/pr-land.mjs` — can only test
  a **stubbed** `--dry-run` path (`we:scripts/lane-drain.mjs:228`, `we:scripts/merge-ai-prs.mjs:568`), so a
  dry-run replay validates the *preview* branch, never the real commit/rename/merge the suite regression-guards.
  "Faithful dry-run" is self-contradictory for a mutating op. And the parent epic already excluded A ("worktree-
  replay *rather than* a per-skill `--dry-run` retrofit", `we:backlog/2268-validation-suite-for-skills-and-memory.md`),
  so the *live* question is **throwaway-clone vs lane-pool**, and A is settled context.
- **The tiering is already ratified.** `we:scripts/lib/invariant-catalogue.json` (resolved #2271) encodes
  `tiers.A` (deterministic script/hook layer, CI-able snapshot) and `tiers.B` (judgment skills, session-run),
  with 43 invariants tagged (37 A / 6 B). This decision routes each tier to a substrate; it does not define the
  split.
- **Scope caveat — the substrate is not the whole of #2272.** Tier-B judgment skills are LLM-driven
  ("no deterministic output", "run from session, not CI"). Their invariants are `judgment-only` and asserted by
  a *model following a prompt* — there is no callable `runRealSkill()`. The isolation substrate is the *easy*
  part; making an LLM skill's replay deterministic enough to assert on is #2272's hard, unsolved problem, which
  **no** substrate choice resolves. This decision settles only *where the mutation runs*, not *how a judgment
  skill is driven*.

## Axis-framing

The live axis is **what disposable isolation primitive the suite uses to run a *mutating* script/skill and
assert on its effect without leaving state behind.** Running the fork-existence test: the parent already ruled
out A (universal `--dry-run` retrofit) on fidelity grounds, so the genuine either/or is **throwaway clone vs the
shared lane pool** — and it *is* a real fork because the two cannot coexist as the substrate (a per-test
`mkdtemp`+`git init` scratch repo is hermetic and CI-safe; acquiring a production pool lane is neither), and the
lane-pool branch is *broken* by forced invariants (no pool in CI → `acquire` exits 1; `reset --hard origin/main`
destroys the fixture; leases strand + contend with the drain — `we:scripts/lane-pool.mjs:474,508-511`). Which
layer: a test-harness/infra call, Tier-A per the ratified split. The fork turns on a concrete code-level shape
(the harness setup/teardown), so it carries a code example. Fork A (`--dry-run`) is retained only as
settled-context, not a live branch.

## Recommended path at a glance

| Fork | Question | Recommended default (post-skeptic) | Main alternative (excluded) |
| --- | --- | --- | --- |
| 1 | Disposable substrate for replaying a *mutating* script/skill? | **Per-test throwaway clone — `mkdtempSync` + `git init`/`git clone` off the fixture, run the real mutation, assert on the tree, `rmSync` (the shipped `we:scripts/__tests__/lane-drain-numbering.test.mjs` pattern).** Hermetic, CI-safe, no shared-infra coupling. | **Acquire a shared lane-pool lane** (broken — no pool in CI → `acquire` exits 1; `reset --hard origin/main` destroys the fixture; lease strand + drain contention, `we:scripts/lane-pool.mjs:474,508-511`) · **(A) universal `--dry-run` retrofit** (parent-excluded — stubbed path ≠ real mutation) |

**Supported by default (not forks):**
- **Tier-A deterministic scripts → the same throwaway-repo golden snapshot** (this is #2273's scope). Read-only
  gates (`we:scripts/check-*.mjs`, `we:scripts/lint-*.mjs`, `we:scripts/guard-*.mjs`) mutate nothing, so a
  golden test captures exit-code + stdout with no isolation; deterministic *mutating* scripts (e.g.
  `we:scripts/backlog.mjs` scaffold/resolve) use the same `mkdtemp`+`git init` throwaway pattern. One substrate
  serves both tiers' *mutation* replay.
- **`--dry-run` stays an operator-preview feature, not a suite mechanism** (correcting the item's original
  "cheap `--dry-run` on pure Tier-A scripts" line — pure gates need no dry-run; mutating scripts use the
  throwaway repo).

## Fork 1 — Disposable substrate for mutating-script/skill replay

**Fork exists because** the two substrates cannot both serve the suite, and the *flawed* branch is broken by
forced invariants: acquiring a shared lane-pool lane exits 1 in CI (no pool, `we:scripts/lane-pool.mjs:474`),
force-resets the checkout to `origin/main` and `clean -fd`s away the seeded fixture
(`we:scripts/lane-pool.mjs:508-511`), and strands a 4-hour lease that contends with the live drain. A per-test
throwaway clone has none of these — it is hermetic and disposable by construction.

- **Per-test throwaway clone (default).** For a mutating replay case, `mkdtempSync` a scratch dir, `git init`
  (or `git clone` the fixture corpus), seed the synthetic historical tree, run the **real** mutating
  function/skill against it, assert the invariant-catalogue checks on the resulting tree/commits, and `rmSync`
  the dir in teardown. This is the exact shape already shipping in
  `we:scripts/__tests__/lane-drain-numbering.test.mjs` — generalize it, don't invent a primitive.
- **Acquire a shared lane-pool lane (excluded — broken).** Reusing `we:scripts/lane-pool.mjs`
  acquire/release/remove *looks* like reuse but is production infra: CI-broken, fixture-hostile, and it mutates
  the shared pool (a suite that `remove`s shrinks the human's pool; a red test strands a lane for 4h). Rejected.
- **(A) universal `--dry-run` retrofit (parent-excluded — settled context).** A faithful `--dry-run` on every
  mutating script tests a stubbed preview path, not the real mutation — the fidelity gap the parent epic
  already ruled out. Listed for completeness, not a live branch.

Harness shape under the default (keyed to the shipped throwaway-repo pattern):

```js
// Generalizes we:scripts/__tests__/lane-drain-numbering.test.mjs — a per-test THROWAWAY repo, not the lane pool.
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let repo;
beforeEach(() => { repo = mkdtempSync(join(tmpdir(), 'replay-')); execFileSync('git', ['init'], {cwd: repo}); seedFixture(repo); });
afterEach(() => rmSync(repo, {recursive: true, force: true}));          // disposable by construction — no lease, no pool

it('replays the real mutation and asserts on the resulting tree', () => {
  runRealMutation(repo);                                                // the REAL commit/rename/merge runs
  assertInvariants(repo, catalogue.tiers.A);                            // assert on the resulting tree/commits
});
// (lane-pool excluded) — `lane-pool.mjs acquire` exits 1 in CI (:474) and `reset --hard origin/main` (:508-511)
//   would delete the seeded fixture. (A excluded) — a --dry-run replay asserts the preview branch, not the mutation.
```

**Skeptic:** REFUTED-then-corrected (hostile 4-axis attack). The **lane-pool mechanism was REFUTED**: the card's
own flagship evidence (`we:scripts/__tests__/lane-drain-numbering.test.mjs:26`) uses `mkdtemp`+`git init`, *not*
the pool, and the pool is CI-broken + fixture-hostile + lease-stranding (`we:scripts/lane-pool.mjs:474,508-511`)
— default flipped to the throwaway clone. **(0) Classification:** real fork (throwaway-clone vs pool cannot
coexist as the substrate; pool branch broken by forced invariants), with A as parent-settled context, not a
live branch. **(1) Merit:** the substrate serves the *deterministic* mutation-replay; the harder "drive an LLM
judgment skill deterministically" is #2272's unsolved problem — scope caveat folded so the item no longer over-
claims Tier-B runnability. **(2) Statute-overlap:** `codifiedIn` reworded to "an ephemeral throwaway clone
(`mkdtemp`+`git init`, `rmSync`), never the shared lane pool" — removing the collision with the #2283 lease
primitive / #2337 force-gate / #1933 clone-pool statutes a `lane-pool acquire→remove` wording would have caused.
**(3) Citation-scope:** the `we:scripts/lib/invariant-catalogue.json` tiering is cited only for the A/B *tagging* (its ratified
content), not as substrate authority.

**Screen:** clear (fresh-context two-confusion). **(1) Impl-detail:** rises to a real ratifiable rule — it pins
#2272 + #2273 to one substrate and forecloses the tempting wrong path (repurposing operator `--dry-run` as the
fidelity substrate), producing a cite-able convention. **(2) Merit-vs-prioritization:** a genuine *fidelity*
merit, not effort — a dry-run cannot perform the mutation it must assert on, independent of retrofit cost.

## Codified rule (on resolve — worded to the real primitive)

*"The skill/memory validation suite replays mutating cases inside an **ephemeral throwaway clone**
(`mkdtempSync` + `git init`/`git clone`, discarded via `rmSync`), asserting on the resulting tree — **never the
shared lane pool** (which is CI-broken, fixture-hostile, and lease-bearing). `--dry-run` remains an
operator-preview feature, never the suite's fidelity substrate. Driving an LLM *judgment* skill deterministically
is a separate #2272 problem, unaddressed by the substrate choice."*

---

Child of #2268 (the validation suite); directly unblocks #2272 (Tier-B session-replay harness — whose hard part,
deterministic LLM-skill replay, this decision does *not* solve). Sibling #2273 owns the Tier-A snapshot path
(same throwaway-repo substrate); #2270/#2271 (golden corpus + invariant catalogue) are resolved and supply the
fixtures + assertions.
