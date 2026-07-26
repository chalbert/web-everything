# Cutting per-item wall-clock in the conveyor (design record, 2026-07-26)

**Status:** proposed (v3). Reviewed by a high-care design jury twice (`decision-prose`): round 1 → **changes**
(52 findings, the framing errors) folded into v2; round 2 → **changes** (second-order soundness) folded here.
Parent: delivery-throughput program #2606 / conveyor epic #2612. Slices: #2680 (0) · #2683 (C) · #2684 (B) ·
#2682 (E) · #2681 (D) (+ Lever A = prioritize #2619, pinned).

**Invariants held (non-negotiable):** the final landed diff is signed off by an agent that did **not** author it;
the drain daemon stays the sole writer to `main`; gate-self / statute edits stay `review:human`, human-only;
deterministic-core / thin-judgment.

## 1. Where per-item wall-clock goes today

Per item, in PR cycles (a cycle ≈ CI-green ~2.0 min + daemon land-gap ~0.5 min):

- **Unscoped leaf** (dominant pre-#2619): held `unshaped-no-scope` by `we:scripts/readiness/dispatch-plan.mjs` →
  a **prepare-scope PR lands** → next tick the build PR lands = **2 cycles** (tax **a**, the two-hop).
- **Cross-locus couple:** impl PR lands → the WE half goes `BEHIND` → the drain
  (`we:scripts/merge-ai-prs.mjs`) rebase-drops it → the WE half **re-runs CI** → lands = **~2 cycles**
  (tax **b**, the couple re-CI).
- **Every PR:** full ~2.0 min gate + up to **60 s** daemon re-sweep
  (`plateau:tools/drain-daemon` `DEFAULTS.intervalSec=60`) = tax **c**.

**What this model omits (round-1 deepest finding).** It counts only PR *transport*. It ignores (i) **agent
authoring time** (LLM producing the diff — likely the dominant term), and (ii) whether #2606 **throughput** is even
*bound* by per-item latency: items run in parallel lanes, CI on separate runners, but **all** lands funnel through
one serial daemon + a fixed lane-pool width. If land-serialization or authoring binds, shrinking already-parallel
CI moves latency, not throughput. **So we measure first (Lever 0), then commit levers on evidence.**

## 2. The levers (post-jury, v3)

- **Lever 0 — instrument first** (#2680). A pure breakdown of authoring / first-CI / poll-gap /
  land-serialization wait / pool saturation, per-item and aggregate, from lane-board + `gh` timestamps. Tells us
  which term binds. **Two round-2 corrections:** (1) it **cannot** produce Lever D's false-green signal — a
  false-green is a test-*outcome* fact (selected-suite green while full would be red), recoverable only by a
  **shadow full-suite compare**, never from timing data; that signal is owned by D, not here. (2) **Authoring
  time** is not cleanly derivable from `gh` PR timestamps (a PR is created *after* authoring); isolating it needs
  a real **dispatch → first-commit span**, which may require recording that boundary — if so, that (small)
  instrumentation is in scope, and the "no new state store" claim is relaxed to "no new *durable* store."

- **Lever A — author `scope:` at readiness** (land #2619). Kills the two-hop: removes a whole PR **and a whole
  land off the serial writer** per unscoped item — helps throughput, not just latency. Scope here is for
  **dispatch-overlap arbitration only**, tolerant of incompleteness via the observed-scope breach detector
  (#2560). **Not a test-selection input** (see D).

- **Lever C — event-driven land** (#2683). Fire the fast-drain when the land becomes possible, then run **the
  daemon's own land path scoped to one PR**: `planLabelDrain` ordering + the full pre-land gate re-derived
  server-side (`we:scripts/lib/pr-merge-gate.mjs`) + per-PR idempotency + verified mutual exclusion vs a
  concurrent daemon sweep (today `--only` bypasses the whole-process lease and leans only on the numbering mutex,
  `we:scripts/readiness/drain-lock.mjs`). **Round-2 correction:** the trigger is the **last-precondition-satisfied**
  event — CI-green **and** the non-author review sign-off present — **not CI-green alone.** The sign-off usually
  lands *after* green, so a green-only trigger no-ops (gate incomplete) and falls back to the 60 s sweep, saving
  nothing for the common review-after-green item; C must also fire on the sign-off event. **And** C's *throughput*
  value is provisional on Lever 0 showing land-serialization actually binds — until then it is a latency lever
  (it still removes the poll-gap, but that is only a throughput win if the serial land is a material fraction).

- **Lever B — couple concurrency** (#2684). Robust: open both PRs so their first CIs overlap. Conditional:
  skip the WE re-CI **only when** landed-impl-SHA == the overlap-stack base (#2393) **and** main hasn't advanced;
  otherwise fall back to today's rebase + re-CI. Handles squash-merge and impl `review:changes` bounces. **Round-2
  correction:** the overlap-CI win is **not unconditional** — an impl `review:changes` bounce moves the stacked
  base and discards the WE half's first CI, so quantify B's benefit against the observed impl-bounce rate (#2680),
  not as "always true." The −48% figure is withdrawn.

- **Lever E — shard the full vitest run** (#2682). `vitest --shard`, zero-soundness-risk, zero maintenance.
  Land before D and re-measure; it may capture most of tax (c).

- **Lever D — diff-driven test selection** (#2681). Select off the actual `git diff` via vitest's module-graph
  (not a scope→glob map). Gate the shrink behind a **deny-by-default allow-list** on the actual changed set; define
  **red-main remediation** (dispatch-freeze + revert); keep the `push:[main]` full suite as backstop. **Three
  round-2 sharpenings:** (1) vitest `--changed/related` follows only **static** import edges — `import.meta.glob` /
  fs-read test→source edges (all-demos / registry snapshots) are invisible, so add a glob-edge guard (force-full
  when a changed path is under a glob-discovered fixture root) — "sound-by-construction" applies only to the static
  graph. (2) The diff **merge-base must be pinned** (net two-dot vs `origin/main`, robust to stacked/rebased/squash)
  so a sensitive-path edit earlier in the branch cannot fall outside the computed set and evade the allow-list.
  (3) The **false-green signal is produced here** — a shadow full-suite compare in measure mode — not by Lever 0.
  Flag-gated, sequenced after E, defaulted only on that measured evidence.

- ~~Card-only fast-CI lane~~ — **dropped**: tail-optimization of the path A makes rare, and unsound (the
  `/backlog/` page renders from `backlog/*.md`, so a card change can break the render — exactly what the skipped
  smoke/interaction tests catch; and a card's `scope:`/`status`/`priority` are trusted control inputs, not inert).

## 3. Savings, re-scoped honestly

The earlier −55%…−86% figures were **% of transport only** and conflated latency with throughput. Revised:
**A** removes one full PR cycle + one serial land per unscoped item (helps both). **C** removes avg ~30 s serial
land-gap per item — a *throughput* win **only if** Lever 0 shows the serial land binds (else a latency win).
**B / E / D** shrink already-parallel CI *latency* — real for lane turnover and time-to-first-delivery, but their
**throughput** impact is conditional on Lever 0. No aggregate headline % until measured.

## 4. Sequencing

**0 → A → C → B → E → D.** Every slice reuses an existing seam (`scope:` #2609/#2619, `--only`/lease #2290/#2449,
`stackParents` #2393, `planLabelDrain` + `pr-merge-gate` ordering & gate, the lane board) — no new *durable* state
store, no new landing authority.

## 5. Convergence status

Two jury rounds. Round 1 killed the framing errors (latency-vs-throughput targeting, the scope-glob test-selection
unsoundness, A2). Round 2 returned `changes` again but the findings shifted to **second-order soundness** — the
three design-level ones (Lever 0 can't emit the false-green signal · C's trigger event · C's measure-first
consistency) are folded above; the rest (D's glob-edge blindness + diff merge-base, B's overlap-CI conditionality)
are **slice acceptance criteria**, carried on the filed slices #2681/#2684, to be enforced at each slice's own PR
review rather than re-litigated as design rounds. The design *shape* is treated as converged; residual soundness is
owned by the slices.
</content>
