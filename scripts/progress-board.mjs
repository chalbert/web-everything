#!/usr/bin/env node
/**
 * progress-board.mjs — the operator's published progress board (item `x9t5i5a`).
 *
 * WHAT IT IS. A single fixed-path HTML page that answers "what is the plan, and where is it?" — published
 * once as an Artifact and then REFRESHED MECHANICALLY. The model never sees or writes the markup: this
 * script owns every byte of the page. One update costs exactly **one Bash call** (a verb below) plus
 * **one Artifact call** (re-publish the same fixed path).
 *
 * WHERE THE CONTENT COMES FROM — two halves, deliberately split by who can know it:
 *   • DERIVED (live, free): open + recently-merged pull requests, read through `gh pr list`, each reduced
 *     to ONE status by `classifyPr` — needs-human / bounced / ci-red / conflicted / needs-review / queued /
 *     landed. Nothing about PR state is ever typed by hand, so the board cannot drift from GitHub.
 *   • HAND-MAINTAINED (tiny): `reports/progress-board.json` — the plan items and the decisions waiting on
 *     the operator. These are intentions; no API knows them. The model edits them ONLY through the verbs
 *     below, never by hand — a hand-edited state file is how the "mechanical" property gets lost.
 *
 * DEGRADATION IS A FEATURE. `gh` missing, unauthenticated, offline or rate-limited must not lose the page.
 * Every successful fetch is cached to a sidecar (`reports/.progress-board-cache.json`, gitignored); a failed
 * fetch renders the cache behind a visible "stale" banner, and with no cache at all the page still renders
 * with an empty PR section and an honest note. A stale-but-rendered board beats a crash.
 *
 * The HAND-MAINTAINED half degrades the same way, and it has to: that file is git-tracked, so an unresolved
 * merge-conflict marker is enough to make it invalid JSON. `loadState` never throws — it returns the empty
 * state carrying `[STATE_ERROR]`, the page renders behind a red "the plan could not be read" banner, and
 * every verb is refused until it is fixed by hand (saving an empty plan over a recoverable one is the single
 * unrecoverable move here). That is a DIFFERENT failure from an unanswerable decision — see `validateDecisions`.
 *
 * WHERE IT MAY WRITE. `--out=` and `--state=` are caller-controlled, so `assertWritablePath` refuses any path
 * that lands inside this repository but outside `reports/` — a tracked file must never be overwritten.
 * Outside the repository is allowed and normal: the board is published from a scratchpad path.
 *
 * THE URL-STABILITY RULE (why `artifactUrl` lives in the state file). Re-publishing the same file path keeps
 * the artifact URL only WITHIN the conversation that first published it. From any other session the publisher
 * must pass the stored URL as the Artifact `url` parameter or a NEW url is minted and the operator's bookmark
 * dies. So the URL is stored (`--url=…`) and printed on every render — see `we:skills-src/progress-board/SKILL.md`.
 *
 * CLI (every mutation re-renders; all verbs are idempotent; output is one line):
 *   node scripts/progress-board.mjs                      # re-render from live state
 *   node scripts/progress-board.mjs --start=<id>         # item → in-progress (also clears a blocker)
 *   node scripts/progress-board.mjs --done=<id>          # item → done
 *   node scripts/progress-board.mjs --block=<id> --why="…"
 *   node scripts/progress-board.mjs --note=<id> --text="…"   # empty text clears the note
 *   node scripts/progress-board.mjs --add="<title>" [--phase=<n>]
 *   node scripts/progress-board.mjs --decide=<id>        # a decision was taken by the operator
 *   node scripts/progress-board.mjs --url=<artifact-url> # store the published URL (do this once, after publishing)
 *
 * DECISIONS ARE THE PAGE'S ONLY ASK, so they carry more than a title, and that is ENFORCED rather than asked
 * for. Anything marked `awaiting` must be answerable from the page alone — a `question`, at least two real
 * `options` with exactly one recommended, and `ifNothing`. The tool refuses the flip to `awaiting` and
 * refuses to render a board that carries an incomplete one (exit 1, naming the id and every missing field);
 * an unfinished decision waits in `draft`, which never reaches the operator's section. `why` and `evidence`
 * are strongly encouraged and not blocking. Every field has a verb; none is ever hand-typed into JSON:
 *   node scripts/progress-board.mjs --decision-add="<title>" --question="…" --if-nothing="…" [--id=<id>] [--status=<s>]
 *   node scripts/progress-board.mjs --decision-set=<id> --field=<name> --value="…"   # empty --value clears
 *   node scripts/progress-board.mjs --decision-option=<id> --label="…" --detail="…" [--recommend]
 *   node scripts/progress-board.mjs --decision-evidence=<id> --text="…"              # empty --text clears all
 *
 * Flags: --state=<path> --out=<path> --no-gh --json --help.
 * Env:   WE_BOARD_NO_GH=1 (never shell out to gh), WE_BOARD_NOW=<iso> (freeze the stamp, for tests).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_STATE = join(ROOT, 'reports', 'progress-board.json');
const DEFAULT_OUT = join(ROOT, 'reports', 'progress-board.html');
const cachePathFor = (statePath) => join(dirname(statePath), '.progress-board-cache.json');

// ── Where this script may write ───────────────────────────────────────────────

/** Lexical `..` cannot escape a symlinked directory, so resolve the PARENT for real and re-attach the name. */
function realish(p) {
  const abs = resolve(p);
  const parent = dirname(abs);
  try {
    return join(realpathSync(parent), basename(abs));
  } catch {
    return abs; // the directory does not exist yet — nothing to follow, and mkdir will create it under ROOT rules
  }
}

const within = (dir, p) => {
  const rel = relative(dir, p);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};

/** Repo-relative inside the repo, absolute outside it — never a wall of `../..` back out of the checkout. */
const shortPath = (p) => (within(ROOT, resolve(p)) ? relative(ROOT, resolve(p)) : resolve(p));

/**
 * `--out=` and `--state=` are the only paths a caller controls, and the thing worth protecting is a TRACKED
 * repository file: `--out=./package.json` would silently overwrite it. Writing OUTSIDE the repo is not the
 * danger and is in active use — the board is published from a scratchpad path — so the rule is deliberately
 * narrow: inside the repo, only `reports/` is writable; outside the repo, anywhere.
 *
 * @returns {string} the resolved path to use.
 */
export function assertWritablePath(p, flag) {
  const abs = realish(p);
  const root = realish(ROOT);
  if (!within(root, abs)) return abs; // outside the repository entirely — the caller's own disk, their call
  if (within(join(root, 'reports'), abs)) return abs;
  throw new Error(
    `refusing ${flag}=${p} — it resolves to ${relative(root, abs)} inside the repository, and the board may only write ` +
      `inside reports/ or to a path outside the repository entirely (overwriting a tracked file is never the intent).`,
  );
}

// ── State ─────────────────────────────────────────────────────────────────────

/** Item lifecycle. `blocked` is the only one that pulls an item into the operator's section. */
export const ITEM_STATUSES = ['todo', 'in-progress', 'blocked', 'done'];

/**
 * Decision lifecycle — four states, and the two middle ones carry the whole design:
 *   • `draft`    — being prepared. Not yet answerable, so it may NOT sit in the operator's section; it
 *                  renders low-emphasis near the bottom. This is the only place an incomplete decision may live.
 *   • `awaiting` — outstanding, and therefore COMPLETE: see `decisionGaps`. The operator has not ruled.
 *   • `queued`   — RULED, but deliberately deferred ("do it, when the priority is right"). It must stay on
 *                  the page (the ruling is a fact worth seeing) while reading as settled, so it renders in
 *                  its own section and is NEVER counted as needing the operator.
 *   • `taken`    — ruled and absorbed into the plan; the plan item now carries it, so it leaves the board.
 */
