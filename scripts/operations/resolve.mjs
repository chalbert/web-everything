/**
 * @file scripts/operations/resolve.mjs
 * @description THE `resolve` DECLARATION (#xrrpfo7, under epic #3029) — close out a backlog item, with the
 *   guards that stop a close-out from writing a contradiction.
 *
 * THE SIBLING OF `claim`. `we:scripts/operations/claim.mjs` (#3034) declared the OPEN of an item's lifecycle;
 * this declares the CLOSE. They were siblings in `we:scripts/backlog.mjs` all along — the same `transition()`
 * function, the same guarded writer — and the reason to declare this one is measured rather than aesthetic: a
 * 1,786-call session audit on 2026-08-21 found 15 raw `backlog.mjs resolve` calls and 0 through any operation,
 * because there was none to call. Meanwhile `we:skills-src/next-backlog-item/SKILL.md` step 7 still instructs
 * the raw command, so every agent following the skill correctly bypasses the declared layer.
 *
 * WHAT A BAD RESOLVE COSTS, and why the guards are not ceremony. PR #1503's round-1 finding was a decision
 * card whose body said RATIFIED while its `status` stayed `open`, leaving four sibling slices blocked. That is
 * the close-out half of the lifecycle failing quietly: the human-readable half said done, the machine-readable
 * half said not, and nothing reconciled them. Every guard below refuses a different way of writing that same
 * kind of contradiction to disk.
 *
 * THE FOUR REFUSALS, and each is REPLAYED from the existing home rather than invented here:
 *
 *   1. **wrong status** — only an in-flight item resolves. `applyTransition`'s own check (#911's home).
 *   2. **an epic with open children** (#658) — a resolved epic over live slices is a contradiction the gate
 *      would later flag, so it is refused BEFORE the write rather than caught after.
 *   3. **an uncodified decision** (#911) — a decision must carry its rule into the statute layer before it
 *      closes, or the ruling exists only in a card nobody reads. `validateCodifiedIn` decides; this file does
 *      not re-derive what a valid `codifiedIn` is.
 *   4. **undeclared presentation drift** (#2803) — an item that edited a UI surface its `scope:` never named
 *      resolves outside the UI-fidelity gate's view. The self-declared-scope bypass, refused at the producer.
 *
 * `force` overrides 2 and 4, exactly as `--force` does today, and the verdict RECORDS that it did. A guard
 * stepped over silently is a guard that was not really there — the existing CLI prints a warning to stderr,
 * which no caller can act on; a field on the verdict can be gated on.
 *
 * IT DECLARES OVER THE EXISTING HOME (#2644). `applyTransition` does the splice, `validateCodifiedIn` decides
 * codification, `reconcileScope` decides drift. Re-implementing any of those here would be a second answer to
 * a question that already has one — the defect this engine's own `verify` header calls out for the same
 * reason.
 *
 * PURE. No fs, no clock, no process, no network in this file: `./resolve-io.mjs` is the only place it touches
 * the world, and it is injected, so every refusal below is reachable in a test with no filesystem.
 */
import { op } from './registry.mjs';
import { compute, effect as effectStep } from './step-kinds.mjs';
import { applyTransition } from '../backlog/frontmatter.mjs';

/** The operation's stable id. Adapters resolve it by this name. */
export const RESOLVE_OP = 'resolve';

/** The one effect: write the already-computed bytes through the guarded writer. */
export const RESOLVE_EFFECT = 'resolve.write';

/** Why a resolve was refused. A closed set, so a caller can branch without string-matching prose. */
export const RESOLVE_REFUSALS = Object.freeze([
  'not-in-flight', 'open-children', 'uncodified-decision', 'scope-drift', 'splice-failed',
]);

/**
 * Shape one injected reader result into the `read` finding. PURE.
 *
 * REFUSES A MISSING ITEM rather than returning an empty context: a resolve aimed at an id that does not
 * resolve must not proceed to a plan that then reports "nothing to do", which reads as success.
 */
export function shapeResolveRead(raw, { ref } = {}) {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`resolve.read: the injected reader returned ${typeof raw}, not a resolve context`);
  }
  if (!raw.found) {
    throw new Error(`resolve.read: no backlog item resolves for ${JSON.stringify(String(ref ?? ''))}`);
  }
  return {
    abs: String(raw.abs || ''),
    rel: String(raw.rel || ''),
    id: String(raw.id || ''),
    kind: String(raw.kind || ''),
    status: String(raw.status || ''),
    content: String(raw.content || ''),
    // #658 — children still open under this epic, by the `parent:` EDGE and never the body's prose listing,
    // which goes stale. Empty for a non-epic.
    openChildren: Array.isArray(raw.openChildren) ? raw.openChildren.map((c) => ({
      num: String(c?.num ?? ''), status: String(c?.status ?? ''),
    })) : [],
    // #2803 — presentation/route surfaces this clone touched that the item's `scope:` never declared.
    // `scopeDeclared: false` is NOT the same as an empty `offending` list: the first means the reconciliation
    // could not run (a pre-#2613 legacy item), the second means it ran and found nothing. Collapsing them
    // would let "we could not check" read as "we checked and it was clean".
    scopeDeclared: raw.scopeDeclared === true,
    offending: Array.isArray(raw.offending) ? raw.offending.map(String) : [],
    today: String(raw.today || ''),
  };
}

