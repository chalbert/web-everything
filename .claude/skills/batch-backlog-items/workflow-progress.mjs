#!/usr/bin/env node
// workflow-progress.mjs — one-shot liveness probe for a background Workflow run.
//
// WHY THIS EXISTS: the /workflow (parallel batch) orchestrator runs in the background and emits its progress
// via the Workflow tool's `log()` — which lands in /workflows. This VS Code extension has NO /workflows TUI,
// so a long run (#1147 batches routinely take 20–70 min) shows NOTHING in chat until the completion
// notification. That reads as "hung." This script reads the run's on-disk artifacts and prints ONE compact
// status block, so the main loop can forward a heartbeat into chat on a ~2-min ScheduleWakeup tick.
//
// It is a ONE-SHOT (print once, exit) by design: the timer/cadence lives in the main loop (ScheduleWakeup),
// not here — a background poll-loop couldn't surface text into chat anyway (only the agent posting can).
//
// Live signals it reads (all append-as-you-go DURING the run):
//   <session>/subagents/workflows/<wf_id>/journal.jsonl   — a {type:"started"} then {type:"result"} per agent
//   <session>/subagents/workflows/<wf_id>/agent-<id>.jsonl — each agent's transcript (mtime = last activity)
//   <session>/workflows/<wf_id>.json                       — final summary (present once status=completed)
//
// Usage:
//   node workflow-progress.mjs                 # newest run under this project's sessions
//   node workflow-progress.mjs <wf_id>         # a specific run (e.g. wf_c5c5c953-077)
//   node workflow-progress.mjs <path-to-run-dir>
//
// Output: a human heartbeat block on stdout. First line is machine-readable:
//   STATUS=running|completed|failed|unknown DONE=<n> LAUNCHED=<m> RUNNING=<r> IDLE_S=<secs>
// The main loop keeps ticking while STATUS=running and stops on completed/failed.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PROJECTS = path.join(os.homedir(), '.claude', 'projects');

function readLines(file) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim());
  } catch { return []; }
}
function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
function mtime(file) {
  try { return fs.statSync(file).mtimeMs; } catch { return 0; }
}

// Find every run dir: <session>/subagents/workflows/<wf_id>/ containing a journal.jsonl.
function allRunDirs() {
  const out = [];
  let projectDirs = [];
  try { projectDirs = fs.readdirSync(PROJECTS).map((d) => path.join(PROJECTS, d)); } catch { return out; }
  for (const proj of projectDirs) {
    let sessions = [];
    try { sessions = fs.readdirSync(proj).map((s) => path.join(proj, s)); } catch { continue; }
    for (const sess of sessions) {
      const wfDir = path.join(sess, 'subagents', 'workflows');
      let runs = [];
      try { runs = fs.readdirSync(wfDir).map((r) => path.join(wfDir, r)); } catch { continue; }
      for (const run of runs) {
        const journal = path.join(run, 'journal.jsonl');
        if (fs.existsSync(journal)) out.push({ runDir: run, session: sess, wfId: path.basename(run), journalMtime: mtime(journal) });
      }
    }
  }
  return out;
}

function resolveTarget(arg) {
  if (arg && fs.existsSync(arg) && fs.statSync(arg).isDirectory()) {
    return { runDir: arg, session: path.resolve(arg, '..', '..', '..'), wfId: path.basename(arg) };
  }
  const runs = allRunDirs();
  if (arg) {
    const hit = runs.find((r) => r.wfId === arg || r.wfId.includes(arg));
    if (hit) return hit;
  }
  // default: newest by journal mtime
  runs.sort((a, b) => b.journalMtime - a.journalMtime);
  return runs[0] || null;
}