export const DECISION_STATUSES = ['draft', 'awaiting', 'queued', 'taken'];

/** The scalar decision fields `--decision-set` may write. `options` and `evidence` have their own verbs. */
export const DECISION_FIELDS = ['title', 'question', 'why', 'ifNothing', 'detail', 'status', 'preparedDate'];

/**
 * THE ENFORCED CONTRACT. A decision presented to the operator has to be ANSWERABLE FROM THE PAGE — that is
 * the whole reason the board exists, and it is not left to whoever writes the next entry to remember.
 *
 * Optional context is the same as no context: the next entry goes in as a bare title, the page slides back
 * into a list of one-liners nobody can act on, and a convention in the skill will not stop it. So the fields
 * are REQUIRED on anything marked `awaiting`, the tool refuses the run when one is missing, and the only way
 * to hold an unfinished decision is `draft` — which never reaches the operator's section.
 *
 * `why` and `evidence` are strongly encouraged and deliberately NOT blocking: a decision can be genuinely
 * self-evident in its question, and a hard requirement there would only train people to type filler.
 *
 * @returns {string[]} the missing pieces, in the order the operator would need them. Empty = answerable.
 */
export function decisionGaps(d) {
  const gaps = [];
  if (!d?.question) gaps.push('question (--decision-set --field=question)');
  const options = d?.options ?? [];
  if (options.length < 2) {
    // One option is not a decision, it is an announcement — and two is a perfectly good answer. The rule is
    // "at least two", never "pad to three".
    gaps.push(`options: at least two, this has ${options.length} (--decision-option --label=… --detail=…)`);
  } else if (options.filter((o) => o.recommended).length !== 1) {
    gaps.push('exactly one option marked recommended (--decision-option --label=… --recommend)');
  }
  if (!d?.ifNothing) gaps.push('ifNothing — what breaks if it is never answered (--decision-set --field=ifNothing)');
  return gaps;
}

/** Every unanswerable `awaiting` decision on the board, as one message each. Empty = the board may render. */
export function validateDecisions(state) {
  return (state.decisions ?? [])
    .filter((d) => (d.status ?? 'awaiting') === 'awaiting')
    .map((d) => [d, decisionGaps(d)])
    .filter(([, gaps]) => gaps.length)
    .map(([d, gaps]) => `decision "${d.id}" is awaiting the operator but cannot be answered from the page — missing ${gaps.join(' · ')}`);
}

const EMPTY_STATE = {
  title: 'Progress board',
  repo: null,
  artifactUrl: null,
  nextRuling: 1,
  phases: {},
  items: [],
  decisions: [],
};

/**
 * RULING NUMBERS — `R1`, `R2`, … — exist because the operator answers these in chat: "R6 — as recommended".
 * A number derived from position (whatever order a message happened to list them in) means nothing the next
 * day, so the number is IDENTITY, not position:
 *   • assigned once, at creation, from a counter that lives in the state file, and persisted;
 *   • never renumbered when the list is reordered or filtered;
 *   • never reused. A decision that is taken or dropped RETIRES its number with it — the counter only ever
 *     moves forward, so "R2" can never later mean something else.
 * A decision that predates the scheme is backfilled once, on the next run, and then never moves again.
 *
 * @returns {number} how many numbers were assigned (non-zero means the state needs saving).
 */
export function ensureRulingNumbers(state) {
  let assigned = 0;
  let next = Number.isInteger(state.nextRuling) && state.nextRuling > 0 ? state.nextRuling : 1;
  // Never hand back a number that is already in use — a hand-edited counter must not create a duplicate.
  const taken = new Set((state.decisions ?? []).map((d) => d?.ruling).filter(Boolean));
  for (const d of state.decisions ?? []) {
    if (d.ruling) continue;
    while (taken.has(`R${next}`)) next += 1;
    d.ruling = `R${next}`;
    taken.add(d.ruling);
    next += 1;
    assigned += 1;
  }
  state.nextRuling = next;
  return assigned;
}

/**
 * Carries "this state file could not be read" alongside the fallback state. A SYMBOL on purpose:
 * `JSON.stringify` and `Object.keys` both skip it, so `saveState` can never write the complaint back into
 * the file it is complaining about.
 */
export const STATE_ERROR = Symbol('progress-board.stateError');

/**
 * Read the hand-maintained half — and DEGRADE rather than die, the same contract the `gh` half already
 * honours. The realistic trigger is not exotic: this file is git-tracked, so an unresolved merge-conflict
 * marker makes it invalid JSON, and a crash there loses the whole page over a fixable typo.
 *
 * A broken file yields the empty state plus `[STATE_ERROR]`, which the CLI turns into a loud banner ON THE
 * PAGE and a refusal to write verbs (writing an empty plan over a recoverable file is the one genuinely
 * unrecoverable move). A well-formed file with an unanswerable decision is a DIFFERENT failure and is not
 * routed through here — see `validateDecisions`.
 */
export function loadState(statePath) {
  if (!existsSync(statePath)) return { ...EMPTY_STATE };

  let raw;
  try {
    raw = JSON.parse(readFileSync(statePath, 'utf8'));
  } catch (e) {
    const broken = { ...EMPTY_STATE };
    broken[STATE_ERROR] = `${shortPath(statePath)} is not valid JSON — ${e.message}`;
    return broken;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    const broken = { ...EMPTY_STATE };
    broken[STATE_ERROR] = `${shortPath(statePath)} does not hold a JSON object`;
    return broken;
  }

  // Right shape, wrong types: a string where a list belongs takes out every `.filter`/`.map` downstream.
  // Normalise to something renderable and say which key was wrong — never guess at what it meant.
  const state = { ...EMPTY_STATE, ...raw };
  const wrong = [];
  for (const key of ['items', 'decisions']) {
    if (!Array.isArray(state[key])) {
      wrong.push(key);
      state[key] = [];
    } else {
      state[key] = state[key].filter((x) => x && typeof x === 'object' && !Array.isArray(x));
      if (state[key].length !== raw[key]?.length) wrong.push(`${key} (entries that were not objects)`);
    }
  }
  if (!state.phases || typeof state.phases !== 'object' || Array.isArray(state.phases)) {
    wrong.push('phases');
    state.phases = {};
  }
  if (wrong.length) state[STATE_ERROR] = `${shortPath(statePath)} has the wrong type for: ${wrong.join(', ')} — ignored`;
  return state;
}

export function saveState(statePath, state) {
  // `_`-prefixed keys are notes to the next human reader; keep them at the TOP where they are read, rather
  // than wherever the merge with the defaults happens to leave them.
  const keys = Object.keys(state);
  const ordered = Object.fromEntries([...keys.filter((k) => k.startsWith('_')), ...keys.filter((k) => !k.startsWith('_'))].map((k) => [k, state[k]]));
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify(ordered, null, 2) + '\n');
}

/** A stable, readable id from a title — the `--add` verb's key, so re-adding the same title is a no-op. */
export function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'item';
}

// ── Live PR derivation ────────────────────────────────────────────────────────

const PR_FIELDS = 'number,title,labels,mergeStateStatus,statusCheckRollup,state,mergedAt';

