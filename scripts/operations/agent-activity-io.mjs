/**
 * @file scripts/operations/agent-activity-io.mjs
 * @description The IO shell for `./agent-activity.mjs` (backlog #3932) — every filesystem/process read the
 * pure resolver needs, assembled into the flat row shape `resolveAgentActivity` consumes. Nothing here
 * decides a join; it only gathers.
 *
 * SOURCES (design: plateau:docs/wip-live-agent.md §1.1, extended for what's actually on this machine today):
 *  - `claude agents --json --all` (background sessions) + live review-job records (`./review-job-store.mjs`
 *    — PR #2674 made reviews detached node jobs, not `claude --bg` sessions; `listAgentsWithReviewJobs`
 *    already merges the two into one `claude-agents`-shaped array, so both ride the same row-building code).
 *  - Each of those sessions' OWN direct subagents (`<claude-projects>/<cwd-slug>/<sessionId>/subagents/…`) —
 *    looked up from the session's own `cwd`, never a blind tree-walk, so it costs nothing extra when a
 *    dispatched session's cwd is a scratch dir (PR #2701, `~/workspace/.operations/dispatch/<uuid>`) rather
 *    than the daemon's own clone: the project slug is DERIVED from whatever `cwd` really is.
 *  - `.operations/codex-delivery-threads/<slug>.json` records (Codex runs have no `claude agents` entry).
 *  - Lane leases via `lane-pool.mjs status --json` (the same CLI `./stale-state-io.mjs` already shells out
 *    to) — indexed by `ownerSession`/`workerSession`, NOT by a `lane/<num>-…` branch name: live-checked
 *    2026-09-26, every lane in this pool sits on `branch: 'main'` (guard-lane's single-branch-workflow rule),
 *    so the design doc's branch-name assumption no longer holds. The card hint instead comes out of the
 *    lease's own `purpose`/`session` string.
 *  - Claim replay — a bounded tail read of the session's own transcript, reusing `BACKLOG_VERB_RE` from
 *    `we:scripts/dev/active-progress-watch.mjs` (now exported for exactly this reuse) rather than
 *    re-deriving it. NOT yet incremental-by-byte-offset (the design's stated ideal) — every call re-reads
 *    the last 128 KB of each session's transcript. That's the honest gap this slice leaves for whichever
 *    caller finds it too slow; ~n:1854's numbers) are more nervous than a first correct cut needs to be.
 *  - Interactive (non-background) sessions — ONLY scanned when `input.all` is true, since it means walking
 *    every project directory rather than the handful of `cwd`s `claude agents` already named. Off by
 *    default: the epic's own "Live" bar ("every session `claude agents --json` reports … either on a card or
 *    in `unmatched`") is satisfied without it.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { REPO_ROOT, defaultListAgents } from './dispatch-lane-io.mjs';
import { listAgentsWithReviewJobs, REVIEW_JOB_KIND } from './review-job-store.mjs';
import { CODEX_THREAD_DIR_NAME } from './codex-delivery-provider.mjs';
import { BACKLOG_VERB_RE } from '../dev/active-progress-watch.mjs';

export { REPO_ROOT };

/** Where the harness keeps every project's session transcripts. Overridable for tests. */
export function claudeProjectsDir(env = process.env) {
  return env?.AGENT_ACTIVITY_PROJECTS_DIR || join(homedir(), '.claude', 'projects');
}

/** The harness's own cwd → project-slug rule (every non-alphanumeric char becomes `-`) — copied from
 *  `we:scripts/dev/active-progress-watch.mjs`'s `PROJECT_SLUG`, the one other reader that already derives it. */
export function projectSlugFor(cwd) {
  return String(cwd || '').replace(/[^a-zA-Z0-9]/g, '-');
}

const TAIL_BYTES = 131072; // matches active-progress-watch.mjs's own bound

function readTail(path) {
  let text;
  try { text = readFileSync(path, 'utf8'); } catch { return null; }
  return text.length > TAIL_BYTES ? text.slice(-TAIL_BYTES) : text;
}

/** The child's first user message as plain text (string or joined text-blocks) — used by resolver 6
 *  (mention) and the workflow-lane branch of resolver 3. Reads only the first line. Null when unreadable. */
