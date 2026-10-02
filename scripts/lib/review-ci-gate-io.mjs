/** Fresh repo-explicit review eligibility, with injectable read-only GitHub IO. */
import { execFileSync } from 'node:child_process';
import { getRequiredStatusChecks } from './required-status-checks.mjs';
import { reviewCiGate } from './review-ci-gate.mjs';

const gh = argv => execFileSync('gh', argv, { encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'] });
export const readReviewHead = ({ repo, pr, run = gh }) => JSON.parse(run(['pr', 'view', String(pr), '--repo', repo, '--json', 'headRefOid'])).headRefOid;
export const readReviewChecks = ({ repo, headSha, run = gh }) => JSON.parse(run([
  'api', '--paginate', '--slurp', `repos/${repo}/commits/${headSha}/check-runs?per_page=100&filter=all`,
])).flatMap(page => {
  if (!Array.isArray(page.check_runs)) throw new Error('unreadable check runs');
  return page.check_runs;
});

export function readReviewCiGate({ repo, pr, readHead = readReviewHead,
  readChecks = readReviewChecks, readRequired = getRequiredStatusChecks } = {}) {
  let headSha = null;
  try {
    if (typeof repo !== 'string' || !/^[^/]+\/[^/]+$/.test(repo)) throw new Error('explicit repo required');
    headSha = readHead({ repo, pr });
    if (typeof headSha !== 'string' || !headSha.trim()) return reviewCiGate({ headSha });
    const required = readRequired({ repo, ttlMs: 0 });
    if (!['live', 'cache'].includes(required?.source)) {
      return { allowed: false, headSha, reason: 'untrusted-required-set', source: required?.source };
    }
    const checks = readChecks({ repo, headSha });
    const currentHead = readHead({ repo, pr });
    if (currentHead !== headSha) return { allowed: false, headSha, currentHead, reason: 'head-changed' };
    return { ...reviewCiGate({ headSha, requiredChecks: required.checks, checks }), source: required.source };
  } catch (error) {
    return { allowed: false, headSha, reason: 'unreadable-ci', error: String(error?.message ?? error) };
  }
}
