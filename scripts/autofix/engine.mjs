/**
 * @file scripts/autofix/engine.mjs
 * @description Conformance auto-fix engine — backlog #095, MVP walking skeleton.
 *
 * The SAME pipeline shape as the upgrader (#094), one domain over:
 *
 *     failure descriptor  →  candidate patch  →  verify gate (re-run the suite)
 *     (check:standards --json)  (fixer provider)    (failure cleared + no new error? keep : revert)
 *
 * Two design rules carried from #086/#089/#094:
 *   1. **AI is a swappable provider, not architecture.** A fixer (failure → patch) is a
 *      registry-backed provider with a stable contract — the SAME inject-a-provider shape as
 *      `CustomAnalyzerRegistry` (#094) and `CustomCompilerRegistry` (#081). This core registers no
 *      fixer; a deterministic *reference* fixer OR a BYO-key *model* fixer is registered in.
 *   2. **The verify gate is the moat** (the #089 propose-and-verify edge). A proposed patch is
 *      APPLIED, the suite re-run, and the patch is kept ONLY if its target failure cleared and it
 *      introduced no NEW error. A patch the suite doesn't accept is reverted and reported — never
 *      shipped. So output trustworthiness is structural, not promised: the agent cannot ship a fix
 *      the conformance suite hasn't accepted.
 *
 * This module is PURE — no fs, no process, no network. The orchestrator takes injected `verify` /
 * `read` / `write` callbacks, so the same loop runs against the real suite (the CLI wires it to
 * `check:standards --json` + node fs) or against an in-memory fixture (the vitest sandbox). That is
 * what lets the verify-gated loop be tested deterministically without corrupting real specs.
 */

// ── Contracts (JSDoc typedefs — the analyzer↔generator analogue) ────────────────
//
/**
 * @typedef {Object} FailureDescriptor
 * @property {string} kind   Failure class a fixer matches on (e.g. `deprecated-status`).
 * @property {'reference'|'model'} [fix]  Routing call recorded by check-standards (#197):
 *           `reference` = mechanically fixable (a deterministic fixer here derives the edit);
 *           `model` = content-generation, deferred to the BYO-key model fixer (#196). A `model`
 *           descriptor carries no matching deterministic fixer, so the loop reports it `skipped`.
 * @property {string} [entity] Spec entity (`Block` / `Plug` / `Protocol` / `Intent` / `Capability` / …).
 * @property {string} [id]    Entity id within its registry.
 * @property {string} [file]  Repo-relative spec file the fix edits (or, for `missing-description`, creates).
 * @property {string} [field] Field to change / supply.
 * @property {string} [from]  Current (offending) value.
 * @property {string} [to]    Canonical target value.
 * @property {string[]} [allowed]  For `invalid-status`: the allowed values the model must pick from.
 * @property {string} [value]      For `unresolved-ref`: the unresolved reference value.
 * @property {string} [refRegistry] For `unresolved-ref`: the registry the value should resolve in.
 *
 * @typedef {Object} Failure
 * @property {string} message  Human-readable failure text (always present).
 * @property {FailureDescriptor} [descriptor]  Structured form — only failures carrying one are fixable.
 *
 * @typedef {Object} Patch
 * @property {string} file        Repo-relative file the patch rewrites.
 * @property {string} newContent  Full proposed new file content (serialization-friendly — a diff is
 *                                 `before` vs `newContent`, so patches are inspectable / loggable).
 * @property {string} summary     One-line human description of the change.
 *
 * @typedef {Object} Fixer
 * @property {string} id   Stable provider id (shown in diagnostics + reports).
 * @property {(f: Failure) => boolean} handles  Does this provider claim the failure?
 * @property {(f: Failure, ctx: { read: (file: string) => string }) => (Patch|null|Promise<Patch|null>)} fix
 *           Failure → proposed patch. May be async (a model provider does a network call; the
 *           reference provider is sync). Return `null` when it can't safely produce one (e.g. the
 *           target row isn't found) — the engine records a give-up rather than guessing.
 *
 * @typedef {Object} VerifyState
 * @property {boolean} ok
 * @property {Failure[]} failures
 */

