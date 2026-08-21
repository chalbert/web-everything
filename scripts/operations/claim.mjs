/**
 * @file scripts/operations/claim.mjs
 * @description THE `claim` DECLARATION — the is-the-engine-too-heavy probe (#3034, under epic #3029).
 *
 * THREE STEPS, `compute` → `compute` → `effect`. NO `judge`, NO `confirm`: claiming an item reads ownership
 * state and writes a status change; there is no judgement in it and nobody to ask. Structurally identical to
 * `we:scripts/operations/dispatch-lane.mjs` — the one existing operation with the same shape (also no judge, no
 * confirm, also a real IO-backed guard set feeding a pure verdict).
 *
 *   | step    | kind      | does                                                                              |
 *   |---------|-----------|------------------------------------------------------------------------------------|
 *   | `read`  | `compute` | shapes one injected `readClaimContext({ref})` call into a `read` finding          |
 *   | `plan`  | `compute` | replays the SAME guard order `we:scripts/backlog.mjs`'s `transition()` uses       |
 *   | `write` | `effect`  | declares ONE effect carrying the already-computed new file bytes                 |
 *
 * `plan` THROWS on a real guard violation (already claimed, queued, prepare-held, or dirty-file, absent
 * `--force`) rather than returning a benign zero-effect verdict — a deliberate divergence from
 * `dispatch-lane`'s "nothing to dispatch this tick" pattern. `dispatch-lane`'s non-dispatch is a NORMAL outcome
 * most ticks produce; `claim`'s guard violations are exactly what `we:scripts/backlog.mjs`'s `die()` treats as
 * exit-1 failures today, and matching that contract — not softening it — is what "the ownership invariant
 * enforced in the pure core" has to mean if it is going to be checked rather than merely asserted. This mirrors
 * how `we:scripts/operations/review-pr.mjs`'s `record` step throws when `decideSetLabel` disallows a swap — a
 * declared step throwing on a genuine refusal is an established pattern in this engine, not a new one.
 *
 * IT DECLARES OVER THE OWNERSHIP INVARIANT; IT DOES NOT RE-DERIVE IT. `planClaim` calls `applyTransition`
 * (imported from `we:scripts/backlog/frontmatter.mjs`) for the actual splice — the invariant that ownership is
 * `status: active`, never git state, already lives there and is already pure. This file adds the THREE real
 * IO-backed guards that sit in front of it (queued / prepare-held / dirty-file) and nothing else.
 *
 * IO IS INJECTED, AND THIS FILE REACHES NOTHING. Same split as `./dispatch-lane.mjs` / `./dispatch-lane-io.mjs`:
 * this is the WHAT, and `./claim-io.mjs` is the only place it touches the world.
 *
 * PURE. No fs, no clock, no process, no network in this file.
 */

import { op } from './registry.mjs';
// #3224 — the raw invocation this operation declares over. Declared in ONE place and read by two
// consumers: `op()` validates its shape here, and the skill-wiring scan reads the same map.
import { DECLARED_HOMES } from './declared-homes.mjs';
import { compute, effect as effectStep } from './step-kinds.mjs';
import { applyTransition } from '../backlog/frontmatter.mjs';

/** The operation's stable id. Adapters resolve it by this name. */
export const CLAIM_OP = 'claim';

/** The effect type the `write` step declares — the sink is registered under this string in `./claim-io.mjs`. */
export const CLAIM_EFFECT = 'backlog.claim-write';

/**
 * SHAPE one `readClaimContext()` result into the `read` finding. PURE — separated from the injected reader so
 * every refusal below is testable without `fs`/`git`.
 *
 * WHAT THE READER OWES:
 *   - `found` — `false` when `ref` resolves to no backlog file (or an ambiguous one). `shapeClaimRead` refuses
 *     that immediately; the CLI's own `resolveFile` already produces the item's rich not-found UX before this
 *     operation is ever invoked (see `we:scripts/backlog.mjs`'s `claimViaOperation`), so this refusal is a
 *     defence-in-depth backstop for a caller (e.g. `run.mjs claim`) that skips that pre-check.
 *   - `abs`/`rel`/`id`/`status`/`content` — the resolved file's identity and current text.
 *   - `queued`/`heldBy`/`dirty` — the three IO-backed guards `we:scripts/backlog.mjs:317-357` reads today
 *     (ready-to-merge, prepare-hold, and the item's own dirty-file check), composed by the reader.
 *   - `today` — the CLI's clock boundary, injected so this stays pure.
 *
 * @param {object} raw - what `./claim-io.mjs`'s `readClaimContext` returns.
 * @param {{ref: string}} asked
 * @returns {object} the `read` finding.
 */
export function shapeClaimRead(raw, { ref } = {}) {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`claim.read: the injected reader returned ${typeof raw}, not a claim context`);
  }
  if (!raw.found) {
    throw new Error(`claim.read: no backlog item resolves for ${JSON.stringify(String(ref ?? ''))}`);
  }
  return {
    abs: String(raw.abs || ''),
    rel: String(raw.rel || ''),
    id: String(raw.id || ''),
    status: String(raw.status || ''),
    content: String(raw.content || ''),
    queued: raw.queued === true,
    // Two separate fields, not one — `isHeld` (a live lease) and `heldBy` (the holder's name, which can be
    // legitimately null even while held) are two different reads in `we:scripts/readiness/prepare-hold-state.mjs`,
    // and collapsing them into one nullable field would silently drop the refusal when a hold exists with no
    // recorded holder.
    held: raw.held === true,
    heldBy: raw.heldBy ? String(raw.heldBy) : null,
    dirty: raw.dirty === true,
    today: String(raw.today || ''),
  };
}

