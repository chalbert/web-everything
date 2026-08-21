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
 * How many open PRs one listing may return.
 *
 * A CAP THAT IS REPORTED, NOT ONE THAT IS SILENT (PR #1521 juror). The first cut asked for 100 and said
 * nothing when a repo had more, so PR 101 was simply absent from a report whose whole purpose is noticing a
 * PR nobody is looking at. That is this operation's own defect turned on itself: silence reading as absence.
 *
 * Raised, and — more importantly — `createPrReader` now detects a listing that came back FULL and marks the
 * result `truncated`, because the honest answer to "were there more?" is either "no" or "I cannot tell", and
 * a bare list cannot distinguish them. `no silent caps` is the rule; this is it applied to itself.
 */
export const LIST_LIMIT = 200;

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
    : ['pr', 'list', '--repo', repo, '--state', 'open', '--limit', String(LIST_LIMIT), '--json', fields];
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

    // A listing that came back FULL may have been cut off — `gh` does not say. Reported rather than assumed
    // either way: the reader's job is to state what it knows, and `assessPrs` turns it into a finding.
    return { repo, prs, truncated: pr === 0 && rows.length >= LIST_LIMIT };
  };
}
