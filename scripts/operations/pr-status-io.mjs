/**
 * @file scripts/operations/pr-status-io.mjs
 * @description The INJECTED READER for the `pr-status` operation — the only half that shells `gh`. Kept out
 *   of `pr-status.mjs` for the same reason `gate-health-io.mjs` is kept out of its declaration: that file's
 *   import graph is asserted free of `node:` specifiers, so its step functions provably hold no writer in
 *   lexical scope. Everything here READS.
 */
import { execFileSync } from 'node:child_process';

/** How long a `gh` call may take before it is abandoned. A kill lands as a throw, never as an empty list. */
export const GH_TIMEOUT_MS = 60 * 1000;

/**
 * The argv for the open-PR listing. PURE, and exported so a test can assert the exact command with no
 * subprocess — the discipline `verify-io.mjs` applies to its own spawn.
 *
 * `headRefOid` IS THE FIELD THAT MATTERS. Every state this operation reports is a claim about one commit, and
 * asking `gh` for the PR without it yields a PR whose head is unknown — which `shapeReadFinding` refuses
 * rather than assessing optimistically. The checks are fetched per-head separately, because `gh pr list`
 * cannot return check runs keyed to a sha.
 */
export function listArgv({ repo, pr = 0 }) {
  const fields = 'number,title,labels,mergeable,headRefOid';
  return pr > 0
    ? ['pr', 'view', String(pr), '--repo', repo, '--json', fields]
    : ['pr', 'list', '--repo', repo, '--state', 'open', '--limit', '100', '--json', fields];
}

/**
 * The argv for one head's check runs.
 *
 * KEYED TO THE SHA, NOT THE PR, and that is the whole point of the operation. `gh pr checks <n>` answers for
 * the PR and will happily report a run recorded against a SUPERSEDED commit, which is exactly the reading
 * that let two PRs display green marks belonging to commits that were no longer their heads. Asking the
 * commit-statuses endpoint for an explicit sha cannot do that.
 */
export function checksArgv({ repo, sha }) {
  return ['api', `repos/${repo}/commits/${sha}/check-runs`, '--jq', '.check_runs[] | {name,status,conclusion}'];
}

/** One `gh` invocation. Throws on failure — a reader that could not read must never return an empty list. */
function gh(argv, { run = execFileSync } = {}) {
  return String(run('gh', argv, { encoding: 'utf8', timeout: GH_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 }) ?? '');
}

/** Parse `--jq`'s newline-delimited JSON objects. A blank stream is legitimately zero check runs. */
export function parseJsonLines(text) {
  return String(text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

/** Normalize `gh`'s label objects (`{name}`) to bare names, tolerating either shape. */
export function labelNames(labels) {
  return (Array.isArray(labels) ? labels : []).map((l) => String(l?.name ?? l ?? '')).filter(Boolean);
}

/**
 * The reader the declaration is injected with. `run` is injected so every branch is reachable with no `gh`,
 * no network and no credential.
 *
 * A FAILED CHECK FETCH THROWS rather than yielding `[]`. An empty check list is what this operation reads as
 * `unchecked` — a real, actionable finding — so letting a network error produce one would manufacture the
 * exact alarm the operation exists to raise, and the next person to see a false `unchecked` would learn to
 * ignore a true one.
 */
export function createPrReader({ run = execFileSync } = {}) {
  return ({ repo, pr = 0 }) => {
    const raw = gh(listArgv({ repo, pr }), { run });
    const parsed = JSON.parse(raw || (pr > 0 ? '{}' : '[]'));
    const rows = Array.isArray(parsed) ? parsed : [parsed];

    const prs = rows.filter((r) => r && r.number != null).map((r) => {
      const headSha = String(r.headRefOid ?? '');
      return {
        number: Number(r.number),
        title: String(r.title ?? ''),
        labels: labelNames(r.labels),
        mergeable: String(r.mergeable ?? 'UNKNOWN').toLowerCase(),
        headSha,
        checks: headSha ? parseJsonLines(gh(checksArgv({ repo, sha: headSha }), { run })) : [],
      };
    });

    return { repo, prs };
  };
}
