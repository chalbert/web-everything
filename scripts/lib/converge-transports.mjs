/**
 * converge-transports.mjs — the TRANSPORT contract for the convergence loop (#xztipiw).
 *
 * The convergence core (`we:scripts/lib/converge-core.mjs`) decides WHAT to do next. A transport says WHERE the
 * material comes from and WHERE a revision goes. Those are the only two things that differ between converging a
 * parked pull request and converging uncommitted work in a lane clone.
 *
 * EXACTLY TWO MEMBERS, ON PURPOSE. An earlier draft of this contract also carried `snapshot` / `checkpoint` /
 * `restore` / `allowedWriteSet`. A jury flagged that as premature generalization: four shared concepts sized for
 * a third caller that does not exist, and stubs on one of the two implementations. Round-boundary bookkeeping
 * that only ONE transport needs stays private to that transport — it does not belong in shared vocabulary.
 *
 * ONE IMPLEMENTATION, ALSO ON PURPOSE. Only `working-tree` ships here, because only `/converge` calls it. The
 * `pr-branch` implementation arrives with the item that actually migrates `we:scripts/workflows/review-parked-prs.mjs`
 * onto this core — writing it now would be a second unused generalization, the same mistake one layer down.
 *
 * PURITY. Both members are pure BUILDERS: they return a description of the effect to perform, never perform it.
 * `readMaterial` returns a shell command for the caller to run; `applyRevision` returns an agent prompt for the
 * caller to spawn. So the transport is unit-testable, and the caller (a Workflow harness, or a main-session
 * skill) owns every side effect. This is the same split the core makes — reasoning here, effects there.
 */

import { buildEditorMandate } from './review-core.mjs';

/** The contract every transport must satisfy. Two members. */
export const TRANSPORT_CONTRACT = Object.freeze({
  required: Object.freeze(['transport', 'readMaterial', 'applyRevision']),
});

/**
 * Validate a transport implementation. Pure; never throws — a malformed transport must surface as a structured
 * result at its own boundary, not crash the loop three layers in.
 * @param {*} transport
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateTransport(transport) {
  if (!transport || typeof transport !== 'object' || Array.isArray(transport)) {
    return { valid: false, errors: ['transport must be a non-null object'] };
  }
  const errors = [];
  if (typeof transport.transport !== 'string' || !transport.transport) {
    errors.push('transport.transport must be a non-empty string');
  }
  if (typeof transport.readMaterial !== 'function') {
    errors.push('transport.readMaterial must be a function (ctx) => { kind, command }');
  }
  if (typeof transport.applyRevision !== 'function') {
    errors.push('transport.applyRevision must be a function ({ findings, round, roundCap, ctx }) => { kind, prompt }');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Shell-quote a single argument for safe interpolation into a `bash -c` command string. A lane path or a base
 * ref reaches these builders from a caller's argument, so it is never pasted raw.
 * @param {string} value
 * @returns {string}
 */
function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/**
 * THE WORKING-TREE TRANSPORT — converge the work in a lane clone, before any PR exists.
 *
 * Reads the lane's whole change against its fork point: committed lane commits AND uncommitted edits, in one
 * diff, because pre-PR work is normally a mix of both and reviewing only half of it would be worse than not
 * reviewing at all.
 *
 * `git add --intent-to-add` is what makes UNTRACKED files visible to `git diff`. Without it a brand-new file —
 * the single most common thing an unfinished change adds — is invisible to the panel, which would then accept a
 * diff it never saw. It stages nothing and changes no file content; it only records that the path exists.
 *
 * IT LISTS PATHS EXPLICITLY RATHER THAN USING `--all`. A repo guard blocks `git add -A` / `.` / `--all` outright,
 * because a broad add sweeps up whatever OTHER concurrent sessions have in flight in the same tree. The first
 * draft of this transport used `--all` and was blocked the moment it ran — so the untracked set is enumerated
 * with `git ls-files --others --exclude-standard` and added by explicit path. An empty list is a no-op, not an
 * error.
 */
