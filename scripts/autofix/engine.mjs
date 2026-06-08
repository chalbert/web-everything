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
 * @property {string} [entity] Spec entity (`Block` / `Plug` / `Protocol` / `Intent`).
 * @property {string} [id]    Entity id within its registry.
 * @property {string} [file]  Repo-relative spec file the fix edits.
 * @property {string} [field] Field to change.
 * @property {string} [from]  Current (offending) value.
 * @property {string} [to]    Canonical target value.
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

/** @type {Fixer} */
export const deprecatedStatusFixer = {
  id: 'reference:deprecated-status',
  handles: (f) => f.descriptor?.kind === 'deprecated-status',
  fix: (f, { read }) => {
    const d = f.descriptor;
    if (!d?.file || !d.id || !d.field || d.from === undefined || d.to === undefined || d.from === d.to) return null;
    const content = read(d.file);
    // SURGICAL edit — anchor on the unique id, then rewrite the first `"<field>": "<from>"` that
    // follows it (specs list id before its fields), changing only that one value. A full
    // JSON.parse → stringify would reformat the entire file (inline objects expand to multi-line),
    // burying the one-field fix in hundreds of noise lines and defeating human diff review.
    const idAnchor = content.indexOf(`"id": "${d.id}"`);
    if (idAnchor === -1) return null; // can't locate the row — give up safely, don't guess
    const fieldRe = new RegExp(`("${escapeRegExp(d.field)}"\\s*:\\s*)"${escapeRegExp(d.from)}"`);
    const m = fieldRe.exec(content.slice(idAnchor));
    if (!m) return null; // already fixed, or the field isn't where we expect — give up safely
    const start = idAnchor + m.index;
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

// ── Orchestrator: bounded propose → apply → verify-gate → accept/revert loop ─────

/**
 * @typedef {Object} AutofixOptions
 * @property {() => (VerifyState|Promise<VerifyState>)} verify  Re-run the suite, return its failures.
 * @property {(file: string) => string} read   Read current file content.
 * @property {(file: string, content: string) => void} write  Write file content.
 * @property {CustomFixerRegistry} [registry]  Defaults to the shared singleton.
 * @property {number} [maxRounds]  Loop bound (default 50) — a backstop, not the expected exit.
 *
 * @typedef {Object} AutofixResult
 * @property {boolean} ok           Suite green at the end?
 * @property {Array<{ failure: Failure, fixerId: string, file: string, before: string, after: string, summary: string }>} applied
 * @property {Array<{ failure: Failure, fixerId: string|null, reason: string }>} gaveUp  Attempted but the verify gate rejected (reverted).
 * @property {Failure[]} skipped    Remaining failures no registered fixer handles.
 * @property {number} rounds        Verify rounds consumed.
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
  const { verify, read, write, registry = fixerRegistry, maxRounds = 50 } = opts;
  const applied = [];
  const gaveUp = [];
  const gaveUpKeys = new Set();
  let rounds = 0;

  while (rounds < maxRounds) {
    rounds++;
    const before = await verify();
    if (before.ok) break; // green — done

    // Next failure we can attempt: a registered fixer handles it and we haven't already given up on it.
    const target = before.failures.find((f) => !gaveUpKeys.has(failureKey(f)) && registry.resolve(f));
    if (!target) break; // nothing left we know how to attempt — exit, report the remainder as skipped

    const fixer = registry.resolve(target);
    const tKey = failureKey(target);

    let patch;
    try {
      patch = await fixer.fix(target, { read });
    } catch (e) {
      gaveUp.push({ failure: target, fixerId: fixer.id, reason: `fixer threw: ${e.message}` });
      gaveUpKeys.add(tKey);
      continue;
    }
    if (!patch) {
      gaveUp.push({ failure: target, fixerId: fixer.id, reason: 'fixer produced no patch (could not safely fix)' });
      gaveUpKeys.add(tKey);
      continue;
    }

    // Apply, re-verify — the gate. Snapshot first so a rejected patch leaves no trace.
    const snapshot = read(patch.file);
    write(patch.file, patch.newContent);
    const after = await verify();

    const beforeKeys = new Set(before.failures.map(failureKey));
    const targetCleared = !after.failures.some((f) => failureKey(f) === tKey);
    const newFailures = after.failures.filter((f) => !beforeKeys.has(failureKey(f)));

    if (targetCleared && newFailures.length === 0) {
      applied.push({ failure: target, fixerId: fixer.id, file: patch.file, before: snapshot, after: patch.newContent, summary: patch.summary });
      // loop continues; next round re-verifies and picks the next failure
    } else {
      write(patch.file, snapshot); // revert — the suite didn't accept it
      const why = !targetCleared
        ? 'patch did not clear the target failure'
        : `patch introduced ${newFailures.length} new failure(s): ${newFailures.map((f) => f.message).join('; ')}`;
      gaveUp.push({ failure: target, fixerId: fixer.id, reason: why });
      gaveUpKeys.add(tKey);
    }
  }

  const final = await verify();
  const skipped = final.failures.filter((f) => !registry.resolve(f) && !gaveUpKeys.has(failureKey(f)));
  return { ok: final.ok, applied, gaveUp, skipped, rounds };
}
