#!/usr/bin/env node
// agent-health.mjs — read a subagent's OWN transcript to answer "is it stuck?" without pinging it.
//
// WHY THIS EXISTS (live incident, 2026-09-04): an orchestrating session pinged (SendMessage) a
// reconciliation agent to ask for a status update. The ping sat unprocessed with no visible response,
// because the target was blocked inside a SYNCHRONOUS nested `Agent()` call to its own child
// (`run_in_background: false`) — a ping to a session mid-blocking-tool-call just queues behind
// whatever it's blocked on; there is no way to distinguish "genuinely stuck" from "busy and can't
// respond yet" from the ping's silence alone. Reading the target's transcript directly gives an
// accurate, NON-DISRUPTIVE read instead: last tool call, last result, and — critically — whether the
// most recent action is a still-unresolved nested Agent() call, which explains the silence outright.
//
// GENERIC ON PURPOSE: this is a general Claude-Code multi-agent-orchestration utility, not specific to
// any one epic or repo. It lives here (skills-src/, a normal repo skill) only because this is the repo
// that is actually committed and backed up to a remote right now; it may migrate to a personal,
// cross-project skills repo later. Keep its content free of repo- or epic-specific assumptions.
//
// ── The core safety property: BOUNDED READ, NEVER THE WHOLE FILE ───────────────────────────────────
// The Agent tool's own spawn result says it outright: "Do NOT Read or tail this file via the shell
// tool — it is the full subagent JSONL transcript and reading it will overflow your context." This
// script is what you use INSTEAD of that shell `cat`/`tail` — it reads at most `--max-bytes` (default
// 2 MB) off the END of the file, splits that chunk into lines, and prints only the last `--lines`
// (default 15) of them — each with any single field truncated to `--field-max` chars (default 400)
// before it is printed. A single enormous line (e.g. a giant tool_result) cannot blow this budget: the
// byte cap bounds it regardless of how the file is shaped. Getting the file's total line count (a
// rough activity/progress proxy) is done by streaming and counting '\n' bytes only — it never holds
// the file's parsed content in memory and never prints it.
//
// ── Where a transcript actually lives (observed live on this machine, 2026-09-04) ──────────────────
// The Agent tool's spawn result hands you an `output_file` path directly, e.g.:
//   /private/tmp/claude-<uid>/<project-slug>/<session-id>/tasks/<agentId>.output
// That path is a SYMLINK (not the transcript itself) resolving to the real, permanent JSONL transcript
// under this machine's Claude Code project store:
//   ~/.claude/projects/<project-slug>/<session-id>/subagents/agent-<agentId>.jsonl
// where <project-slug> is the launching session's cwd with every "/" replaced by "-" (a leading "/"
// becomes a leading "-"), e.g. "/Users/me/workspace/webeverything" -> "-Users-me-workspace-webeverything".
// The /private/tmp copy is ephemeral (cleared on reboot / task cleanup); the ~/.claude/projects one is
// the durable source of truth, so this script's id-only lookup (no output_file in hand) searches THAT
// tree directly rather than trying to reconstruct the /private/tmp path. Bare background-Bash task ids
// (printed as `b<hex>.output` under the same tasks/ dir) are a DIFFERENT thing — plain shell output
// files, not agent JSONL transcripts — and are out of scope here.
//
// Usage:
//   node agent-health.mjs <agentId | output_file path | .jsonl path> [options]
//
// Options:
//   --lines=N        tail this many JSONL entries (default 15; the bounded-read budget, not a target)
//   --max-bytes=N    never read more than this many bytes off the end of the file (default 2_000_000)
//   --field-max=N    truncate any single printed field to this many chars (default 400)
//   --session=ID     narrow an id-only lookup to one session's subagents/ dir
//   --project=SLUG   narrow an id-only lookup to one project's dir (the "-Users-..." slug)
//   --json           print the parsed summary as JSON instead of the human report
//
// Exit code is always 0 (a health *report*, not a pass/fail check) unless the transcript truly cannot
// be found, which exits 1 with a plain explanation.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

// Hard ceilings — NOT just defaults. A caller-supplied override (--max-bytes/--lines/--field-max) is
// floor-clamped for sanity but must never be able to defeat the "never the whole file" guarantee this
// tool exists to provide; these caps hold even against an explicit oversized request (#1905 review
// finding: unclamped overrides let `--max-bytes` alone reproduce the exact full-file-read failure this
// tool is supposed to prevent).
const HARD_MAX_BYTES = 8_000_000; // 8 MB absolute ceiling regardless of what is requested
const HARD_MAX_LINES = 500;
const HARD_MAX_FIELD = 20_000;

