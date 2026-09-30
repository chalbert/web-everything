/** Git transport supplies the same commit author/message inputs as gh's commits connection. */
import { execFileSync } from 'node:child_process';

export function readGitPrCommits(repoSlug, head, { cwd = process.cwd(), git = execFileSync, headRefOid } = {}) {
  if (!head || !/^[\w./-]+$/.test(head) || head.startsWith('-')) return null;
  const run = (args) => String(git('git', args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
    maxBuffer: 16 * 1024 * 1024,
  }));
  try {
    // Never read a sibling repo's refs as if they belonged to the requested repo.
    const remote = run(['remote', 'get-url', 'origin']).trim();
    if (!remote.replace(/\.git$/, '').endsWith(`/${repoSlug}`) && !remote.replace(/\.git$/, '').endsWith(`:${repoSlug}`)) return null;
    run(['check-ref-format', `refs/heads/${head}`]);
    run(['fetch', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main', `+refs/heads/${head}:refs/remotes/origin/${head}`]);
    if (run(['rev-parse', '--is-shallow-repository']).trim() !== 'false') return null;
    if (headRefOid && run(['rev-parse', `origin/${head}`]).trim() !== headRefOid) return null;
    const raw = run(['log', '-z', '--format=%H%x00%an%x00%ae%x00%B%x00%(trailers:key=Co-Authored-By,valueonly,separator=%x1f)', `origin/main..origin/${head}`, '--']);
    const fields = raw.split('\0');
    if (fields.at(-1) === '') fields.pop();
    if (fields.length % 5) return null;
    const commits = [];
    for (let i = 0; i < fields.length; i += 5) {
      const [oid, name, email, message, trailers] = fields.slice(i, i + 5);
      const nl = message.indexOf('\n');
      const authors = [{ name, email }];
      for (const trailer of trailers.split('\x1f')) {
        const m = trailer.trim().match(/^(.*?)\s*<([^>]+)>$/);
        if (m) authors.push({ name: m[1], email: m[2] });
      }
      commits.push({ oid, authors, messageHeadline: nl < 0 ? message : message.slice(0, nl), messageBody: nl < 0 ? '' : message.slice(nl + 1) });
    }
    return commits;
  } catch { return null; }
}
