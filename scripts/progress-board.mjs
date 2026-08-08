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
 * Flags: --state=<path> --out=<path> --no-gh --json --help.
 * Env:   WE_BOARD_NO_GH=1 (never shell out to gh), WE_BOARD_NOW=<iso> (freeze the stamp, for tests).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_STATE = join(ROOT, 'reports', 'progress-board.json');
const DEFAULT_OUT = join(ROOT, 'reports', 'progress-board.html');
const cachePathFor = (statePath) => join(dirname(statePath), '.progress-board-cache.json');

// ── State ─────────────────────────────────────────────────────────────────────

/** Item lifecycle. `blocked` is the only one that pulls an item into the operator's section. */
export const ITEM_STATUSES = ['todo', 'in-progress', 'blocked', 'done'];

const EMPTY_STATE = {
  title: 'Progress board',
  repo: null,
  artifactUrl: null,
  phases: {},
  items: [],
  decisions: [],
};

export function loadState(statePath) {
  if (!existsSync(statePath)) return { ...EMPTY_STATE };
  const raw = JSON.parse(readFileSync(statePath, 'utf8'));
  return { ...EMPTY_STATE, ...raw };
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

  const needsYou = {
    decisions: (state.decisions ?? []).filter((d) => d.status !== 'taken'),
    prs: rows.filter((r) => r.status === 'needs-human'),
    items: items.filter((i) => i.status === 'blocked'),
  };
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
    generatedAt: nowIso(),
    prs: { ...prs, rows },
    counts: {
      needsYou: needsYou.decisions.length + needsYou.prs.length + needsYou.items.length,
      inFlight: inFlight.items.length + inFlight.prs.length,
      done: landed.items.length,
      total: items.length,
    },
    needsYou,
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

.banner { border: 1px solid var(--warn); background: var(--warn-bg); color: var(--warn); border-radius: 5px; padding: .5rem .75rem; font-size: .8125rem; margin-bottom: 1.5rem; }

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

function decisionRowHtml(d) {
  const detail = [d.detail, d.preparedDate && `prepared ${d.preparedDate}`].filter(Boolean).join(' · ');
  return `      <div class="row crit">
        <div class="body">
          <div class="t">${esc(d.title)}</div>
          ${detail ? `<div class="d">${esc(detail)}</div>` : ''}
          <div class="d"><span class="lbl">${esc(/^\d+$/.test(String(d.id)) ? `#${d.id}` : d.id)}</span></div>
        </div>
        ${chip('crit', 'decide')}
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

/** The whole page. A self-contained fragment: no external font, script, image or stylesheet (strict CSP). */
export function renderPage(m) {
  const needsYou = [
    ...m.needsYou.decisions.map(decisionRowHtml),
    ...m.needsYou.prs.map(prRowHtml),
    ...m.needsYou.items.map(itemRowHtml),
  ].join('\n');

  const inFlight = [...m.inFlight.items.map(itemRowHtml), ...m.inFlight.prs.map(prRowHtml)].join('\n');
  const landed = [...m.landed.prs.map(prRowHtml), ...m.landed.items.map(itemRowHtml)].join('\n');

  const banner = m.prs.fresh
    ? ''
    : `    <div class="banner">Pull-request state is <strong>stale</strong> — ${esc(m.prs.reason ?? 'the live lookup did not run')}${
        m.prs.fetchedAt ? ` (snapshot from ${esc(stampOf(m.prs.fetchedAt))})` : ''
      }.</div>\n`;

  return `<title>${esc(m.title)}</title>
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
  'Nothing here moves without the operator: decisions to take, reviews only a human can clear, work that is stuck.',
  needsYou || '      <p class="empty">Nothing is waiting on you.</p>',
)}

${sectionHtml(
  'In flight',
  'Work under way. Ordered by how hard it is stuck — bounced and red first, quietly-queued last.',
  inFlight || '      <p class="empty">Nothing in flight.</p>',
)}

${sectionHtml('The plan', 'Every item, by phase, joined to its pull request where one exists.', planTableHtml(m.plan))}

${sectionHtml('Landed', 'Recently merged pull requests and finished plan items.', landed || '      <p class="empty">Nothing landed yet.</p>')}

  <footer class="board">
    Generated by <span class="mono">we:scripts/progress-board.mjs</span> from <span class="mono">we:reports/progress-board.json</span> plus live pull-request state.
    Pull-request state moves continuously — this page is a snapshot taken at the stamp above, not a live feed. Re-run the board to refresh it.
  </footer>
</div>
`;
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
      const d = (state.decisions ?? []).find((x) => String(x.id) === String(args.id));
      if (!d) throw new Error(`no decision "${args.id}" — known: ${(state.decisions ?? []).map((x) => x.id).join(', ') || '(none)'}`);
      d.status = 'taken';
      d.takenAt ??= today;
      return `decided ${d.id}`;
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

  --state=<path>  --out=<path>  --no-gh  --json  --help`;

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  const statePath = args.state ? String(args.state) : DEFAULT_STATE;
  const outPath = args.out ? String(args.out) : DEFAULT_OUT;
  const state = loadState(statePath);

  const verbs = [];
  if (args.start) verbs.push(['start', { id: String(args.start) }]);
  if (args.done) verbs.push(['done', { id: String(args.done) }]);
  if (args.block) verbs.push(['block', { id: String(args.block), why: args.why === true ? '' : args.why }]);
  if (args.note) verbs.push(['note', { id: String(args.note), text: args.text === true ? '' : args.text }]);
  if (args.add) verbs.push(['add', { title: String(args.add), phase: args.phase }]);
  if (args.decide) verbs.push(['decide', { id: String(args.decide) }]);
  if (args.url) verbs.push(['url', { url: String(args.url) }]);

  const confirmations = [];
  try {
    for (const [verb, a] of verbs) confirmations.push(applyVerb(state, verb, a));
  } catch (e) {
    console.error(`✗ ${e.message}`);
    return 1;
  }
  if (verbs.length) saveState(statePath, state);

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
  console.log(`✓ ${head} → ${rel(outPath)} (${model.counts.needsYou} needs you, ${model.counts.inFlight} in flight)${staleness}${url}`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('progress-board.mjs')) process.exit(main());