function parseArgs(argv) {
  const opts = { lines: 15, maxBytes: 2_000_000, fieldMax: 400, json: false, session: null, project: null };
  const pos = [];
  for (const a of argv) {
    if (a === '--json') opts.json = true;
    else if (a.startsWith('--lines=')) opts.lines = Math.min(HARD_MAX_LINES, Math.max(1, Number(a.slice(8)) || 15));
    else if (a.startsWith('--max-bytes=')) opts.maxBytes = Math.min(HARD_MAX_BYTES, Math.max(1024, Number(a.slice(12)) || 2_000_000));
    else if (a.startsWith('--field-max=')) opts.fieldMax = Math.min(HARD_MAX_FIELD, Math.max(20, Number(a.slice(12)) || 400));
    else if (a.startsWith('--session=')) opts.session = a.slice(10);
    else if (a.startsWith('--project=')) opts.project = a.slice(10);
    else if (a === '--help' || a === '-h') opts.help = true;
    else pos.push(a);
  }
  opts.target = pos[0] || null;
  return opts;
}

function idFromAny(s) {
  // Strip whatever decoration the caller pasted: a bare id, "agent-<id>", "<id>.output", "<id>.jsonl",
  // "agent-<id>.jsonl" — all reduce to the same bare hex id.
  return String(s).trim()
    .replace(/^.*\//, '')       // basename, if a path slipped through
    .replace(/^agent-/, '')
    .replace(/\.(output|jsonl)$/, '');
}

// ── locate the real transcript file ─────────────────────────────────────────────────────────────────
function resolveTranscript(opts) {
  const { target } = opts;
  if (!target) return { error: 'no agent id / output_file / transcript path given' };

  // 1) A path that exists on disk — resolve through the symlink (output_file -> the real .jsonl) and
  //    use it directly, whatever its name. This is the fast path when you have the Agent tool's own
  //    output_file line in hand.
  if (target.includes('/') || target.includes(path.sep)) {
    try {
      const real = fs.realpathSync(target);
      if (fs.existsSync(real)) return { file: real };
    } catch { /* broken symlink or gone — fall through to id search below */ }
  }

  // 2) Bare id (or a decorated form of one) — search the durable project store for
  //    subagents/agent-<id>.jsonl, optionally narrowed by --project/--session.
  const id = idFromAny(target);
  if (!id) return { error: `could not derive an agent id from "${target}"` };

  let projectDirs;
  try { projectDirs = fs.readdirSync(PROJECTS_DIR); } catch { return { error: `no Claude project store at ${PROJECTS_DIR}` }; }
  if (opts.project) projectDirs = projectDirs.filter((d) => d === opts.project);

  const hits = [];
  for (const proj of projectDirs) {
    const projPath = path.join(PROJECTS_DIR, proj);
    let sessionDirs;
    try { sessionDirs = fs.readdirSync(projPath).filter((s) => !s.endsWith('.jsonl')); } catch { continue; }
    if (opts.session) sessionDirs = sessionDirs.filter((s) => s === opts.session);
    for (const sess of sessionDirs) {
      const file = path.join(projPath, sess, 'subagents', `agent-${id}.jsonl`);
      if (fs.existsSync(file)) {
        let mtimeMs = 0;
        try { mtimeMs = fs.statSync(file).mtimeMs; } catch { /* ignore */ }
        hits.push({ file, mtimeMs });
      }
    }
  }
  if (!hits.length) {
    return { error: `no transcript found for agent id "${id}" under ${PROJECTS_DIR}/**/subagents/ (pass the output_file path directly, or narrow with --project/--session)` };
  }
  hits.sort((a, b) => b.mtimeMs - a.mtimeMs); // most-recently-active match wins on an (unlikely) id collision
  return { file: hits[0].file, ambiguous: hits.length > 1 ? hits.length : 0 };
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
      // We started mid-file: the first "line" in this chunk is a partial line — drop it.
      const nl = text.indexOf('\n');
      text = nl === -1 ? '' : text.slice(nl + 1);
    }
    let lines = text.split('\n').filter((l) => l.trim());
    if (!lines.length && rawText.trim()) {
      // Either a single oversized line with no newline anywhere in the window, or (when start>0) the
      // whole window is one partial line with no newline before the cap — in both cases the
      // partial-line-drop above can legitimately empty `text`. Fall back to the RAW (pre-drop) chunk so
      // this still surfaces SOMETHING rather than silently reporting zero lines (#1905 review finding:
      // the old fallback read from the already-emptied `text`, so it silently returned nothing in
      // exactly the truncated-head case its own comment promised to handle).
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
    const chunkSize = 1 << 20; // 1 MB
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
    if (sawAny && !endedWithNewline) count++; // a final line with no trailing newline still counts
    return count;
  } finally {
    fs.closeSync(fd);
  }
}

