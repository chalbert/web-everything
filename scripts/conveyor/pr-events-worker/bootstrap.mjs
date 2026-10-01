/** Operator-only first-deploy baseline. No polling or live credentials in tests. */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { validateBootstrap } from './core.mjs';

export async function bootstrapRepos({ url, repos, readToken, bootstrapToken, importId, limit = 1000,
  run = (command, args) => execFileSync(command, args, { encoding: 'utf8' }), fetchImpl = fetch }) {
  if (!url || !readToken || !bootstrapToken || !importId || !Array.isArray(repos) || !repos.length ||
      !Number.isSafeInteger(limit) || limit < 1 || repos.some((repo) => !/^[A-Za-z0-9][\w.-]*\/[A-Za-z0-9][\w.-]*$/.test(repo))) throw new Error('invalid bootstrap configuration');
  const results = [];
  for (const repo of [...new Set(repos)]) {
    const before = await fetchImpl(`${url.replace(/\/$/, '')}/prs`, { headers: { authorization: `Bearer ${readToken}` } });
    if (!before.ok) throw new Error(`cursor read failed: HTTP ${before.status}`);
    const { stateCursor: baseCursor } = await before.json();
    let prs = [], status = 'complete', failure;
    try {
      const rows = JSON.parse(await run('gh', ['pr', 'list', '--repo', repo, '--state', 'open', '--limit', String(limit), '--json', 'number,headRefOid,isDraft,labels,state']));
      if (!Array.isArray(rows)) throw new Error('invalid list response');
      prs = rows.map((p) => ({ number: p.number, sha: p.headRefOid, draft: p.isDraft,
        labels: p.labels.map((l) => l.name), state: p.state === 'OPEN' ? 'open' : p.state }));
      status = rows.length >= limit ? 'truncated' : 'complete';
      validateBootstrap({ repo, importId, baseCursor, status, prs });
    } catch (error) { failure = error; status = 'failed'; prs = []; }
    const input = validateBootstrap({ repo, importId, baseCursor, status, prs });
    const response = await fetchImpl(`${url.replace(/\/$/, '')}/prs/bootstrap`, {
      method: 'POST', headers: { authorization: `Bearer ${bootstrapToken}`, 'content-type': 'application/json' }, body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(`bootstrap import failed: HTTP ${response.status}; retry the identical import payload or use a new import ID for a fresh listing`);
    results.push(await response.json());
    if (failure) throw new Error(`listing failed for ${repo}; incomplete coverage recorded; retry with a new import ID`, { cause: failure });
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')));
  bootstrapRepos({ url: args.url, repos: args.repos?.split(','), importId: args['import-id'],
    limit: Number(args.limit || 1000), readToken: process.env.PR_EVENTS_READ_TOKEN,
    bootstrapToken: process.env.PR_EVENTS_BOOTSTRAP_TOKEN }).then((result) => console.log(JSON.stringify(result)))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
