/**
 * @file land-advance-tools.mjs
 * Permission grants are argv atoms: the variadic form consumes the following prompt.
 * Review's existing disallowed-tools policy remains authoritative. API access is
 * restricted to GET; node access names the review operation and its lifecycle tools.
 */
const read = ['Read', 'Grep', 'Glob']; // local inspection
const build = ['Read', 'Edit', 'Write', 'Bash(node scripts/*)', // implementation and verification
  ...['add', 'commit', 'push', 'status', 'diff', 'log', 'fetch', 'rev-parse'].map((v) => `Bash(git ${v}:*)`),
  ...['create', 'view', 'edit'].map((v) => `Bash(gh pr ${v}:*)`)];
export const ALLOWED_TOOLS_BY_KIND = Object.freeze({
  review: Object.freeze([...read, ...['view', 'diff', 'list'].map((v) => `Bash(gh pr ${v}:*)`), // PR reads
    'Bash(gh api --method GET:*)', 'Bash(node scripts/operations/wip-agents-cli.mjs)',
    'Bash(node scripts/operations/review-loop-cli.mjs:*)', // declared review-pr operation
    'Bash(node scripts/operations/completion-cli.mjs report:*)', // brief's started/done records
    'Bash(node scripts/lane-pool.mjs acquire:*)', // brief's bounded lane acquisition
    'Bash(node scripts/lane-pool.mjs release:*)']), // release that lane on completion
  fix: Object.freeze([...build]), build: Object.freeze([...build]),
});
export function allowedToolsArg(kind) {
  if (!Object.hasOwn(ALLOWED_TOOLS_BY_KIND, kind)) throw new TypeError(`Unknown dispatch kind: ${kind}`);
  return `--allowedTools=${ALLOWED_TOOLS_BY_KIND[kind].join(',')}`;
}