// ── Fixer provider seam (swappable AI) ──────────────────────────────────────────

/**
 * Ordered fixer registry. Empty by default → a failure with no matching provider is reported as
 * `skipped`, never faked (same "don't silently pass" discipline as `CustomAnalyzerRegistry`). First
 * registered provider that `handles()` the failure wins, so a specialised provider can be unshifted
 * ahead of the reference one later.
 */
export class CustomFixerRegistry {
  #providers = [];

  /** Replace-by-id so re-registering the same provider doesn't stack duplicates. */
  register(fixer) {
    this.#providers = this.#providers.filter((p) => p.id !== fixer.id);
    this.#providers.push(fixer);
    return this;
  }
  resolve(failure) {
    return this.#providers.find((p) => p.handles(failure)) ?? null;
  }
  ids() {
    return this.#providers.map((p) => p.id);
  }
  has() {
    return this.#providers.length > 0;
  }
}

/** Pre-seeded singleton — `registerReferenceFixers` (or a BYO-AI provider) registers into this. */
export const fixerRegistry = new CustomFixerRegistry();

// ── Reference fixer: deprecated-status (deterministic — no model needed) ─────────
//
// The conformance contract ALREADY encodes the fix (STATUS_SYNONYMS in check-standards), so this
// provider needs no intelligence — it is the upgrader's `legacyWebComponentAnalyzer` analogue: the
// walking-skeleton reference that proves the verify-gated loop end-to-end with zero API key. A model
// provider plugs into the same registry for *content-generation* classes (e.g. missing-description),
// where the fix isn't mechanically derivable.

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * String-aware spans of every object that is a *direct element* of the top-level JSON array — each
 * `[start, end)` in source-text coordinates. A direct element opens on a `{` seen at bracket-depth 1
 * and brace-depth 0, and closes when its braces re-balance; nested objects/arrays inside a row (a
 * `crossRef`, a `dimensions` map, a `tiers` map) sit deeper, so they're never mistaken for a row.
 * The string scan ignores braces/brackets inside JSON string values (a `{` in a summary, say).
 * @param {string} content
 * @returns {Array<[number, number]>}
 */
function topLevelObjectSpans(content) {
  const spans = [];
  let inStr = false, esc = false, brace = 0, bracket = 0, objStart = -1;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '[') bracket++;
    else if (c === ']') bracket--;
    else if (c === '{') { if (bracket === 1 && brace === 0) objStart = i; brace++; }
    else if (c === '}') { brace--; if (brace === 0 && objStart !== -1) { spans.push([objStart, i + 1]); objStart = -1; } }
  }
  return spans;
}

/** @type {Fixer} */
export const deprecatedStatusFixer = {
  id: 'reference:deprecated-status',
  handles: (f) => f.descriptor?.kind === 'deprecated-status',
  fix: (f, { read }) => {
    const d = f.descriptor;
    if (!d?.file || !d.id || !d.field || d.from === undefined || d.to === undefined || d.from === d.to) return null;
    const content = read(d.file);
    // SURGICAL edit — locate the row by its unique id, then rewrite that row's `"<field>": "<from>"`,
    // changing only that one value. A full JSON.parse → stringify would reformat the entire file
    // (inline objects expand to multi-line), burying the one-field fix in hundreds of noise lines and
    // defeating human diff review.
    const idRe = new RegExp(`"id"\\s*:\\s*"${escapeRegExp(d.id)}"`);
    const idMatch = idRe.exec(content);
    if (!idMatch) return null; // can't locate the row — give up safely, don't guess
    // Bound the field rewrite to the row's OWN object span — order-independent (works whether the
    // field precedes or follows the id) and sibling-safe (it can never reach into the next row even
    // if this row's field is reordered ahead of its id). Falls back to whole-file only if the row
    // isn't a top-level array element (defensive; spec files are always arrays of rows).
    const span = topLevelObjectSpans(content).find(([s, e]) => idMatch.index >= s && idMatch.index < e);
    const [from, to] = span ?? [0, content.length];
    const region = content.slice(from, to);
    const fieldRe = new RegExp(`("${escapeRegExp(d.field)}"\\s*:\\s*)"${escapeRegExp(d.from)}"`);
    const m = fieldRe.exec(region);
    if (!m) return null; // already fixed, or the field isn't in this row — give up safely
    const start = from + m.index;
    const newContent = content.slice(0, start) + m[1] + `"${d.to}"` + content.slice(start + m[0].length);
    return {
      file: d.file,
      newContent,
      summary: `${d.entity ?? 'entity'} "${d.id}" ${d.field}: ${d.from} → ${d.to}`,
    };
  },
};

