/**
 * remote-manifest.mjs — the ONE `gh api` argv for reading a remote constellation repo's
 * `.lane-manifest.json` off a PR head ref (#2383/#2399). Shared by the drain (`merge-ai-prs.mjs`)
 * and `/finish` (`lane-resume.mjs`) so the two manifest readers can never drift: a fix to this argv
 * lands in both by construction, keeping cross-repo `blockedBy` ordering identical on both paths.
 * (Hoisting is the only cycle-free home — lane-resume already imports from merge-ai-prs.)
 */

/**
 * Build the `gh api` argv that reads a remote repo's `.lane-manifest.json` off a head ref. Pure/exported so
 * the `--method GET` is regression-guarded. `--method GET` is REQUIRED: `gh api` silently switches to POST the
 * moment an `-f`/`--field` param is present with no explicit method, and a POST to the read-only contents
 * endpoint 404s — which the callers' manifest-read catch would swallow to null, so every remote lane would
 * drop its item/blockedBy (the very cross-repo ordering the drain and `/finish` sweeps exist for). GET keeps
 * `-f ref=` as a query param.
 * @param {string} repo — "owner/name"
 * @param {string} ref  — the PR head ref
 */
export function remoteManifestApiArgs(repo, ref) {
  return ['api', '--method', 'GET', `repos/${repo}/contents/.lane-manifest.json`, '-f', `ref=${ref}`, '-q', '.content'];
}
