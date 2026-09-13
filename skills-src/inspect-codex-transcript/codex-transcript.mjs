#!/usr/bin/env node
// codex-transcript.mjs — read a Codex CLI run's OWN rollout transcript to answer "what did it do / is it
// stuck?", the Codex-side counterpart to `skills-src/inspect-agent-health/agent-health.mjs`.
//
// WHY THIS EXISTS: this repo dispatches work to Codex as a real second delivery/judge agent
// (`we:scripts/codex-direct-task.mjs`, #3580/#xqa9ttq). Until now the only thing we read back off a Codex
// run was its rollout-QUOTA record (`readRolloutQuota`/`collectAndClearRolloutQuota`) — a single
// `rate_limits` field. That left the natural question "what did the Codex agent actually DO?" answerable
// only from the run's stdout, which is gone once the process exits and is not captured for a backgrounded
// run. It turns out Codex persists the FULL turn-by-turn trace to the same rollout file the quota is read
// from, so the answer was already on disk — nothing was reading it.
//
// ── VERIFIED LIVE (2026-09-13, codex-cli 0.153.4, this machine) ────────────────────────────────────
// Everything below was confirmed by running real `codex exec` probes and reading the files back, not
// inferred from docs:
//   • A rollout file is written for EVERY run at
//       $CODEX_HOME/sessions/YYYY/MM/DD/rollout-<ISO8601>-<threadId>.jsonl   ($CODEX_HOME ?? ~/.codex)
//     where <threadId> is exactly the `thread_id` the run's own `--json` stream prints on `thread.started`.
//   • It is written INCREMENTALLY, while the run is still going — a probe blocked in a 50-second shell
//     command had its prompt, its assistant message and its pending tool call already on disk mid-call.
//     So a live "is it stuck?" read is genuinely possible, exactly as for a Claude subagent.
//   • `codex exec resume <threadId>` APPENDS to the SAME file — one thread is one file across resumes,
//     and a resumed run demonstrably recalled a prior turn's detail verbatim.
//   • What IS readable: the user prompt, every assistant message, every tool call with its literal
//     command/arguments, every tool output with exit code and stdout, per-turn token usage, the model
//     context window, and the rate-limit/quota record.
//   • What is NOT readable: the model's private reasoning. `reasoning` items carry
//     `encrypted_content` (an opaque blob) and a `summary` array that was EMPTY in 66/66 reasoning items
//     across the whole local corpus. There is no Codex equivalent of reading a Claude `thinking` block.
//     Callers that want to judge a Codex run's quality must judge its OBSERVABLE trace (what it ran, what
//     came back, what it concluded), never its deliberation.
//
// ── TWO WAYS THE TRANSCRIPT CAN BE DESTROYED (know these before relying on it) ─────────────────────
//   1. `collectAndClearRolloutQuota()` in `we:scripts/codex-direct-task.mjs` DELETES the rollout file
//      after reading its quota record — that is #x8wbivt Fork 4's ratified shape for a fire-and-forget
//      role. `codexDirectTask` does not call it by default (its `clearRolloutAfterRun` opts in), but any
//      caller that does opt in destroys the transcript this tool reads.
//   2. Codex's own `--ephemeral` flag suppresses the rollout file entirely, so there is nothing to read.
//   A run whose transcript you may later want to audit must avoid BOTH.
//
// ── The core safety property: BOUNDED READ, NEVER THE WHOLE FILE ───────────────────────────────────
// Identical discipline to `agent-health.mjs`, and needed for the same reason: a rollout file is large by
// construction — its very first line embeds the full base instructions and is ~40 KB on its own, before
// any turn content. This script reads at most `--max-bytes` (default 2 MB) off the END of the file,
// splits that chunk into lines, and prints only the last `--lines` (default 15), each with any single
// field truncated to `--field-max` chars (default 400). A single enormous line (a huge tool output)
// cannot blow the budget: the byte cap bounds it regardless of file shape. The total line count is
// obtained by streaming and counting '\n' bytes only. The session header is read with its OWN separate
// small bounded head-read that whitelists a handful of short fields and NEVER retains or prints
// `base_instructions`.
//
// Usage:
//   node codex-transcript.mjs <threadId | rollout path | latest> [options]
//
// Options:
//   --lines=N        tail this many JSONL records (default 15)
//   --max-bytes=N    never read more than this many bytes off the end of the file (default 2_000_000)
//   --field-max=N    truncate any single printed field to this many chars (default 400)
//   --meta-bytes=N   bounded head-read budget for the session header (default 512_000)
//   --codex-home=P   override $CODEX_HOME / ~/.codex
//   --json           print the parsed summary as JSON instead of the human report
//
// Exit code is always 0 (a report, not a pass/fail check) unless the transcript cannot be found, which
// exits 1 with a plain explanation.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// Hard ceilings — NOT just defaults. Mirrors `agent-health.mjs`'s #1905 review finding: a caller-supplied
// override must never be able to defeat the "never the whole file" guarantee this tool exists to provide.
const HARD_MAX_BYTES = 8_000_000;
const HARD_MAX_LINES = 500;
const HARD_MAX_FIELD = 20_000;
const HARD_META_BYTES = 4_000_000;

