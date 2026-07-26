# Cutting per-item wall-clock in the conveyor (design record, 2026-07-26)

**Status:** proposed (v6). High-care design-jury convergence loop (`decision-prose`): round 1 → **changes**
(framing) → v2; round 2 → **changes** (second-order soundness) → v3; round 3 → **changes** (design-shape) → v4;
round 4 → **changes** (round-3 fold consequences, all on Lever C) → v5; round 5 (= the round cap) → **changes**,
all-new residuals on Lever C's concurrency → **ESCALATE** by the deterministic round-cap rule. **Outcome:
A/B/E/D converged; Lever C spun out to its own decision (#xwysuk4, see §5).** The loop folded each round and
escalated mechanically at the cap — the process `we:#xvwmwkx` will run in code, not by hand.
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

## 2. The levers (post-jury, v6)

- **Lever 0 — instrument first** (#2680). A pure breakdown of authoring / first-CI / poll-gap /
  land-serialization wait / pool saturation, per-item and aggregate, from lane-board + `gh` timestamps. Tells us
  which term binds. **Round-2 corrections:** (1) it **cannot** produce Lever D's false-green signal — a
  false-green is a test-*outcome* fact (selected-suite green while full would be red), recoverable only by a
  **shadow full-suite compare**, never from timing data; that signal is owned by D, not here. (2) **Authoring
  time** is not cleanly derivable from `gh` PR timestamps (a PR is created *after* authoring); isolating it needs
  a real **dispatch → first-commit span**, which may require recording that boundary — if so, that (small)
  instrumentation is in scope, and the "no new state store" claim is relaxed to "no new *durable* store."
  **Round-4 refinement:** that span is not pure authoring — it also contains lane-clone setup, env boot, and
  context load. The gate in §4 routes to *different* out-of-portfolio fixes for those sub-terms (authoring-reduction
  vs clone/pool provisioning), so Lever 0 must **decompose** the span (at least authoring vs setup), else it can
  read "authoring binds" and fire the wrong lever. Sub-term decomposition is a gating precondition, not optional.

- **Lever A — author `scope:` at readiness** (land #2619). Kills the two-hop: removes a whole PR **and a whole
  land off the serial writer** per unscoped item. Committed unconditionally as a **latency + total-work** win
  (fewer PRs, fewer lands). **Round-4 consistency fix:** its *throughput* benefit is gated on the same term C's
  is — removing a land raises throughput only if **land-serialization or pool-width binds** (in an idle-writer /
  spare-lane regime it is a latency + total-work win, not a throughput one). So A's throughput claim carries the
  same Lever-0 qualifier; we don't assert it unconditionally while gating C's identical mechanism. Scope here is for
  **dispatch-overlap arbitration only**, tolerant of incompleteness via the observed-scope breach detector
  (#2560). **Not a test-selection input** (see D).

- **Lever C — event-driven land** (#2683) — **ESCALATED to decision #xwysuk4 (see §5); not committed here.** Fire
  the fast-drain when the land becomes possible, then run **the daemon's own land path scoped to one PR**:
  `planLabelDrain` ordering + the full pre-land gate re-derived server-side (`we:scripts/lib/pr-merge-gate.mjs`) +
  per-PR idempotency. **Round-2:** the trigger is the **last-precondition-satisfied** event — CI-green **and** the
  non-author review sign-off present — not CI-green alone (the sign-off usually lands after green). C's *throughput*
  value is provisional on Lever 0 showing land-serialization binds. **Round-3:** C is not a second concurrent
  writer — its speedup is eliminating the ≤60 s *poll wait*, so it runs **under the daemon's held lease**
  (`--under-lease`, never a bypass) with the numbering mutex widened to guard the whole read-gate→merge→push
  section. **Rounds 4–5 (why it escalated):** that widened lock needs a bounded timeout so it can't wedge the
  queue — but a plain lease-TTL cannot distinguish *crashed* from *slow-but-alive*, so a timed-out-but-live
  holder's late push races the next writer (the second-writer race returns). Making C sole-writer-safe needs a
  **fencing token / monotonic lease generation / CAS-on-push**, plus an **authorization-by-identity** model (not
  sign-off *presence*) and **non-repudiable audit** of C vs the daemon. A new concurrency finding surfaced every
  round → the mechanical round cap escalated it to its own decision rather than a sixth prose fold.

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

**Portfolio-scope caveat (round-3 gap).** Levers A–E address only **transport + CI**. But two of the binding
terms Lever 0 measures — **agent authoring time** (this record's own pick for the *dominant* term) and
**lane-pool width** — have **no lever here**. So the honest scope is: if Lever 0 fingers authoring or pool
saturation as the binding constraint on #2606, **this portfolio does not contain the throughput fix** — that is a
*new* lever outside A–E (authoring-time reduction: caching / cheaper model for mechanical items / better prompts;
or pool-width expansion), which the gate below triggers as first-class #2606 work, tracked separately. A–E are
not asserted to cover the bottleneck; they cover the terms they name, and Lever 0 says whether that intersects
what binds.

## 3. Savings, re-scoped honestly

The earlier −55%…−86% figures were **% of transport only** and conflated latency with throughput. Revised:
**A** removes one full PR cycle + one serial land per unscoped item (helps both). **C** removes avg ~30 s serial
land-gap per item — a *throughput* win **only if** Lever 0 shows the serial land binds (else a latency win).
**B / E / D** shrink already-parallel CI *latency* — real for lane turnover and time-to-first-delivery, but their
**throughput** impact is conditional on Lever 0. No aggregate headline % until measured.

## 4. Sequencing — a measured GATE, not a fixed line (round-3 fix)

"Measure first" is now an actual branch point, not a caveat. The order is **measure → commit A → re-measure →
gate**:

1. **Lever 0** (measure the current system).
2. **Lever A** (land #2619) — committed unconditionally: it removes a whole PR *and a serial land* per unscoped
   item, a strict win independent of which term binds.
3. **Re-measure (Lever 0 again).** A materially changes serial-land pressure, so C's premise must be read from a
   *post-A* measurement, never the stale pre-A one. (Symmetric to E's "land before D and re-measure.")
4. **Gate on what binds** — do NOT build downstream levers unconditionally:
   - *land-serialization binds* → **C** (decision #xwysuk4 first). Else C is deferred/dropped (a latency-only lever
     isn't worth its concurrency-critical build).
   - *CI duration binds* → **E** (zero-risk shard), then **D** only if E's post-measure delta leaves enough to
     justify D's soundness cost.
   - *couple re-CI is a material tax* → **B**.
   - *authoring time or pool width binds* → **neither is in A–E** → trigger the out-of-portfolio lever (see the
     portfolio-scope caveat in §2) as the real #2606 work.
   A lever whose term the re-measure shows does not bind is **not built** — the gate can reorder, defer, or drop.

Every *built* slice reuses an existing seam (`scope:` #2609/#2619, `--only`/`--under-lease` #2290/#2449,
`stackParents` #2393, `planLabelDrain` + `pr-merge-gate` ordering & gate, the numbering mutex, the lane board) —
no new *durable* state store, no new landing authority.

## 5. Convergence status — CONVERGED (A/B/E/D) + ESCALATED (C)

A committee-convergence loop: the editor folds each round's findings and re-submits; a human is escalated only by
the deterministic round-cap rule (`deriveNegotiationOutcome` + `NEGOTIATION_ROUND_CAP=5`,
`we:scripts/lib/jury-core.mjs`). Five rounds ran:

- **Round 1 → v2:** framing errors (latency-vs-throughput targeting, scope-glob test-selection unsoundness, the
  card-only lane).
- **Round 2 → v3:** second-order soundness — Lever 0 can't emit the false-green signal, C's trigger event, C's
  measure-first consistency (folded); D's static-graph/merge-base + B's overlap-CI conditionality banked as slice
  acceptance criteria (#2681/#2684).
- **Round 3 → v4:** design-shape — C's safe-vs-fast tension, the portfolio gap, the measure→A→C staleness +
  measure-first-as-a-real-gate (§4 became a measured branch point). All editor-folded.
- **Round 4 → v5:** consequences of the round-3 folds, all on **Lever C** — the whole-merge mutex's liveness
  regression, authorization-vs-mutual-exclusion + lease delegation, un-audited daemon sole-writer assumptions;
  plus A's throughput-claim consistency and Lever 0's span decomposition. All new, all folded.
- **Round 5 (= cap) → escalate.** `changes` with **all-new residuals, every one on Lever C's concurrency** —
  chiefly that the round-4 lease-TTL fix re-opens the second-writer race (a TTL can't tell crashed from
  slow-but-alive; the late push races the next writer), needing a **fencing token / CAS-on-push**, plus an
  undesigned authorization-by-identity model and non-repudiable audit. `deriveNegotiationOutcome({changes, 5, 5})`
  → **escalate**.

**Outcome:**
- **A · B · E · D — converged.** No new finding for 2+ rounds; residuals banked as slice acceptance criteria
  (#2681/#2684) for each PR's own review. They proceed under the §4 measured gate.
- **C — escalated to decision #xwysuk4.** *Event-driven landing against a sole-writer daemon* is a genuine
  distributed-systems problem that is not closeable by more prose folds. The decision asks: can C be made
  sole-writer-safe (fencing/CAS + authorization-by-identity + audit), and is it worth it — given C's only win is
  removing the ≤60 s poll-gap, itself gated on Lever 0? Default lean: **defer C** until Lever 0 proves the serial
  land binds AND a clean safety design exists; a promising alternative that dissolves most of the packet is C only
  **nudging the daemon to sweep-now** (the daemon stays the literal sole writer) rather than landing itself.

Five rounds, editor-folded each time, escalated at the cap by the deterministic rule — the exact loop
`we:#xvwmwkx` will run in code instead of by hand (this session hand-emulated it as a stopgap).
