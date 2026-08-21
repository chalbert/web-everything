/**
 * @file scripts/operations/declared-homes.mjs
 * @description WHICH RAW INVOCATION EACH OPERATION WAS BUILT TO REPLACE (#3224) — the one fact about an
 *   operation that nothing can derive, declared once and read by two consumers.
 *
 * THE SPLIT THIS FILE EXISTS TO HOLD. Whether `we:scripts/backlog.mjs` reaches `operations/claim.mjs` is
 * visible in the import graph and is DERIVED (`homeDelegates`, in `we:scripts/lib/skill-operation-wiring.mjs`).
 * Whether the `claim` operation was BUILT to replace `backlog.mjs claim` is intent, and no graph holds it —
 * so it is declared here. Restating the derived half as a flag beside the declared half is the failure that
 * produced all three of PR #1510's blockers: a predicate re-derived instead of read from the home that owns
 * it, which then went stale without anything noticing.
 *
 * TWO CONSUMERS, ONE DEFINITION (#2644): each operation module passes its own entry to `op({declaresOver})`,
 * which validates the shape at REGISTRATION; and the #3224 scan reads the map to know what to look for. An
 * entry that parses to nothing throws out of `op()` rather than producing a scan that silently checks nothing.
 *
 * ── WHAT IS AND IS NOT IN HERE, AND WHY IT IS SHORT ─────────────────────────────────────────────────────────
 *
 * ONLY ENTRIES SUBSTANTIATED BY THE OPERATION'S OWN HEADER. The temptation is to fill this in for all twelve
 * operations from memory of what each one "is about", and a wrong entry here is not a harmless overreach: it
 * makes the scan flag a skill line that is perfectly correct, and a gate that cries wolf is one that gets
 * `--force`d past on reflex. Fewer correct entries beat more guessed ones — an operation missing from this map
 * costs a finding nobody gets, while a wrong one costs the gate's credibility.
 *
 * SEVERAL OPERATIONS BELONG IN NEITHER COLUMN, and that is not an oversight:
 *   - `record-verdict` replaces a hand-assembled shell one-liner, not a CLI. There is no home to name.
 *   - `review-pr`, `review-prep` and `stage-pr-view` REUSE `review-core.mjs` / `review-detail.mjs` rather than
 *     declaring over their command lines. A header naming a module means it imports it, which is not the same
 *     relationship at all, and reading it as one is how this map would fill up with false entries.
 *   - `gate-health`, `explore`, `mutation-check` and `suggest-next` had no raw CLI to begin with.
 *
 * ── A CORRECTION TO #3224'S OWN PREMISE ─────────────────────────────────────────────────────────────────────
 *
 * The card motivates the gate with "14 skills instruct `we:scripts/lane-pool.mjs` while 0 instruct
 * `dispatch-lane`". That comparison does not hold, and the map is deliberately not built to satisfy it:
 * `dispatch-lane`'s header says it declares over `we:scripts/conveyor/tick-core.mjs#planTick` — the conveyor's
 * per-tick dispatch policy. `lane-pool.mjs` is LANE PROVISIONING, which no operation declares over. The two
 * were counted against each other as if they named the same job. The measured gap (5 of 11 operations named
 * by zero skills) is real; that particular pair of numbers was not evidence for it.
 */

/**
 * Operation name → the raw invocations it declares over, as `"<locus:path> [subcommand]"`.
 *
 * A subcommand is present exactly when the home HAS subcommands. `verify-lane.mjs` has none, so naming the
 * file names the whole invocation; `backlog.mjs` has a dozen and only `claim` is declared over, so a
 * file-granular entry there would condemn every other `backlog.mjs` line in every skill.
 */
export const DECLARED_HOMES = Object.freeze({
  // `verify` SHELLS the home and classifies what it said — the operation is the fuller caller, so a skill
  // should name the operation. `verify.mjs`'s header states the relationship outright: "IT DECLARES OVER AN
  // EXISTING HOME, IT DOES NOT REPLACE ONE", and `verify-io.mjs` holds the actual `VERIFY_LANE_CLI` spawn.
  verify: Object.freeze(['we:scripts/verify-lane.mjs']),

  // THE NEGATIVE CONTROL, and the reason this scan is delegation-aware at all. `backlog.mjs claim` delegates
  // through `claimViaOperation`, so naming it IS naming the declared layer — and it additionally does the #083
  // reservation clear, the `claims.json` baseline and the rename-slug block that `run.mjs claim` does not.
  // PR #1508 rewired a skill off it on the theory that any raw-home mention is a miswiring and DROPPED all
  // three. This entry must never produce a finding; the suite pins that it does not.
  claim: Object.freeze(['we:scripts/backlog.mjs claim']),

  // `dispatch-lane` CONSUMES `planTick`'s `decisions.spawnBuilds` and refuses to invent a launch of its own —
  // "IT DECLARES OVER THE TICK CORE; IT DOES NOT RE-DERIVE IT". A skill telling an agent to run the core by
  // hand is telling it to execute a dispatch the operation exists to make structural.
  'dispatch-lane': Object.freeze(['we:scripts/conveyor/tick-core.mjs']),
});
