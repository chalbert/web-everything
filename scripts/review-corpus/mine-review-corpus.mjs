#!/usr/bin/env node
/**
 * @file scripts/review-corpus/mine-review-corpus.mjs
 * @description Mine this repo's own recorded review verdicts into replayable fixtures, so a candidate
 * gate or reviewer can be scored against what the real reviews actually found. Same shape as
 * `we:scripts/mine-golden-corpus.mjs` (#2270): git history + recorded history in, deterministic
 * input+expected fixtures out, idempotent on rerun.
 *
 * WHY THIS EXISTS. Every structured `review-pr` verdict comment records `Net basis: <base>..<head>` —
 * the exact revision range that review judged. Those commits are all still reachable, so each historical
 * review is reconstructable EXACTLY: `git diff <base>..<head>` is the input the juror saw, and the
 * findings in that comment are the labels. That turns 92 structured verdicts — 87 DISTINCT revision
 * ranges, since a re-review at an unchanged head repeats a range — into a scored corpus.
 *
 * RETRACTED — this sentence used to read *"That turns 87 recorded verdicts into a scored corpus."* 87 is
 * the number of distinct RANGES, not of verdicts; `cases/index.json` records `cases: 92`, and 62 further
 * verdict comments were skipped as unstructured. Counted 2026-08-26 over `cases/*.json`.
 *
 * READ-ONLY, BY CONSTRUCTION — and the construction is TWO guards over ONE shell-out. Everything this file
 * reads from GitHub goes through `ghExec`, which calls:
 *   - `assertReadOnlyGh` — the `gh` subcommand must be one of TWO allowed reads, `gh api` or `gh pr list`;
 *   - `assertReadOnlyEndpoint` — for `gh api`, the argv must carry no write flag in ANY spelling `gh`
 *     accepts (`--method`/`-X`, `--field`/`-f`, `--raw-field`/`-F`, `--input`, each of them space-separated,
 *     `=`-joined, OR — because `gh` is cobra/pflag-based — concatenated as `-XPOST`; see
 *     `WRITE_FLAG_PATTERNS` and the retraction on it), and the endpoint must match one of a
 *     THREE-shape read allowlist: `/issues/{n}/comments`, `/pulls/{n}`, `/pulls/{n}/files`.
 * Of those three shapes the code today calls exactly ONE, `/issues/{n}/comments` (the single `ghJson` call
 * site, in `mineRepo`); the other two are allowlisted ahead of the callers that will read a PR's head/base
 * and its file list. The corpus is mined FROM the PRs and must never write back to them.
 *
 * RETRACTED — this paragraph used to read *"It calls `gh api` on `/issues/{n}/comments` and `/pulls/{n}` and
 * nothing else … `assertReadOnlyEndpoint` fails closed on any endpoint that is not a plain GET of those two
 * shapes."* Every clause of that was wrong. The guard allowlists THREE endpoint shapes, not two; the code
 * calls ONE of them, not two; and "nothing else" was false in a way the sentence hid — `mineRepo` shelled
 * `gh pr list` DIRECTLY, a second call site that reached GitHub without passing `assertReadOnlyEndpoint` at
 * all. The listing was a read, so nothing was ever written; but the guarantee the sentence advertised did not
 * hold, because one word (`gh pr edit`) would have been refused by nothing. `assertReadOnlyGh` + `ghExec` now
 * close that path, and `__tests__/mine-review-corpus.test.mjs` pins the allowlist shape by shape AND counts
 * the `gh` call sites, so neither claim can rot silently again.
 *
 * WHAT A LABEL IS, AND IS NOT — read this before dividing by any number out of this corpus. The cases
 * record what a review SAID, not what was true. A finding marked `CONFIRMED` is confirmed BY THE REVIEWING
 * SESSION ABOUT ITS OWN FINDING; no second party ever adjudicated it, and a peer session that authored many
 * of the underlying PRs reports finding real errors in several of those reviews after the fact. The labels
 * are therefore fallible INDIVIDUALLY as well as incomplete COLLECTIVELY — the pooling problem twice over.
 * Every rate derived from them is sound as a RELATIVE comparison between reviewers scored on the same pool,
 * and unsound as an absolute catch rate. `index.json.provenance` carries the same sentence, so a reader who
 * has only the mined tree and never saw the PR page still gets the weaker, correct reading (#1569 r3 f9).
 *
 * THE `presentAt` LABEL — the one that makes this worth building. A finding raised in round 4 was very
 * often already there in round 1; the reviewer just hadn't looked. We can prove that per finding rather
 * than assume it: a finding on `<path>` found at head `H_found` was PRESENT at an earlier head `H` iff
 * `git diff H H_found -- <path>` is empty, i.e. the file did not change between them. That gives each
 * round a defensible "what was findable here but not found" set, which is the recall baseline the whole
 * experiment is measured against.
 *
 * Usage:
 *   node scripts/review-corpus/mine-review-corpus.mjs [--repo=owner/name] [--limit=200]
 *                                                     [--out=scripts/review-corpus/cases]
 *                                                     [--comments-dir=<dir>]   # offline: pre-fetched comment dumps
 *
 * Output: `<out>/<pr>-r<round>.json` per verdict + `<out>/index.json` (counts, provenance, corpus as-of
 * marker taken from the newest mined commit date — never a wall clock, so a rerun is byte-stable).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

/* ------------------------------------------------------------------ read-only guard */

