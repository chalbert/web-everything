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
  const raw = exec(['api', 'graphql', '--paginate', '--slurp', '-f', `query=${query}`, '-f', `owner=${owner}`, '-f', `name=${name}`, '-F', `number=${number}`, '--jq', '[.[].data.repository.pullRequest.commits.nodes[] | .commit | .authors = .authors.nodes]'],
    { encoding: 'utf8', throttle: { op: 'pr view commits (pr-limit)' } });
  return JSON.parse(String(raw));
}

export function meteredAlreadyDone(repo, key, { exec = runGhSync } = {}) {
  const query = `query($search:String!){
    rateLimit { cost }
    search(query:$search,type:ISSUE,first:5){nodes{... on PullRequest{
      number title url mergedAt headRefName body
      files(first:100){nodes{path}}
    }}}
  }`;
  const raw = exec(['api', 'graphql', '-f', `query=${query}`, '-f', `search=repo:${repo} is:pr is:merged ${key} in:title`, '--jq', '[.data.search.nodes[] | .files = .files.nodes]'],
    { encoding: 'utf8', throttle: { op: 'pr list (already-done)' } });
  return JSON.parse(String(raw));
}
