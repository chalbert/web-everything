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

// ── Health scan (the point of the whole thing) ──────────────────────────────────────────────────────────
// The orchestrator script is fully `await`-based: while it is suspended awaiting parallel(probes) or a lane
// agent(), it CANNOT observe an in-flight agent going idle or erroring — it is blocked. So stall/error/thrash
// detection can ONLY happen out-of-band, here, reading the transcripts' mtimes + tails. This is what closes the
// "blind until the run ends 1h later" gap: every tick judges liveness instead of just echoing a count.
const STALL_S = Number(process.env.WF_STALL_S || 180);   // an agent silent longer than this is a suspected stall
const THRASH_N = 4;                                        // N identical consecutive tool calls = spinning
const ERR_MARKERS = [
  'overloaded', 'overloaded_error', 'rate_limit', 'rate limit', 'api error', 'too many requests',
  'internal server error', 'econnreset', 'etimedout', 'service unavailable', 'invalidstate',
];

function agentLabel(runDir, id, labelById) {
  // Prefer the label the journal recorded (probe:#NNNN / lane:#NNNN) — but real journals don't carry one, so
  // scrape the transcript. The universally-present signal is the item # (every worker prompt names it); a role
  // word (serial/integrate/probe/…) is present for SOME agent types, so prefix it only when found WITH a number.
  if (labelById && labelById.get(id)) return labelById.get(id);
  const head = readLines(path.join(runDir, `agent-${id}.jsonl`)).slice(0, 8).join(' ');
  // The ITEM number is written distinctively as `#NNNN ("slug")` (most agents) or `item #NNNN` (integrate) —
  // match those, NOT the framework refs (#1933/#1167/#1147) that pepper the prompt boilerplate first.
  const num = (head.match(/#(\d{3,5})\s*\("/) || head.match(/\bitem #(\d{3,5})\b/i) || [])[1];
  const role = (head.match(/\b(probe|lane|serial|replay|integrate|setup)\b/i) || [])[1];
  if (num) return `${role ? role.toLowerCase() + ':' : ''}#${num}`;
  if (role) return role.toLowerCase();
  return id.slice(0, 8);
}

// Return { flags:[{id,label,kind,detail,ageS}], stalled, errored, thrash } for the running agents.
function scanHealth(runDir, runningIds, labelById) {
  const flags = [];
  for (const id of runningIds) {
    const file = path.join(runDir, `agent-${id}.jsonl`);
    const evs = readLines(file);
    const ageS = evs.length ? Math.round((Date.now() - mtime(file)) / 1000) : -1;
    const label = agentLabel(runDir, id, labelById);

    // (1) STALL — no transcript writes for a long time (or never started writing).
    if (evs.length === 0 && ageS < 0) { flags.push({ id, label, kind: 'stall', detail: 'no transcript yet — may have failed to start', ageS: -1 }); continue; }
    if (ageS > STALL_S) flags.push({ id, label, kind: 'stall', detail: `silent ${ageS}s (> ${STALL_S}s)`, ageS });

    // (2) ERROR — an error-shaped event in the LAST few events. Kept narrow (transient overloads are common and
    // agents retry through them — 18/56 transcripts hit one in the last run and recovered); a marker still in the
    // final events is one the agent has NOT worked past, which is the signal worth a wake.
    const tail = evs.slice(-5);
    for (let i = tail.length - 1; i >= 0; i--) {
      const low = tail[i].toLowerCase();
      const isErr = low.includes('"is_error":true') || ERR_MARKERS.some((m) => low.includes(m));
      if (isErr) {
        const which = ERR_MARKERS.find((m) => low.includes(m)) || 'tool error (is_error)';
        flags.push({ id, label, kind: 'error', detail: `recent error: ${which}`, ageS });
        break;
      }
    }

    // (3) THRASH — the last THRASH_N tool_use calls are byte-identical (same name+target) → spinning in place.
    const sigs = [];
    for (let i = evs.length - 1; i >= 0 && sigs.length < THRASH_N; i--) {
      let o; try { o = JSON.parse(evs[i]); } catch { continue; }
      const content = o?.message?.content;
      if (!Array.isArray(content)) continue;
      const t = content.find((c) => c.type === 'tool_use');
      if (t) sigs.push(`${t.name}|${JSON.stringify(t.input?.command || t.input?.file_path || t.input?.description || '')}`);
    }
    if (sigs.length === THRASH_N && new Set(sigs).size === 1) {
      flags.push({ id, label, kind: 'thrash', detail: `repeated ${THRASH_N}× — ${sigs[0].slice(0, 60)}`, ageS });
    }
  }
  return {
    flags,
    stalled: flags.filter((f) => f.kind === 'stall').length,
    errored: flags.filter((f) => f.kind === 'error').length,
    thrash: flags.filter((f) => f.kind === 'thrash').length,
  };
}

const target = resolveTarget(process.argv.slice(2).find((a) => !a.startsWith('--')));
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
const labelById = new Map();  // agentId -> the label the orchestrator gave it (probe:#NNNN / lane:#NNNN), if the journal records one
for (const line of journal) {
  let o; try { o = JSON.parse(line); } catch { continue; }
  if (o.type === 'started' && o.agentId) { started.add(o.agentId); if (o.label) labelById.set(o.agentId, o.label); }
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

// ── health scan (out-of-band; the script itself can't see an in-flight stall) ──
const wantHealth = process.argv.slice(2).includes('--health');
const health = status === 'running' ? scanHealth(runDir, runningIds, labelById) : { flags: [], stalled: 0, errored: 0, thrash: 0 };
const healthOk = health.flags.length === 0;

// ── machine-readable lines ──
console.log(`STATUS=${status} DONE=${resulted.size} LAUNCHED=${started.size} RUNNING=${runningIds.length} IDLE_S=${idleS}`);
console.log(`HEALTH=${status !== 'running' ? 'done' : healthOk ? 'ok' : 'warn'} STALLED=${health.stalled} ERRORS=${health.errored} THRASH=${health.thrash}`);

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
  // Health verdict: list every flagged agent so the wake is a review, not just a count. Silent when all-green
  // unless --health forces the "✓ all N running agents healthy" confirmation.
  if (!healthOk) {
    console.log(`   ⚠ HEALTH WARN — ${health.stalled} stalled · ${health.errored} errored · ${health.thrash} thrashing (consider TaskStop → fall back to serial):`);
    for (const f of health.flags.slice(0, 10)) console.log(`     ✗ ${f.label} [${f.kind}] ${f.detail}`);
  } else if (wantHealth && runningIds.length) {
    console.log(`   ✓ health: all ${runningIds.length} running agent(s) live (none stalled/errored/thrashing).`);
  }
}
