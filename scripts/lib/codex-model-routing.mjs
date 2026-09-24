/**
 * codex-model-routing.mjs — THE single source for #x8wbivt (`#3635`)'s ratified Codex routing constants.
 *
 * WHY THIS FILE EXISTS. `#3635` Fork 1 ratified a rule about EVERY Codex call site, not about one file:
 * *"Every Codex invocation names its model explicitly — never the CLI's own implicit default"*. But its own
 * implementation note records that it could only land the constants on `we:scripts/codex-direct-task.mjs`,
 * because the other two real call sites lived on unmerged branches at the time:
 *
 *   - `we:scripts/lib/codex-judge-spawn.mjs` (the review-advisory judge seat) — the card's `scope` NAMES this
 *     file as the one whose `-m` handling motivated the decision, and the card's closing paragraph is explicit
 *     that it "should import these same constants/functions (or their equivalent) rather than keeping its own
 *     separate `CODEX_EFFORT_MAP` copy" once it lands.
 *   - `we:scripts/operations/codex-delivery-provider.mjs` (the write-capable delivery agent) — which DID pin a
 *     model, but as a hand-copied `CODEX_DELIVERY_MODEL = 'gpt-6-astra'` literal whose own header calls the
 *     duplication out: *"CONSOLIDATE to that single source when this branch merges — that is a real
 *     follow-up, not a note to ignore."*
 *
 * This file discharges the note for `codex-direct-task.mjs` (which now re-exports every name below rather
 * than defining its own copy) and is the single source the other two call sites are meant to converge on.
 * As landed by #3897 (this card), neither has converged yet: `codex-judge-spawn.mjs` still defines its own
 * separate `CODEX_EFFORT_MAP` (the import is `#3907`'s scope, blocked on the unconditional `-m` fix there),
 * and `codex-delivery-provider.mjs` does not exist on main yet (`#3902`). Three literal copies of a RATIFIED
 * constant is exactly the shape that lets a re-ratification (a new pinned model, a re-derived effort ladder)
 * land on one copy and silently miss the other two — the decision would then be true of the repo's
 * documentation and false of its behaviour. So the constants live HERE, in `scripts/lib/`, for every call
 * site to import once its own card lands.
 *
 * WHY `scripts/lib/` AND NOT `scripts/codex-direct-task.mjs`. `codex-direct-task.mjs` is a runnable CLI with a
 * `main()`, a 30-minute timeout default and a scratch-clone/gate pipeline. A library module
 * (`scripts/lib/codex-judge-spawn.mjs`) importing a top-level CLI script to reach a frozen string is backwards
 * layering: it drags an executable's module graph into a pure unit. The constants are pure data plus one pure
 * function, so they belong in the shared layer both sides already depend on. `codex-direct-task.mjs`
 * RE-EXPORTS every name below, so its public API — and its existing tests — are byte-identical to before.
 *
 * SCOPE OF THE RULING THIS FILE CARRIES. The pin is on MODEL (Fork 3, `gpt-6-astra`) and the routing
 * vocabulary is on EFFORT (Fork 2, the three rungs). Fork 2 was ratified as *one model for every Codex role*:
 * a judge seat, a delivery agent and the personal task tool all get the SAME model, and differ — if at all —
 * only on the effort rung. Nothing here encodes a per-role model, because no measurement supports one.
 */

