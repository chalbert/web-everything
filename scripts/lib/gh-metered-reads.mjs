/** Read queries include their own rateLimit cost; gh-throttle captures it before stdout projection. */
import { runGhSync } from './gh-throttle.mjs';

export function meteredPrCommits(repo, number, { exec = runGhSync } = {}) {
  const [owner, name] = repo.split('/');
  const query = `query($owner:String!,$name:String!,$number:Int!,$endCursor:String){
    rateLimit { cost }
    repository(owner:$owner,name:$name){pullRequest(number:$number){commits(first:100,after:$endCursor){
      pageInfo { hasNextPage endCursor }
      nodes { commit { oid messageHeadline messageBody authors(first:100){nodes{name email}} } }
    }}}
  }`;
  // gh rejects `--slurp` together with `--jq`, so the pages come back raw and are projected here.
  const raw = exec(['api', 'graphql', '--paginate', '--slurp', '-f', `query=${query}`, '-f', `owner=${owner}`, '-f', `name=${name}`, '-F', `number=${number}`],
    { encoding: 'utf8', throttle: { op: 'pr view commits (pr-limit)' } });
  const pages = JSON.parse(String(raw));
  const commits = [];
  for (const page of Array.isArray(pages) ? pages : [pages]) {
    const nodes = page?.data?.repository?.pullRequest?.commits?.nodes;
    if (!Array.isArray(nodes)) throw new Error('unexpected commits response shape');
    for (const { commit } of nodes) commits.push({ ...commit, authors: commit.authors?.nodes ?? [] });
  }
  return commits;
}

/** The already-done search as `{args, opts}` — shared by the sync and async callers so the async one can await its own executor. */
export function alreadyDoneRequest(repo, key, opts = {}) {
  const query = `query($search:String!){
    rateLimit { cost }
    search(query:$search,type:ISSUE,first:5){nodes{... on PullRequest{
      number title url mergedAt headRefName body
      files(first:100){nodes{path}}
    }}}
  }`;
  return {
    args: ['api', 'graphql', '-f', `query=${query}`, '-f', `search=repo:${repo} is:pr is:merged ${key} in:title`, '--jq', '[.data.search.nodes[] | .files = .files.nodes]'],
    opts: { encoding: 'utf8', ...opts, throttle: { op: 'pr list (already-done)' } },
  };
}

/** `opts` (timeout, killSignal, maxBuffer, stdio) is forwarded to the exec so the CALL SITE owns its subprocess bounds (#3460). */
export function meteredAlreadyDone(repo, key, { exec = runGhSync, opts = {} } = {}) {
  const req = alreadyDoneRequest(repo, key, opts);
  return JSON.parse(String(exec(req.args, req.opts)));
}
