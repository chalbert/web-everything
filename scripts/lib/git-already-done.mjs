/** Local merged-PR index. Unknown/incomplete history falls back to the host. */
import { execFileSync } from 'node:child_process';

// One `git fetch` per process per window: a planner tick checks dozens of stale items back to back, and each
// fetch is a blocking network round-trip. `origin/main` does not need to be fresher than this for an exclusion check.
const FETCH_TTL_MS = 60_000;
const lastFetch = new Map();
const otherBasesCache = new Map(); // fetchKey → {at, value}; same TTL as the fetch, one ls-remote per window

export function readGitAlreadyDone(num, { git = execFileSync, cwd = process.cwd(), filter, bornAs, now = Date.now } = {}) {
  const key = String(num ?? '').trim();
  if (!/^\d+$/.test(key)) return null;
  // `bornAs` is interpolated into a RegExp and a git pathspec below — only the JIT `x…` alias shape is safe.
  if (bornAs != null && !/^x[a-z0-9]+$/.test(String(bornAs))) return null;
  const run = (args) => String(git('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15_000, maxBuffer: 64 * 1024 * 1024 }));
  let otherBases = false;
  try {
    if (run(['rev-parse', '--is-shallow-repository']).trim() !== 'false') return null;
    const remote = run(['remote', 'get-url', 'origin']).trim();
    const slug = remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/)?.[1];
    if (!slug) return null;
    const fetchKey = `${git === execFileSync ? '' : 'inj:'}${cwd}`;
    if (!(now() - (lastFetch.get(fetchKey) ?? -Infinity) < FETCH_TTL_MS)) {
      run(['fetch', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main']);
      lastFetch.set(fetchKey, now());
    }
    // A PR merged into another base branch (a release branch) never appears in main's history, yet the GitHub
    // search counts it. Any long-lived origin branch besides main / `lane/*` PR heads means a negative answer
    // from main alone is unprovable — fall back to the host. (Positive answers below stay valid regardless.)
    const cached = otherBasesCache.get(fetchKey);
    if (cached && now() - cached.at < FETCH_TTL_MS) otherBases = cached.value;
    else {
      const heads = run(['ls-remote', '--heads', 'origin']).split('\n').map((l) => l.split('\trefs/heads/')[1]).filter(Boolean);
      otherBases = heads.some((h) => h !== 'main' && !h.startsWith('lane/'));
      otherBasesCache.set(fetchKey, { at: now(), value: otherBases });
    }
    const aliases = new Set([key, bornAs].filter(Boolean));
    const numbering = run(['log', 'origin/main', '--format=%s', '--grep=JIT-number']);
    for (const m of numbering.matchAll(/\b(x[a-z0-9]+)→#(\d+)\b/g)) if (m[2] === key) aliases.add(m[1]);
    // Older custom merges cannot describe an item that had not yet been born. Use
    // graph ancestry (not wall-clock dates) to establish that boundary.
    const births = run(['log', '--reverse', '--diff-filter=A', '--format=%H', 'origin/main', '--', ...[...aliases].map((id) => `backlog/${id}-*.md`)]).trim().split('\n');
    const birth = /^[0-9a-f]{40}$/.test(births[0] || '') ? births[0] : null;
    const raw = run(['log', 'origin/main', '--first-parent', '-z', '--format=%H%x00%cI%x00%P%x00%B']);
    const fields = raw.split('\0');
    if (fields.at(-1) === '') fields.pop();
    if (fields.length % 4) return null;
    for (let i = 0; i < fields.length; i += 4) {
      const [sha, mergedAt, parents, message] = fields.slice(i, i + 4);
      if (parents.trim().split(/\s+/).length < 2) {
        // A first-parent commit with one parent is a squash/rebase merge or a direct push: git holds no PR
        // record for it, so if it names the item the negative answer cannot be proved locally.
        if ([...aliases].some((alias) => new RegExp(`(^|[^0-9])${alias}([^0-9]|$)`).test(message))) return null;
        continue;
      }
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
    return otherBases ? null : { done: false, pr: null, checked: true };
  } catch { return null; }
}