/** Register the deterministic reference fixers into a registry (defaults to the shared singleton). */
export function registerReferenceFixers(registry = fixerRegistry) {
  registry.register(deprecatedStatusFixer);
  return registry;
}

// ── Failure identity (to track a single failure across verify rounds) ────────────

/** Stable key for a failure, so the loop can tell "did THIS one clear?" across re-verifies. */
export function failureKey(f) {
  const d = f.descriptor;
  return d ? `${d.kind}:${d.entity ?? ''}:${d.id ?? ''}:${d.field ?? ''}` : `msg:${f.message}`;
}

// ── Model-fix cost bounds (#293 deliverable 1) ───────────────────────────────────
//
// A model fixer (#196) does a metered API call per `fix()` — on a large failure set the loop could
// fire one call per failure and burn the BYO key unbounded. Reference fixers are free (no model), so
// the budget caps ONLY model-fixer invocations: by convention a model fixer's id is `model:…` (the
// reference ones are `reference:…`). The cap is the count of model `fix()` calls the loop is allowed
// to make in a run; once spent, remaining model-fixable failures are reported `deferred` (never
// attempted), while free reference fixes keep flowing.
export const isModelFixer = (fixer) => typeof fixer?.id === 'string' && fixer.id.startsWith('model:');

// ── Diff surfacing (#293 deliverable 2) ──────────────────────────────────────────
//
// The engine already captures `before`/`after` for every patch; this renders them as a line-oriented
// unified-ish diff so a human (CLI `--review`, the playground) can read what a model patch proposes
// before it lands. Pure + exported so the surface and its test share one formatter.
/** A `{ added, removed, lines }` line diff of `before` → `after` (`lines` are `{ sign, text }`). */
export function lineDiff(before, after) {
  const a = String(before ?? '').split('\n');
  const b = String(after ?? '').split('\n');
  // A minimal LCS-free diff: trim the common prefix/suffix, mark the middle removed-then-added. Good
  // enough for human review of a focused patch (a drafted njk, a one-field rewrite) without a full
  // Myers diff — the patch is already small and verify-gated.
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let sa = a.length, sb = b.length;
  while (sa > p && sb > p && a[sa - 1] === b[sb - 1]) { sa--; sb--; }
  const lines = [];
  for (let i = 0; i < p; i++) lines.push({ sign: ' ', text: a[i] });
  for (let i = p; i < sa; i++) lines.push({ sign: '-', text: a[i] });
  for (let i = p; i < sb; i++) lines.push({ sign: '+', text: b[i] });
  for (let i = sa; i < a.length; i++) lines.push({ sign: ' ', text: a[i] });
  return { added: sb - p, removed: sa - p, lines };
}

/** Render `lineDiff` as a `--- file` / `+++ file` text block (CLI/log friendly). */
export function formatDiff(before, after, file = '') {
  const { lines } = lineDiff(before, after);
  const head = file ? [`--- ${file}`, `+++ ${file}`] : [];
  return [...head, ...lines.map(({ sign, text }) => `${sign}${text}`)].join('\n');
}