/**
 * THE VERDICT. Replays the SAME guard order `we:scripts/backlog.mjs:317-357` uses — ready-to-merge (queued) →
 * prepare-hold → claim-first dirty-file, each skippable by `force` — then calls `applyTransition` (imported, not
 * re-derived) for the actual splice.
 *
 * THROWS on a real guard violation (see the file header for why). Every thrown message here is verbatim what
 * `we:scripts/backlog.mjs`'s `transition()` used to `die()` with, so a caller that surfaces the thrown message
 * unchanged reproduces today's exact text (Done-when: "preserve every existing message and exit code exactly").
 *
 * @param {object} read - the `read` finding from {@link shapeClaimRead}.
 * @param {{as?: 'active'|'preparing', force?: boolean}} [opts]
 * @returns {{claiming: true, content: string, id: string, claimedStatus: 'active'|'preparing', today: string}}
 */
export function planClaim(read, { as, force = false } = {}) {
  if (!read || typeof read !== 'object') {
    throw new Error('claim.plan: no read finding to plan from');
  }
  const { id, rel, content, queued, held, heldBy, dirty, today } = read;

  if (!force) {
    if (queued) {
      throw new Error(
        `#${id} is queued (ready-to-merge, #2138 Fork 4) — a lane is pushed and waiting for the drain; it is ` +
        `not claimable. The drain unqueues it at landing; pass --force only to deliberately steal a stuck ` +
        `queue entry.`,
      );
    }
    if (held) {
      throw new Error(
        `#${id} is prepare-held${heldBy ? ` by ${heldBy}` : ''} (#2219 (b) flow) — a session is preparing it ` +
        `in a lane; it is not claimable until the prepare-hold is released (\`backlog.mjs prepare-release ` +
        `${id}\`). Pass --force only to deliberately steal a stuck hold.`,
      );
    }
    if (dirty) {
      throw new Error(
        `#${id} — ${rel} has uncommitted edits; a claim must be the first action on an item (ground / edit / ` +
        `present AFTER claiming, next turn). Commit, stash, or revert those edits and re-claim — or pass ` +
        `--force if this is deliberate (e.g. a freshly-scaffolded item).`,
      );
    }
  }

  const res = applyTransition(content, 'claim', { today, as });
  if (res.error) throw new Error(`#${id} — ${res.error}`);

  return {
    claiming: true,
    content: res.content,
    id,
    claimedStatus: as === 'preparing' ? 'preparing' : 'active',
    today,
  };
}

/**
 * BUILD THE DECLARATION. `readClaimContext` is the injected reader; {@link ./claim-io.mjs} supplies the real
 * one and tests supply a stub. Built per call so nothing leaks between registries.
 *
 * @param {{readClaimContext: (o: {ref: string}) => object}} deps
 * @returns {object} the frozen declaration from `op()`.
 */
export function claimOperation({ readClaimContext } = {}) {
  if (typeof readClaimContext !== 'function') {
    throw new TypeError(
      'claim: needs a `readClaimContext({ref})` reader — the io is INJECTED so the declaration stays testable '
      + 'without `fs`/`git`; the real binding is `we:scripts/operations/claim-io.mjs`.',
    );
  }

  return op(CLAIM_OP, {
    declaresOver: DECLARED_HOMES.claim,
    input: {
      // A backlog item ref — numeric NNN (landed) or an `xNNNNNN` hash (provisional, #2288). The exact shape
      // `we:scripts/backlog.mjs`'s own `resolveFile` accepts.
      ref: 'string',
      as: { type: 'string', required: false, default: 'active', enum: ['active', 'preparing'] },
      force: { type: 'boolean', required: false, default: false },
    },
    verdictFrom: 'plan',

    // ── 1. read ─────────────────────────────────────────────────────────────────────────────────────────────
    read: compute({
      reads: ['input.ref'],
      fn: (view) => shapeClaimRead(readClaimContext({ ref: view.input.ref }), { ref: view.input.ref }),
    }),

    // ── 2. plan ─────────────────────────────────────────────────────────────────────────────────────────────
    plan: compute({
      reads: ['input.as', 'input.force', 'findings.read'],
      fn: (view) => planClaim(view.findings.read, { as: view.input.as, force: view.input.force }),
    }),

    // ── 3. write ────────────────────────────────────────────────────────────────────────────────────────────
    // DECLARES ONE effect carrying the already-computed new file bytes; the sink applies them through the
    // extracted guarded writer (`we:scripts/backlog/guarded-write.mjs`).
    write: effectStep({
      reads: ['verdict', 'findings.read'],
      effects: (view) => [{
        type: CLAIM_EFFECT,
        // IDEMPOTENT: TRUE — `verdict.content` is a value `plan()` already fully computed; re-writing the
        // identical bytes on replay (a crash between `pending` and `applied`) is safe. Same reasoning as
        // `review-pr.mjs`'s staged write-up effect.
        idempotent: true,
        payload: { abs: view.findings.read.abs, rel: view.findings.read.rel, content: view.verdict.content },
      }],
    }),
  });
}
