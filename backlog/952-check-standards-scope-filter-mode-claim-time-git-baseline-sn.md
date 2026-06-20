---
kind: story
size: 5
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: scripts/readiness/claimScope.mjs
tags: []
---

# check:standards --scope filter mode + claim-time git baseline snapshot (gate violation attribution)

Build the #949-ratified gate attribution: (1) claim records git status --porcelain baseline + owning session/ids into per-session state alongside the #083 reservation registry; (2) check:standards gains a --scope/--mine flag that partitions findings by files-dirty-now-minus-baseline and exits 1 only on a my-scope error, external findings printed as non-failing notes; default no-flag run stays whole-repo-strict (CI/close-out unchanged). check:health reuses the same scope mode keyed on claimed item-id (findings already carry id). Build check:standards scoping first (where cross-session reds land).

## Progress (batch-2026-06-18) — resolved

Built the ratified (#949) `check:standards` lead half end-to-end.

- **Pure attribution module** `we:scripts/readiness/claimScope.mjs` (mirrors the `we:scripts/readiness/reservations.mjs`
  purity contract — no fs/process/clock; callers inject git output + clock). Carries the claim-baseline
  CRUD (`recordClaim`/`baselineFor`/`pruneExpiredClaims`), `porcelainFiles` (parses `git status
  --porcelain`, incl. rename targets), `mineFiles` (= dirty-now − baseline; `null` ⇒ caller falls back
  to strict), and the finding partition (`findingFiles`/`classifyFinding`/`partitionFindings`). 12 unit
  tests in `we:scripts/__tests__/claimScope.test.mjs`.
- **Claim baseline (producer)** in `we:scripts/backlog.mjs`: on `claim … --session=<slug>` it snapshots
  the files already dirty (everyone else's in-flight + pre-existing) into `we:.claude/skills/batch-backlog-items/claims.json`
  the **first** time the session claims (kept thereafter, so the session's own later edits all count as
  mine), and stamps the owning id. Best-effort (a git/IO hiccup never fails the claim). Verified live: a
  claim recorded a 106-file baseline + the owning id.
- **`--scope=<session>` (consumer)** in `we:scripts/check-standards.mjs`: partitions errors against the
  session's owned set — **my-scope errors block (exit 1); external (concurrent/pre-existing) errors print
  as `note (external)` and don't fail; a path-less finding can't be proven foreign so it stays blocking
  (fail-safe).** The **default no-flag run is untouched** — whole-repo-strict (CI/close-out unchanged).
- **Aggregate findings made attributable.** The canonical concurrent-red — the **aggregate, descriptor-
  less repo-locus error** (one finding spanning several sessions' files, the #664 worked example) — now
  carries `descriptor.files`, so `--scope` attributes it per-file. `we:AGENTS.md`-stale carries its `file` too.
- **Verified both directions live** (induced a controlled repo-locus error): baseline excluding the file →
  attributed *mine* → **exit 1**; baseline including it → demoted to an external note → **exit 0**. Default
  run + the full rules/reservations suites green (182 tests).

**Deferred to [#957](/backlog/957-check-health-scope-reuse-batch-gate-step-adopts-scope/):** the
`check:health --scope` reuse (trivial — findings already carry the item-id) and the batch skill/workflow
**adopting** `--scope` so the manual scoped-stop triage becomes deterministic. #953 remains the Fork 2-C
file-claim precision upgrade.