// ── Orchestrator: bounded propose → apply → verify-gate → accept/revert loop ─────

/**
 * @typedef {Object} AutofixOptions
 * @property {() => (VerifyState|Promise<VerifyState>)} verify  Re-run the suite, return its failures.
 * @property {(file: string) => string} read   Read current file content.
 * @property {(file: string, content: string) => void} write  Write file content.
 * @property {(file: string) => boolean} [exists]  Does the file exist? Defaults to "read() doesn't throw".
 *           Needed so a CREATING fixer (e.g. the model `missing-description` fixer, #196) can be
 *           reverted by DELETION rather than by writing an empty file back.
 * @property {(file: string) => void} [remove]  Delete a file. Defaults to writing `''` (degraded). The
 *           CLI wires a real `rm`; a created-then-rejected patch is removed, not left empty.
 * @property {CustomFixerRegistry} [registry]  Defaults to the shared singleton.
 * @property {number} [maxRounds]  Loop bound (default 50) — a backstop, not the expected exit.
 * @property {number} [maxModelFixes]  Cost bound (#293): max model-fixer `fix()` calls per run
 *           (default Infinity). Once spent, remaining model-fixable failures are reported `deferred`
 *           and never attempted — so a runaway loop can't burn the BYO key. Reference fixes are free
 *           and ignore this cap.
 * @property {(proposal: { failure: Failure, fixerId: string, file: string, before: string, after: string, summary: string }) => ('accept'|'revert'|boolean|Promise<'accept'|'revert'|boolean>)} [decide]
 *           Human/playground review hook (#293): called for a patch that PASSED the verify gate, before
 *           it lands. Return `revert` / `false` to reject it (the file is reverted and the patch is
 *           recorded in `reviewed`); `accept` / `true` (the default) keeps it. Lets a human gate
 *           model patches on the diff even though the suite accepted them.
 *
 * @typedef {Object} AutofixResult
 * @property {boolean} ok           Suite green at the end?
 * @property {Array<{ failure: Failure, fixerId: string, file: string, before: string, after: string, summary: string }>} applied
 * @property {Array<{ failure: Failure, fixerId: string|null, reason: string }>} gaveUp  Attempted but the verify gate rejected (reverted).
 * @property {Array<{ failure: Failure, fixerId: string, file: string, before: string, after: string, summary: string }>} reviewed  Passed the gate but the `decide` reviewer reverted.
 * @property {Array<{ failure: Failure, fixerId: string, reason: string }>} deferred  Model-fixable but the model-fix budget was spent — never attempted (no API call).
 * @property {Failure[]} skipped    Remaining failures no registered fixer handles.
 * @property {number} rounds        Verify rounds consumed.
 * @property {number} modelFixesUsed  Model-fixer `fix()` calls made (for cost accounting).
 */

/**
 * Drive the suite to green by repeatedly: pick the next fixable, not-yet-given-up failure → ask its
 * fixer for a patch → apply it → re-verify → KEEP only if the target failure cleared and no new error
 * appeared, else REVERT and give up on it. Never throws on a bad patch/fixer — it becomes a recorded
 * give-up, so callers get a structured "couldn't, because…" not an exception.
 *
 * @param {AutofixOptions} opts
 * @returns {Promise<AutofixResult>}
 */
