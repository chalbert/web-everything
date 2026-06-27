#!/usr/bin/env node
// Active-work LIVE feed watcher (#1854) — dev-only.
//
// The website can't ask a running workflow to "save its progress to a file": a Workflow script runs
// sandboxed with no filesystem access. It doesn't need to — the HARNESS already persists live progress,
// per session, as the run unfolds:
//   • <session>/workflows/wf_*.json  — the run journal: runId, workflowName, phases[], and a
//     `workflowProgress[]` event stream (workflow_phase + per-agent workflow_agent {label,state,phaseTitle,
//     agentId}). Written incrementally (it's what resumeFromRunId replays).
//   • <session>/subagents/agent-<agentId>.jsonl — each subagent's transcript, appended as it works.
//
// This watcher reads those (NEVER writes them), digests them into the grouped-runs shape the Active-work
// tab expects, and writes it to <output>/active-progress.json so the dev server serves it at
// /active-progress.json for the client poller (src/assets/js/backlog-active.js). It is the read-side
// mirror of how the backlog already surfaces reservations.json. On a static publish nobody runs this, the
// file 404s, and the tab falls back to its build-time snapshot — which is the correct, honest degradation.
//
// Usage:
//   node scripts/dev/active-progress-watch.mjs            # watch loop (default 4s), writes _site/active-progress.json
//   node scripts/dev/active-progress-watch.mjs --once     # write once and exit (test / CI)
//   --interval=<sec>   poll cadence (default 4)
//   --recent=<min>     keep terminal runs whose journal changed within this window (default 10)
//   --out=<path>       output file (default _site/active-progress.json)
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const flag = (name, def) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const ONCE = argv.includes('--once');
const INTERVAL_MS = Number(flag('interval', '4')) * 1000;
const RECENT_MS = Number(flag('recent', '10')) * 60_000;
const OUT = flag('out', join(ROOT, '_site', 'active-progress.json'));

// The harness stores each project's sessions under ~/.claude/projects/<slug>/, where <slug> is the
// absolute repo path with every non-alphanumeric char replaced by '-'. Derive it from cwd so this is
// portable across machines/checkouts.
const PROJECT_SLUG = ROOT.replace(/[^a-zA-Z0-9]/g, '-');
const PROJECTS_DIR = join(homedir(), '.claude', 'projects', PROJECT_SLUG);

const TERMINAL = new Set(['completed', 'failed', 'aborted', 'cancelled']);
// A backlog num inside an agent label — workflow lanes are labelled `verify:#353`, `probe:1149`,
// `slice-1622`, etc. Match a 2–4 digit run on word boundaries (so `b1`/`D3`/`G1` don't false-match);
// the `#` is optional. This is the membership signal that ties a running lane back to its card.
const NUM_RE = /\b(\d{2,4})\b/;

// Last meaningful activity line from a subagent transcript — the tail event's text or tool call. Reads
// only the tail of the file (transcripts grow large) and fails soft to undefined.
function lastActivity(jsonlPath) {
  try {
    if (!existsSync(jsonlPath)) return undefined;
    let text = readFileSync(jsonlPath, 'utf8');
    if (text.length > 65536) text = text.slice(-65536); // tail only; a partial first line is skipped below
    const lines = text.split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      let ev;
      try { ev = JSON.parse(lines[i]); } catch { continue; } // skip a truncated tail line
      if (ev.type !== 'assistant' || !ev.message) continue;
      const blocks = Array.isArray(ev.message.content) ? ev.message.content : [];
      for (let j = blocks.length - 1; j >= 0; j--) {
        const b = blocks[j];
        if (b.type === 'tool_use') return `→ ${b.name}`;
        if (b.type === 'text' && b.text && b.text.trim()) {
          return b.text.trim().replace(/\s+/g, ' ').slice(0, 140);
        }
      }
    }
  } catch { /* fail soft */ }
  return undefined;
}