// Strip ANSI/OSC/CSI terminal escape sequences and other C0 control bytes (keeping \n and \t) before
// anything from a transcript is printed to a real terminal. #1905 review finding: transcript content
// can echo untrusted text (e.g. a WebFetch body, or command output) verbatim; printing it unsanitized
// lets a crafted transcript manipulate the viewing terminal (hidden/spoofed text, screen clears, or
// worse on a vulnerable emulator) via escape sequences this tool would otherwise pass straight through.
// eslint-disable-next-line no-control-regex
const ESCAPE_OR_CONTROL_RE = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[[0-?]*[ -/]*[@-~]|\x1b[@-Z\\-_]|[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;
function stripControlSequences(s) {
  return s.replace(ESCAPE_OR_CONTROL_RE, '');
}

// ── truncate any individual field before printing (per-field cap, independent of the line/byte caps) ─
function truncate(str, max) {
  const raw = typeof str === 'string' ? str : JSON.stringify(str);
  if (raw == null) return '';
  const s = stripControlSequences(raw);
  return s.length > max ? `${s.slice(0, max)}… [+${s.length - max} chars truncated]` : s;
}

function flattenToolResultText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((c) => (typeof c === 'string' ? c : c?.text ?? JSON.stringify(c))).join('\n');
  }
  return JSON.stringify(content ?? '');
}

// ── parse one JSONL entry into a small, printable, per-field-truncated summary ─────────────────────
function summarizeEntry(raw, fieldMax) {
  let o;
  try { o = JSON.parse(raw); } catch { return { kind: 'unparseable', text: truncate(raw, fieldMax) }; }
  const type = o.type;
  const content = o?.message?.content;
  const blocks = [];
  if (Array.isArray(content)) {
    for (const c of content) {
      if (!c || typeof c !== 'object') continue;
      if (c.type === 'text' && c.text) {
        blocks.push({ kind: 'text', text: truncate(c.text.trim(), fieldMax) });
      } else if (c.type === 'thinking' && c.thinking) {
        blocks.push({ kind: 'thinking', text: truncate(c.thinking.trim(), fieldMax) });
      } else if (c.type === 'tool_use') {
        blocks.push({
          kind: 'tool_use',
          id: c.id,
          name: c.name,
          input: truncate(JSON.stringify(c.input ?? {}), fieldMax),
          rawInput: c.input,
        });
      } else if (c.type === 'tool_result') {
        blocks.push({
          kind: 'tool_result',
          toolUseId: c.tool_use_id,
          isError: !!c.is_error,
          content: truncate(flattenToolResultText(c.content), fieldMax),
        });
      }
    }
  } else if (typeof content === 'string' && content.trim()) {
    blocks.push({ kind: 'text', text: truncate(content.trim(), fieldMax) });
  }
  return { kind: type || 'unknown', ts: o.timestamp || null, blocks };
}

function formatEntry(entry) {
  if (entry.kind === 'unparseable') return `  [unparsed] ${entry.text}`;
  const lines = [];
  for (const b of entry.blocks || []) {
    if (b.kind === 'text') lines.push(`  » text: ${b.text}`);
    else if (b.kind === 'thinking') lines.push(`  … thinking: ${b.text}`);
    else if (b.kind === 'tool_use') lines.push(`  → tool_use: ${b.name}(${b.input})`);
    else if (b.kind === 'tool_result') lines.push(`  ← tool_result${b.isError ? ' [ERROR]' : ''}: ${b.content}`);
  }
  if (!lines.length) lines.push(`  (${entry.kind}, no printable content block)`);
  return lines.join('\n');
}