/**
 * Decide the resolve. PURE, and THROWS on a genuine refusal rather than returning a benign zero-effect verdict.
 *
 * Throwing matches `claim`'s `planClaim` and the contract `we:scripts/backlog.mjs`'s `die()` has today: these
 * are exit-1 failures, not normal outcomes. `dispatch-lane`'s "nothing to dispatch this tick" is the shape
 * that returns benignly, and the difference is whether the non-action is EXPECTED. A refused resolve never is.
 */
export function planResolve(read, { force = false, graduatedTo = '', codifiedTo = '' } = {}) {
  const refuse = (reason, message) => {
    const err = new Error(`resolve: ${message}`);
    err.reason = reason;
    throw err;
  };

  // 1. #658 — an epic cannot close over live slices. Checked before the splice so the contradiction is never
  //    written, not merely flagged by the gate afterwards.
  const steppedOver = [];
  if (read.kind === 'epic' && read.openChildren.length) {
    if (!force) {
      refuse('open-children',
        `#${read.id} is an epic with ${read.openChildren.length} open child slice(s) — resolve or re-parent `
        + `them first, or pass force:\n${read.openChildren.map((k) => `    #${k.num} — ${k.status}`).join('\n')}`);
    }
    steppedOver.push({ guard: 'open-children', detail: read.openChildren.map((k) => `#${k.num}`) });
  }

  // 2. #2803 — undeclared presentation drift. Only fires when the reconciliation actually RAN: an item with no
  //    declared scope is a pre-#2613 legacy item, which passes with the fact recorded rather than erroring.
  if (read.scopeDeclared && read.offending.length) {
    if (!force) {
      refuse('scope-drift',
        `#${read.id} touched ${read.offending.length} presentation/route surface(s) its scope: never declared `
        + `— an under-scoped UI item cannot resolve (#2803):\n${read.offending.map((f) => `    ${f}`).join('\n')}`
        + '\nDeclare them in scope: (and let the UI-fidelity gate see the item), or pass force.');
    }
    steppedOver.push({ guard: 'scope-drift', detail: [...read.offending] });
  }

  // 3. THE SPLICE, and the two refusals that live inside it (#911's codification gate and the status check).
  //    Delegated whole — this file decides nothing about what a valid `codifiedIn` is.
  const res = applyTransition(read.content, 'resolve', {
    today: read.today,
    graduatedTo: graduatedTo || undefined,
    codifiedTo: codifiedTo || undefined,
  });
  if (res.error) {
    // The home speaks in prose; map it onto the closed refusal set so a caller can branch. An unrecognised
    // error becomes `splice-failed` rather than being forced into a category it may not belong to.
    const reason = /^status is/.test(res.error) ? 'not-in-flight'
      : /codifiedIn|codif/i.test(res.error) ? 'uncodified-decision'
        : 'splice-failed';
    refuse(reason, `#${read.id} — ${res.error}`);
  }

  return {
    id: read.id,
    rel: read.rel,
    status: 'resolved',
    graduatedTo: graduatedTo || null,
    codifiedIn: codifiedTo || null,
    content: res.content,
    // RECORDED, not merely warned about. The CLI prints `--force` warnings to stderr today, which no caller can
    // gate on; a verdict field means a batch close-out can refuse to proceed when a guard was stepped over.
    forced: steppedOver.length > 0,
    steppedOver,
    // Stated so a consumer never has to infer it: the reconciliation did not run, which is not the same as
    // running clean (#2613 legacy item).
    scopeUnchecked: !read.scopeDeclared,
  };
}

/**
 * Build the declaration. `readResolveContext` is injected — `./resolve-io.mjs` supplies the real reader.
 */
export function resolveOperation({ readResolveContext } = {}) {
  if (typeof readResolveContext !== 'function') {
    throw new TypeError(
      'resolve: needs a `readResolveContext({ref})` reader — the io is INJECTED so the declaration stays '
      + 'testable without `fs`/`git`; the real binding is `we:scripts/operations/resolve-io.mjs`.',
    );
  }

  return op(RESOLVE_OP, {
    input: {
      // NNN or an `xNNNNNN` hash (#2288) — the shapes `we:scripts/backlog.mjs`'s `resolveFile` accepts.
      ref: 'string',
      graduatedTo: { type: 'string', required: false, default: '' },
      codifiedTo: { type: 'string', required: false, default: '' },
      force: { type: 'boolean', required: false, default: false },
    },
    verdictFrom: 'plan',

    read: compute({
      reads: ['input.ref'],
      fn: (view) => shapeResolveRead(readResolveContext({ ref: view.input.ref }), { ref: view.input.ref }),
    }),

    plan: compute({
      reads: ['input.force', 'input.graduatedTo', 'input.codifiedTo', 'findings.read'],
      fn: (view) => planResolve(view.findings.read, {
        force: view.input.force,
        graduatedTo: view.input.graduatedTo,
        codifiedTo: view.input.codifiedTo,
      }),
    }),

    write: effectStep({
      reads: ['verdict', 'findings.read'],
      effects: (view) => [{
        type: RESOLVE_EFFECT,
        // IDEMPOTENT: `verdict.content` is a value `plan()` already computed in full, so a replay after a
        // crash between `pending` and `applied` writes identical bytes. Same reasoning as `claim`'s.
        idempotent: true,
        payload: { abs: view.findings.read.abs, rel: view.findings.read.rel, content: view.verdict.content },
      }],
    }),
  });
}