// Digest one workflow journal file into a run object (null to drop it).
function digestJournal(journalPath) {
  let j;
  try { j = JSON.parse(readFileSync(journalPath, 'utf8')); } catch { return null; }
  const mtimeMs = statSync(journalPath).mtimeMs;
  const status = j.status || 'running';
  // Keep in-flight runs always; keep terminal ones only briefly (so a finished run lingers, then drops).
  if (TERMINAL.has(status) && (Date.now() - mtimeMs) > RECENT_MS) return null;

  const sessionDir = dirname(dirname(journalPath)); // <session>/workflows/wf_x.json → <session>
  const subagentsDir = join(sessionDir, 'subagents');
  const progress = Array.isArray(j.workflowProgress) ? j.workflowProgress : [];

  const agents = progress
    .filter((e) => e.type === 'workflow_agent')
    .map((e) => {
      const num = (String(e.label || '').match(NUM_RE) || [])[1];
      const state = e.state || 'running';
      const a = { index: e.index, label: e.label, phaseTitle: e.phaseTitle, agentId: e.agentId, state, num };
      // Tail the transcript for current activity only on still-running agents (cheaper; done agents are static).
      if (state !== 'done' && e.agentId) {
        const line = lastActivity(join(subagentsDir, `agent-${e.agentId}.jsonl`));
        if (line) a.lastLine = line;
      }
      return a;
    });

  // Current phase = the phase of the first non-done agent, else the last phase announced.
  const phases = progress.filter((e) => e.type === 'workflow_phase');
  const firstOpen = agents.find((a) => a.state !== 'done');
  const phase = firstOpen ? firstOpen.phaseTitle : (phases.length ? phases[phases.length - 1].title : undefined);

  return {
    kind: 'workflow',
    id: j.runId,
    name: j.workflowName || j.runId,
    status,
    phase,
    agentCount: typeof j.agentCount === 'number' ? j.agentCount : agents.length,
    agents,
    updatedAt: new Date(mtimeMs).toISOString(),
  };
}

// All workflow runs across the project's sessions, newest journal first.
function workflowRuns() {
  if (!existsSync(PROJECTS_DIR)) return [];
  const out = [];
  for (const session of readdirSync(PROJECTS_DIR)) {
    const wfDir = join(PROJECTS_DIR, session, 'workflows');
    if (!existsSync(wfDir)) continue;
    for (const f of readdirSync(wfDir)) {
      if (!/^wf_.*\.json$/.test(f)) continue;
      const run = digestJournal(join(wfDir, f));
      if (run) out.push(run);
    }
  }
  return out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

// Live batches from the reservations soft-hold (same source the backlog loader reads). Included for a
// self-describing feed; the client renders only workflow runs (batches already show in the static snapshot).
function batchRuns() {
  try {
    const resPath = join(ROOT, '.claude/skills/batch-backlog-items/reservations.json');
    if (!existsSync(resPath)) return [];
    const res = JSON.parse(readFileSync(resPath, 'utf8'));
    const ttlMs = (typeof res.ttlMinutes === 'number' ? res.ttlMinutes : 120) * 60_000;
    const now = Date.now();
    const bySession = new Map();
    for (const h of (Array.isArray(res.held) ? res.held : [])) {
      if (!h || !h.session || !h.num || Number.isNaN(Date.parse(h.at)) || (now - Date.parse(h.at)) > ttlMs) continue;
      if (!bySession.has(h.session)) bySession.set(h.session, { kind: 'batch', id: h.session, name: h.session, status: 'running', nums: [], updatedAt: h.at });
      const b = bySession.get(h.session);
      b.nums.push(String(h.num));
      if (Date.parse(h.at) > Date.parse(b.updatedAt)) b.updatedAt = h.at;
    }
    return [...bySession.values()].map((b) => ({ ...b, nums: b.nums.sort((x, y) => Number(x) - Number(y)) }));
  } catch { return []; }
}

function generate() {
  const runs = [...workflowRuns(), ...batchRuns()];
  const payload = {
    generatedAt: new Date().toISOString(),
    generatedBy: 'active-progress-watch',
    projectSlug: PROJECT_SLUG,
    updatedAt: runs.length ? runs[0].updatedAt : new Date().toISOString(),
    runs,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 2));
  return payload;
}

if (ONCE) {
  const p = generate();
  const wf = p.runs.filter((r) => r.kind === 'workflow').length;
  console.log(`active-progress: wrote ${OUT} — ${p.runs.length} run(s) (${wf} workflow), slug ${PROJECT_SLUG}`);
} else {
  console.log(`active-progress: watching ${PROJECTS_DIR}\n  → ${OUT} every ${INTERVAL_MS / 1000}s (Ctrl-C to stop)`);
  const tick = () => { try { const p = generate(); process.stdout.write(`\r  ${new Date().toLocaleTimeString()} · ${p.runs.length} run(s)   `); } catch (e) { console.error('tick error:', e.message); } };
  tick();
  setInterval(tick, INTERVAL_MS);
}