export async function autofix(opts) {
  const {
    verify, read, write, registry = fixerRegistry, maxRounds = 50,
    maxModelFixes = Infinity, decide,
  } = opts;
  // A CREATING fixer (#196) makes a file that didn't exist; revert must DELETE it, not blank it.
  const exists = opts.exists ?? ((file) => { try { read(file); return true; } catch { return false; } });
  const remove = opts.remove ?? ((file) => write(file, ''));
  const applied = [];
  const gaveUp = [];
  const reviewed = [];   // passed the gate but the reviewer reverted (#293 deliverable 2)
  const deferred = [];   // model-fixable but the budget was spent (#293 deliverable 1)
  // One "don't attempt this again" set: covers give-ups, reviewer-rejections, and budget-deferrals, so
  // none is re-picked and the final `skipped` (no-fixer failures) excludes them all.
  const settledKeys = new Set();
  let rounds = 0;
  let modelFixesUsed = 0;

  while (rounds < maxRounds) {
    rounds++;
    const before = await verify();
    if (before.ok) break; // green — done

    // Next failure we can attempt: a registered fixer handles it and we haven't already settled it.
    const target = before.failures.find((f) => !settledKeys.has(failureKey(f)) && registry.resolve(f));
    if (!target) break; // nothing left we know how to attempt — exit, report the remainder as skipped

    const fixer = registry.resolve(target);
    const tKey = failureKey(target);

    // Cost bound: a model fixer would make an API call — if the budget is spent, defer it WITHOUT
    // calling fix() (no key burned). Reference fixers are free and never consume the budget.
    if (isModelFixer(fixer) && modelFixesUsed >= maxModelFixes) {
      deferred.push({ failure: target, fixerId: fixer.id, reason: `model-fix budget (${maxModelFixes}) exhausted` });
      settledKeys.add(tKey);
      continue;
    }

    let patch;
    try {
      if (isModelFixer(fixer)) modelFixesUsed++; // count the metered call we're about to make
      patch = await fixer.fix(target, { read });
    } catch (e) {
      gaveUp.push({ failure: target, fixerId: fixer.id, reason: `fixer threw: ${e.message}` });
      settledKeys.add(tKey);
      continue;
    }
    if (!patch) {
      gaveUp.push({ failure: target, fixerId: fixer.id, reason: 'fixer produced no patch (could not safely fix)' });
      settledKeys.add(tKey);
      continue;
    }

    // Apply, re-verify — the gate. Snapshot first so a rejected patch leaves no trace. A patch that
    // CREATES the file (the target didn't exist) is reverted by DELETION, not by writing it back.
    const existedBefore = exists(patch.file);
    const snapshot = existedBefore ? read(patch.file) : null;
    write(patch.file, patch.newContent);
    const after = await verify();

    const beforeKeys = new Set(before.failures.map(failureKey));
    const targetCleared = !after.failures.some((f) => failureKey(f) === tKey);
    const newFailures = after.failures.filter((f) => !beforeKeys.has(failureKey(f)));

    if (targetCleared && newFailures.length === 0) {
      const proposal = { failure: target, fixerId: fixer.id, file: patch.file, before: snapshot ?? '', after: patch.newContent, summary: patch.summary };
      // Review hook: the patch passed the verify gate, but a human/playground may still reject it on
      // the diff. Default (no `decide`) accepts — unchanged behaviour. `revert`/`false` reverts it.
      const verdict = decide ? await decide(proposal) : 'accept';
      const accepted = verdict === 'accept' || verdict === true || verdict === undefined;
      if (accepted) {
        applied.push(proposal);
        // loop continues; next round re-verifies and picks the next failure
      } else {
        if (existedBefore) write(patch.file, snapshot); // revert — the reviewer rejected it
        else remove(patch.file);
        reviewed.push(proposal);
        settledKeys.add(tKey); // don't re-propose a patch the reviewer already rejected
      }
    } else {
      if (existedBefore) write(patch.file, snapshot); // revert an edit — the suite didn't accept it
      else remove(patch.file); // revert a CREATION — delete the file the rejected patch made
      const why = !targetCleared
        ? 'patch did not clear the target failure'
        : `patch introduced ${newFailures.length} new failure(s): ${newFailures.map((f) => f.message).join('; ')}`;
      gaveUp.push({ failure: target, fixerId: fixer.id, reason: why });
      settledKeys.add(tKey);
    }
  }

  const final = await verify();
  const skipped = final.failures.filter((f) => !registry.resolve(f) && !settledKeys.has(failureKey(f)));
  return { ok: final.ok, applied, gaveUp, reviewed, deferred, skipped, rounds, modelFixesUsed };
}