/**
 * The `model_reasoning_effort` levels accepted repo-wide, and what each sends to Codex. **IDENTITY, not a
 * clamp** — every key below is a real level the pinned `CODEX_MODEL` actually offers, so an explicitly
 * requested level is sent through unchanged.
 *
 * `#3635`'s follow-up correction (2026-09-12, PR #2122 re-review) is the authority here, and it names the
 * clamp's ORIGIN: `codex-judge-spawn.mjs` mapped `xhigh`/`max` down to `high` and rejected `ultra` outright,
 * on the assumption Codex stops at `high`, and `codex-direct-task.mjs` copied that convention. The assumption
 * is false and was re-checked twice — against the CLI's own server-fetched catalogue
 * (`gpt-6-astra`'s `supported_reasoning_levels` are `low·medium·high·xhigh·max·ultra`, `client_version
 * 0.153.4`) and against EXECUTION (a live `codex exec -m gpt-6-astra -c model_reasoning_effort=<level>` ping
 * at each of `xhigh`, `max` and `ultra` completed normally, no 400). A clamp therefore silently DOWNGRADED an
 * explicitly requested level while recording nothing — the exact failure mode Fork 1 exists to close, just on
 * the second axis.
 *
 * PER-MODEL CAVEAT: the level set is a property of the MODEL, not of Codex. The pinned `CODEX_MODEL` offers
 * all six; a caller who overrides `model` may name one the catalogue does not list for it (e.g. `gpt-5.5`
 * offers only `low·medium·high·xhigh`), and Codex answers that with its own error. This map validates the
 * VOCABULARY, not the entitlement. RE-DERIVE on a Codex CLI upgrade or a `CODEX_MODEL` change.
 */
export const CODEX_EFFORT_MAP = Object.freeze({
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xhigh',
  max: 'max',
  ultra: 'ultra',
});

/**
 * #x8wbivt (`#3635`) — RATIFIED 2026-09-11 (operator, Nicolas Gilbert). The Codex model pin: every real
 * `codex exec` invocation in this repo names its model explicitly via `-m`, never relying on the CLI's own
 * implicit default — measured live as resolving to this same model today (`codex doctor`'s un-pinned
 * `model <default>`), but an implicit default is a choice nobody records and the server-fetched catalogue can
 * re-rank without a release. `gpt-6-astra` was chosen on measured evidence (89 logged `codex exec` runs across
 * 8 selectable models): top score on every probe (8/8 on the quick-lookup probe, correct on both judgment
 * probes), lowest reasoning-token burn among the perfect scorers, and it shares its weekly quota bucket with
 * the operator's own interactive Codex use (so routing here does not silently drain a SEPARATE,
 * faster-draining bucket the way the "cheap" `gpt-5.3-codex-spark` model measurably does). RE-DERIVE if a
 * future probe run finds a real capability split, or if this model is retired from the entitled catalogue.
 */
export const CODEX_MODEL = 'gpt-6-astra';

/**
 * #x8wbivt (`#3635`) — RATIFIED 2026-09-11. The Claude-side three-rung ladder
 * (`agent-memory-src/always-set-subagent-model-explicitly.md` — Haiku/Sonnet/Opus, routing on the *shape* of
 * the work) is KEPT as a routing vocabulary on the Codex side too, but it no longer selects a MODEL: the
 * card's own measurement (three of four probes scored identically across six of seven current-generation
 * models; the one real separation found was by model *generation*, not marketing tier) refuses a model-based
 * ladder twice over.
 *
 * WHAT THE EFFORT EVIDENCE ACTUALLY SAYS — all three rows of the card's "Effort moved correctness where the
 * model did not" table, not just the flattering one (n=4 per raised-effort cell, one probe shape, one repo):
 *   - `gpt-5.5` default (`medium`) 4/8 → `high` **4/4** — a real rescue, on a previous-generation model.
 *   - `gpt-5.3-codex-spark` default 7/8 → `high` **3/4** — MORE effort scored WORSE. Effort is not monotonic.
 *   - `gpt-6-astra` default (`medium`) 8/8 → `low` **4/4** — on the model this repo actually pins, the ladder
 *     is a NO-OP on this probe: the cheap rung scored the same as the default one.
 * So the honest claim is NOT "effort buys correctness". It is: effort is the only axis on which ANY movement
 * was observed at all, the movement was mixed in direction, and on the pinned model nothing moved. The ladder
 * below is therefore kept because it makes the routing choice EXPLICIT AND RECORDED (the Fork-1 principle
 * applied to the second axis) and preserves the rung vocabulary for when real evidence exists — NOT because
 * `high` is measurably better than `low` here. Treat the rungs as a cost/latency dial with an unproven
 * correctness effect, and do NOT cite the 4/8→4/4 row on its own as justification.
 *
 * The rungs deliberately stop at `high` and do not reach `xhigh`/`max`/`ultra` (all three real and reachable
 * via an explicit `effort` — see `CODEX_EFFORT_MAP`): no probe exercised them, so mapping a rung onto one
 * would invent evidence. RE-DERIVE if a harder probe finds a task shape effort does not rescue — or one where
 * raising it hurts again.
 */