/**
 * The read allowlist, as data. THREE shapes — the count the header states, and the count the test asserts.
 * Every entry is anchored at both ends so a path that merely CONTAINS an allowed shape cannot pass.
 */
export const ALLOWED_READ_ENDPOINTS = Object.freeze([
  /^repos\/[\w.-]+\/[\w.-]+\/issues\/\d+\/comments$/,
  /^repos\/[\w.-]+\/[\w.-]+\/pulls\/\d+$/,
  /^repos\/[\w.-]+\/[\w.-]+\/pulls\/\d+\/files$/,
]);

/**
 * A write flag, in EVERY shape `gh` accepts one. `gh` is built on cobra/pflag, which lets a SHORTHAND flag
 * carry its value with no separator at all — `-XPOST` is the same invocation as `-X POST`, the same
 * mechanism as `docker -p8080:80` — and lets shorthands cluster, so the value-taking letter can sit at the
 * end of a run of boolean ones (`-qXPOST`). Hence the short-flag pattern matches a LEADING single dash
 * followed by any run of letters ending in `X`, `f` or `F`, rather than the whole token: a token-equality
 * test only ever catches the space-separated spelling.
 *
 * The long forms are matched on `(=|$)` so `--methodical` (were there such a flag) is not mistaken for one.
 * `--input` is here because `gh api --input body.json` sends a body, which makes the request a POST without
 * `--method` ever appearing.
 *
 * RETRACTED — this test used to read
 * `/^--method(=|$)/.test(a) || /^-X$/.test(a) || /^--field(=|$)/.test(a) || /^-f$/.test(a)`, and the file
 * header claimed on the strength of it that the guard refuses "any argv carrying a write flag". That was
 * wrong. Anchoring the short flags at BOTH ends (`/^-X$/`, `/^-f$/`) meant the guard refused `-X POST` and
 * waved through `-XPOST`; verified live before the fix, `assertReadOnlyEndpoint(<allowlisted>, [..., '-XPOST'])`
 * returned true with no throw, as did `-fbody=…`. `-F`/`--raw-field` and `--input` — two more ways to put a
 * body on the request — were not tested for at all, in any spelling. So `gh api <allowlisted-endpoint> -XPOST`
 * would have reached GitHub as a WRITE against the very PRs this corpus is mined from (#1571 review, f6).
 * Exported so the test suite asserts the patterns rather than a reader trusting the sentence above them.
 */
