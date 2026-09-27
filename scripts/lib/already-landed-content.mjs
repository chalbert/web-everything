/**
 * already-landed-content.mjs — the PURE core for "has this open PR's own content already landed on `main`,
 * carried there by a DIFFERENT PR?" (live incident: chalbert/web-everything PR #2752, #4034/#2748).
 *
 * WHY THIS EXISTS. PR #2759 was built ON TOP OF #2752's branch (a stacked lane) and merged to `main` first,
 * carrying every one of #2752's commits with it. #2752's own branch was SEPARATELY rebased afterward (its
 * ref now points at one squashed commit that shares no history with what actually landed), so it drifted into
 * `mergeable: CONFLICTING` and was bounced by `we:scripts/conveyor/parked-pr-conflict-watch.mjs` — even though
 * every file it touches is, byte-for-byte, already on `main`. `we:scripts/conveyor/reconcile-core.mjs`'s
 * mechanical conflict-fix route (`isConflictBounce`) would dispatch a FIX SESSION at this PR: wasted work at
 * best (there is nothing left to fix), and at worst a fixer "resolving" the apparent conflict by reverting the
 * carrier PR's later additions.
 *
 * WHY A PLAIN `git merge-tree`/CURRENT-CONTENT DIFF IS NOT ROBUST ENOUGH HERE (measured on the live PR).
 *   - `git merge-tree --write-tree origin/main <head>` (the same primitive
 *     `we:scripts/prune-landed-lanes.mjs#classifyLaneBranch` uses for a lane REF) reports `CONFLICT (add/add)`
 *     for both files #2752 touches: git's add/add short-circuit never attempts a text merge when the computed
 *     merge-base predates either side introducing the path, so it cannot see that one side is a pure subset of
 *     the other.
 *   - `git diff <head> origin/main -- <file>` is NOT empty either: `main`'s current version was FURTHER
 *     refined after the carrier PR landed it (a rewritten line, an added test case) — a byte-identical-to-HEAD
 *     check is exactly the false negative this module exists to avoid.
 *
 * THE SIGNAL THAT IS ROBUST: BLOB IDENTITY AT SOME POINT IN MAIN'S OWN HISTORY SINCE THE PR'S BASE, PER FILE. `main`'s commit log
 * for a path is the sequence of every distinct version that path has ever held on `main`. If the open PR's
 * CURRENT blob for a file is byte-identical to SOME commit's blob for that same path — not necessarily the
 * CURRENT one — then that exact content was, at some point, actually incorporated into `main`, whatever
 * happened to it afterward. This is invariant under: a rebase of the open PR (blob identity does not care
 * about commit graph shape), and later refinement on `main` (the match can sit anywhere in the log, not just
 * at the tip). Confirmed live: `git rev-parse 253d75c2b:scripts/lib/critical-work.mjs` matches the blob at
 * commit `22faaaa91` on `origin/main` (part of PR #2759, itself a genuinely different tip than #2759's own
 * merge commit — an ordinary merge carries every original commit along, not just its own).
 *
 * BOUNDED TO `<merge-base>..main`, NEVER ALL OF MAIN'S HISTORY (PR #2769 review). A match that predates the PR's
 * own merge-base with `main` proves nothing about delivery: a PR that deliberately RESTORES a file to an old
 * version would match that old commit while `main` still holds something else. Only a commit `main` gained
 * AFTER the PR branched off can have carried the PR's content there. The same range bounds a DELETION: it is
 * landed only when the path is gone from `main`'s tip AND a commit in that range deleted it.
 *
 * WHAT THIS MODULE DOES NOT DO: it does not run `git`, `gh`, or touch the filesystem — every per-file match is
 * computed by the IO shell (`we:scripts/conveyor/reconcile-pass.mjs#enrichPrsWithAlreadyLandedFacts`) and
 * handed in. This file only decides, from that evidence, the verdict and the (best-effort, never-guessed)
 * carrier attribution.
 *
 * REPORT, NEVER BULK-FLIP FOR ATTRIBUTION (mirrors `we:scripts/backlog-stranded-sweep.mjs`'s own doctrine): the
 * CONTAINMENT verdict is authoritative once every file matches (this is a per-file EXACT content match, not a
 * heuristic), but WHICH pr carried it is attributed only when every matched commit resolves to the exact same
 * single PR number. Two matched files landing via two different PRs, or a commit with no PR association at
 * all (`GET /repos/{o}/{r}/commits/{sha}/pulls` returning nothing — e.g. a direct push), NEVER invents a name;
 * the caller still gets the (true) containment fact, with `carrierPr: null`.
 */