/** Shell out to `gh`. Returns parsed JSON, or null on ANY failure (missing binary, auth, network, rate limit). */
function ghPrList(repo, args) {
  const argv = ['pr', 'list', '--json', PR_FIELDS, ...args];
  if (repo) argv.push('--repo', repo);
  try {
    const out = execFileSync('gh', argv, { encoding: 'utf8', timeout: 25_000, stdio: ['ignore', 'pipe', 'pipe'] });
    const parsed = JSON.parse(out);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** True when the check rollup carries at least one hard failure (vs merely pending). */
export function ciFailed(rollup) {
  return (rollup ?? []).some((c) => {
    const v = String(c?.conclusion ?? c?.state ?? '').toUpperCase();
    return v === 'FAILURE' || v === 'TIMED_OUT' || v === 'ACTION_REQUIRED' || v === 'STARTUP_FAILURE';
  });
}

/** True while any check is still running — the difference between "queued" and "queued, green". */
export function ciPending(rollup) {
  return (rollup ?? []).some((c) => {
    const v = String(c?.conclusion ?? c?.state ?? '').toUpperCase();
    return v === '' || v === 'PENDING' || v === 'IN_PROGRESS' || v === 'QUEUED' || v === 'WAITING';
  });
}

/**
 * The board's PR vocabulary, ranked by who is holding the ball. Lower `rank` = more consequential.
 *
 * `needs-human` is the ONLY status that means "the operator personally". Note that a reviewer-wants-changes
 * PR outranks it deliberately: `review:changes` moves the ball to the AUTHOR LANE, so a PR carrying both
 * labels is the author's problem, not the operator's — putting it in the operator's section would bury the
 * one PR that genuinely awaits their clear.
 */
export const PR_STATUS = Object.freeze({
  'needs-human': { rank: 0, sev: 'crit', label: 'awaiting your clear', gloss: 'a human must review this before it can land' },
  bounced: { rank: 1, sev: 'warn', label: 'changes requested', gloss: 'back with the author lane to fix and re-push' },
  'ci-red': { rank: 2, sev: 'warn', label: 'CI red', gloss: 'a required check failed' },
  conflicted: { rank: 3, sev: 'warn', label: 'conflicted', gloss: 'needs a rebase before it can merge' },
  'needs-review': { rank: 4, sev: 'info', label: 'awaiting review', gloss: 'parked for an independent review pass' },
  queued: { rank: 5, sev: 'info', label: 'queued to land', gloss: 'reviewed and waiting on the merge queue' },
  open: { rank: 6, sev: 'muted', label: 'open', gloss: 'in progress, no hold recorded' },
  landed: { rank: 7, sev: 'ok', label: 'landed', gloss: '' },
});

/** Reduce one raw `gh` PR record to a single board status. Pure — the whole derivation lives here. */
export function classifyPr(pr) {
  const labels = new Set((pr?.labels ?? []).map((l) => l?.name).filter(Boolean));
  const merge = String(pr?.mergeStateStatus ?? '').toUpperCase();
  if (String(pr?.state ?? '').toUpperCase() === 'MERGED') return 'landed';
  if (labels.has('review:changes')) return 'bounced';
  // `review:accepted` SUPERSEDES `review:human`: the human hold has already been cleared, so the PR is
  // waiting on the merge queue, not on the operator. Without this an accepted PR sits in their section forever.
  if (labels.has('review:human') && !labels.has('review:accepted')) return 'needs-human';
  if (ciFailed(pr?.statusCheckRollup)) return 'ci-red';
  if (merge === 'DIRTY' || merge === 'BEHIND') return 'conflicted';
  if (labels.has('review:pending')) return 'needs-review';
  if (labels.has('review:accepted') || labels.has('ready-to-merge')) return 'queued';
  return 'open';
}

/** A one-line human detail under a PR row: the extra fact the status alone does not carry. */
function prDetail(pr, status) {
  const merge = String(pr?.mergeStateStatus ?? '').toUpperCase();
  if (status === 'landed') return pr.mergedAt ? `merged ${pr.mergedAt.slice(0, 10)}` : 'merged';
  if (status === 'conflicted') return merge === 'BEHIND' ? 'behind main — needs a rebase' : 'conflicting with main';
  // A bounced PR is going to be re-pushed, so whatever its checks are doing right now is noise against the
  // one fact that matters (a reviewer wants changes).
  if (status !== 'bounced' && ciPending(pr?.statusCheckRollup)) return 'checks still running';
  if (merge === 'BLOCKED') return 'merge blocked by branch protection';
  return '';
}

/** Shrink a raw `gh` record to what the page needs (this is also the cache shape). */
const toRow = (pr) => ({
  number: pr.number,
  title: pr.title,
  labels: (pr.labels ?? []).map((l) => l.name).filter(Boolean),
  status: classifyPr(pr),
  detail: prDetail(pr, classifyPr(pr)),
});

/**
 * Fetch open + recently-merged PRs, cache on success, fall back to the cache on failure.
 * @returns {{ rows: object[], fresh: boolean, fetchedAt: string|null, reason: string|null }}
 */
export function fetchPrs({ repo, statePath, useGh = true }) {
  const cacheFile = cachePathFor(statePath);
  const readCache = () => {
    try {
      const c = JSON.parse(readFileSync(cacheFile, 'utf8'));
      return Array.isArray(c?.rows) ? c : null;
    } catch {
      return null;
    }
  };

  if (!useGh) {
    const c = readCache();
    return { rows: c?.rows ?? [], fresh: false, fetchedAt: c?.fetchedAt ?? null, reason: 'live PR lookup disabled for this run' };
  }

  const open = ghPrList(repo, ['--state=open', '--limit', '30']);
  const merged = ghPrList(repo, ['--state=merged', '--limit', '6']);
  if (open === null) {
    const c = readCache();
    return {
      rows: c?.rows ?? [],
      fresh: false,
      fetchedAt: c?.fetchedAt ?? null,
      reason: c ? 'GitHub was unreachable — showing the last good snapshot' : 'GitHub was unreachable and no snapshot was cached',
    };
  }

  const rows = [...open.map(toRow), ...(merged ?? []).map((pr) => ({ ...toRow(pr), status: 'landed', detail: prDetail(pr, 'landed') }))];
  const fetchedAt = nowIso();
  try {
    mkdirSync(dirname(cacheFile), { recursive: true });
    writeFileSync(cacheFile, JSON.stringify({ fetchedAt, rows }, null, 2) + '\n');
  } catch {
    /* the cache is an optimisation — never fail a render over it */
  }
  return { rows, fresh: true, fetchedAt, reason: null };
}

// ── Model ─────────────────────────────────────────────────────────────────────

const nowIso = () => (process.env.WE_BOARD_NOW || new Date().toISOString());

/** "2026-08-08 14:23 UTC" — one unambiguous stamp, no locale surprises. */
function stampOf(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

const ITEM_CHIP = Object.freeze({
  blocked: { sev: 'crit', label: 'blocked' },
  'in-progress': { sev: 'info', label: 'in progress' },
  todo: { sev: 'muted', label: 'not started' },
  done: { sev: 'ok', label: 'done' },
});

/**
 * Join the hand-maintained state to the live PR rows and sort everything by consequence.
 * Pure — takes the already-fetched rows, returns exactly what the renderer prints.
 */
export function buildModel(state, prs) {
  const rows = [...prs.rows].sort(
    (a, b) => (PR_STATUS[a.status]?.rank ?? 9) - (PR_STATUS[b.status]?.rank ?? 9) || b.number - a.number,
  );
  const byPr = new Map(rows.map((r) => [r.number, r]));
  const items = (state.items ?? []).map((it) => ({ ...it, prRow: it.pr ? byPr.get(Number(it.pr)) ?? null : null }));

  // A decision with no status recorded is outstanding — the safe default, since an un-set status must never
  // quietly hide something the operator has not actually ruled on.
  const decisions = (state.decisions ?? []).map((d) => ({ ...d, status: d.status ?? 'awaiting' }));
  const needsYou = {
    decisions: decisions.filter((d) => d.status === 'awaiting'),
    prs: rows.filter((r) => r.status === 'needs-human'),
    items: items.filter((i) => i.status === 'blocked'),
  };
  // Ruled-and-queued decisions are shown, but OUTSIDE the operator's section and out of its count: the ask
  // has already been answered, and re-presenting it as outstanding is exactly the noise the board exists to cut.
  const ruled = decisions.filter((d) => d.status === 'queued');
  // Drafts are the only place an unanswerable decision may sit, and they sit far away from the operator's
  // section on purpose — a half-written question in "needs you" is worse than no entry at all.
  const drafts = decisions.filter((d) => d.status === 'draft');
  // An in-progress item whose PR is on the board is ALREADY represented by that PR row (with a live status
  // the item cannot have). Listing both says the same thing twice, so only PR-less items appear here; the
  // plan table below is where every item, joined to its PR, is enumerated.
  const inFlight = {
    prs: rows.filter((r) => !['needs-human', 'landed'].includes(r.status)),
    items: items.filter((i) => i.status === 'in-progress' && !i.prRow),
  };
  const landed = { prs: rows.filter((r) => r.status === 'landed'), items: items.filter((i) => i.status === 'done') };

  const phaseOrder = [...new Set(items.map((i) => Number(i.phase) || 0))].sort((a, b) => a - b);
  const plan = phaseOrder.map((n) => ({
    phase: n,
    title: state.phases?.[String(n)] ?? (n ? `Phase ${n}` : 'Unphased'),
    items: items.filter((i) => (Number(i.phase) || 0) === n),
  }));

  return {
    title: state.title ?? EMPTY_STATE.title,
    repo: state.repo ?? null,
    artifactUrl: state.artifactUrl ?? null,
    stateError: state[STATE_ERROR] ?? null,
    generatedAt: nowIso(),
    prs: { ...prs, rows },
    counts: {
      needsYou: needsYou.decisions.length + needsYou.prs.length + needsYou.items.length,
      inFlight: inFlight.items.length + inFlight.prs.length,
      done: landed.items.length,
      total: items.length,
    },
    needsYou,
    ruled,
    drafts,
    inFlight,
    landed,
    plan,
  };
}

// ── Render ────────────────────────────────────────────────────────────────────

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * The palette lives ONCE per theme and is emitted into four places (`:root`, the
 * `prefers-color-scheme` block, and both `data-theme` overrides) so the viewer's own toggle wins in
 * BOTH directions. Components style through the tokens only — never a raw colour.
 *
 * The neutral is a cool graphite (a considered grey with a blue cast), not the default mid-grey; the
 * accent is a muted steel-teal that stays legible on both surfaces without competing with the severity
 * colours, which are the only saturated things on the page.
 */
const LIGHT = {
  '--bg': '#f5f7f8',
  '--surface': '#ffffff',
  '--surface-2': '#eef1f3',
  '--ink': '#12171b',
  '--ink-2': '#59646c',
  '--line': '#dde3e7',
  '--accent': '#0e6a74',
  '--crit': '#a32b28',
  '--crit-bg': '#fbebea',
  '--warn': '#8a5708',
  '--warn-bg': '#fbf2e2',
  '--ok': '#1d6b46',
  '--ok-bg': '#e8f4ed',
  '--info': '#2f5a78',
  '--info-bg': '#ecf2f7',
  '--muted': '#59646c',
  '--muted-bg': '#eef1f3',
};

const DARK = {
  '--bg': '#12171a',
  '--surface': '#191f23',
  '--surface-2': '#212a2f',
  '--ink': '#e4eaee',
  '--ink-2': '#95a2aa',
  '--line': '#2a343a',
  '--accent': '#5bbcc6',
  '--crit': '#f5938c',
  '--crit-bg': '#38201f',
  '--warn': '#e0b064',
  '--warn-bg': '#352a16',
  '--ok': '#78cfa1',
  '--ok-bg': '#173226',
  '--info': '#93c2df',
  '--info-bg': '#1a2b36',
  '--muted': '#95a2aa',
  '--muted-bg': '#212a2f',
};

const vars = (t) =>
  Object.entries(t)
    .map(([k, v]) => `    ${k}: ${v};`)
    .join('\n');

const css = () => `
:root {
${vars(LIGHT)}
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root {
${vars(DARK)}
  }
}
:root[data-theme="dark"] {
${vars(DARK)}
}
:root[data-theme="light"] {
${vars(LIGHT)}
}

* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 2rem 1.25rem 4rem;
  background: var(--bg);
  color: var(--ink);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 15px;
  line-height: 1.5;
  overflow-x: hidden;
}
.wrap { max-width: 62rem; margin: 0 auto; }
code, .mono, .pr-num, .lbl { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace; }

header.board { border-bottom: 1px solid var(--line); padding-bottom: 1rem; margin-bottom: 1.5rem; }
h1 { font-size: 1.5rem; line-height: 1.2; margin: 0 0 .4rem; letter-spacing: -0.01em; }
.meta { display: flex; flex-wrap: wrap; gap: .4rem 1rem; color: var(--ink-2); font-size: .8125rem; }
.meta .mono { color: var(--ink-2); }
.stamp strong { color: var(--ink); font-weight: 600; }

.tiles { display: flex; flex-wrap: wrap; gap: .625rem; margin: 1.25rem 0 2rem; }
.tile {
  flex: 1 1 8rem; background: var(--surface); border: 1px solid var(--line);
  border-radius: 6px; padding: .625rem .75rem;
}
.tile .n { font-size: 1.5rem; font-weight: 650; line-height: 1.1; }
.tile .k { font-size: .75rem; color: var(--ink-2); text-transform: uppercase; letter-spacing: .06em; }
.tile.crit .n { color: var(--crit); }
.tile.info .n { color: var(--info); }
.tile.ok .n { color: var(--ok); }

section { margin-bottom: 2.25rem; }
h2 { font-size: .8125rem; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-2); margin: 0 0 .25rem; font-weight: 650; }
.sub { color: var(--ink-2); font-size: .8125rem; margin: 0 0 .875rem; }

.row {
  display: flex; gap: .75rem; align-items: flex-start;
  background: var(--surface); border: 1px solid var(--line); border-left: 3px solid var(--muted);
  border-radius: 5px; padding: .625rem .75rem; margin-bottom: .5rem;
}
.row.crit { border-left-color: var(--crit); }
.row.warn { border-left-color: var(--warn); }
.row.info { border-left-color: var(--info); }
.row.ok { border-left-color: var(--ok); }
.row .body { flex: 1 1 auto; min-width: 0; }
.row .t { font-weight: 550; }
.row .d { color: var(--ink-2); font-size: .8125rem; margin-top: .125rem; }
.pr-num { color: var(--ink-2); font-size: .8125rem; }

.chip {
  flex: 0 0 auto; font-size: .6875rem; font-weight: 650; letter-spacing: .04em; text-transform: uppercase;
  padding: .1875rem .4375rem; border-radius: 3px; white-space: nowrap;
}
.chip.crit { color: var(--crit); background: var(--crit-bg); }
.chip.warn { color: var(--warn); background: var(--warn-bg); }
.chip.info { color: var(--info); background: var(--info-bg); }
.chip.ok { color: var(--ok); background: var(--ok-bg); }
.chip.muted { color: var(--muted); background: var(--muted-bg); }

.lbl { font-size: .6875rem; color: var(--ink-2); background: var(--surface-2); border-radius: 3px; padding: .0625rem .3125rem; margin-right: .25rem; }

/* Decisions are the only thing on the page that ask the operator for an answer, so theirs is the only row
   that earns more than two lines. Same stripe, same chips, same tokens — just the full case, stacked. */
.row.decision { padding: .8125rem .875rem; }
.row.decision .t { font-size: 1rem; line-height: 1.35; font-weight: 650; }
/* The ruling number is how the operator ANSWERS — they read it off the page and reply "R6 — as recommended".
   It has to be findable at a glance, so it is the one accent-coloured thing inside a decision card. */
.rnum {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-size: .8125rem; font-weight: 700; letter-spacing: .02em; color: var(--accent);
  border: 1px solid var(--accent); border-radius: 3px; padding: .0625rem .3125rem; margin-right: .4375rem;
  white-space: nowrap; vertical-align: .0625rem;
}
.dwhy { font-size: .8125rem; color: var(--ink-2); margin-top: .375rem; }
.opts { list-style: none; margin: .625rem 0 0; padding: 0; }
.opts li { background: var(--surface-2); border-radius: 4px; padding: .4375rem .5625rem; margin-bottom: .3125rem; font-size: .8125rem; color: var(--ink-2); }
.opts li:last-child { margin-bottom: 0; }
.opts li.rec { background: var(--ok-bg); }
.opts .ol { color: var(--ink); font-weight: 650; }
.opts .chip { margin-right: .375rem; vertical-align: .0625rem; }
.breaks { margin-top: .625rem; font-size: .8125rem; color: var(--crit); }
.breaks b { font-weight: 650; }
/* On a ruled or still-draft decision the cost of inaction is context, not an alarm — keeping it red would
   make a settled or unfinished row read as outstanding, which is what those two sections exist to prevent. */
.row.ok .breaks, .row.muted .breaks { color: var(--ink-2); }
.ev { margin-top: .5rem; }
.ev .e { display: block; font-size: .6875rem; line-height: 1.45; color: var(--ink-2); overflow-wrap: anywhere; }
.ev .e::before { content: "· "; }

.banner { border: 1px solid var(--warn); background: var(--warn-bg); color: var(--warn); border-radius: 5px; padding: .5rem .75rem; font-size: .8125rem; margin-bottom: 1.5rem; }
.banner.crit { border-color: var(--crit); background: var(--crit-bg); color: var(--crit); }

.scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid var(--line); border-radius: 5px; background: var(--surface); }
table { border-collapse: collapse; width: 100%; min-width: 34rem; font-size: .875rem; }
th, td { text-align: left; padding: .5rem .75rem; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font-size: .6875rem; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-2); font-weight: 650; }
tbody tr:last-child td { border-bottom: 0; }
td .note { color: var(--ink-2); font-size: .8125rem; }
.phase-row td { background: var(--surface-2); font-weight: 650; font-size: .75rem; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-2); }
.done .t, .done td.title { color: var(--ink-2); }

.empty { color: var(--ink-2); font-size: .875rem; font-style: italic; }
footer.board { border-top: 1px solid var(--line); padding-top: 1rem; color: var(--ink-2); font-size: .75rem; }
footer.board a { color: var(--accent); }
`;

const chip = (sev, label) => `<span class="chip ${sev}">${esc(label)}</span>`;

function prRowHtml(r) {
  const meta = PR_STATUS[r.status] ?? PR_STATUS.open;
  const detail = [r.detail, meta.gloss].filter(Boolean).join(' · ');
  const labels = (r.labels ?? []).map((l) => `<span class="lbl">${esc(l)}</span>`).join('');
  return `      <div class="row ${meta.sev}">
        <div class="body">
          <div class="t"><span class="pr-num">#${esc(r.number)}</span> ${esc(r.title)}</div>
          <div class="d">${esc(detail)}</div>
          <div class="d">${labels}</div>
        </div>
        ${chip(meta.sev, meta.label)}
      </div>`;
}

function itemRowHtml(it) {
  const c = ITEM_CHIP[it.status] ?? ITEM_CHIP.todo;
  const detail = [it.blocker && `blocked: ${it.blocker}`, it.note, it.pr && `PR #${it.pr}`].filter(Boolean).join(' · ');
  return `      <div class="row ${c.sev}">
        <div class="body">
          <div class="t">${esc(it.title)}</div>
          ${detail ? `<div class="d">${esc(detail)}</div>` : ''}
          <div class="d"><span class="lbl">${esc(it.id)}</span></div>
        </div>
        ${chip(c.sev, c.label)}
      </div>`;
}

/**
 * A decision, in full. The standard the page has to hit is that the operator can ANSWER it here — without
 * opening a backlog file, a PR or a diff. So when the rich fields are present this renders, in order: the
 * question as the heading, why it is a judgment call at all, the real options with the recommended one
 * marked, what breaks if nothing is done, and the grounding (loci, counts, prior rulings).
 *
 * Every field is optional and `detail` remains the fallback, so a bare `{id, title, detail}` entry — the
 * shape the board shipped with — still renders exactly as it did.
 */
function decisionRowHtml(d, { sev = 'crit', chipLabel = 'decide' } = {}) {
  // With a question present, the title stops being the heading and becomes the short handle for the
  // decision; with no question the title IS the heading and `detail` carries whatever context exists.
  const sub = [d.question ? d.title : d.detail, d.preparedDate && `prepared ${d.preparedDate}`]
    .filter(Boolean)
    .join(' · ');

  const options = (d.options ?? []).length
    ? `          <ul class="opts">
${d.options
  .map(
    (o) =>
      `            <li${o.recommended ? ' class="rec"' : ''}>${o.recommended ? chip('ok', 'recommended') : ''}<span class="ol">${esc(o.label)}</span>${o.detail ? ` — ${esc(o.detail)}` : ''}</li>`,
  )
  .join('\n')}
          </ul>`
    : '';

  const evidence = (d.evidence ?? []).length
    ? `          <div class="ev">${d.evidence.map((e) => `<span class="mono e">${esc(e)}</span>`).join('')}</div>`
    : '';

  // Both handles, deliberately: the R-number is what the operator quotes back in conversation, the backlog
  // number is what the record is filed under. They are different things and neither substitutes for the other.
  const rnum = d.ruling ? `<span class="rnum">${esc(d.ruling)}</span>` : '';
  const filedAs = /^\d+$/.test(String(d.id)) ? `#${d.id}` : d.id;

  const body = [
    `          <div class="t">${rnum}${esc(d.question || d.title)}</div>`,
    sub ? `          <div class="d">${esc(sub)}</div>` : '',
    d.why ? `          <div class="dwhy">${esc(d.why)}</div>` : '',
    options,
    d.ifNothing ? `          <div class="breaks"><b>If nothing is done:</b> ${esc(d.ifNothing)}</div>` : '',
    evidence,
    `          <div class="d">${d.ruling ? `<span class="lbl">answer as ${esc(d.ruling)}</span>` : ''}<span class="lbl">filed as ${esc(filedAs)}</span></div>`,
  ]
    .filter(Boolean)
    .join('\n');

  return `      <div class="row decision ${sev}">
        <div class="body">
${body}
        </div>
        ${chip(sev, chipLabel)}
      </div>`;
}

function planTableHtml(plan) {
  if (!plan.length) return '      <p class="empty">No plan items yet.</p>';
  const body = plan
    .map((p) => {
      const head = `        <tr class="phase-row"><td colspan="4">${esc(p.phase ? `Phase ${p.phase} — ${p.title}` : p.title)}</td></tr>`;
      const rows = p.items
        .map((it) => {
          const c = ITEM_CHIP[it.status] ?? ITEM_CHIP.todo;
          const note = [it.blocker && `blocked: ${it.blocker}`, it.note].filter(Boolean).join(' · ');
          const prCell = it.pr
            ? `<span class="mono">#${esc(it.pr)}</span>${it.prRow ? `<div class="note">${esc((PR_STATUS[it.prRow.status] ?? PR_STATUS.open).label)}</div>` : ''}`
            : '<span class="note">—</span>';
          return `        <tr class="${it.status === 'done' ? 'done' : ''}">
          <td class="title">${esc(it.title)}<div class="note"><span class="mono">${esc(it.id)}</span></div></td>
          <td>${chip(c.sev, c.label)}</td>
          <td>${prCell}</td>
          <td class="note">${esc(note)}</td>
        </tr>`;
        })
        .join('\n');
      return `${head}\n${rows}`;
    })
    .join('\n');
  return `      <div class="scroll">
        <table>
          <thead><tr><th>Item</th><th>State</th><th>PR</th><th>Note</th></tr></thead>
          <tbody>
${body}
          </tbody>
        </table>
      </div>`;
}

const sectionHtml = (title, sub, inner) =>
  `    <section>
      <h2>${esc(title)}</h2>
      <p class="sub">${esc(sub)}</p>
${inner}
    </section>`;

/**
 * THE PROVENANCE MARKER. The template lives in exactly one place — this file — and there is no example page
 * anywhere for a future session to fork. The realistic failure is not someone editing the HTML; it is
 * someone in a hurry hand-writing a page and publishing it to the board's URL, which silently drops every
 * required field and is overwritten by the next real run anyway.
 *
 * So every generated page carries a marker whose fingerprint covers the body. A hand-written page has no
 * marker; a marker copied onto hand-written content does not match. `--verify=<path>` turns that into a
 * one-line check the skill can require BEFORE publishing.
 */
const MARKER_RE = /^<!-- progress-board:generated schema=(\d+) at=(\S+) decisions=(\d+) fingerprint=([0-9a-f]+) -->\n/;
const SCHEMA = 1;

const fingerprint = (body) => createHash('sha256').update(body, 'utf8').digest('hex').slice(0, 16);

/**
 * Is this file the real, script-generated board?
 * @returns {{ ok: boolean, reason: string }}
 */
export function verifyPage(html) {
  const m = MARKER_RE.exec(String(html ?? ''));
  if (!m) return { ok: false, reason: 'no progress-board marker — this page was NOT generated by the board script' };
  const body = String(html).slice(m[0].length);
  if (Number(m[1]) !== SCHEMA) return { ok: false, reason: `marker is schema ${m[1]}, this script writes schema ${SCHEMA} — re-render it` };
  const actual = fingerprint(body);
  if (actual !== m[4]) return { ok: false, reason: `fingerprint ${m[4]} does not match the page body (${actual}) — the content was edited after it was generated` };
  return { ok: true, reason: `generated ${m[2]}, ${m[3]} decision${m[3] === '1' ? '' : 's'}, fingerprint ${actual}` };
}

/** The whole page. A self-contained fragment: no external font, script, image or stylesheet (strict CSP). */
export function renderPage(m) {
  const needsYou = [
    ...m.needsYou.decisions.map(decisionRowHtml),
    ...m.needsYou.prs.map(prRowHtml),
    ...m.needsYou.items.map(itemRowHtml),
  ].join('\n');

  // Only rendered when there is something to show — an empty "Ruled" heading would read as a fourth thing
  // the operator has to look at, which is the opposite of why it exists.
  const ruled = m.ruled.length
    ? sectionHtml(
        'Ruled, queued',
        'Already decided — kept visible because the ruling is the fact, but deliberately waiting behind other work. Nothing here is asking you anything.',
        m.ruled.map((d) => decisionRowHtml(d, { sev: 'ok', chipLabel: 'ruled · queued' })).join('\n'),
      ) + '\n'
    : '';

  // Deliberately far from "Needs you" and deliberately quiet: a draft is not an ask, it is a note that
  // somebody is still assembling one.
  const drafts = m.drafts.length
    ? sectionHtml(
        'Decisions being prepared',
        'Not answerable yet, so not asked. The board will not let one of these into "Needs you" until it carries a question, at least two options with one recommended, and what breaks if nothing is done.',
        m.drafts.map((d) => decisionRowHtml(d, { sev: 'muted', chipLabel: 'draft' })).join('\n'),
      ) + '\n'
    : '';

  const inFlight = [...m.inFlight.items.map(itemRowHtml), ...m.inFlight.prs.map(prRowHtml)].join('\n');
  const landed = [...m.landed.prs.map(prRowHtml), ...m.landed.items.map(itemRowHtml)].join('\n');

  const banner =
    // The plan half failing is worse than the PR half failing — a page that quietly shows an empty plan
    // reads as "nothing is happening" rather than "I could not read the plan". Say it first and say it loud.
    (m.stateError
      ? `    <div class="banner crit"><strong>The plan and decisions could not be read</strong> — ${esc(m.stateError)}. Everything below this line is the live pull-request half only; the plan half is missing, not empty.</div>\n`
      : '') +
    (m.prs.fresh
      ? ''
      : `    <div class="banner">Pull-request state is <strong>stale</strong> — ${esc(m.prs.reason ?? 'the live lookup did not run')}${
          m.prs.fetchedAt ? ` (snapshot from ${esc(stampOf(m.prs.fetchedAt))})` : ''
        }.</div>\n`);

  const body = `<title>${esc(m.title)}</title>
<style>${css()}</style>
<div class="wrap">
  <header class="board">
    <h1>${esc(m.title)}</h1>
    <div class="meta">
      ${m.repo ? `<span class="mono">${esc(m.repo)}</span>` : ''}
      <span class="stamp">Last refreshed <strong>${esc(stampOf(m.generatedAt))}</strong></span>
      <span>${m.prs.fresh ? 'pull-request state read live' : 'pull-request state from cache'}</span>
    </div>
  </header>

${banner}  <div class="tiles">
    <div class="tile crit"><div class="n">${m.counts.needsYou}</div><div class="k">Needs you</div></div>
    <div class="tile info"><div class="n">${m.counts.inFlight}</div><div class="k">In flight</div></div>
    <div class="tile ok"><div class="n">${m.counts.done}/${m.counts.total}</div><div class="k">Plan done</div></div>
  </div>

${sectionHtml(
  'Needs you',
  'Nothing here moves without the operator: decisions to take, reviews only a human can clear, work that is stuck. Answer a decision by its ruling number — "R6 — as recommended" is enough.',
  needsYou || '      <p class="empty">Nothing is waiting on you.</p>',
)}
${ruled}
${sectionHtml(
  'In flight',
  'Work under way. Ordered by how hard it is stuck — bounced and red first, quietly-queued last.',
  inFlight || '      <p class="empty">Nothing in flight.</p>',
)}

${sectionHtml('The plan', 'Every item, by phase, joined to its pull request where one exists.', planTableHtml(m.plan))}
${drafts}
${sectionHtml('Landed', 'Recently merged pull requests and finished plan items.', landed || '      <p class="empty">Nothing landed yet.</p>')}

  <footer class="board">
    Generated by <span class="mono">we:scripts/progress-board.mjs</span> from <span class="mono">we:reports/progress-board.json</span> plus live pull-request state.
    Every decision here was rendered from data that the script refuses to leave incomplete — a hand-written page cannot say this, and is not the board.
    Pull-request state moves continuously — this page is a snapshot taken at the stamp above, not a live feed. Re-run the board to refresh it.
  </footer>
</div>
`;

  const count = m.needsYou.decisions.length + m.ruled.length + m.drafts.length;
  return `<!-- progress-board:generated schema=${SCHEMA} at=${m.generatedAt} decisions=${count} fingerprint=${fingerprint(body)} -->\n${body}`;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

const findItem = (state, id) => (state.items ?? []).find((i) => i.id === id);

/**
 * Apply one verb to the state. Pure-ish (mutates + returns the state) and IDEMPOTENT: re-running a verb
 * that already holds re-states it without moving a date or duplicating a row.
 * @returns {string} the one-line confirmation
 */
export function applyVerb(state, verb, args = {}) {
  const today = nowIso().slice(0, 10);
  switch (verb) {
    case 'start': {
      const it = requireItem(state, args.id);
      it.status = 'in-progress';
      delete it.blocker;
      it.startedAt ??= today;
      return `started ${it.id}`;
    }
    case 'done': {
      const it = requireItem(state, args.id);
      it.status = 'done';
      delete it.blocker;
      it.startedAt ??= today;
      it.doneAt ??= today;
      return `done ${it.id}`;
    }
    case 'block': {
      const it = requireItem(state, args.id);
      if (!args.why) throw new Error('--block requires --why="<reason>"');
      it.status = 'blocked';
      it.blocker = args.why;
      return `blocked ${it.id} — ${args.why}`;
    }
    case 'note': {
      const it = requireItem(state, args.id);
      if (args.text) it.note = args.text;
      else delete it.note;
      return args.text ? `noted ${it.id}` : `note cleared on ${it.id}`;
    }
    case 'add': {
      const id = slugify(args.title);
      const existing = findItem(state, id);
      if (existing) {
        if (args.phase != null) existing.phase = Number(args.phase);
        return `already on the board: ${id}`;
      }
      state.items.push({ id, title: String(args.title), phase: Number(args.phase ?? 0) || 0, status: 'todo' });
      return `added ${id}`;
    }
    case 'decide': {
      const d = requireDecision(state, args.id);
      d.status = 'taken';
      d.takenAt ??= today;
      return `decided ${d.id}`;
    }
    case 'decision-add': {
      // Keyed on the id, so re-running the same add is a no-op rather than a second copy of the question.
      const id = args.id && args.id !== true ? String(args.id) : slugify(args.title);
      // `R<n>` is the ruling-number namespace, handed out by the counter alone. Letting an --id squat there
      // would make two different decisions answer to the same thing the operator types in chat.
      if (/^R\d+$/i.test(id)) throw new Error(`--id="${id}" is reserved — R-numbers are assigned by the board, never chosen`);
      const question = args.question === true ? '' : String(args.question ?? '');
      const ifNothing = args.ifNothing === true ? '' : String(args.ifNothing ?? '');
      const status = args.status && args.status !== true ? String(args.status) : 'draft';
      if (!DECISION_STATUSES.includes(status)) throw new Error(`--status must be one of: ${DECISION_STATUSES.join(', ')}`);

      // A decision that will need answering must arrive with the two fields only its author knows. Everything
      // else can be built up afterwards, but a bare title is exactly the entry this board refuses to carry.
      // Recording an already-RULED decision (`--status=queued|taken`) is a different act — it is a record of
      // an answer, not a question, so it is not held to the same bar.
      if ((status === 'draft' || status === 'awaiting') && (!question || !ifNothing)) {
        throw new Error(
          `--decision-add requires --question="…" and --if-nothing="…" (a title is not a decision). ` +
            `Use --status=queued or --status=taken to record one that has already been ruled.`,
        );
      }

      state.decisions ??= [];
      const existing = state.decisions.find((x) => String(x.id) === id);
      if (existing) {
        if (question) existing.question = question;
        if (ifNothing) existing.ifNothing = ifNothing;
        return `already on the board: decision ${id}`;
      }
      const d = { id, title: String(args.title), status };
      if (question) d.question = question;
      if (ifNothing) d.ifNothing = ifNothing;
      if (status === 'awaiting') requireAnswerable(d, 'add');
      state.decisions.push(d);
      return `added decision ${id} (${status})`;
    }
    case 'decision-set': {
      const d = requireDecision(state, args.id);
      const field = String(args.field ?? '');
      if (!DECISION_FIELDS.includes(field)) {
        throw new Error(`--field must be one of: ${DECISION_FIELDS.join(', ')} (options and evidence have their own verbs)`);
      }
      const value = args.value === true ? '' : String(args.value ?? '');
      if (field === 'status' && value && !DECISION_STATUSES.includes(value)) {
        throw new Error(`status must be one of: ${DECISION_STATUSES.join(', ')}`);
      }
      // The flip to `awaiting` is the moment a decision starts asking the operator for something, so it is
      // the moment the contract is checked. Refusing here — before anything is written — is what keeps a
      // half-built decision out of their section without ever needing a person to notice.
      if (field === 'status' && value === 'awaiting') requireAnswerable({ ...d, status: 'awaiting' }, 'flip');
      // Empty clears, exactly like `--note --text=` — one way to unset a field, not two.
      if (value) d[field] = value;
      else delete d[field];
      return value ? `set ${field} on ${d.id}` : `cleared ${field} on ${d.id}`;
    }
    case 'decision-option': {
      const d = requireDecision(state, args.id);
      const label = args.label === true ? '' : String(args.label ?? '');
      if (!label) throw new Error('--decision-option requires --label="<option>"');
      d.options ??= [];
      const detail = args.detail === true ? '' : String(args.detail ?? '');
      const existing = d.options.find((o) => o.label === label);
      const o = existing ?? { label };
      if (!existing) d.options.push(o);
      if (detail) o.detail = detail;
      // Exactly one option can be the recommendation — a second `--recommend` MOVES it rather than adding one.
      if (args.recommend) {
        for (const other of d.options) delete other.recommended;
        o.recommended = true;
      }
      return `${existing ? 'option updated on' : 'option added to'} ${d.id}: ${label}`;
    }
    // Options match on the exact label, so re-wording one ADDS a second row rather than replacing the
    // first — and the page then shows the operator the same choice twice. Without this verb the only
    // repair is a hand-edit of the state file, which the board forbids.
    case 'decision-option-remove': {
      const d = requireDecision(state, args.id);
      const label = args.label === true ? '' : String(args.label ?? '');
      if (!label) throw new Error('--decision-option-remove requires --label="<option>"');
      const before = d.options?.length ?? 0;
      d.options = (d.options ?? []).filter((o) => o.label !== label);
      if (d.options.length === before) throw new Error(`no option labelled "${label}" on ${d.id}`);
      return `option removed from ${d.id}: ${label}`;
    }
    case 'decision-evidence': {
      const d = requireDecision(state, args.id);
      const text = args.text === true ? '' : String(args.text ?? '');
      if (!text) {
        delete d.evidence;
        return `evidence cleared on ${d.id}`;
      }
      d.evidence ??= [];
      if (d.evidence.includes(text)) return `evidence already on ${d.id}`;
      d.evidence.push(text);
      return `evidence added to ${d.id}`;
    }
    case 'url': {
      state.artifactUrl = args.url;
      return `artifact URL stored`;
    }
    default:
      throw new Error(`unknown verb "${verb}"`);
  }
}

function requireItem(state, id) {
  const it = findItem(state, id);
  if (!it) throw new Error(`no item "${id}" — known ids: ${(state.items ?? []).map((i) => i.id).join(', ') || '(none)'}`);
  return it;
}

/**
 * Find a decision by EITHER handle: the ruling number the operator quotes in chat (`R4`, case-insensitive)
 * or the id under which it is filed (a backlog number, or a slug). Both are printed on the card precisely so
 * that either one works here.
 */
export function findDecision(state, handle) {
  const key = String(handle);
  const lower = key.toLowerCase();
  return (
    (state.decisions ?? []).find((x) => String(x.id) === key) ??
    (state.decisions ?? []).find((x) => String(x.ruling ?? '').toLowerCase() === lower) ??
    null
  );
}

function requireDecision(state, id) {
  const d = findDecision(state, id);
  if (!d) {
    const known = (state.decisions ?? []).map((x) => (x.ruling ? `${x.ruling}/${x.id}` : x.id)).join(', ') || '(none)';
    throw new Error(`no decision "${id}" — known: ${known}`);
  }
  return d;
}

/** Refuse to put an unanswerable decision in front of the operator, naming the id and every missing field. */
function requireAnswerable(d, at) {
  const gaps = decisionGaps(d);
  if (!gaps.length) return;
  const how = at === 'add' ? 'add "%s" as awaiting' : 'mark "%s" awaiting';
  throw new Error(
    `cannot ${how.replace('%s', d.id)} — it must be answerable from the page. Missing ${gaps.join(' · ')}. ` +
      `Build it up first (it can sit as --field=status --value=draft meanwhile).`,
  );
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { _: [] };
  for (const a of argv) {
    const m = /^--([a-z-]+)(?:=([\s\S]*))?$/.exec(a);
    if (m) out[m[1]] = m[2] === undefined ? true : m[2];
    else out._.push(a);
  }
  return out;
}

const USAGE = `progress-board — the operator's published status page (one Bash call + one Artifact call per update)

  node scripts/progress-board.mjs                    re-render from live state
  node scripts/progress-board.mjs --start=<id>       item → in progress (clears any blocker)
  node scripts/progress-board.mjs --done=<id>        item → done
  node scripts/progress-board.mjs --block=<id> --why="<reason>"
  node scripts/progress-board.mjs --note=<id> --text="<note>"    (empty --text clears it)
  node scripts/progress-board.mjs --add="<title>" [--phase=<n>]
  node scripts/progress-board.mjs --decide=<id>      a decision was taken
  node scripts/progress-board.mjs --url=<url>        store the published artifact URL (once)

  A decision the operator can ANSWER FROM THE PAGE. Enforced, not requested: anything marked "awaiting" must
  carry a question, two or more real options with exactly one recommended, and ifNothing — or the run exits 1
  naming the id and the missing field. Park an unfinished one as "draft"; it never reaches "needs you".

  node scripts/progress-board.mjs --decision-add="<title>" --question="<one line>" --if-nothing="<what breaks>"
                                  [--id=<id>] [--status=<s>]   (adds as draft; --status=queued|taken records a ruling)
  node scripts/progress-board.mjs --decision-set=<id> --field=<name> --value="<text>"   (empty --value clears)
        --field: ${DECISION_FIELDS.join(' | ')}
        status:  ${DECISION_STATUSES.join(' | ')}
                 draft = being prepared, kept out of "needs you" · queued = ruled but deferred
  node scripts/progress-board.mjs --decision-option=<id> --label="<option>" --detail="<tradeoff>" [--recommend]
  node scripts/progress-board.mjs --decision-option-remove=<id> --label="<option>"   (labels match exactly, so
        re-wording an option ADDS a second one — remove the superseded label rather than hand-editing state)
  node scripts/progress-board.mjs --decision-evidence=<id> --text="<locus, count or prior ruling>"
        then, once it is answerable: --decision-set=<id> --field=status --value=awaiting

  <id> is EITHER handle: the ruling number the operator quotes ("R6", the board assigns it and never reuses
  it) or the id it is filed under. So --decide=R6 and --decide=2978 reach the same decision.

  node scripts/progress-board.mjs --verify=<path>    is that file the script-generated board? (exit 0 / 1)

  --state=<path>  --out=<path>  --no-gh  --json  --help`;

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  let statePath;
  let outPath;
  try {
    statePath = args.state ? assertWritablePath(String(args.state), '--state') : DEFAULT_STATE;
    outPath = args.out ? assertWritablePath(String(args.out), '--out') : DEFAULT_OUT;
  } catch (e) {
    console.error(`✗ ${e.message}`);
    return 1;
  }
  // `--verify` is a read-only question about a FILE, not about the board's state — answer it and stop.
  if (args.verify) {
    const target = resolve(String(args.verify));
    let html;
    try {
      html = readFileSync(target, 'utf8');
    } catch (e) {
      console.error(`✗ cannot read ${shortPath(target)} — ${e.message}`);
      return 1;
    }
    const v = verifyPage(html);
    console[v.ok ? 'log' : 'error'](`${v.ok ? '✓' : '✗'} ${shortPath(target)}: ${v.ok ? 'is the generated board' : 'is NOT the generated board'} — ${v.reason}`);
    return v.ok ? 0 : 1;
  }

  const state = loadState(statePath);

  const verbs = [];
  if (args.start) verbs.push(['start', { id: String(args.start) }]);
  if (args.done) verbs.push(['done', { id: String(args.done) }]);
  if (args.block) verbs.push(['block', { id: String(args.block), why: args.why === true ? '' : args.why }]);
  if (args.note) verbs.push(['note', { id: String(args.note), text: args.text === true ? '' : args.text }]);
  if (args.add) verbs.push(['add', { title: String(args.add), phase: args.phase }]);
  if (args.decide) verbs.push(['decide', { id: String(args.decide) }]);
  if (args['decision-add'])
    verbs.push([
      'decision-add',
      { title: String(args['decision-add']), id: args.id, question: args.question, ifNothing: args['if-nothing'], status: args.status },
    ]);
  if (args['decision-set']) verbs.push(['decision-set', { id: String(args['decision-set']), field: args.field, value: args.value }]);
  if (args['decision-option'])
    verbs.push([
      'decision-option',
      { id: String(args['decision-option']), label: args.label, detail: args.detail, recommend: args.recommend !== undefined && args.recommend !== 'false' },
    ]);
  if (args['decision-option-remove'])
    verbs.push(['decision-option-remove', { id: String(args['decision-option-remove']), label: args.label }]);
  if (args['decision-evidence']) verbs.push(['decision-evidence', { id: String(args['decision-evidence']), text: args.text }]);
  if (args.url) verbs.push(['url', { url: String(args.url) }]);

  // A file we could not read is a file we must not overwrite: applying a verb here would save the EMPTY
  // fallback state over a plan that is very likely one merge-conflict marker away from fine. Refuse the
  // write, keep rendering (below) so the page still exists and says why.
  const broken = state[STATE_ERROR];
  if (broken && verbs.length) {
    console.error(`✗ refusing to write: ${broken}. Fix the file by hand — applying a verb now would overwrite the plan with an empty one.`);
    return 1;
  }

  const confirmations = [];
  try {
    for (const [verb, a] of verbs) confirmations.push(applyVerb(state, verb, a));
  } catch (e) {
    console.error(`✗ ${e.message}`);
    return 1;
  }
  // Backfill any decision that predates the R-number scheme, once. Idempotent after the first run, which is
  // why it can safely trigger a save even when no verb ran.
  const numbered = broken ? 0 : ensureRulingNumbers(state);

  // Save FIRST, validate second. The verbs are how an incomplete decision gets completed, so refusing to
  // persist them would deadlock the only route out of a board that is already failing this check.
  if (verbs.length || numbered) saveState(statePath, state);

  // The render guard, and a DIFFERENT failure from an unreadable file: this one means the file parsed fine
  // and someone put an unanswerable decision in front of the operator. It catches what the verb guards
  // cannot — an entry that predates the rule, or one an editor wrote around the CLI. It hard-fails rather
  // than warning, because a warning is read once and then never again.
  const invalid = broken ? [] : validateDecisions(state);
  if (invalid.length) {
    console.error(`✗ ${invalid.length} decision${invalid.length === 1 ? '' : 's'} cannot be answered from the page — refusing to render:`);
    for (const line of invalid) console.error(`    ${line}`);
    console.error(
      `  Fill the gaps with the verbs named above, or park it until it is ready:\n` +
        `    node scripts/progress-board.mjs --decision-set=<id> --field=status --value=draft`,
    );
    return 1;
  }

  const useGh = !args['no-gh'] && process.env.WE_BOARD_NO_GH !== '1';
  const prs = fetchPrs({ repo: state.repo, statePath, useGh });
  const model = buildModel(state, prs);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, renderPage(model));

  if (args.json) {
    process.stdout.write(JSON.stringify(model, null, 2) + '\n');
    return 0;
  }

  const rel = (p) => (p.startsWith(ROOT) ? relative(ROOT, p) : p);
  const head = confirmations.length ? confirmations.join('; ') : 'rendered';
  const url = model.artifactUrl ? ` · publish to ${model.artifactUrl}` : ' · no artifact URL stored yet (--url=<url> after the first publish)';
  const staleness = prs.fresh ? '' : ' · PR state STALE';
  // The page carries the loud version; this is the one line the model actually reads, so it has to carry it too.
  const stateNote = broken ? ` · STATE FILE UNREADABLE: ${broken}` : '';
  console.log(`${broken ? '⚠' : '✓'} ${head} → ${rel(outPath)} (${model.counts.needsYou} needs you, ${model.counts.inFlight} in flight)${stateNote}${staleness}${url}`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('progress-board.mjs')) process.exit(main());
