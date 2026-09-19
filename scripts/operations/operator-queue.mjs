/** @file Read-only operator queue: surface human review only when every readiness gate passes. */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DEFAULT_REPOS = ['chalbert/web-everything', 'chalbert/frontierui', 'chalbert/plateau-app'];
const hasLabel = (pr, name) => (pr.labels ?? []).some((label) => label.name === name);

export function evaluatePr(pr) {
  const reasons = [];
  if (!hasLabel(pr, 'review:human')) reasons.push('no review:human label');

  const advisories = (pr.comments ?? []).flatMap((comment, index) => {
    const verdict = (comment.body ?? '').match(/^\*\*Verdict:\*\*[^\r\n]*/m)?.[0];
    const basis = (comment.body ?? '').match(/^Net basis: `([a-f0-9]+)\.\.([a-f0-9]+)`/im);
    return verdict && basis
      ? [{ verdict, head: basis[2], time: Date.parse(comment.createdAt) || 0, index }]
      : [];
  });
  advisories.sort((a, b) => b.time - a.time || b.index - a.index);
  const advisory = advisories[0];
  if (!advisory) {
    reasons.push('no advisory verdict');
  } else {
    const head = (pr.headRefOid ?? '').toLowerCase();
    const reviewed = advisory.head.toLowerCase();
    if (!head || !(head.startsWith(reviewed) || reviewed.startsWith(head))) {
      reasons.push(`advisory is on ${reviewed.slice(0, 9)}, head is ${head.slice(0, 9)}`);
    }
  }
  if (/changes/i.test(advisory?.verdict ?? '') || hasLabel(pr, 'review:changes')) {
    reasons.push('changes requested');
  }

  const checks = (pr.statusCheckRollup ?? []).filter((check) => check.name !== 'review-gate');
  const pending = checks.filter((check) => check.status !== 'COMPLETED');
  const failing = checks.filter((check) => check.status === 'COMPLETED'
    && !['SUCCESS', 'SKIPPED', 'NEUTRAL'].includes(check.conclusion));
  const names = (entries) => entries.map((check) => check.name || check.context || 'unnamed check').join(', ');
  if (failing.length) reasons.push(`CI failing: ${names(failing)}`);
  if (pending.length) reasons.push(`CI pending: ${names(pending)}`);
  if (hasLabel(pr, 'ci:failed')) reasons.push('ci:failed label');

  if (pr.mergeable === 'CONFLICTING' || hasLabel(pr, 'merge-status:conflicting')) {
    reasons.push('conflicts with base');
  }
  if (pr.mergeable !== 'MERGEABLE' && pr.mergeable !== 'CONFLICTING') {
    reasons.push('mergeability unknown');
  }
  return { ready: reasons.length === 0, reasons };
}

export function main(args = process.argv.slice(2)) {
  const requested = args.filter((arg) => arg.startsWith('--repo=')).map((arg) => arg.slice(7));
  const report = { ready: [], notReady: [], errors: [] };
  for (const repo of requested.length ? requested : DEFAULT_REPOS) {
    try {
      const prs = JSON.parse(execFileSync('gh', [
        'pr', 'list', '--repo', repo, '--state', 'open', '--limit', '200', '--json',
        'number,title,labels,headRefOid,mergeable,statusCheckRollup,comments',
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
      for (const pr of prs.filter((candidate) => hasLabel(candidate, 'review:human'))) {
        const result = evaluatePr(pr);
        const row = { repo, number: pr.number, title: pr.title };
        if (result.ready) report.ready.push(row);
        else report.notReady.push({ ...row, reasons: result.reasons });
      }
    } catch (error) {
      const detail = String(error.stderr || error.message).trim().replace(/\s+/g, ' ');
      report.errors.push(`${repo}: ${detail}`);
    }
  }
  if (args.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const error of report.errors) console.error(`ERROR ${error}`);
    console.log('NEEDS YOU (review:human, all gates pass):');
    console.log(report.ready.map((pr) => `${pr.repo}#${pr.number}  ${pr.title}`).join('\n') || '(none)');
    console.log('NOT READY — agent work (review:human but gates fail):');
    console.log(report.notReady.map((pr) => `${pr.repo}#${pr.number}  ${pr.reasons.join('; ')}`).join('\n') || '(none)');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