export const WORKING_TREE_TRANSPORT = Object.freeze({
  transport: 'working-tree',

  /**
   * @param {{laneRoot: string, baseRef?: string}} ctx
   * @returns {{kind: 'shell', command: string, cwd: string}}
   */
  readMaterial({ laneRoot, baseRef = 'origin/main' } = {}) {
    const cwd = shellQuote(laneRoot);
    const base = shellQuote(baseRef);
    // `git diff <forkpoint>` compares the WORKING TREE to the fork point, so committed and uncommitted work both
    // appear. The intent-to-add is allowed to fail (a repo with nothing untracked) WITHOUT taking the read down —
    // but it is braced, because `cd X && A || true && B` parses as `((cd && A) || true) && B`, which would let a
    // FAILED `cd` fall through and diff whatever repo the caller happened to be standing in. The brace group
    // confines the `|| true` to the intent-to-add, so a bad lane path still fails the whole command.
    return {
      kind: 'shell',
      cwd: laneRoot,
      command: [
        `cd ${cwd}`,
        `{ git ls-files --others --exclude-standard -z | xargs -0 git add --intent-to-add -- >/dev/null 2>&1 || true; }`,
        `git diff "$(git merge-base HEAD ${base})"`,
      ].join(' && '),
    };
  },

  /**
   * The editor's mandate comes from the shared review core — this transport only adds WHERE to write and the one
   * rule that differs from the PR case: edit in place, never commit, never push. Committing here would take the
   * decision to publish out of the human's hands, which is exactly what `/converge` promises not to do.
   *
   * @param {{findings: any[], round: number, roundCap: number, ctx: {laneRoot: string}}} o
   * @returns {{kind: 'agent', prompt: string}}
   */
  applyRevision({ findings = [], round = 1, roundCap, ctx = {} } = {}) {
    const mandate = buildEditorMandate({ findings, round, roundCap });
    const prompt = [
      mandate,
      '',
      '## Where you are working',
      '',
      `Edit the files in the lane clone at \`${ctx.laneRoot}\` **in place**.`,
      '',
      '- Do **not** run `git commit`, `git push`, or `gh pr create`. This loop revises work in the tree; whether it',
      '  ever becomes a commit or a PR is the human\'s call, not yours.',
      '- Do **not** revert or stash changes you did not make — a human may be editing in this clone at the same time.',
      '',
      '## What to return',
      '',
      'Return JSON: `{ "advanced": <true if you changed at least one file>, "dismissed": [{ "summary": "…",',
      '"reason": "…" }] }`. Put every finding you judged NOT real in `dismissed` with a one-line reason — a',
      'finding you neither fixed nor dismissed is a finding silently dropped, which the loop treats as a stall.',
    ].join('\n');
    return { kind: 'agent', prompt };
  },
});

/** The closed registry. `/converge` resolves through here so an unknown name fails at the boundary. */
const REGISTRY = Object.freeze({
  [WORKING_TREE_TRANSPORT.transport]: WORKING_TREE_TRANSPORT,
});

/**
 * Resolve a transport by name. Fails closed: an absent, unknown, or misspelled name returns an error rather than
 * silently defaulting, because defaulting would silently pick where a revision gets WRITTEN.
 *
 * NOTE ON SCOPE — this applies to the CONVERGE entry point only. The judge-only jury path
 * (`we:.claude/skills/jury/`) takes no transport at all: `design-pixels` and `decision-prose` are judged without
 * any convergence loop, so they neither need nor accept one.
 *
 * @param {string} name
 * @returns {{ok: true, transport: object}|{ok: false, error: string, available: string[]}}
 */
export function resolveTransport(name) {
  const available = Object.keys(REGISTRY);
  if (typeof name !== 'string' || !name) {
    return { ok: false, error: 'a transport name is required (no default)', available };
  }
  const found = REGISTRY[name];
  if (!found) return { ok: false, error: `unknown transport "${name}"`, available };
  return { ok: true, transport: found };
}