function tailAgentActivity(runDir, runningIds) {
  // For each running agent, derive a one-line "what it's doing" from its transcript tail + mtime.
  const lines = [];
  for (const id of runningIds) {
    const file = path.join(runDir, `agent-${id}.jsonl`);
    const evs = readLines(file);
    let label = id.slice(0, 8);
    let doing = 'starting…';
    // walk backwards for the last meaningful action: a tool_use name, or an assistant text snippet.
    for (let i = evs.length - 1; i >= 0 && i > evs.length - 40; i--) {
      let o; try { o = JSON.parse(evs[i]); } catch { continue; }
      const content = o?.message?.content;
      if (!Array.isArray(content)) continue;
      const tool = content.find((c) => c.type === 'tool_use');
      if (tool) {
        const name = tool.name || 'tool';
        const inp = tool.input || {};
        const hint = inp.description || inp.command || inp.file_path || inp.prompt || '';
        doing = `${name}${hint ? ` — ${String(hint).slice(0, 60)}` : ''}`;
        break;
      }
      const txt = content.find((c) => c.type === 'text' && c.text && c.text.trim());
      if (txt) { doing = txt.text.trim().replace(/\s+/g, ' ').slice(0, 70); break; }
    }
    const ageS = evs.length ? Math.round((Date.now() - mtime(file)) / 1000) : -1;
    lines.push(`     • ${label}: ${doing}${ageS >= 0 ? `  (${ageS}s ago)` : ''}`);
  }
  return lines;
}

const target = resolveTarget(process.argv[2]);
if (!target) {
  console.log('STATUS=unknown DONE=0 LAUNCHED=0 RUNNING=0 IDLE_S=-1');
  console.log('No workflow run found (no journal.jsonl under any session). Has a /workflow batch been launched?');
  process.exit(0);
}

const { runDir, session, wfId } = target;
const journal = readLines(path.join(runDir, 'journal.jsonl'));
const started = new Set();
const resulted = new Set();
const resultsByAgent = new Map();
for (const line of journal) {
  let o; try { o = JSON.parse(line); } catch { continue; }
  if (o.type === 'started' && o.agentId) started.add(o.agentId);
  if (o.type === 'result' && o.agentId) { resulted.add(o.agentId); resultsByAgent.set(o.agentId, o.result); }
}
const runningIds = [...started].filter((id) => !resulted.has(id));

// newest activity across ALL agent transcripts = global liveness (detects a true stall vs. just-slow).
let newest = 0;
try {
  for (const f of fs.readdirSync(runDir)) {
    if (f.startsWith('agent-') && f.endsWith('.jsonl')) newest = Math.max(newest, mtime(path.join(runDir, f)));
  }
} catch { /* ignore */ }
const idleS = newest ? Math.round((Date.now() - newest) / 1000) : -1;

// completion: the final summary file appears under <session>/workflows/<wf_id>.json once the run ends.
const summary = readJSON(path.join(session, 'workflows', `${wfId}.json`));
let status = 'running';
if (summary?.status === 'completed' || summary?.status === 'failed') status = summary.status;

// phase + recent script log lines, if the summary file is present (it carries logs[] + phases).
let phaseLine = '';
let recentLogs = [];
if (summary) {
  if (Array.isArray(summary.logs)) recentLogs = summary.logs.slice(-3);
}

// ── machine-readable first line ──
console.log(`STATUS=${status} DONE=${resulted.size} LAUNCHED=${started.size} RUNNING=${runningIds.length} IDLE_S=${idleS}`);

// ── human heartbeat block ──
const stall = idleS >= 0 && idleS > 180 && status === 'running';
if (status === 'completed' || status === 'failed') {
  console.log(`✓ workflow ${wfId} ${status} — ${resulted.size}/${started.size} agents finished.`);
  if (recentLogs.length) console.log(recentLogs.map((l) => `     ${l}`).join('\n'));
} else {
  const flag = stall ? ' ⚠ possible stall' : '';
  console.log(`⏳ workflow ${wfId} — ${resulted.size}/${started.size} agents done, ${runningIds.length} running · last activity ${idleS}s ago${flag}`);
  if (phaseLine) console.log(`   ${phaseLine}`);
  if (runningIds.length) console.log(tailAgentActivity(runDir, runningIds.slice(0, 6)).join('\n'));
}
