#!/usr/bin/env node
/**
 * @file scripts/conveyor/status-board.mjs
 * @description The CONVEYOR STATUS BOARD (WE #2613, epic #2612) — a compact TEXT mirror of the plateau lane
 *   board, printed on demand. It renders the ONE tick picture that `scripts/readiness/conveyor-state.mjs --json`
 *   already produces (queue · lanes · freeSlots · prs · daemon · idle · health · unshaped · clearedNotReady) into
 *   an ASCII board so an operator can eyeball the whole conveyor at a glance without reading raw JSON. It INVENTS
 *   no state and re-derives no decision — it is a pure formatter over the state object; the routine per-tick
 *   status stays the terse one-liner in the /conveyor skill, and THIS is the fuller on-demand view.
 *
 * PURE-CORE / IO-SHELL SPLIT (mirrored from conveyor-state.mjs): {@link renderBoard} is a PURE
 *   `renderBoard(state) → string` — NO fs / gh / `Date` / `child_process`, deterministic and vitest-testable
 *   against fixtures. The IO shell (the `main()` CLI, gated on direct invocation) shells
 *   `node scripts/readiness/conveyor-state.mjs --json` (inheriting the env, so `CONVEYOR_QUEUE_FILE` still points
 *   the state read at the same session sidecar) and prints the rendered board.
 *
 * DEGRADE GRACEFULLY: a null / partial / missing state never throws — every section reads its slice defensively
 *   and an empty section is OMITTED, so an idle conveyor renders just the header line.
 *
 * MARKER LEGEND — one symbol, one meaning (do not overload a symbol):
 *   ⟳  building    — a lane actively building its item
 *   ◐  preparing   — scope being shaped: a lane still declaring scope, or a cleared item with no predicted scope
 *   ‖  paused      — a lane auto-paused on a scope breach (two lanes drifted onto one path)
 *   ⏸  parked      — held for human review (a lane's PR, or a NEEDS-YOU parked PR)
 *   →  ready       — cleared & ready; launches on the next free lane
 *   ⛔  blocked     — cleared but waiting on another item to land
 *   ·  waiting     — cleared but not launchable now (no free lane)
 *   ⚠  attention   — a health warning, or a cleared id that is not a ready build-queue row
 */