export function firstMessageText(path) {
  let head;
  try {
    const text = readFileSync(path, 'utf8');
    const nl = text.indexOf('\n');
    head = nl === -1 ? text : text.slice(0, nl);
  } catch { return null; }
  let ev;
  try { ev = JSON.parse(head); } catch { return null; }
  const content = ev?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((b) => (b?.type === 'text' ? b.text : '')).join(' ');
  return null;
}

/**
 * A session's own net-claimed backlog items, in claim order, from a BOUNDED tail of its transcript (not yet
 * incremental-by-offset — see this file's header). Only `Bash` calls with a real `backlog.mjs
 * claim|resolve|release NNN` invocation count (the same anchored grammar active-progress-watch.mjs uses).
 * PURE given the text; the only IO is the read itself.
 */
export function claimedNumsFromTranscript(path) {
  const text = readTail(path);
  if (!text) return [];
  const owned = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (ev.type !== 'assistant' || !ev.message) continue;
    for (const b of (Array.isArray(ev.message.content) ? ev.message.content : [])) {
      if (b?.type !== 'tool_use' || b.name !== 'Bash' || !b.input || typeof b.input.command !== 'string') continue;
      let m;
      BACKLOG_VERB_RE.lastIndex = 0;
      while ((m = BACKLOG_VERB_RE.exec(b.input.command))) {
        const num = m[2];
        if (m[1] === 'claim') { if (!owned.includes(num)) owned.push(num); }
        else { const i = owned.indexOf(num); if (i !== -1) owned.splice(i, 1); }
      }
    }
  }
  return owned;
}

/** `lane-pool.mjs status --json` → every LIVE lease on this repo's lane pool. Best-effort: a failure here
 *  means resolver 4 simply finds nothing, never that the whole read fails. */
export function readLaneLeases({ run = execFileSync, root = REPO_ROOT } = {}) {
  try {
    const out = run(process.execPath, [join(root, 'scripts/lane-pool.mjs'), 'status', '--json'], {
      cwd: root, encoding: 'utf8', timeout: 60_000, maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    });
    const parsed = JSON.parse(out);
    return Array.isArray(parsed.lanes) ? parsed.lanes.map((l) => l.lease).filter(Boolean) : [];
  } catch { return []; }
}

/** `Map<sessionId, lease>`, keyed by BOTH `ownerSession` and `workerSession` — either can name the row
 *  resolver 4 is looking at. A lease naming neither is unreachable by session id and simply isn't indexed. */
export function indexLeasesBySession(leases) {
  const bySession = new Map();
  for (const lease of leases) {
    if (lease?.ownerSession) bySession.set(lease.ownerSession, lease);
    if (lease?.workerSession) bySession.set(lease.workerSession, lease);
  }
  return bySession;
}

/** Every direct subagent (plain + workflow-lane) of ONE session, found by ITS OWN `cwd` — never a blind
 *  scan. Missing dir (no subagents, or an unreadable one) → `[]`, not an error: most sessions have none. */
export function subagentRowsFor(parentSessionId, cwd, projectsDir = claudeProjectsDir()) {
  if (!parentSessionId || !cwd) return [];
  const dir = join(projectsDir, projectSlugFor(cwd), parentSessionId, 'subagents');
  if (!existsSync(dir)) return [];
  let entries;
  try { entries = readdirSync(dir); } catch { return []; }
  const rows = [];
  for (const entry of entries) {
    if (entry === 'workflows') {
      const wfBase = join(dir, 'workflows');
      let runIds;
      try { runIds = readdirSync(wfBase); } catch { continue; }
      for (const runId of runIds) {
        const runDir = join(wfBase, runId);
        let files;
        try { files = readdirSync(runDir).filter((f) => /^agent-.*\.jsonl$/.test(f)); } catch { continue; }
        for (const f of files) {
          rows.push({
            id: `${parentSessionId}:wf:${runId}:${f}`, sessionId: null, runtime: 'claude', kind: 'subagent',
            cwd, parentSessionId, workflowLane: true, firstMessageText: firstMessageText(join(runDir, f)),
            state: null, startedAt: null, lastEventAt: null,
          });
        }
      }
      continue;
    }
    if (/^agent-.*\.jsonl$/.test(entry)) {
      rows.push({
        id: `${parentSessionId}:${entry}`, sessionId: null, runtime: 'claude', kind: 'subagent',
        cwd, parentSessionId, workflowLane: false, firstMessageText: firstMessageText(join(dir, entry)),
        state: null, startedAt: null, lastEventAt: null,
      });
    }
  }
  return rows;
}

