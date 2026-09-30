/** Local merged-PR index. Unknown/incomplete history falls back to the host. */
import { execFileSync } from 'node:child_process';

export function readGitAlreadyDone(num, { git = execFileSync, cwd = process.cwd(), filter, bornAs } = {}) {
  const key = String(num ?? '').trim();
  if (!/^\d+$/.test(key)) return null;
  const run = (args) => String(git('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15_000, maxBuffer: 64 * 1024 * 1024 }));
  try {
    if (run(['rev-parse', '--is-shallow-repository']).trim() !== 'false') return null;
    const remote = run(['remote', 'get-url', 'origin']).trim();
    const slug = remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/)?.[1];
    if (!slug) return null;
    run(['fetch', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main']);
    const aliases = new Set([key, bornAs].filter(Boolean));
    const numbering = run(['log', 'origin/main', '--format=%s', '--grep=JIT-number']);
    for (const m of numbering.matchAll(/\b(x[a-z0-9]+)→#(\d+)\b/g)) if (m[2] === key) aliases.add(m[1]);
    // Older custom merges cannot describe an item that had not yet been born. Use
    // graph ancestry (not wall-clock dates) to establish that boundary.
    const births = run(['log', '--reverse', '--diff-filter=A', '--format=%H', 'origin/main', '--', ...[...aliases].map((id) => `backlog/${id}-*.md`)]).trim().split('\n');
    const birth = /^[0-9a-f]{40}$/.test(births[0] || '') ? births[0] : null;
    const raw = run(['log', 'origin/main', '--merges', '--first-parent', '-z', '--format=%H%x00%cI%x00%B']);
    const fields = raw.split('\0');
    if (fields.at(-1) === '') fields.pop();
    if (fields.length % 3) return null;
    for (let i = 0; i < fields.length; i += 3) {
      const [sha, mergedAt, message] = fields.slice(i, i + 3);
      const match = message.match(/^Merge pull request #(\d+) from [^/]+\/(\S+)\n\n([^\n]+)(?:\n([\s\S]*))?$/);
      if (!match) {
        if (!birth) return null;
        // Throws unless the unknown merge is definitely older than the item's creation.
        run(['merge-base', '--is-ancestor', sha, birth]);
        continue;
      }
      const [, number, headRefName, title, body = ''] = match;
      let normalizedTitle = title;
      for (const alias of aliases) if (alias !== key) normalizedTitle = normalizedTitle.replace(new RegExp(`\\b${alias}\\b`, 'g'), key);
      if (!new RegExp(`(^|[^0-9])${key}([^0-9]|$)`).test(normalizedTitle)) continue;
      const files = run(['diff', '--name-only', '-z', `${sha}^1`, sha, '--']).split('\0').filter(Boolean).map((path) => ({ path }));
      const pr = { number: Number(number), title: normalizedTitle, headRefName, body, files, mergedAt, url: `https://github.com/${slug}/pull/${number}`, state: 'MERGED' };
      if (!filter([pr], key).length) continue;
      // Default GitHub merge messages omit the original PR body. A body-only disclaimer
      // cannot be disproved locally: preserve the old guard by asking GitHub for this case.
      return null;
    }
    return { done: false, pr: null, checked: true };
  } catch { return null; }
}