import { execFileSync } from 'node:child_process';
import { openSync, closeSync, readFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

// ── PURE CORE (no fs / gh / Date / child_process — the whole state is passed IN) ─────────────────────────────

/** The one-symbol-one-meaning marker set (see the legend in the file header). */
export const MARKERS = Object.freeze({
  building: '⟳',
  preparing: '◐',
  paused: '‖',
  parked: '⏸',
  ready: '→',
  blocked: '⛔',
  waiting: '·',
  attention: '⚠',
});

/** The review-park labels a PR can carry — a hard human-only gate that surfaces in NEEDS YOU. */
const REVIEW_LABELS = ['review:human', 'review:pending', 'review:changes'];

const arr = (x) => (Array.isArray(x) ? x : []);
const numKey = (n) => {
  const s = String(n ?? '').trim();
  return /^\d+$/.test(s) ? String(Number(s)) : s.toLowerCase();
};
const hash = (n) => `#${String(n)}`;

/** The first review-park label on a PR's labels (normalized to `[string]`), or null when it carries none. */
function reviewLabelOf(labels) {
  const set = new Set(arr(labels).map(String));
  return REVIEW_LABELS.find((l) => set.has(l)) || null;
}

/**
 * The state marker for one active lane, derived from the lane row × the PRs (NOT re-derived from raw leases):
 *   paused-breach (a non-empty breach set) ▸ review-parked (its PR carries a review label) ▸ preparing-scope
 *   (leased but no predicted scope declared yet) ▸ building (the normal case). First match wins.
 * @param {{lease?:string[], breach?:string[], num?:*}} lane
 * @param {Map<string,object>} prByNum  item-num → PR row
 * @returns {'paused'|'parked'|'preparing'|'building'}
 */
export function laneMarker(lane, prByNum) {
  if (arr(lane?.breach).length) return 'paused';
  const pr = lane?.num != null ? prByNum.get(numKey(lane.num)) : null;
  if (pr && reviewLabelOf(pr.labels)) return 'parked';
  if (arr(lane?.lease).length === 0) return 'preparing';
  return 'building';
}

const LANE_STATE_WORD = { building: 'building', preparing: 'preparing-scope', paused: 'paused-breach', parked: 'review-parked' };

/** The human word for the daemon section: the `"unavailable"` sentinel, else resident / absent. */
function daemonWord(daemon) {
  if (daemon === 'unavailable' || daemon == null) return 'unavailable';
  return daemon.resident ? 'resident' : 'absent';
}

/**
 * Render the whole conveyor tick picture into a compact ASCII board. PURE + total: any missing / null / partial
 * slice degrades to an empty section (omitted), never a throw. Sections render only when they have rows.
 * @param {object|null|undefined} state  the `conveyor-state.mjs --json` object
 * @returns {string}
 */
export function renderBoard(state) {
  const s = state && typeof state === 'object' ? state : {};
  const lanes = arr(s.lanes);
  const queue = arr(s.queue);
  const unshaped = arr(s.unshaped);
  const clearedNotReady = arr(s.clearedNotReady);
  const prs = arr(s.prs);
  const health = s.health && typeof s.health === 'object' ? s.health : {};
  const freeSlots = Number.isFinite(s.freeSlots) ? s.freeSlots : 0;

  // item-num → PR row (for the lane-marker join + the NEEDS-YOU section).
  const prByNum = new Map();
  for (const p of prs) if (p?.num != null) prByNum.set(numKey(p.num), p);

  // ── RUNNING: one line per active lane, with its derived state marker. ──
  const laneRows = lanes.map((l) => ({ ...l, marker: laneMarker(l, prByNum) }));

  // ── QUEUE partition: only CLEARED (buildQueued) items that are not yet running. ──
  const unshapedNums = new Set(unshaped.map((u) => numKey(u?.num)));
  const cleared = queue.filter((r) => r?.buildQueued === true);
  const queueRows = [];
  for (const r of cleared) {
    if (unshapedNums.has(numKey(r.num))) {
      queueRows.push({ num: r.num, marker: 'preparing', why: 'preparing scope · author scope: to parallelize' });
    } else if (arr(r.openBlockers).length) {
      queueRows.push({ num: r.num, marker: 'blocked', why: `blocked · waits on ${arr(r.openBlockers).map(hash).join(', ')}` });
    } else if (freeSlots <= 0) {
      queueRows.push({ num: r.num, marker: 'waiting', why: 'no free lane' });
    } else {
      queueRows.push({ num: r.num, marker: 'ready', why: 'ready · will launch' });
    }
  }
  // Cleared ids with NO ready build-queue row (blocked/resolved/typo) — surfaced so a clear never silently vanishes.
  const shownNums = new Set(queueRows.map((r) => numKey(r.num)));
  for (const n of clearedNotReady) {
    if (shownNums.has(numKey(n))) continue;
    queueRows.push({ num: n, marker: 'attention', why: 'cleared-but-not-ready · not a ready build-queue row' });
  }

  // ── NEEDS YOU: parked PRs (a human-only review gate) with the exact action. ──
  const parked = prs
    .map((p) => ({ p, label: reviewLabelOf(p?.labels) }))
    .filter((x) => x.label);

  // ── Header counts (each maps to a section; documented so a glance is unambiguous). ──
  const running = laneRows.length; // every active lane is running work (its sub-state shows as a marker below)
  const preparing = unshaped.length; // cleared items with no predicted scope yet — need shaping to parallelize
  // cleared items waiting to launch (ready / blocked / no-lane / not-ready) — the preparing (unshaped) rows are
  // still rendered in QUEUE but counted under `preparing`, never double-counted here.
  const queued = queueRows.filter((r) => r.marker !== 'preparing').length;
  const needsYou = parked.length; // parked PRs awaiting /review
  const total = freeSlots + running; // pool size = free lanes + occupied lanes

  const header =
    `CONVEYOR · ${running} running · ${preparing} preparing · ${queued} queued · ${needsYou} needs-you` +
    ` · ${freeSlots}/${total} lanes free · health ${health.verdict || 'ok'} · daemon ${daemonWord(s.daemon)}`;

  const blocks = [header];

  if (laneRows.length) {
    const lines = ['RUNNING'];
    for (const l of laneRows) {
      const who = l.num != null ? hash(l.num) : l.session ? String(l.session) : '(unclaimed)';
      let extra = '';
      if (l.marker === 'paused') extra = ` (breach on ${arr(l.breach).length} path${arr(l.breach).length === 1 ? '' : 's'})`;
      else if (l.marker === 'parked') {
        const pr = prByNum.get(numKey(l.num));
        if (pr?.prNumber != null) extra = ` (PR #${pr.prNumber})`;
      }
      lines.push(`  lane-${String(l.lane).padEnd(3)} ${MARKERS[l.marker]} ${who} ${LANE_STATE_WORD[l.marker]}${extra}`);
    }
    blocks.push(lines.join('\n'));
  }

  if (queueRows.length) {
    const lines = ['QUEUE'];
    for (const r of queueRows) lines.push(`  ${hash(r.num).padEnd(8)} ${MARKERS[r.marker]} ${r.why}`);
    blocks.push(lines.join('\n'));
  }

  if (parked.length) {
    const lines = ['NEEDS YOU'];
    for (const { p, label } of parked) {
      const who = p.num != null ? hash(p.num) : `PR #${p.prNumber}`;
      lines.push(`  ${who.padEnd(8)} ${MARKERS.parked} PR #${p.prNumber} ${label} → /review ${p.prNumber}`);
    }
    blocks.push(lines.join('\n'));
  }

  // ── FOOTER: health detail when the verdict is not ok, and the daemon note when it is unavailable. ──
  const footer = [];
  if (health.verdict === 'warn') {
    const stalled = arr(health.stalled);
    if (stalled.length) {
      footer.push(
        `${MARKERS.attention} stalled: ` +
          stalled.map((x) => `lane-${x.lane}${x.num != null ? ` ${hash(x.num)}` : ''} (${x.idleS}s idle)`).join(', '),
      );
    }
    const errors = arr(health.errors);
    if (errors.length) footer.push(`${MARKERS.attention} errors: ${errors.join('; ')}`);
  }
  if (s.daemon === 'unavailable') {
    footer.push(`${MARKERS.attention} drain daemon unavailable — escalations still park, but nothing auto-lands until a drain runs`);
  }
  if (footer.length) blocks.push(footer.join('\n'));

  // A wholly-idle board is just the header + one honest note (nothing running, nothing cleared, nothing parked).
  if (blocks.length === 1) blocks.push('(nothing running or cleared for build — conveyor idle)');

  return blocks.join('\n\n') + '\n';
}

// ── IO SHELL (runs only as a CLI — owns the child_process read of the state) ─────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE_CLI = resolve(HERE, '..', 'readiness', 'conveyor-state.mjs');

function main() {
  let state;
  // Read the whole tick picture in one call — the SAME single read the /conveyor tick starts from. The child's
  // stdout is redirected to a real FILE (not a pipe): conveyor-state.mjs `process.exit(0)`s right after writing
  // its payload, which TRUNCATES an async write to a bounded ~8 KB pipe (the full JSON is ~23 KB) — a file fd
  // drains synchronously and always lands complete. The env is inherited, so CONVEYOR_QUEUE_FILE still aims the
  // state read at this session's sidecar.
  const tmp = join(mkdtempSync(join(tmpdir(), 'conveyor-board-')), 'state.json');
  try {
    const fd = openSync(tmp, 'w');
    try {
      execFileSync('node', [STATE_CLI, '--json'], { stdio: ['ignore', fd, 'pipe'], maxBuffer: 64 * 1024 * 1024 });
    } finally {
      closeSync(fd);
    }
    state = JSON.parse(readFileSync(tmp, 'utf8'));
  } catch (e) {
    process.stderr.write(`status-board: could not read conveyor state — ${String(e.message || e).split('\n')[0]}\n`);
    process.exit(1);
  } finally {
    try { unlinkSync(tmp); } catch { /* best-effort cleanup */ }
  }
  process.stdout.write(renderBoard(state));
  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}
