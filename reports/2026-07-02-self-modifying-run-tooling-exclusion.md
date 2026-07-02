# Prep session — #2077 self-modifying items vs the parallel run's own tooling (2026-07-02)

Prepared decision [#2077](/backlog/2077-parallel-orchestrator-exclude-self-modifying-items-from-conc/)
to the Definition of Ready: research + authoring only, no ruling, no stamp. Research topic:
`self-modifying-run-tooling-exclusion`.

## What the survey established

**The incident, verified in git.** Run `batch-2026-07-01-1947-2071` TaskStop'd after "#2073's lane wedged
editing the live orchestrator file (sandbox-locked)" — 5/17 items landed, 12 reopened by hand (commit
`34a26a39`, pre-claim `0b66e918`). #2071/#2072/#2073 all edit
`we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js`, the file the Workflow tool executes by
path (`scriptPath` in `we:.claude/skills/batch-backlog-items/SKILL.md:238`). All three later landed serially
(`1fdf0b58`, `26757a57`, `6fdcc4a5`) — the driving incident is closed; the item is the standing rule for the
next self-modifying item (live example: #2149 touches `we:scripts/readiness/lane-partition.mjs` + the inline
mirror).

**Why the wedge is structural today.** The serial lane works "IN PLACE in the PRIMARY checkouts"
(`we:parallel-execute.workflow.js:793`); the integrator merges every lane ref into the primary mid-run
(`:820`, `:838`); Phase 4h pushes main in-run (`:1142`). Both in-run routes write the executing file. The
partition has no predicate for the class: `conflicts()` is pairwise-only
(`we:scripts/readiness/lane-partition.mjs:123-129`) and the merge-risk denylist (`:42-54`) guards a different
failure; a lone self-modifying item runs concurrent unflagged.

**Premise reshaped by #2123/#2138.** The #2138 rider (`we:docs/agent/platform-decisions.md:2397`) — producers
stop at lane-push and never touch main; a human-drained queue lands — plus #2123 (uniform lane clones) mean
the steady state has no mid-run primary write at all. The hazard is substrate-conditional; the exclusion
rule needs a sunset keyed to the #2138 implementation arm (#2151/#2152/#2153, all open).

**External prior art.** GitHub Actions pins the run's workflow definition at run start (mid-run pushes to the
workflow file affect only future runs); Jenkins pins shared-library versions per run; bors-lineage merge bots
run from a deployment outside the tree they land. Uniform pattern: never mutate the executing definition
mid-run; the tooling change rides the normal queue and takes effect next run.

## Fork outcomes (post-skeptic, post-screen)

- **Fork 1 — detection seat: SURVIVES-WITH-AMENDMENT.** Default (a) declared `RUN_TOOLING` pathspec in the
  canonical tested `we:scripts/readiness/lane-partition.mjs` + inline sandbox mirror, matched against the
  probe touch-set in Phase 1 before the Phase-2 pre-claim; frontmatter flag rejected (fails open),
  loader/engine exclusion rejected (over-excludes serial `/batch`). Two skeptic amendments folded:
  (1) a **coverage-parity unit test** that extracts every `scripts/*.mjs` invocation from the workflow source
  and asserts `RUN_TOOLING` covers it (the declared list is itself fails-open on drift); (2) two backstop
  seats — a post-hoc check over lane `changedFiles` at integrate time (probes under-report) and a hard
  serial-lane prompt guard (a probe-failed **and** undeclared self-modifier still reaches the in-place serial
  lane via `mustSerialize`, which the integrate-time seat never sees). Pack-seat attack failed (the pack sees
  only frontmatter/derived fields → fails open).
- **Fork 2 — routing: SURVIVES-WITH-AMENDMENT.** Default (a) drop from the `/workflow` run at probe time
  (nothing claimed yet) → work it **solo, or as the LAST item of a serial `/batch`**, with a concrete sunset
  to (c) concurrent-lane-plus-drain once the #2153 drain is live and the in-run integrator/serial lane retire
  onto the queue; in-run serial lane rejected as the observed-broken branch. Skeptic attacks that landed:
  (1) "the drain is not executing the workflow script" was narrowed to fit — the drain itself shells out to
  `RUN_TOOLING` (`we:scripts/push-if-green.mjs`, `we:scripts/readiness/*`) → within a drain pass,
  `RUN_TOOLING`-touching items land **last** (or a dedicated final pass) and the drain invokes no
  `RUN_TOOLING` script after landing one; the ordering note extends to interim re-routes (don't land
  `RUN_TOOLING` into the primary while a `/workflow` run is live). (2) Internal tension in (a): mid-batch
  edits to shelled run-tooling create the same mixed-version condition inside a serial `/batch` → the
  solo-or-last-position amendment. (3) Codification shape: Fork 2 codifies as a **rider under
  `#pr-flow-rollout-mechanism`**, never a new anchor — (c) is recast as an *entailment of the #2138 rider*
  (cited, not re-ruled); only the today-route + sunset trigger are new statute. (#2153 is itself
  `blockedBy: 2160` — the trigger is capability-keyed, not date-keyed, so no verdict impact.)
- **Dissolved:** the card's option (b) "move tooling to an editable locus" — the movable logic already moved
  (#2086 canonical-module pattern); the executing file is executed by path, so relocation doesn't decouple;
  snapshot-execute is the named fallback only if the #2138 substrate slips indefinitely.

## Process notes

- Standing test: two genuine forks (each names a broken/excluded branch); not a validation gate (rival
  branches exist). The invariant is stated once: the run's own executing tooling is never modified in the
  checkout a live run executes it from.
- Statute-overlap (#1886): composes with `#merge-risk-optimistic-with-targeted-lock` (different failure
  class, stated in the item) and `#gate-on-merged-tree-lane-fast-fail` (untouched correctness floor); the
  sunset *executes* the `#pr-flow-rollout-mechanism` rider (recast as entailment to avoid duplicate
  authority), and the drain-ordering residual is earmarked to codify at that anchor.
- Citation-scope (#1932): #2014 cited as the parity *lesson* (single derivation seat), not as authority over
  this turf; #2074 cited as house style; the #2123 phase-1 capability-trigger pattern verified to reach (the
  identical "when-the-capability-lands flip, not a permanent exemption" shape).
- Two-confusion screen (#2091): both forks screened by a separate fresh-context agent — Fork 1 clear/clear
  (the seats produce observably different run-acceptance behavior; fails-open vs fails-closed is a
  correctness difference), Fork 2 clear/clear (the screen independently verified the (a)→(c) sunset is a
  genuine capability gate — (c) is unbuildable on the current substrate; the trigger is named substrate
  state, not a date or rank). Verdicts recorded per fork in the item (`Screen:` lines).

Boundaries kept: no `preparedDate` stamp, no gate run, no claim release — the orchestrator centralizes those.