/** Every recorded Codex delivery thread — `{sessionSlug, threadId, at}` records, one row each. */
export function codexThreadRows(root = REPO_ROOT) {
  const dir = join(root, '.operations', CODEX_THREAD_DIR_NAME);
  let files;
  try { files = readdirSync(dir).filter((f) => f.endsWith('.json')); } catch { return []; }
  const rows = [];
  for (const f of files) {
    let rec;
    try { rec = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
    if (!rec?.sessionSlug || !rec?.threadId) continue;
    rows.push({
      id: `codex-${rec.threadId}`, sessionId: null, runtime: 'codex', kind: 'codex',
      codexSlug: rec.sessionSlug, cwd: null, state: null,
      startedAt: rec.at ? Date.parse(rec.at) || null : null, lastEventAt: null,
    });
  }
  return rows;
}

const RECENT_MS = 6 * 3600_000; // matches active-progress-watch.mjs's own staleness cutoff

/** Top-level session transcripts NOT already accounted for by `claude agents` — the operator's own
 *  interactive chats, or an agent whose harness process has already exited. Recency-bounded (6h) so a full
 *  sweep of `~/.claude/projects` stays cheap; only reachable via `input.all` (see this file's header). */
export function interactiveRows(knownSessionIds, projectsDir = claudeProjectsDir(), now = Date.now()) {
  const rows = [];
  let slugs;
  try { slugs = readdirSync(projectsDir); } catch { return rows; }
  for (const slug of slugs) {
    const slugDir = join(projectsDir, slug);
    let files;
    try { files = readdirSync(slugDir); } catch { continue; }
    for (const f of files) {
      const m = /^([0-9a-f-]{36})\.jsonl$/.exec(f);
      if (!m || knownSessionIds.has(m[1])) continue;
      const path = join(slugDir, f);
      let mtimeMs;
      try { mtimeMs = statSync(path).mtimeMs; } catch { continue; }
      if ((now - mtimeMs) > RECENT_MS) continue;
      rows.push({
        id: m[1], sessionId: m[1], runtime: 'claude', kind: 'interactive', name: null, cwd: null,
        state: null, startedAt: null, lastEventAt: new Date(mtimeMs).toISOString(),
        firstMessageText: firstMessageText(path), claimedNums: claimedNumsFromTranscript(path),
      });
    }
  }
  return rows;
}

/**
 * Build the injected `readActivity(input)` the declared operation calls. Every real read (`claude agents`,
 * the review-job store, lane-pool status, the harness's own project directories) is bound here, and ONLY
 * here — the declaration and the pure resolver import none of it.
 */
export function createAgentActivityReader({
  listAgents = () => defaultListAgents({ all: true }),
  listJobs,
  root = REPO_ROOT,
  projectsDir = claudeProjectsDir(),
  run = execFileSync,
  now = Date.now,
} = {}) {
  return (input = {}) => {
    const base = listAgentsWithReviewJobs({ listAgents, ...(listJobs ? { listJobs } : {}) });
    const leaseIndex = indexLeasesBySession(readLaneLeases({ run, root }));
    const known = new Set();
    const rows = [];
    for (const a of base) {
      const sessionId = a.sessionId ?? null;
      if (sessionId) known.add(sessionId);
      const kind = a.kind === REVIEW_JOB_KIND ? REVIEW_JOB_KIND : 'background';
      const lease = sessionId ? leaseIndex.get(sessionId) ?? null : null;
      const transcriptPath = sessionId && a.cwd ? join(projectsDir, projectSlugFor(a.cwd), `${sessionId}.jsonl`) : null;
      rows.push({
        id: a.id ?? sessionId ?? a.name, sessionId, name: a.name ?? null, runtime: 'claude', kind,
        cwd: a.cwd ?? null, state: a.state ?? null, startedAt: a.startedAt ?? null, lastEventAt: null,
        lease, claimedNums: transcriptPath ? claimedNumsFromTranscript(transcriptPath) : [],
      });
      if (sessionId && a.cwd) rows.push(...subagentRowsFor(sessionId, a.cwd, projectsDir));
    }
    rows.push(...codexThreadRows(root));
    if (input.all) {
      for (const row of interactiveRows(known, projectsDir, now())) {
        row.lease = leaseIndex.get(row.sessionId) ?? null;
        rows.push(row);
      }
    }
    return { rows };
  };
}