export const WRITE_FLAG_PATTERNS = Object.freeze([
  /^--method(=|$)/,
  /^--field(=|$)/,
  /^--raw-field(=|$)/,
  /^--input(=|$)/,
  /^-[a-zA-Z]*[XfF]/,
]);

/**
 * Fail closed on anything that is not one of the THREE read shapes this miner is allowed to use (see the
 * header for the list, and for what is retracted). The point is not that `gh api` defaults to GET — it is
 * that a future edit adding `--method POST` or a `/comments` write must not silently start mutating the pull
 * requests this corpus is mined from.
 *
 * `ALLOWED_READ_ENDPOINTS` above is the ONLY statement of that set; anything describing it in prose — here, the header,
 * the PR body — is a restatement and must be checked against it. `ALLOWED_READ_ENDPOINTS` is exported so a
 * test can assert the count rather than a reader having to trust a sentence (#1569 review, `claim-accuracy`).
 *
 * @param {string} endpoint the `gh api` endpoint path.
 * @param {string[]} argv the full argv handed to `gh`.
 */
export function assertReadOnlyEndpoint(endpoint, argv = []) {
  const mutating = argv.some((a) => WRITE_FLAG_PATTERNS.some((re) => re.test(a)));
  if (mutating) {
    throw new Error(`mine-review-corpus: REFUSED — this miner is read-only; argv carries a write flag: ${argv.join(' ')}`);
  }
  const ok = ALLOWED_READ_ENDPOINTS.some((re) => re.test(endpoint));
  if (!ok) {
    throw new Error(`mine-review-corpus: REFUSED — endpoint is not an allowed read: ${endpoint}`);
  }
  return true;
}

/**
 * The `gh` subcommands this miner may run, as data. `api` is the guarded one — `assertReadOnlyGh` hands it
 * on to `assertReadOnlyEndpoint` for the endpoint check. `pr list` is a pure listing with no write form.
 */
export const ALLOWED_GH_COMMANDS = Object.freeze([['api'], ['pr', 'list']]);

/**
 * Fail closed on any `gh` invocation this miner is not allowed to make. PURE (throws or returns true).
 *
 * WHY IT IS SEPARATE FROM `assertReadOnlyEndpoint`. That guard only ever saw `gh api` argv. The PR-number
 * listing shelled `gh pr list` DIRECTLY, so a whole second `gh` call site sat outside the read-only guarantee
 * the header advertises — a later edit to that line (`gh pr edit`, `gh pr close`, and they are one word
 * apart) would have been refused by nothing. Both call sites now funnel through `ghExec`, which calls this.
 *
 * @param {string[]} argv the full argv handed to `gh`.
 * @returns {true}
 */
export function assertReadOnlyGh(argv = []) {
  const command = ALLOWED_GH_COMMANDS.find((c) => c.every((word, i) => argv[i] === word));
  if (!command) {
    throw new Error(
      `mine-review-corpus: REFUSED — this miner is read-only; \`gh ${argv.join(' ')}\` is not one of its `
      + `allowed reads (${ALLOWED_GH_COMMANDS.map((c) => `gh ${c.join(' ')}`).join(', ')}).`,
    );
  }
  if (command[0] === 'api') assertReadOnlyEndpoint(argv[1] ?? '', argv);
  return true;
}

/**
 * THE ONE PLACE THIS FILE SHELLS `gh`. Everything the miner reads from GitHub goes through here, so the
 * guards above are unbypassable by construction rather than by convention — a second `execFileSync('gh', …)`
 * anywhere in this file would route around them, and the test suite counts the call sites for exactly that
 * reason.
 * @param {string[]} argv the full argv handed to `gh`.
 * @returns {string} stdout.
 */