// ── the one detection this tool exists for: blocked on its own synchronous nested child ────────────
function detectBlockedOnChild(entries) {
  // The signal: the newest entry that contains AT LEAST ONE tool_use has some tool_use with no matching
  // tool_result anywhere in the read window. Within a bounded tail this is reliable regardless of N,
  // because a session blocked inside a tool call appends NOTHING to its own transcript until that call
  // returns — so if it's truly still pending, that tool_use is unconditionally in the newest entry.
  //
  // #1905 review finding: a single turn can carry MULTIPLE tool_use blocks (parallel tool calls issued
  // together — e.g. a blocking Agent() call alongside an unrelated Read in the same turn). The previous
  // version walked an entry's blocks in reverse and returned as soon as it met ANY resolved tool_use,
  // so an earlier-in-the-array pending call in that same entry was never inspected. Fix: collect every
  // tool_use in the newest tool_use-bearing entry and check ALL of them, not just the structurally-last
  // one.
  const resultIds = new Set();
  for (const e of entries) for (const b of e.blocks || []) if (b.kind === 'tool_result') resultIds.add(b.toolUseId);

  for (let i = entries.length - 1; i >= 0; i--) {
    const toolUses = (entries[i].blocks || []).filter((b) => b.kind === 'tool_use');
    if (!toolUses.length) continue; // no tool_use in this entry — keep walking back to find one
    const pending = toolUses.filter((b) => !resultIds.has(b.id));
    if (!pending.length) return { pending: false }; // newest tool-bearing entry is fully resolved
    // Prefer surfacing a blocking nested Agent() call if one of the pending calls is that shape — it's
    // the headline case this tool exists for — otherwise report the first pending call found.
    const nested = pending.find((b) => b.name === 'Agent' && b.rawInput && b.rawInput.run_in_background === false);
    const chosen = nested || pending[0];
    return {
      pending: true,
      toolName: chosen.name,
      input: chosen.input,
      isNestedBlockingAgent: !!nested,
      description: chosen.rawInput?.description || null,
      pendingCount: pending.length,
    };
  }
  return { pending: false };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.target) {
    console.log([
      'Usage: node agent-health.mjs <agentId | output_file path | .jsonl path> [--lines=15] [--max-bytes=2000000]',
      '                              [--field-max=400] [--session=ID] [--project=SLUG] [--json]',
      '',
      'Reads a BOUNDED tail of a subagent\'s own transcript to answer "is it stuck?" without pinging it.',
    ].join('\n'));
    process.exit(opts.help ? 0 : 1);
  }

  const resolved = resolveTranscript(opts);
  if (resolved.error) {
    console.error(`agent-health: ${resolved.error}`);
    process.exit(1);
  }
  const { file } = resolved;

  const total = countLines(file);
  const { lines: rawLines, truncatedHead } = tailLines(file, opts.lines, opts.maxBytes);
  const entries = rawLines.map((l) => summarizeEntry(l, opts.fieldMax));
  const blocked = detectBlockedOnChild(entries);

  let mtimeMs = 0;
  try { mtimeMs = fs.statSync(file).mtimeMs; } catch { /* ignore */ }
  const idleS = mtimeMs ? Math.round((Date.now() - mtimeMs) / 1000) : -1;
  const STALL_S = 180; // silent this long with nothing pending => looks idle/stalled, not just slow

  let verdict, verdictDetail;
  if (blocked.pending && blocked.isNestedBlockingAgent) {
    verdict = 'BLOCKED_ON_CHILD';
    verdictDetail = `blocked inside its own synchronous nested Agent() call${blocked.description ? ` ("${blocked.description}")` : ''} — run_in_background:false, no tool_result yet. This is the exact case a SendMessage ping would just queue behind. Silence here does not mean stuck; it means waiting on its own child.`;
  } else if (blocked.pending) {
    verdict = 'BLOCKED_ON_TOOL';
    verdictDetail = `most recent action is a pending ${blocked.toolName} call with no tool_result yet (age ${idleS >= 0 ? idleS + 's' : 'unknown'}).`;
  } else if (idleS >= 0 && idleS > STALL_S) {
    verdict = 'IDLE_OR_STALLED';
    verdictDetail = `no transcript activity for ${idleS}s (> ${STALL_S}s threshold) and nothing pending — looks idle or genuinely stalled, not mid-call.`;
  } else {
    verdict = 'ACTIVE';
    verdictDetail = `last activity ${idleS >= 0 ? `${idleS}s ago` : 'unknown'}, nothing pending — looks actively progressing.`;
  }

  if (opts.json) {
    console.log(JSON.stringify({
      file, totalLines: total, readLines: entries.length, truncatedHead,
      idleSeconds: idleS, verdict, verdictDetail, blocked, entries,
    }, null, 2));
    return;
  }

  console.log(`Transcript: ${file}`);
  console.log(`Total lines (rough activity proxy): ${total}${resolved.ambiguous ? `  [note: ${resolved.ambiguous} sessions had a transcript for this id — used the most recently active]` : ''}`);
  console.log(`Last modified: ${idleS >= 0 ? `${idleS}s ago` : 'unknown'}`);
  console.log(`Read window: last ${entries.length} of ${total} lines${truncatedHead ? ` (byte-capped at ${opts.maxBytes} bytes off the end)` : ''}`);
  console.log('');
  console.log('Recent activity (oldest to newest):');
  for (const e of entries) console.log(formatEntry(e));
  console.log('');
  console.log(`Verdict: ${verdict}`);
  console.log(verdictDetail);
}

// Run only when invoked directly (`node agent-health.mjs …`), not when imported by the unit tests in
// __tests__/agent-health.test.mjs — matches the CLI-guard convention used elsewhere in this repo (e.g.
// we:scripts/review-core-cli.mjs).
const IS_CLI = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (IS_CLI) main();

export {
  HARD_MAX_BYTES, HARD_MAX_LINES, HARD_MAX_FIELD,
  parseArgs, idFromAny, resolveTranscript, tailLines, countLines,
  stripControlSequences, truncate, flattenToolResultText, summarizeEntry, formatEntry,
  detectBlockedOnChild, main,
};
