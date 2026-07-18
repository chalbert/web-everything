# Prep — console queue scale & ordering forks (#2557)

Session report for the `/prepare` pass on [#2557](/backlog/2557-console-queue-scale-and-ordering-forks/)
(kind: decision, parent #2505 Plateau Loop). Brings four console-board rulings to Definition of Ready. No
greenfield web survey — this is *already-researched ground*: the prior art is the console design record
[we:docs/design/backlog-console-design.md](../docs/design/backlog-console-design.md) (landed via PR #567),
its competitive research (§3h), and its 31-round review campaign. Each fork was re-grounded against the
**real shipped WE CLI**, so no new `/research/` topic was published.

## The four forks (final rulings — all prepared, not resolved)

| Fork | Classification | Recommended default |
|---|---|---|
| **1 — DAG frontier render rule** | Fork (genuine either/or on the frontier *definition*) | State-based frontier (in-flight ∪ next-cleared ∪ gates + 1-hop); deeper chains fold to "+N more" summary bands |
| **2 — Cleared-set ordering** | Fork — **forced-invariant ratify** (case a) | Inherit the ratified #2526 order, *filtered* to `buildQueued`; clearing is a boolean gate, not a re-sort. Reject a separate cleared-only field |
| **3 — Wave vs whole-cluster launch** | Fork (launch *granularity*) | One action clears the cluster + pours its ready frontier off an editable derived-wave plan. Later-wave consent timing is #2561 F1, not ruled here |
| **4 — Repo/program dimension on lanes** | Fork (namespace scope) | One global fleet; a program is a projection (chip + per-program share), not a pool partition. Lease namespace is global |

## Grounding (real, shipped code)

- **Order (#2526)** — [we:scripts/lib/build-queue.mjs:181-232](../scripts/lib/build-queue.mjs):
  `orderQueueDetailed` composes `tier → effectiveScore → rank → dateOpened(FIFO) → num`; `nextToBuild`
  filters that *same* order to `buildQueued`. So Fork 2's "FIFO vs score vs pinned" trichotomy is already
  composed — not rival branches. #2526 is `resolved`, `codifiedIn: one-off` (no statute anchor).
- **Waves (#2334)** — [we:scripts/readiness/batch-schedule.mjs:170-202](../scripts/readiness/batch-schedule.mjs):
  `scheduleWaves` / `readyAfter` / `selectModel` already derive + adaptively dispatch contention waves. Its
  docstring is explicit it is *efficiency, not correctness* — it governs wave **structure**, not consent
  timing (the citation-scope guard for Fork 3).
- **Pool** — [we:scripts/lane-pool.mjs:20-138](../scripts/lane-pool.mjs): keyed by **repo** (WE/FUI/plateau),
  fungible clones, per-repo dev bands. No program dimension exists — so a per-program pool would invent a key
  the substrate lacks (Fork 4 overdetermined toward global).
- **Derived graph** — [we:src/_data/backlog.js:162-163,367,440,570-577](../src/_data/backlog.js):
  `deriveTier`, `blockers` / `openBlockers` / `directUnblocks` etc. `deriveTier` makes a decision tier `B`
  only when blockers clear and `C` when blocked — the fact that corrected Fork 1's predicate (below).

## Skeptic pass (pass 4 — throwaway agent, refute-only; 4 axes)

Statute-overlap: **clean on all four** — [we:docs/agent/platform-decisions.md](../docs/agent/platform-decisions.md)
has no anchor on queue-ordering, frontier/zoom, launch waves, or lane namespace; the only relevant anchor is
the methodological *"prioritization is not a fork branch,"* which each fork's Screen line applies. Findings
folded into the item:

- **Fork 1 — SURVIVES-WITH-AMENDMENT (load-bearing code fix).** The first-draft predicate
  `tier === 'B' && openBlockers > 0` is **unsatisfiable**: `deriveTier` makes tier `B` imply cleared
  blockers, so it would exclude *every prepared decision* (the exact gate the attention model surfaces)
  unless already 1-hop adjacent. Fixed to `tier === 'B'` OR a blocked decision. Frontier *definition*
  (attention > distance) unchanged.
- **Fork 2 — SURVIVES-WITH-AMENDMENT (reframe).** The default is verbatim the shipped `nextToBuild`; the
  "rival" second field is one nobody proposed. Reframed as a **forced-invariant ratify** (the alternative is
  *broken* — contradicts #2526's single-source invariant), which is the standing test's case (a). Ruling
  unchanged and still owed (the board build needs the "no cleared-only field" cite).
- **Fork 3 — SURVIVES-WITH-AMENDMENT (seam overreach).** The first draft ruled "wave k+1 *auto-dispatches*
  / the engine self-serializes" — which decides *later-wave consent timing* (#2561 F1's turf) and
  *contradicts the design's own T1* ("consent stays per-item"); it also over-extended #2334 (efficiency, not
  dispatch policy). Narrowed to rule only launch *granularity* (one action clears the cluster + pours the
  ready frontier off the editable plan); later-wave auto-vs-confirm punted to #2561 F1.
- **Fork 4 — SURVIVES.** Default overdetermined by the repo-keyed pool (strengthens (a)); stays cleanly on
  the namespace side of the #2560 seam (does not touch the conflict-resolution engine).

## Two-confusion screen (pass 5 — separate fresh-context agent)

All four **clear** — no fork is a disguised implementation detail or disguised prioritization. Fork 1 is the
closest to "just how the board draws itself," but ruled observable because the render rule is the console's
primary user-facing output and both branches differ on a genuine UX merit (attention vs distance), not
effort. Recorded on Fork 1's Screen line so the decider sees the borderline. Fork 2 was independently called
"the strongest, most legitimate fork."

## Seams (not resolved here)

- **#2561 F1** (review-unit vs build-unit) — same granularity axis as Fork 3's launch shape; Fork 3 rules
  launch *mechanics* + punts later-wave consent to F1. Aligned, not duplicated.
- **#2560** (scope-lease + conflict engine) — consumes Fork 3 (launch → lease acquisition) and Fork 4
  (global fleet → global lease namespace) as policy inputs; #2560 builds the engine.
- **#2533 F3** (representational-zoom / LOD *mint*) — Fork 1 rules the console render policy; the WE standard
  mint is #2533's call.

## Net

#2557 is now `✓ ready to ratify` — four forks, each with options, a bold default, a folded-in `Skeptic:`
verdict, and a `Screen:` verdict; Forks 1/2/3 carry code examples keyed to the real CLI. Ratify via
`/next decision`.