function ghExec(argv) {
  assertReadOnlyGh(argv);
  return execFileSync('gh', argv, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function ghJson(endpoint, { paginate = false } = {}) {
  const argv = ['api', endpoint, ...(paginate ? ['--paginate'] : [])];
  const out = ghExec(argv);
  if (paginate) {
    // --paginate concatenates JSON arrays; normalise to one array.
    const chunks = out.replace(/\]\s*\[/g, ',').trim();
    return JSON.parse(chunks || '[]');
  }
  return JSON.parse(out || 'null');
}

/* ------------------------------------------------------------------ parsing */

/**
 * The provenance stamped into `index.json`, so the caveat travels WITH the corpus rather than living only
 * on a PR page a later consumer will never read. Exported and pinned by a test against the committed
 * `cases/index.json`, because the whole failure mode this file keeps hitting is a caveat that is stated in
 * one place and absent from the other.
 *
 * RETRACTED — this used to read *"Mined read-only from recorded review-pr verdict comments; revision ranges
 * are the verdicts' own `Net basis` lines."* Nothing in it was false, but it disclaimed nothing: a reader of
 * the tree had no way to learn that a `CONFIRMED` label is the reviewer's own unadjudicated self-assessment,
 * so the stronger reading — "39 verified defects" — was the one the file invited.
 */
export const PROVENANCE = 'Mined read-only from recorded review-pr verdict comments; revision ranges are the '
  + "verdicts' own `Net basis` lines. LABEL CAVEAT: a CONFIRMED label is the reviewing session's own "
  + 'unadjudicated self-assessment of its own finding, not an adjudicated fact — the labels are fallible '
  + 'individually and incomplete collectively, so rates derived from them are sound only as a RELATIVE '
  + 'comparison between reviewers scored on this same pool, never as an absolute catch rate.';

const VERDICT_ACCEPT = '✅ review — accepted';
const VERDICT_CHANGES = '🔁 review — changes requested';

/** Split a raw comment body stream into individual verdict comments, in recorded order. */
export function verdictComments(bodies) {
  return bodies.filter((b) => typeof b === 'string' && (b.includes(VERDICT_ACCEPT) || b.includes(VERDICT_CHANGES)));
}

/**
 * Pull the structured facts out of one `review-pr` verdict comment. Returns null for the older
 * unstructured verdict format (no `Net basis:` line) — those carry no revision range, so they are not
 * replayable and are deliberately left out of the corpus rather than guessed at.
 * @param {string} body the comment body.
 */
export function parseVerdict(body) {
  const basis = body.match(/Net basis: `([0-9a-f]{40})\.\.([0-9a-f]{40})`/);
  if (!basis) return null;
  const decision = body.match(/\*\*Decision:\*\* `(\w+)`/);
  const headline = body.includes(VERDICT_ACCEPT) ? 'accepted' : 'changes';
  const findingsCount = body.match(/### Findings \((\d+)\)/);
  const singleLens = /a SINGLE-LENS run/.test(body);
  const lensRows = [...body.matchAll(/^\|\s*([a-z][a-z-]+)\s*\|\s*(mandatory|advisory)\s*\|\s*([a-z]+)\s*\|/gm)]
    .map(([, lens, weight, verdict]) => ({ lens, weight, verdict }));
  return {
    base: basis[1],
    head: basis[2],
    headline,
    decision: decision ? decision[1] : null,
    declaredFindings: findingsCount ? Number(findingsCount[1]) : null,
    singleLens,
    lensRows,
    findings: parseFindings(body),
  };
}

/**
 * Parse the finding bullets under `### Findings (N)`. Each is rendered as
 *   **<category>** (n)
 *   - `path:line` — <what> — <consequence> _[CONFIRMED]_ _[impact if unfixed: <level>]_
 * A bullet with no leading `path` locus is a prose note, not a located finding, and is skipped: the
 * scorer can only check a gate against a place, so an unlocated finding is not a usable label.
 */
export function parseFindings(body) {
  const section = body.split(/### Findings \(\d+\)/)[1];
  if (!section) return [];
  const upto = section.split(/\n---\n/)[0];
  const out = [];
  let category = null;
  for (const line of upto.split('\n')) {
    const cat = line.match(/^\*\*([a-z][a-z-]+)\*\*\s*\((\d+)\)\s*$/);
    if (cat) { category = cat[1]; continue; }
    const bullet = line.match(/^- `([^`]+)`\s+—\s+(.*)$/);
    if (!bullet) continue;
    const locus = bullet[1];
    const rest = bullet[2];
    const m = locus.match(/^(.*?):(\d+)$/);
    const path = m ? m[1] : locus;
    const lineNo = m ? Number(m[2]) : null;
    // A locus must look like a repo path; `npm run check:standards` and bare `#3233` are prose, not places.
    if (!/^[\w.@-]+(\/[\w.@ -]+)+$/.test(path.replace(/^we:/, ''))) continue;
    const impact = rest.match(/\[impact if unfixed: ([a-z-]+)\]/);
    const confirmed = /_\[CONFIRMED\]_/.test(rest);
    const plausible = /_\[PLAUSIBLE\]_/.test(rest);
    if (!confirmed && !plausible) continue; // unverified narration, not a label
    out.push({
      path: path.replace(/^we:/, ''),
      line: lineNo,
      category,
      impact: impact ? impact[1] : null,
      verdict: confirmed ? 'CONFIRMED' : 'PLAUSIBLE',
      summary: rest.split(' — ')[0].slice(0, 400),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ git */

/**
 * A git PROBE. Every caller below asks git a yes/no question and treats a non-zero exit as "no", so git's
 * own stderr is never the answer to anything — it is only noise on the operator's terminal, interleaved
 * with the miner's report. `stderr: 'ignore'` keeps the failure (the throw) and drops the chatter.
 */
function git(args, { cwd = ROOT } = {}) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

export function commitExists(sha, { cwd = ROOT } = {}) {
  try { git(['cat-file', '-e', `${sha}^{commit}`], { cwd }); return true; } catch { return false; }
}

/**
 * Was `path` identical at `headA` and `headB`? Used to prove a later round's finding was already
 * present at an earlier round's head — if the file never changed between the two, whatever was found
 * later was findable earlier.
 */
export function pathUnchangedBetween(headA, headB, path, { cwd = ROOT } = {}) {
  if (headA === headB) return true;
  try {
    const out = git(['diff', '--name-only', headA, headB, '--', path], { cwd });
    return out === '';
  } catch { return false; }
}

export function changedFiles(base, head, { cwd = ROOT } = {}) {
  try { return git(['diff', '--name-only', base, head]).split('\n').filter(Boolean); } catch { return []; }
}

function commitDate(sha, { cwd = ROOT } = {}) {
  try { return git(['show', '-s', '--format=%cI', sha], { cwd }); } catch { return null; }
}

/* ------------------------------------------------------------------ mining */

/**
 * Build the case set for one PR from its ordered verdict comments. Rounds are 1-based in recorded
 * order. Each case gets `missedHere`: the findings raised in a LATER round whose file was byte-identical
 * at this round's head — i.e. present and findable at this round, and not found.
 */
export function buildCases(pr, verdicts, { cwd = ROOT } = {}) {
  const cases = [];
  for (let i = 0; i < verdicts.length; i += 1) {
    const v = verdicts[i];
    const missed = [];
    for (let j = i + 1; j < verdicts.length; j += 1) {
      for (const f of verdicts[j].findings) {
        if (pathUnchangedBetween(v.head, verdicts[j].head, f.path, { cwd })) {
          missed.push({ ...f, foundAtRound: j + 1, provenBy: `git diff ${v.head.slice(0, 8)} ${verdicts[j].head.slice(0, 8)} -- ${f.path} is empty` });
        }
      }
    }
    cases.push({
      pr,
      round: i + 1,
      totalRounds: verdicts.length,
      base: v.base,
      head: v.head,
      headline: v.headline,
      decision: v.decision,
      singleLens: v.singleLens,
      lensRows: v.lensRows,
      declaredFindings: v.declaredFindings,
      changedFiles: changedFiles(v.base, v.head, { cwd }),
      findings: v.findings,
      missedHere: missed,
    });
  }
  return cases;
}

function parseArgs(argv) {
  const o = { repo: 'chalbert/web-everything', limit: 200, out: 'scripts/review-corpus/cases', commentsDir: null };
  for (const a of argv) {
    const m = a.match(/^--([\w-]+)(?:=(.*))?$/);
    if (!m) continue;
    if (m[1] === 'repo') o.repo = m[2];
    if (m[1] === 'limit') o.limit = Number(m[2]);
    if (m[1] === 'out') o.out = m[2];
    if (m[1] === 'comments-dir') o.commentsDir = m[2];
  }
  return o;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const outDir = resolve(ROOT, opts.out);
  const [owner, name] = opts.repo.split('/');

  let prNumbers = [];
  let bodiesFor = null;

  if (opts.commentsDir) {
    // Offline path: a directory of `<pr>.json` arrays previously fetched with the same GET endpoint.
    const dir = resolve(ROOT, opts.commentsDir);
    prNumbers = readdirSync(dir).filter((f) => /^\d+\.json$/.test(f)).map((f) => Number(f.replace('.json', ''))).sort((a, b) => a - b);
    bodiesFor = (n) => JSON.parse(readFileSync(join(dir, `${n}.json`), 'utf8')).map((c) => c.body);
  } else {
    const list = ghExec(['pr', 'list', '--repo', opts.repo, '--state', 'all', '--limit', String(opts.limit), '--json', 'number']);
    prNumbers = JSON.parse(list).map((p) => p.number).sort((a, b) => a - b);
    bodiesFor = (n) => ghJson(`repos/${owner}/${name}/issues/${n}/comments`, { paginate: true }).map((c) => c.body);
  }

  if (existsSync(outDir)) rmSync(outDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  let kept = 0; let skippedUnreachable = 0; let skippedUnstructured = 0;
  let newestDate = null;
  const perPr = [];

  for (const n of prNumbers) {
    let bodies;
    try { bodies = bodiesFor(n); } catch { continue; }
    const parsed = verdictComments(bodies).map(parseVerdict);
    const structured = parsed.filter(Boolean);
    skippedUnstructured += parsed.length - structured.length;
    const reachable = structured.filter((v) => {
      const ok = commitExists(v.base) && commitExists(v.head);
      if (!ok) skippedUnreachable += 1;
      return ok;
    });
    if (!reachable.length) continue;

    const cases = buildCases(n, reachable);
    for (const c of cases) {
      writeFileSync(join(outDir, `${c.pr}-r${c.round}.json`), `${JSON.stringify(c, null, 2)}\n`);
      kept += 1;
      const d = commitDate(c.head);
      if (d && (!newestDate || d > newestDate)) newestDate = d;
    }
    perPr.push({ pr: n, rounds: cases.length, findings: cases.reduce((a, c) => a + c.findings.length, 0), missed: cases.reduce((a, c) => a + c.missedHere.length, 0) });
  }

  const index = {
    schema: 1,
    repo: opts.repo,
    corpusAsOf: newestDate,
    cases: kept,
    prs: perPr.length,
    skipped: { unreachableCommits: skippedUnreachable, unstructuredVerdicts: skippedUnstructured },
    totals: {
      findings: perPr.reduce((a, p) => a + p.findings, 0),
      provenMissed: perPr.reduce((a, p) => a + p.missed, 0),
    },
    provenance: PROVENANCE,
    perPr,
  };
  writeFileSync(join(outDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  process.stdout.write(`mined ${kept} cases across ${perPr.length} PRs → ${opts.out}\n`);
  process.stdout.write(`  findings labelled: ${index.totals.findings}   proven-missed labels: ${index.totals.provenMissed}\n`);
  process.stdout.write(`  skipped: ${skippedUnreachable} unreachable, ${skippedUnstructured} unstructured\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => { process.stderr.write(`${e.stack}\n`); process.exit(1); });
}