/**
 * we:scripts/lib/already-landed-content.mjs#parseRawDiffZ — parse `git diff --raw -z --no-renames --no-abbrev
 * <base> <head>` into one record per changed path: `{status, path, dstMode, dstBlob}`. Pure.
 *
 * WHY THE RAW DIFF, NOT `gh pr view --json files` (PR #2769 review). A bare path list drops three facts the
 * containment verdict needs: a rename's SOURCE path (`--no-renames` splits it into `D <src>` + `A <dst>`, so the
 * deletion half is checked on its own and a source still alive on `main` disqualifies the verdict), a file-mode
 * change (`dstMode` is compared alongside the blob — a `chmod +x` whose blob never changed is not "landed" just
 * because the old blob is on `main`), and the status itself (a `T`ype change, or anything else unrecognised,
 * reads as unsupported and never matches). Malformed input yields `[]` — never a guess.
 * @param {string} text
 * @returns {Array<{status:string, path:string, dstMode:string, dstBlob:string}>}
 */
export function parseRawDiffZ(text) {
  const tokens = String(text || '').split('\0');
  const out = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const meta = tokens[i].replace(/^\n+/, '');
    const path = tokens[i + 1];
    const m = /^:(\d{6}) (\d{6}) ([0-9a-f]{7,64}) ([0-9a-f]{7,64}) ([A-Z])\d*$/.exec(meta);
    if (!m || !path) return [];
    out.push({ status: m[5], path, dstMode: m[2], dstBlob: m[4] });
  }
  return out;
}

/**
 * we:scripts/lib/already-landed-content.mjs#computeAlreadyLandedVerdict — is EVERY file this PR touches
 * byte-identical to some commit's blob on `main`'s own history for that same path? Pure.
 *
 * `landed` is true only when `fileMatches` is non-empty and every entry carries a non-null `matchedCommit` —
 * an empty `fileMatches` (a PR whose files could not even be read) is never "landed": absence of evidence is
 * not evidence of containment, the same direction every other strict check in this codebase already takes
 * (`we:scripts/backlog-stranded-sweep.mjs#commitSubjectDeliversItem`'s own "never guess" doctrine).
 * @param {Array<{file:string, matchedCommit:(string|null)}>} fileMatches
 * @returns {{landed:boolean, unmatchedFiles:string[]}}
 */
export function computeAlreadyLandedVerdict(fileMatches) {
  const list = Array.isArray(fileMatches) ? fileMatches : [];
  // Every unmatched (or malformed — a `null`/`undefined` entry counts as unmatched) row disqualifies `landed`,
  // even one whose own `file` name cannot be read — `unmatchedFiles` (the human-readable list) is a NARROWER
  // view for reporting than `bad.length` (the actual gate), so a nameless bad row still refuses `landed`.
  const bad = list.filter((m) => !m || !m.matchedCommit);
  const unmatchedFiles = bad.map((m) => m?.file).filter(Boolean);
  return { landed: list.length > 0 && bad.length === 0, unmatchedFiles };
}

/**
 * we:scripts/lib/already-landed-content.mjs#attributeCarrierPr — which single PR carried this content onto
 * `main`, if that is unambiguous. Pure.
 *
 * `pullsByCommit` maps each `matchedCommit` (as computed by {@link computeAlreadyLandedVerdict}'s caller) to
 * the PR number(s) GitHub associates with that commit (`GET /repos/{o}/{r}/commits/{sha}/pulls`, one call per
 * DISTINCT matched commit — never per file, so a PR touching many files this PR also touches costs one read).
 * Attribution fires ONLY when:
 *   1. every matched commit maps to at least one PR, AND
 *   2. the INTERSECTION of every commit's PR set is exactly one PR number.
 * A commit with zero associated PRs (a direct push, a squash-merge whose individual pre-squash commits carry
 * no association), or two matched commits whose PR sets share no common member, both resolve to `null` — the
 * containment fact still stands, this function just declines to name a carrier rather than guess one.
 * @param {Array<{file:string, matchedCommit:(string|null)}>} fileMatches
 * @param {Record<string, number[]>} pullsByCommit
 * @returns {number|null}
 */
export function attributeCarrierPr(fileMatches, pullsByCommit) {
  const list = Array.isArray(fileMatches) ? fileMatches : [];
  const commits = [...new Set(list.map((m) => m?.matchedCommit).filter(Boolean))];
  if (!commits.length) return null;
  let common = null;
  for (const c of commits) {
    const prs = new Set((pullsByCommit && pullsByCommit[c]) || []);
    if (!prs.size) return null; // an unattributed commit — never guess past it
    common = common === null ? prs : new Set([...common].filter((n) => prs.has(n)));
    if (!common.size) return null;
  }
  return common && common.size === 1 ? [...common][0] : null;
}
