/**
 * @file wip-agents-io.mjs
 * @description Evidence gathering for the read-only live-session report. Listing is
 * the one required source; failure there must never masquerade as an empty report.
 * Every other source is best effort and isolated per session. Supervisor reads reuse
 * the health inspector's bounded tail; delegation reads stream at most 64 MB and
 * parse only candidate lines. A truncated no-hit scan cannot prove no delegation.
 * Process probes and transcript mtimes are isolated even for done records. Drain logs
 * use bounded 512 KB tails; unreadable logs never fail the report.
 * All external ports can be replaced by tests without launching agents or networking.
 */
import { execFileSync } from 'node:child_process';
import { openSync, readSync, closeSync, statSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { tailLines } from '../../skills-src/inspect-agent-health/agent-health.mjs';
import { CODEX_MODEL } from '../codex-direct-task.mjs';
import { createFileRunStore } from './run-store.mjs';
import { normalizeHandle, isHandleListed } from './dispatch-lane-io.mjs';
import { DISPATCH_EFFECT } from './dispatch-lane.mjs';
import { extractDelegations, lastAssistantModel } from './wip-agents.mjs';
const CAP = 64 * 1024 * 1024;
const parse = (line) => { try { return JSON.parse(line); } catch { return null; } };

function readDrainLog(file) {
  let fd;
  try {
    fd = openSync(file, 'r');
    const size = statSync(file).size, start = Math.max(0, size - 512 * 1024);
    const buffer = Buffer.alloc(size - start);
    let count = 0;
    while (count < buffer.length) {
      const n = readSync(fd, buffer, count, buffer.length - count, start + count);
      if (!n) break;
      count += n;
    }
    const lines = buffer.subarray(0, count).toString('utf8').split('\n');
    if (start) lines.shift();
    return lines.map(parse).filter((v) => v && typeof v === 'object');
  } catch { return null; }
  finally { try { if (fd !== undefined) closeSync(fd); } catch { /* best effort close */ } }
}
function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e?.code === 'EPERM'; }
}
function transcriptFacts(file) {
  const size = statSync(file).size;
  const transcriptModel = lastAssistantModel(tailLines(file, 40, 512 * 1024).lines.map(parse));
  const start = Math.max(0, size - CAP);
  const providers = new Map();
  let skip = start > 0, malformed = false;
  let fragments = [];
  const consume = (line) => {
    if (skip) { skip = false; return; }
    if (!line.includes('direct-task.mjs')) return;
    const entry = parse(line);
    if (!entry) { malformed = true; return; }
    for (const p of extractDelegations([entry], { defaults: { codex: CODEX_MODEL } })) providers.set(p.provider, p);
  };
  // Synchronous chunked streaming matches the operation engine's synchronous compute
  // contract. Memory is bounded by one line (at most CAP), never the whole file.
  const fd = openSync(file, 'r'), buffer = Buffer.alloc(64 * 1024);
  const decoder = new TextDecoder();
  try {
    for (let offset = start; offset < size;) {
      const count = readSync(fd, buffer, 0, Math.min(buffer.length, size - offset), offset);
      if (!count) { malformed = true; break; }
      offset += count;
      const chunk = decoder.decode(buffer.subarray(0, count), { stream: true });
      let begin = 0, newline;
      while ((newline = chunk.indexOf('\n', begin)) !== -1) {
        fragments.push(chunk.slice(begin, newline));
        consume(fragments.join('')); fragments = []; begin = newline + 1;
      }
      if (begin < chunk.length) fragments.push(chunk.slice(begin));
    }
    fragments.push(decoder.decode());
    if (fragments.length) consume(fragments.join(''));
  } finally { closeSync(fd); }
  return { transcriptModel, transcriptScan: providers.size ? { status: 'found', providers: [...providers.values()] }
    : { status: start > 0 || malformed ? 'unknown' : 'none' } };
}
function transcriptPath(agent, home) {
  const root = join(home, '.claude', 'projects');
  // Session ids are filenames, never caller-controlled paths outside projects.
  if (typeof agent?.sessionId !== 'string' || !/^[\w-]+$/.test(agent.sessionId)) return null;
  const name = `${agent.sessionId}.jsonl`;
  const direct = join(root, String(agent.cwd ?? '').replace(/[^A-Za-z0-9]/g, '-'), name);
  try { if (statSync(direct).isFile()) return direct; } catch { /* fallback below */ }
  for (const dir of readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const file = join(root, dir.name, name);
    try { if (statSync(file).isFile()) return file; } catch { /* next project */ }
  }
  return null;
}
function dispatchRecords() {
  const store = createFileRunStore(), records = new Map();
  for (const id of store.list()) {
    try {
      for (const entry of store.read(id)?.effects ?? []) {
        if (entry.type === DISPATCH_EFFECT && entry.handle && entry.dispatch) records.set(normalizeHandle(entry.handle), entry.dispatch);
      }
    } catch { /* one corrupt run must not hide other records */ }
  }
  return records;
}
function version(provider) {
  const program = provider === 'Codex' ? 'codex' : provider === 'Gemini' ? 'agy' : null;
  if (!program) return null;
  return String(execFileSync(program, ['--version'], { encoding: 'utf8', timeout: 3000, stdio: 'pipe' })).trim().match(/\d+\.\d+\.\d+(?:[-+][\w.-]+)?/)?.[0] ?? null;
}
export function createWipAgentsReader({
  listAgents = () => execFileSync('claude', ['agents', '--json'], { encoding: 'utf8', timeout: 15000, stdio: 'pipe' }),
  readTranscript = transcriptFacts, readDispatchRecords = dispatchRecords,
  cliVersion = version, now = Date.now, homeDir = homedir, pidAlive = processAlive,
  statTranscript = (file) => { try { return statSync(file).mtimeMs; } catch { return null; } },
  readDrainHistory = readDrainLog, readDrainAlerts = readDrainLog,
} = {}) {
  return function readAgents() {
    let agents;
    try {
      const raw = listAgents();
      agents = Array.isArray(raw) ? raw : JSON.parse(String(raw));
      if (!Array.isArray(agents)) throw new Error('expected an array');
    } catch (e) { throw new Error(`claude agents --json failed: ${e.message ?? e}`); }
    let records;
    try { records = readDispatchRecords(); } catch { records = new Map(); }
    const facts = Object.create(null), versions = new Map();
    for (const agent of agents) {
      let f = {}, file = null, alive = null, mtime = null;
      if (Object.hasOwn(agent ?? {}, 'pid')) {
        try { alive = pidAlive(agent.pid) === true; } catch { alive = false; }
      }
      try {
        file = transcriptPath(agent, typeof homeDir === 'function' ? homeDir() : homeDir);
        if (file) f = readTranscript(file, agent) ?? {};
      } catch { /* unknown evidence for only this session */ }
      try { if (file) mtime = statTranscript(file, agent); } catch { /* unknown mtime */ }
      f.pidAlive = alive; f.transcriptMtimeMs = Number.isFinite(mtime) ? mtime : null;
      const entries = records instanceof Map ? records.entries() : Object.entries(records ?? {});
      for (const [handle, record] of entries) {
        if (isHandleListed(handle, [agent]) || (normalizeHandle(handle) && normalizeHandle(handle) === normalizeHandle(agent?.id))) { f.dispatch = record; break; }
      }
      const providers = f.dispatch?.executor ? [f.dispatch.executor] : f.transcriptScan?.providers ?? [];
      for (const p of providers) {
        if (!versions.has(p.provider)) {
          try { versions.set(p.provider, cliVersion(p.provider)); } catch { versions.set(p.provider, null); }
        }
        if (versions.get(p.provider)) p.cliVersion = versions.get(p.provider);
      }
      facts[agent?.sessionId] = f;
    }
    let passes = null, alerts = null;
    try {
      const dir = process.env.WIP_DRAIN_DIR || join(typeof homeDir === 'function' ? homeDir() : homeDir, 'workspace/plateau-app/.drain-daemon');
      try { passes = readDrainHistory(join(dir, 'history.jsonl')) ?? null; } catch { /* unreadable history */ }
      try { alerts = readDrainAlerts(join(dir, 'alerts.jsonl')) ?? null; } catch { /* unreadable alerts */ }
    } catch { /* unavailable home */ }
    return { agents, facts, now: Number(now()), drain: { passes, alerts } };
  };
}