export const CODEX_TIER_EFFORT = Object.freeze({
  haiku: 'low',
  sonnet: 'medium',
  opus: 'high',
});

/**
 * Resolve the real `model_reasoning_effort` value a caller's `tier` (`CODEX_TIER_EFFORT`'s keys) or an
 * explicit `effort` should use — an explicit `effort` always wins (a caller who names a level exactly is more
 * specific than one naming a role), `tier` resolves through the ratified map above, and naming NEITHER pins
 * the `sonnet` rung's `medium` rather than leaving the CLI to infer its own default — the same "never
 * implicit" principle `CODEX_MODEL` applies to model, applied here to effort. PURE.
 *
 * Both inputs are VALIDATED and throw a `TypeError` on an unknown value — `effort` symmetrically with `tier`.
 *
 * @param {object} [opts]
 * @param {'haiku'|'sonnet'|'opus'} [opts.tier] - a `CODEX_TIER_EFFORT` key. Throws on anything else.
 * @param {string} [opts.effort] - a `CODEX_EFFORT_MAP` key. Throws on anything else.
 * @returns {'low'|'medium'|'high'|'xhigh'|'max'|'ultra'} a real Codex `model_reasoning_effort` level — always
 *   a `CODEX_EFFORT_MAP` key. An explicit `effort` is returned as given (the map is an identity, so "as given"
 *   and "mapped" coincide); a `tier` returns that rung's `CODEX_TIER_EFFORT` value, which is a subset
 *   (`low`/`medium`/`high` only).
 * @throws {TypeError} on an unknown `tier` or an unknown `effort`.
 */
export function resolveCodexEffort({ tier, effort } = {}) {
  if (effort !== undefined) {
    if (!Object.hasOwn(CODEX_EFFORT_MAP, effort)) {
      throw new TypeError(`codex-direct-task: \`effort\` must be one of ${Object.keys(CODEX_EFFORT_MAP).join('|')}, got ${JSON.stringify(effort)}`);
    }
    return effort;
  }
  if (tier !== undefined) {
    // `Object.hasOwn`, not a truthiness test on the lookup: a bare object literal still inherits
    // `constructor`/`toString`, so `CODEX_TIER_EFFORT['constructor']` is truthy and would sail through.
    const mapped = Object.hasOwn(CODEX_TIER_EFFORT, tier) ? CODEX_TIER_EFFORT[tier] : undefined;
    if (!mapped) {
      throw new TypeError(`codex-direct-task: \`tier\` must be one of ${Object.keys(CODEX_TIER_EFFORT).join('|')}, got ${JSON.stringify(tier)}`);
    }
    return mapped;
  }
  return CODEX_TIER_EFFORT.sonnet;
}

/**
 * Validate a `model` value and return the exact string to pass after `-m`. Shared by every call site so the
 * three of them cannot drift on what counts as a usable model name.
 *
 * The `startsWith('-')` arm is the load-bearing one: a model string that begins with a dash would be read by
 * `codex` as a FLAG rather than as `-m`'s operand, which silently changes the command rather than failing it.
 *
 * @param {string} model
 * @param {string} [who] - the calling module's name, for the error message.
 * @returns {string} the trimmed model name.
 * @throws {TypeError} if `model` is not a plain, non-empty, non-flag string.
 */
export function assertCodexModel(model, who = 'codex-model-routing') {
  if (typeof model !== 'string' || !model.trim() || model.trim().startsWith('-')) {
    throw new TypeError(`${who}: \`model\` must be a plain non-empty string, got ${JSON.stringify(model)}`);
  }
  return model.trim();
}
