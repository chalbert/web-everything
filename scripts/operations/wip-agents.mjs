/**
 * @file wip-agents.mjs
 * @description Process-backed session liveness and drain health, with evidence for delegation.
 * This declaration is read-only: both steps compute, with no sinks or ambient IO.
 * Missing evidence remains unknown. JSON retains every session; the table groups
 * dead records and hides done sessions only when their process is not alive.
 * Dispatch facts outrank transcript observations, while absence of delegation is
 * asserted only after a complete scan. The shell owns clocks, files and processes.
 */
import { op } from './registry.mjs';
import { compute } from './step-kinds.mjs';
export const WIP_AGENTS_OP = 'wip-agents';

// Mirrored from session-reaper: importing it would contaminate the read-only graph.
// The name-table test pins these two grammars together.
function target(name) {
  const s = String(name ?? '');
  let m = s.match(/^(?:conveyor|prepare-decision|prepare)-(\d+)[a-z]?$/i);
  if (m) return `item #${m[1]}`;
  m = s.match(/^(?:review|fix|ci-heal)-(\d+)[a-z]?$/i);
  return m ? `PR #${m[1]}` : null;
}

/** Tokenize shell words without treating quoted separators or mentions as commands. */
function commands(command) {
  const groups = [[]];
  let value = '', active = false, quoted = false, quote = null;
  const heredocs = [];
  const word = () => { if (active) groups.at(-1).push({ value, quoted }); value = ''; active = quoted = false; };
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === '\\' && quote === '"') value += command[++i] ?? '';
      else value += c;
      continue;
    }
    if (c === '<' && command[i + 1] === '<' && command[i + 2] !== '<' && command[i - 1] !== '<') {
      const match = command.slice(i).match(/^<<(-?)[ \t]*(?:'([^']+)'|"([^"]+)"|([\w-]+))/);
      if (match) {
        word(); heredocs.push({ delimiter: match[2] ?? match[3] ?? match[4], tabs: match[1] === '-' });
        i += match[0].length - 1; continue;
      }
    }
    if (c === '\n' && heredocs.length) {
      word(); groups.push([]);
      for (const doc of heredocs.splice(0)) {
        while (i < command.length) {
          const end = command.indexOf('\n', i + 1);
          const line = command.slice(i + 1, end < 0 ? command.length : end);
          i = end < 0 ? command.length : end;
          if ((doc.tabs ? line.replace(/^\t+/, '') : line) === doc.delimiter) break;
        }
      }
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; active = quoted = true; }
    else if (c === '\\') { active = true; value += command[++i] ?? ''; }
    else if (';|&()\n'.includes(c)) { word(); groups.push([]); }
    else if (/\s/.test(c)) word();
    else if (c === '#' && !active) { while (i < command.length && command[i] !== '\n') i++; word(); groups.push([]); }
    else { active = true; value += c; }
  }
  word();
  return groups;
}
const SCRIPTS = { 'codex-direct-task.mjs': ['Codex', 'codex'], 'gemini-direct-task.mjs': ['Gemini', 'gemini'] };
export function extractDelegations(entries, { defaults = {} } = {}) {
  const providers = new Map();
  for (const entry of entries) {
    if (entry?.type !== 'assistant' || (entry.message?.role && entry.message.role !== 'assistant')) continue;
    for (const tool of Array.isArray(entry.message?.content) ? entry.message.content : []) {
      if (tool?.type !== 'tool_use' || tool.name !== 'Bash' || typeof tool.input?.command !== 'string') continue;
      for (const words of commands(tool.input.command)) {
        let i = 0;
        while (/^[A-Za-z_][\w]*=/.test(words[i]?.value ?? '')) i++;
        if (!words[i] || words[i].quoted || !/(^|\/)node$/.test(words[i++].value)) continue;
        // Eval, syntax-check and help modes do not execute the script argument.
        let invalid = false;
        while (words[i]?.value.startsWith('-')) {
          const flag = words[i++].value;
          if (flag === '--') break;
          if (/^(?:-[epc].*|--eval(?:=.*)?|--print(?:=.*)?|--check|--help|--version|-v)$/.test(flag)) { invalid = true; break; }
          if (['-r', '--require', '--import', '--loader', '--experimental-loader', '--conditions', '-C', '--max-old-space-size', '--stack-size', '--title', '--inspect-port', '--input-type', '--env-file', '--experimental-default-type'].includes(flag)) i++;
        }
        const script = words[i++];
        const spec = script && !script.quoted && SCRIPTS[script.value.split('/').at(-1)];
        if (invalid || !spec) continue;
        let model = defaults[spec[1]] || 'unknown';
        for (; i < words.length; i++) {
          const arg = words[i].value;
          if (arg.startsWith('--model=')) model = arg.slice(8) || 'unknown';
          else if (arg === '--model' || arg === '-m') model = words[++i]?.value || 'unknown';
        }
        // Shell expansion cannot supply an exact model id from transcript text alone.
        if (/[\$`]/.test(model)) model = 'unknown';
        providers.set(spec[0], { provider: spec[0], model });
      }
    }
  }
  return [...providers.values()];
}
export function lastAssistantModel(entries) {
  return entries.filter((e) => e?.type === 'assistant' && (!e.message?.role || e.message.role === 'assistant'))
    .map((e) => e.message?.model).filter((m) => typeof m === 'string' && m.trim() && m !== '<synthetic>').at(-1) ?? null;
}
export function pickSupervisor(record, model) {
  const requested = record?.supervisorModel;
  if (typeof requested === 'string' && /^claude-/.test(requested)) return { model: requested, source: 'dispatch' };
  if (model) return { model, source: 'transcript' };
  if (typeof requested === 'string' && requested.trim()) return { model: `requested: ${requested}`, source: 'dispatch' };
  return { model: 'unknown', source: 'unknown' };
}
export function pickExecutor(record, scan) {
  if (record?.executor?.provider) return { providers: [record.executor], source: 'dispatch' };
  if (scan?.status === 'found' && scan.providers?.length) return { providers: scan.providers, source: 'transcript' };
  return { providers: [], source: scan?.status === 'none' ? 'transcript' : 'unknown' };
}
export const ACTIVE_WINDOW_MS = 15 * 60 * 1000;
const rawState = (a) => (a?.kind === 'interactive' ? a?.status ?? a?.state : a?.state ?? a?.status) ?? null;
const elapsed = (now, at) => Number.isFinite(at) ? Math.max(0, Number(now) - at) : null;
export function classifyLiveness(agent, { pidAlive, transcriptMtimeMs, now }) {
  if (rawState(agent) === 'done') return 'done';
  if (!Object.hasOwn(agent ?? {}, 'pid') || pidAlive !== true) return 'dead-record';
  if (agent.waitingFor) return 'waiting';
  return Number.isFinite(transcriptMtimeMs) && elapsed(now, transcriptMtimeMs) <= ACTIVE_WINDOW_MS ? 'live-active' : 'live-idle';
}
export function classifyAgents({ agents, facts = {}, now }) {
  const fact = (id) => facts instanceof Map ? facts.get(id) : facts[id];
  return agents.slice().sort((a, b) =>
    (Number(a?.startedAt) || 0) - (Number(b?.startedAt) || 0) || String(a?.id ?? '').localeCompare(String(b?.id ?? '')))
    .map((a) => {
      const f = fact(a?.sessionId) ?? {};
      return { id: a?.id ?? (typeof a?.sessionId === 'string' && a.sessionId ? a.sessionId.slice(0, 8) : 'unknown'), sessionId: a?.sessionId ?? 'unknown', name: a?.name ?? 'unknown',
        kind: a?.kind ?? 'unknown', target: target(a?.name), state: rawState(a) || 'unknown', wasState: rawState(a),
        liveness: classifyLiveness(a, { ...f, now }), pid: Number.isFinite(a?.pid) ? a.pid : null,
        pidAlive: typeof f.pidAlive === 'boolean' ? f.pidAlive : null, transcriptAgeMs: elapsed(now, f.transcriptMtimeMs),
        ageMs: elapsed(now, a?.startedAt),
        waitingFor: a?.waitingFor ?? null, supervisor: pickSupervisor(f.dispatch, f.transcriptModel),
        executor: pickExecutor(f.dispatch, f.transcriptScan) };
    });
}
const age = (ms) => ms == null || !Number.isFinite(ms) ? 'unknown' : ms >= 86400000
  ? `${Math.floor(ms / 86400000)}d ${Math.floor(ms / 3600000) % 24}h` : ms >= 3600000
    ? `${Math.floor(ms / 3600000)}h ${Math.floor(ms / 60000) % 60}m` : `${Math.floor(ms / 60000)}m`;
const band = (ms) => ms == null ? 'unknown' : ms < 3600000 ? '<1h' : ms < 86400000 ? '1h-1d' : ms < 7 * 86400000 ? '1d-7d' : '7d+';
export function renderTable(rows) {
  const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
  const lines = ['| Item | Detail | Supervisor | Executor |', '| --- | --- | --- | --- |'];
  const add = (cells) => lines.push('| ' + cells.map(cell).join(' | ') + ' |');
  const order = ['live-active', 'waiting', 'live-idle', 'done'];
  const live = rows.filter((r) => r.liveness !== 'dead-record' && (r.liveness !== 'done' || r.pidAlive === true))
    .sort((a, b) => order.indexOf(a.liveness) - order.indexOf(b.liveness) || (b.ageMs ?? Infinity) - (a.ageMs ?? Infinity));
  for (const r of live) add([
    `\`${r.name}\` (${r.id}) · ${r.target ?? r.kind}`,
    `${r.liveness === 'waiting' ? `⚠ waiting on: ${r.waitingFor} · ` : ''}${r.liveness === 'done' ? 'done (process still alive)' : r.liveness} · state ${r.state} · ${age(r.ageMs)} · transcript ${r.transcriptAgeMs == null ? 'unknown' : `${age(r.transcriptAgeMs)} ago`}`,
    r.supervisor.model,
    r.executor.providers.length ? r.executor.providers.map((p) => `${p.provider} (${p.model || 'unknown'}${p.cliVersion ? `, cli ${p.cliVersion}` : ''})`).join(' + ')
      : r.executor.source === 'unknown' ? 'unknown' : 'none',
  ]);
  const groups = new Map();
  for (const r of rows.filter((r) => r.liveness === 'dead-record')) {
    const state = r.wasState && r.wasState !== 'unknown' ? r.wasState : null;
    const key = JSON.stringify([state, band(r.ageMs)]);
    if (!groups.has(key)) groups.set(key, { state, band: band(r.ageMs), names: [] });
    groups.get(key).names.push(r.name);
  }
  for (const g of groups.values()) add([
    `dead-record${g.state ? ` (was ${g.state})` : ''} ×${g.names.length} · age ${g.band}`,
    g.names.slice(0, 6).map((n) => `\`${n}\``).join(', ') + (g.names.length > 6 ? ` +${g.names.length - 6} more (see --json)` : ''), '—', '—',
  ]);
  if (!rows.some((r) => r.liveness !== 'done')) add(['—', 'No live agents.', '—', '—']);
  const hidden = rows.filter((r) => r.liveness === 'done' && r.pidAlive !== true).length;
  if (hidden) lines.push(`${hidden} done (not shown)`);
  return lines.join('\n');
}
export function classifyDrain({ passes, alerts, now } = {}) {
  const last = passes?.at(-1), latest = alerts?.at(-1) ?? null;
  let start = (alerts?.length ?? 0) - 1;
  while (start > 0 && alerts[start - 1].signature === latest.signature) start--;
  return { readable: passes != null, alertsReadable: alerts != null, lastPassAt: last?.at ?? null,
    lastPassAgeMs: elapsed(now, Date.parse(last?.at)),
    alert: latest ? { ...latest, standingSince: alerts[start].at, lastLoggedAt: latest.at } : null,
    deferred: (last?.deferredDetail ?? []).map((pr) => {
      let i = passes.length - 1;
      while (i >= 0 && passes[i].deferredDetail?.some((p) => p.num === pr.num)) i--;
      return { ...pr, streak: passes.length - 1 - i, sinceAt: passes[i + 1].at, capped: i === -1 };
    }) };
}
const etTime = (at) => {
  if (!Number.isFinite(Date.parse(at))) return 'unknown';
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }).formatToParts(new Date(at));
  const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute} ${p.timeZoneName}`;
};
export function renderDrain(drain) {
  if (!drain.readable) return 'drain: unknown (history.jsonl unreadable)';
  const lines = [], stale = drain.lastPassAgeMs == null || drain.lastPassAgeMs > ACTIVE_WINDOW_MS;
  if (stale) lines.push(`drain: last pass ${age(drain.lastPassAgeMs)} ago (daemon may be stopped)`);
  if (!stale && !drain.deferred.length) lines.push('drain: last pass clean (no deferred PRs)');
  for (const pr of drain.deferred) {
    const a = drain.alert;
    const flag = !drain.alertsReadable ? 'drain alert log unreadable' : !a || ['ok', 'healthy'].includes(a.health)
      ? 'drain has not flagged it' : `drain has flagged ${a.health} [${(a.types ?? []).join(', ')}] since ${etTime(a.standingSince)}, last logged ${etTime(a.lastLoggedAt)}`;
    lines.push(`PR #${pr.num} deferred ${pr.streak === 1 ? 'this pass' : `every pass (${pr.capped ? 'at least ' : ''}${pr.streak} passes, since ${etTime(pr.sinceAt)})`}: ${pr.waitOn?.length ? pr.waitOn.join(', ') : 'no waitOn recorded'} (${flag})`);
  }
  return lines.join('\n');
}
export function wipAgentsOperation({ readAgents } = {}) {
  if (typeof readAgents !== 'function') throw new TypeError('wip-agents needs readAgents()');
  return op(WIP_AGENTS_OP, { input: {}, verdictFrom: 'assess',
    read: compute({ reads: [], fn: () => readAgents() }),
    assess: compute({ reads: ['findings.read'], fn: (v) => ({ generatedAt: new Date(v.findings.read.now).toISOString(), rows: classifyAgents(v.findings.read), drain: classifyDrain({ ...v.findings.read.drain, now: v.findings.read.now }) }) }),
  });
}
