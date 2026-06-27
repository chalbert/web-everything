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
const STEP_LIMIT = 10;       // live step-stream depth per session
const AGENT_STEP_LIMIT = 6;  // per running subagent

// Short hint for a tool call — the arg that says WHAT it's doing (command / file / query / description).
function toolHint(input) {
  if (!input || typeof input !== 'object') return '';
  const raw = input.command || input.file_path || input.path || input.pattern || input.query || input.description || input.url || '';
  return String(raw).replace(/\s+/g, ' ').trim().slice(0, 64);
}

// Turn one assistant event into 0–2 stream steps (a text line and/or a tool call), newest-relevant last.
function eventSteps(ev) {
  const out = [];
  const at = ev.timestamp;
  for (const b of (Array.isArray(ev.message && ev.message.content) ? ev.message.content : [])) {
    if (b.type === 'text' && b.text && b.text.trim()) {
      out.push({ at, kind: 'text', text: b.text.trim().replace(/\s+/g, ' ').slice(0, 120) });
    } else if (b.type === 'tool_use') {
      const hint = toolHint(b.input);
      out.push({ at, kind: 'tool', text: '→ ' + b.name + (hint ? ' ' + hint : '') });
    }
  }
  return out;
}
// A backlog num inside an agent label — workflow lanes are labelled `verify:#353`, `probe:1149`,
// `slice-1622`, etc. Match a 2–4 digit run on word boundaries (so `b1`/`D3`/`G1` don't false-match);
// the `#` is optional. This is the membership signal that ties a running lane back to its card.
const NUM_RE = /\b(\d{2,4})\b/;

// Recent step-stream + last line from a subagent transcript. Reads only the tail of the file
// (transcripts grow large) and fails soft. Returns { lastLine, steps } (steps oldest→newest).
function tailSteps(jsonlPath, limit) {
  try {
    if (!existsSync(jsonlPath)) return { steps: [] };
    let text = readFileSync(jsonlPath, 'utf8');
    if (text.length > 131072) text = text.slice(-131072); // tail only; a partial first line is skipped below
    const lines = text.split('\n').filter(Boolean);
    const steps = [];
    for (const line of lines) {
      let ev;
      try { ev = JSON.parse(line); } catch { continue; } // skip a truncated tail line
      if (ev.type !== 'assistant' || !ev.message) continue;
      for (const s of eventSteps(ev)) { steps.push(s); if (steps.length > limit) steps.shift(); }
    }
    // Prefer the last TEXT step as the agent's "message" (its prose result) over a trailing tool call
    // like StructuredOutput, which reads as "→ StructuredOutput" and says nothing.
    let lastLine;
    for (let i = steps.length - 1; i >= 0; i--) { if (steps[i].kind === 'text') { lastLine = steps[i].text; break; } }
    if (!lastLine && steps.length) lastLine = steps[steps.length - 1].text;
    return { lastLine, steps };
  } catch { return { steps: [] }; }
}