// Silent this long => no longer plausibly mid-step. Deliberately more generous than agent-health's 180s:
// a Codex tool call is a real shell command (an `npm test`, a clone) and routinely runs for minutes with
// nothing appended to the rollout until it returns.
const STALL_S = 300;

function codexHome(explicit) {
  return explicit || process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

function parseArgs(argv) {
  const opts = {
    lines: 15, maxBytes: 2_000_000, fieldMax: 400, metaBytes: 512_000,
    json: false, codexHome: null, help: false,
  };
  const pos = [];
  for (const a of argv) {
    if (a === '--json') opts.json = true;
    else if (a.startsWith('--lines=')) opts.lines = Math.min(HARD_MAX_LINES, Math.max(1, Number(a.slice(8)) || 15));
    else if (a.startsWith('--max-bytes=')) opts.maxBytes = Math.min(HARD_MAX_BYTES, Math.max(1024, Number(a.slice(12)) || 2_000_000));
    else if (a.startsWith('--field-max=')) opts.fieldMax = Math.min(HARD_MAX_FIELD, Math.max(20, Number(a.slice(12)) || 400));
    else if (a.startsWith('--meta-bytes=')) opts.metaBytes = Math.min(HARD_META_BYTES, Math.max(1024, Number(a.slice(13)) || 512_000));
    else if (a.startsWith('--codex-home=')) opts.codexHome = a.slice(13);
    else if (a === '--help' || a === '-h') opts.help = true;
    else pos.push(a);
  }
  opts.target = pos[0] || null;
  return opts;
}

/** Reduce whatever the caller pasted to a bare thread id: a raw id, a rollout filename, a full path. */
function threadIdFromAny(s) {
  const base = String(s).trim().replace(/^.*\//, '').replace(/\.jsonl$/, '');
  // `rollout-2026-09-13T06-40-29-<uuid>` → `<uuid>`: the id is the trailing 5-group UUID.
  const m = base.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  return m ? m[1] : base;
}

/** Every rollout file under $CODEX_HOME/sessions, newest-mtime first. */
function listRollouts(home) {
  const root = path.join(home, 'sessions');
  const out = [];
  const walk = (dir) => {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.jsonl')) {
        let mtimeMs = 0;
        try { mtimeMs = fs.statSync(p).mtimeMs; } catch { /* ignore */ }
        out.push({ file: p, mtimeMs });
      }
    }
  };
  walk(root);
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function resolveTranscript(opts) {
  const { target } = opts;
  if (!target) return { error: 'no thread id / rollout path / "latest" given' };
  const home = codexHome(opts.codexHome);

  // 1) An existing path — use it directly, whatever it is called.
  if (target.includes('/') || target.includes(path.sep)) {
    try {
      const real = fs.realpathSync(target);
      if (fs.existsSync(real)) return { file: real, home };
    } catch { /* not a live path — fall through to the id/latest lookup */ }
  }

  const all = listRollouts(home);
  if (!all.length) return { error: `no rollout transcripts under ${path.join(home, 'sessions')} (is CODEX_HOME right? was the run made with --ephemeral, which writes none?)` };

  // 2) "latest" — the most recently written rollout, whatever thread it belongs to.
  if (target === 'latest') return { file: all[0].file, home, latest: true };

  // 3) A thread id. Matches `findRolloutFile` in we:scripts/codex-direct-task.mjs: the id is the filename
  //    suffix. A thread resumed N times still has exactly ONE file, so at most one match is expected.
  const id = threadIdFromAny(target);
  if (!id) return { error: `could not derive a thread id from "${target}"` };
  const hits = all.filter((f) => f.file.endsWith(`-${id}.jsonl`));
  if (!hits.length) {
    return {
      error: `no rollout found for thread id "${id}" under ${path.join(home, 'sessions')}. Either the id is wrong, the run used --ephemeral (writes no rollout), or the file was deleted by a caller opting into codex-direct-task.mjs's clearRolloutAfterRun / collectAndClearRolloutQuota.`,
    };
  }
  return { file: hits[0].file, home, ambiguous: hits.length > 1 ? hits.length : 0 };
}

// ── bounded byte-capped tail read (the safety property) ────────────────────────────────────────────
function tailLines(file, n, maxBytes) {
  const fd = fs.openSync(file, 'r');
  try {
    const { size } = fs.fstatSync(fd);
    const start = Math.max(0, size - maxBytes);
    const len = size - start;
    const buf = Buffer.alloc(len);
    if (len > 0) fs.readSync(fd, buf, 0, len, start);
    const rawText = buf.toString('utf8'); // kept UNMODIFIED for the oversized-line fallback below
    let text = rawText;
    if (start > 0) {
      // Started mid-file: the first "line" in the chunk is a partial record — drop it.
      const nl = text.indexOf('\n');
      text = nl === -1 ? '' : text.slice(nl + 1);
    }
    let lines = text.split('\n').filter((l) => l.trim());
    if (!lines.length && rawText.trim()) {
      // One oversized record with no newline in the window — fall back to the RAW chunk so this surfaces
      // something rather than silently reporting zero lines.
      lines = [rawText.trim()];
    }
    return { lines: lines.slice(-n), truncatedHead: start > 0, size };
  } finally {
    fs.closeSync(fd);
  }
}

// Stream-count '\n' bytes only — O(1) memory regardless of file size, never parses or prints content.
function countLines(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const chunkSize = 1 << 20;
    const buf = Buffer.alloc(chunkSize);
    let count = 0;
    let bytesRead;
    let sawAny = false;
    let endedWithNewline = true;
    while ((bytesRead = fs.readSync(fd, buf, 0, chunkSize, null)) > 0) {
      sawAny = true;
      for (let i = 0; i < bytesRead; i++) if (buf[i] === 10) count++;
      endedWithNewline = buf[bytesRead - 1] === 10;
    }
    if (sawAny && !endedWithNewline) count++;
    return count;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Bounded HEAD read for the session header. The rollout's line 0 is `session_meta`, whose
 * `base_instructions` field alone is ~40 KB — so this reads a capped prefix, parses the first line, and
 * keeps ONLY a whitelist of short scalars. `base_instructions` is never retained or printed. A header
 * larger than the cap simply yields null rather than an unbounded read.
 */
function readSessionMeta(file, maxBytes) {
  const fd = fs.openSync(file, 'r');
  try {
    const { size } = fs.fstatSync(fd);
    const len = Math.min(size, maxBytes);
    const buf = Buffer.alloc(len);
    if (len > 0) fs.readSync(fd, buf, 0, len, 0);
    const text = buf.toString('utf8');
    const nl = text.indexOf('\n');
    if (nl === -1) return null; // header longer than the cap — report absence, never widen the read
    let o;
    try { o = JSON.parse(text.slice(0, nl)); } catch { return null; }
    if (o?.type !== 'session_meta') return null;
    const p = o.payload || {};
    return {
      threadId: p.session_id ?? p.id ?? null,
      startedAt: p.timestamp ?? null,
      cwd: p.cwd ?? null,
      originator: p.originator ?? null,   // e.g. "codex_exec"
      cliVersion: p.cli_version ?? null,
      source: p.source ?? null,
      modelProvider: p.model_provider ?? null,
      contextWindow: p.context_window?.window_id ? null : (p.context_window ?? null),
    };
  } catch {
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

// Strip ANSI/OSC/CSI escapes and other C0 control bytes (keeping \n and \t) before anything from a
// transcript reaches a terminal. A Codex rollout embeds raw command STDOUT verbatim — the single most
// likely place for terminal escape sequences to appear — so this matters more here than for a Claude
// transcript, not less.
// eslint-disable-next-line no-control-regex
const ESCAPE_OR_CONTROL_RE = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[[0-?]*[ -/]*[@-~]|\x1b[@-Z\\-_]|[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;
function stripControlSequences(s) {
  return s.replace(ESCAPE_OR_CONTROL_RE, '');
}

function truncate(str, max) {
  const raw = typeof str === 'string' ? str : JSON.stringify(str);
  if (raw == null) return '';
  const s = stripControlSequences(raw);
  return s.length > max ? `${s.slice(0, max)}… [+${s.length - max} chars truncated]` : s;
}

/** Codex tool output is an array of `{type:'input_text', text}` parts; messages use `content[].text`. */
function flattenParts(v) {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map((c) => (typeof c === 'string' ? c : c?.text ?? JSON.stringify(c))).join('\n');
  return JSON.stringify(v ?? '');
}

/**
 * Codex wraps a shell run in a JSON envelope inside the tool output, e.g.
 * `{"chunk_id":…,"exit_code":0,"output":"…"}`. Pull the exit code out when it is there so a failing
 * command is visibly a failure rather than just more text. Returns null when absent/unparseable.
 */
function exitCodeOf(text) {
  const m = String(text).match(/"exit_code"\s*:\s*(-?\d+)/);
  return m ? Number(m[1]) : null;
}

// ── parse one rollout record into a small, printable, per-field-truncated summary ───────────────────
function summarizeRecord(raw, fieldMax) {
  let o;
  try { o = JSON.parse(raw); } catch { return { kind: 'unparseable', text: truncate(raw, fieldMax) }; }
  const ts = o.timestamp ?? null;
  const p = o.payload || {};
  const pt = p.type;

  // Tool CALL — both shapes Codex emits. `custom_tool_call` carries a JS snippet in `input`;
  // `function_call` carries JSON in `arguments`. Both pair to their output via `call_id`.
  if (pt === 'custom_tool_call' || pt === 'function_call') {
    return {
      kind: 'tool_call', ts, callId: p.call_id ?? null, name: p.name ?? null,
      input: truncate(p.input ?? p.arguments ?? '', fieldMax),
    };
  }
  if (pt === 'custom_tool_call_output' || pt === 'function_call_output') {
    const flat = flattenParts(p.output);
    const code = exitCodeOf(flat);
    return {
      kind: 'tool_output', ts, callId: p.call_id ?? null, exitCode: code,
      isError: code != null && code !== 0,
      text: truncate(flat, fieldMax),
    };
  }
  if (pt === 'message') {
    return {
      kind: 'message', ts, role: p.role ?? null,
      text: truncate(flattenParts(p.content).trim(), fieldMax),
    };
  }
  if (pt === 'reasoning') {
    // Present but opaque — see this file's header. Reported as a COUNT, never as content, because there
    // is no content to report: `summary` is empty and `encrypted_content` is not decryptable here.
    return { kind: 'reasoning', ts, encrypted: !!p.encrypted_content, hasSummary: Array.isArray(p.summary) && p.summary.length > 0 };
  }
  if (pt === 'task_started') return { kind: 'turn_started', ts, turnId: p.turn_id ?? null, contextWindow: p.model_context_window ?? null };
  if (pt === 'task_complete') return { kind: 'turn_complete', ts };
  if (pt === 'token_count') {
    const info = p.info || {};
    const rl = p.rate_limits || {};
    return {
      kind: 'tokens', ts,
      totalTokens: info.total_token_usage?.total_tokens ?? null,
      contextWindow: info.model_context_window ?? null,
      quotaUsedPercent: rl.primary?.used_percent ?? null,
      quotaWindowMinutes: rl.primary?.window_minutes ?? null,
      quotaResetsAt: rl.primary?.resets_at ?? null,
    };
  }
  if (o.type === 'turn_context') return { kind: 'turn_context', ts, cwd: p.cwd ?? null, approvalPolicy: p.approval_policy ?? null };
  return { kind: o.type === 'event_msg' ? `event:${pt || 'unknown'}` : (o.type || 'unknown'), ts };
}

function formatRecord(r) {
  switch (r.kind) {
    case 'unparseable': return `  [unparsed] ${r.text}`;
    case 'message': return `  » ${r.role}: ${r.text}`;
    case 'tool_call': return `  → tool_call: ${r.name}(${r.input})`;
    case 'tool_output': return `  ← tool_output${r.isError ? ` [exit ${r.exitCode}]` : ''}: ${r.text}`;
    case 'reasoning': return `  … reasoning: [encrypted, no readable summary]`;
    case 'turn_started': return `  ⟩ turn started`;
    case 'turn_complete': return `  ⟨ turn complete`;
    case 'turn_context': return `  · turn context (cwd=${r.cwd}, approvals=${r.approvalPolicy})`;
    case 'tokens': return `  · tokens: ${r.totalTokens ?? '?'} / ${r.contextWindow ?? '?'} context${r.quotaUsedPercent != null ? `, quota ${r.quotaUsedPercent}% used` : ''}`;
    default: return `  (${r.kind})`;
  }
}

/**
 * The pending-call detection, by `call_id` pairing.
 *
 * Verified live: while a Codex run is blocked inside a shell command, its `custom_tool_call` record is
 * ALREADY on disk and its matching `*_output` record is not — so an unmatched call_id in the read window
 * genuinely means "this call has not returned yet".
 *
 * IMPORTANT, and the reason this does not read `payload.status`: that field said `"completed"` on a call
 * whose output had demonstrably not been written yet. It describes the MODEL item's generation, not the
 * tool's execution. Pairing call ids is the only sound signal.
 */
function detectPendingCall(records) {
  const outputIds = new Set();
  for (const r of records) if (r.kind === 'tool_output' && r.callId) outputIds.add(r.callId);
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    if (r.kind !== 'tool_call') continue;
    if (r.callId && outputIds.has(r.callId)) return { pending: false };
    return { pending: true, name: r.name, input: r.input, callId: r.callId };
  }
  return { pending: false };
}

/**
 * Is a turn still open? `task_started` with no later `task_complete` within the window. This is the
 * Codex-specific signal with no Claude analogue: a `codex exec` process that was killed or crashed leaves
 * its rollout permanently mid-turn, and — unlike a Claude subagent — there is no harness to notice. The
 * thread is still resumable (`codex exec resume <id>`), but nothing will resume it on its own.
 */
function detectOpenTurn(records) {
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].kind === 'turn_complete') return false;
    if (records[i].kind === 'turn_started') return true;
  }
  return null; // no turn boundary in the window — unknown
}

/** Latest token/quota reading in the window, for the report's footer. */
function latestTokens(records) {
  for (let i = records.length - 1; i >= 0; i--) if (records[i].kind === 'tokens') return records[i];
  return null;
}

function buildVerdict({ pending, openTurn, idleS, windowSize }) {
  const stale = idleS >= 0 && idleS > STALL_S;
  if (pending.pending && !stale) {
    return ['RUNNING_TOOL', `mid tool call — \`${pending.name}\` issued with no output record yet (${idleS >= 0 ? `${idleS}s ago` : 'age unknown'}). The run is working, not stuck; a Codex tool call is a real shell command and can legitimately take minutes.`];
  }
  if (pending.pending) {
    return ['STALLED_IN_TOOL', `a \`${pending.name}\` call has had no output record for ${idleS}s (> ${STALL_S}s). Either the command genuinely runs this long, or the process died mid-call. Check whether a codex process is still alive before assuming progress.`];
  }
  if (openTurn === true && stale) {
    return ['ABANDONED_MID_TURN', `a turn started and never completed, and nothing has been appended for ${idleS}s (> ${STALL_S}s). This is the Codex-specific failure mode: the \`codex exec\` process is almost certainly gone, and NOTHING will resume it on its own. The thread is still resumable by hand with \`codex exec resume <threadId>\`.`];
  }
  if (openTurn === true) {
    return ['ACTIVE', `a turn is open and the transcript was appended to ${idleS >= 0 ? `${idleS}s ago` : 'recently'} with nothing pending — actively progressing.`];
  }
  if (openTurn === false) {
    return ['COMPLETED', `the last turn closed cleanly (task_complete), ${idleS >= 0 ? `${idleS}s ago` : 'at an unknown time'}. Unlike a Claude subagent this means the process has EXITED — the thread is finished, not idle. Continue it only via \`codex exec resume <threadId>\`.`];
  }
  return ['UNKNOWN', `no turn boundary appeared in the read window (last ${windowSize ?? '?'} records). Re-run with a larger --lines to widen it.`];
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.target) {
    console.log([
      'Usage: node codex-transcript.mjs <threadId | rollout path | latest> [--lines=15] [--max-bytes=2000000]',
      '                                 [--field-max=400] [--meta-bytes=512000] [--codex-home=PATH] [--json]',
      '',
      "Reads a BOUNDED tail of a Codex CLI run's own rollout transcript to report what it did and whether",
      'it is still going. Never loads or prints the whole file.',
    ].join('\n'));
    process.exit(opts.help ? 0 : 1);
  }

  const resolved = resolveTranscript(opts);
  if (resolved.error) {
    console.error(`codex-transcript: ${resolved.error}`);
    process.exit(1);
  }
  const { file } = resolved;

  const total = countLines(file);
  const meta = readSessionMeta(file, opts.metaBytes);
  const { lines: rawLines, truncatedHead } = tailLines(file, opts.lines, opts.maxBytes);
  const records = rawLines.map((l) => summarizeRecord(l, opts.fieldMax));

  const pending = detectPendingCall(records);
  const openTurn = detectOpenTurn(records);
  const tokens = latestTokens(records);
  const reasoningCount = records.filter((r) => r.kind === 'reasoning').length;

  let mtimeMs = 0;
  try { mtimeMs = fs.statSync(file).mtimeMs; } catch { /* ignore */ }
  const idleS = mtimeMs ? Math.round((Date.now() - mtimeMs) / 1000) : -1;
  const [verdict, verdictDetail] = buildVerdict({ pending, openTurn, idleS, windowSize: records.length });

  if (opts.json) {
    console.log(JSON.stringify({
      file, threadId: meta?.threadId ?? threadIdFromAny(file), meta,
      totalLines: total, readLines: records.length, truncatedHead, idleSeconds: idleS,
      verdict, verdictDetail, pending, openTurn, tokens,
      reasoning: { countInWindow: reasoningCount, readable: false, why: 'Codex reasoning items carry encrypted_content with an empty summary — there is no readable chain of thought.' },
      records,
    }, null, 2));
    return;
  }

  console.log(`Rollout: ${file}`);
  if (meta) {
    console.log(`Thread:  ${meta.threadId}`);
    console.log(`Started: ${meta.startedAt}  (${meta.originator ?? '?'}, codex ${meta.cliVersion ?? '?'})`);
    console.log(`Cwd:     ${meta.cwd}`);
  } else {
    console.log('Session header: not readable within the bounded head-read budget (--meta-bytes).');
  }
  if (resolved.latest) console.log('[resolved via "latest" — most recently written rollout on this machine]');
  console.log(`Total records (rough activity proxy): ${total}${resolved.ambiguous ? `  [note: ${resolved.ambiguous} files matched this id — used the newest]` : ''}`);
  console.log(`Last modified: ${idleS >= 0 ? `${idleS}s ago` : 'unknown'}`);
  console.log(`Read window: last ${records.length} of ${total} records${truncatedHead ? ` (byte-capped at ${opts.maxBytes} bytes off the end)` : ''}`);
  console.log('');
  console.log('Recent activity (oldest to newest):');
  for (const r of records) console.log(formatRecord(r));
  console.log('');
  if (tokens) {
    console.log(`Tokens: ${tokens.totalTokens ?? '?'} used of ${tokens.contextWindow ?? '?'} context window${tokens.quotaUsedPercent != null ? `  |  plan quota ${tokens.quotaUsedPercent}% used over ${tokens.quotaWindowMinutes ?? '?'}min` : ''}`);
  }
  if (reasoningCount) {
    console.log(`Reasoning: ${reasoningCount} item(s) in this window, all ENCRYPTED with no readable summary — Codex exposes no chain of thought. Judge the observable trace above, never the deliberation.`);
  }
  console.log('');
  console.log(`Verdict: ${verdict}`);
  console.log(verdictDetail);
}

const IS_CLI = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (IS_CLI) main();

export {
  HARD_MAX_BYTES, HARD_MAX_LINES, HARD_MAX_FIELD, HARD_META_BYTES, STALL_S,
  codexHome, parseArgs, threadIdFromAny, listRollouts, resolveTranscript,
  tailLines, countLines, readSessionMeta, stripControlSequences, truncate,
  flattenParts, exitCodeOf, summarizeRecord, formatRecord,
  detectPendingCall, detectOpenTurn, latestTokens, buildVerdict, main,
};