// Cache an agent transcript tail by file mtime — a done agent's file never changes, so it's parsed once.
const AGENT_TAIL_CACHE = new Map(); // path → { mtimeMs, tail }
function cachedAgentTail(p) {
  let mtimeMs;
  try { mtimeMs = statSync(p).mtimeMs; } catch { return { steps: [] }; } // no transcript (pruned / not written)
  const c = AGENT_TAIL_CACHE.get(p);
  if (c && c.mtimeMs === mtimeMs) return c.tail;
  const tail = tailSteps(p, AGENT_STEP_LIMIT);
  AGENT_TAIL_CACHE.set(p, { mtimeMs, tail });
  return tail;
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
  // A workflow agent's transcript lives at <session>/subagents/workflows/<runId>/agent-<agentId>.jsonl
  // (NOT <session>/subagents/, which holds plain Agent-tool subagents).
  const agentDir = join(sessionDir, 'subagents', 'workflows', String(j.runId || ''));
  const progress = Array.isArray(j.workflowProgress) ? j.workflowProgress : [];

  const agents = progress
    .filter((e) => e.type === 'workflow_agent')
    .map((e) => {
      const num = (String(e.label || '').match(NUM_RE) || [])[1];
      const state = e.state || 'running';
      const a = { index: e.index, label: e.label, phaseTitle: e.phaseTitle, agentId: e.agentId, state, num };
      // Tail EVERY agent's transcript for its message stream — a done agent's final message is its
      // result, which is exactly what you want to read. Cached by file mtime (a done agent's transcript
      // is immutable, so it parses once), so re-tailing a big finished run each tick stays cheap.
      if (e.agentId) {
        const t = cachedAgentTail(join(agentDir, `agent-${e.agentId}.jsonl`));
        if (t.lastLine) a.lastLine = t.lastLine;
        if (t.steps && t.steps.length) a.steps = t.steps;
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

// ── Per-session live digest (#1854 v2) ────────────────────────────────────────────────────────────
// The "live chat progress" for NON-workflow work (prepare / decide / slice / build / batch). Each of
// those runs in an ordinary session with no run-journal, so the only progress signal is the session's own
// transcript. We map an active item → the session working it by replaying that session's backlog CLI
// calls (claim adds ownership, resolve/release removes it; net set = what it currently owns), then tail
// the same transcript for a digest: the current in-progress todo, last tool, and last assistant line.
const SESSION_CACHE = new Map(); // sessionId → { mtimeMs, digest }
// A REAL backlog CLI invocation, anchored to a command boundary (line start, `;`, `&&`, `|`), optional
// `node `, then a quote/space-free path ending in backlog.mjs. Anchoring matters: it must NOT match a
// command that merely MENTIONS the string — e.g. `grep 'backlog.mjs claim 1854'` (backlog.mjs sits inside
// a quote, not at a command boundary) would otherwise be miscounted as a claim and leak a resolved item.
const BACKLOG_VERB_RE = /(?:^|[\n;&|])\s*(?:node\s+)?[^\s'"]*backlog\.mjs\s+(claim|resolve|release)\s+(\d+)/g;

function digestSession(jsonlPath) {
  let text;
  try { text = readFileSync(jsonlPath, 'utf8'); } catch { return null; }
  const owned = new Set();
  const steps = [];
  let currentTodo, lastTool, lastLine;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (ev.type !== 'assistant' || !ev.message) continue;
    for (const b of (Array.isArray(ev.message.content) ? ev.message.content : [])) {
      if (b.type === 'tool_use') {
        lastTool = b.name;
        if (b.name === 'Bash' && b.input && typeof b.input.command === 'string') {
          let m;
          BACKLOG_VERB_RE.lastIndex = 0;
          while ((m = BACKLOG_VERB_RE.exec(b.input.command))) {
            if (m[1] === 'claim') owned.add(m[2]); else owned.delete(m[2]);
          }
        }
        if (b.name === 'TodoWrite' && b.input && Array.isArray(b.input.todos)) {
          const ip = b.input.todos.find((t) => t.status === 'in_progress');
          currentTodo = ip ? ip.content : (b.input.todos.length ? b.input.todos[b.input.todos.length - 1].content : currentTodo);
        }
      } else if (b.type === 'text' && b.text && b.text.trim()) {
        lastLine = b.text.trim().replace(/\s+/g, ' ').slice(0, 160);
      }
    }
    for (const s of eventSteps(ev)) { steps.push(s); if (steps.length > STEP_LIMIT) steps.shift(); }
  }
  return { ownedNums: [...owned], currentTodo, lastTool, lastLine, steps };
}

// num → live digest, from every recent top-level session transcript (cached on mtime). A num owned by
// more than one session takes the most recently active one.
function sessionDigests() {
  const out = {};
  if (!existsSync(PROJECTS_DIR)) return out;
  for (const f of readdirSync(PROJECTS_DIR)) {
    if (!/^[0-9a-f-]{36}\.jsonl$/.test(f)) continue; // top-level session transcripts only
    const p = join(PROJECTS_DIR, f);
    let mtimeMs;
    try { mtimeMs = statSync(p).mtimeMs; } catch { continue; }
    if ((Date.now() - mtimeMs) > 6 * 3600_000) continue; // skip stale sessions (>6h)
    const cached = SESSION_CACHE.get(f);
    const d = (cached && cached.mtimeMs === mtimeMs) ? cached.digest : digestSession(p);
    SESSION_CACHE.set(f, { mtimeMs, digest: d });
    if (!d || !d.ownedNums.length) continue;
    const sessionId = f.replace('.jsonl', '');
    const updatedAt = new Date(mtimeMs).toISOString();
    for (const num of d.ownedNums) {
      const prev = out[num];
      if (prev && prev.updatedAt >= updatedAt) continue; // keep the most recently active session
      out[num] = { sessionId: sessionId.slice(0, 8), currentTodo: d.currentTodo, lastTool: d.lastTool, lastLine: d.lastLine, steps: d.steps || [], updatedAt };
    }
  }
  return out;
}

function generate() {
  const runs = [...workflowRuns(), ...batchRuns()];
  const digests = sessionDigests();
  const payload = {
    generatedAt: new Date().toISOString(),
    generatedBy: 'active-progress-watch',
    projectSlug: PROJECT_SLUG,
    updatedAt: runs.length ? runs[0].updatedAt : new Date().toISOString(),
    runs,
    digests,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 2));
  return payload;
}

if (ONCE) {
  const p = generate();
  const wf = p.runs.filter((r) => r.kind === 'workflow').length;
  console.log(`active-progress: wrote ${OUT} — ${p.runs.length} run(s) (${wf} workflow), ${Object.keys(p.digests).length} live session digest(s), slug ${PROJECT_SLUG}`);
} else {
  console.log(`active-progress: watching ${PROJECTS_DIR}\n  → ${OUT} every ${INTERVAL_MS / 1000}s (Ctrl-C to stop)`);
  const tick = () => { try { const p = generate(); process.stdout.write(`\r  ${new Date().toLocaleTimeString()} · ${p.runs.length} run(s)   `); } catch (e) { console.error('tick error:', e.message); } };
  tick();
  setInterval(tick, INTERVAL_MS);
}
