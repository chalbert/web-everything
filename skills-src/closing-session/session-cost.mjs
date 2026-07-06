#!/usr/bin/env node
// Estimate the usage-equivalent $ cost of a Claude Code session from its JSONL
// transcript. Subscription plans aren't billed per-token; this is the "if paid
// by usage" equivalent, for the close audit.
//
// Usage:
//   node session-cost.mjs [path-to-session.jsonl]
// With no arg, picks the most-recently-modified transcript under
// ~/.claude/projects/ — during a close that is the current session.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Per-Mtok USD. Cache write = 5-min tier (1.25x input); cache read = 0.1x input.
// Matched by first substring hit, so order specific → general.
const RATES = [
  { m: 'opus',   in: 15,  out: 75,  cw: 18.75, cr: 1.5  },
  { m: 'sonnet', in: 3,   out: 15,  cw: 3.75,  cr: 0.3  },
  { m: 'haiku',  in: 1,   out: 5,   cw: 1.25,  cr: 0.1  },
];
const rateFor = (model = '') =>
  RATES.find((r) => model.toLowerCase().includes(r.m)) || RATES[0];

function newestTranscript() {
  const root = path.join(os.homedir(), '.claude', 'projects');
  let best = null;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.jsonl')) {
        const t = fs.statSync(p).mtimeMs;
        if (!best || t > best.t) best = { p, t };
      }
    }
  };
  try { walk(root); } catch { /* no transcripts */ }
  return best && best.p;
}

const args = process.argv.slice(2);
const usdOnly = args.includes('--usd-only'); // print just the dollar total (for `backlog.mjs cost --usd=`)
const fileArg = args.find((a) => !a.startsWith('--'));
const file = fileArg || newestTranscript();
if (!file || !fs.existsSync(file)) {
  console.log(usdOnly ? '0' : 'session cost: no transcript found');
  process.exit(0);
}

// Dedup by message.id FIRST. A streamed response is written to the transcript
// multiple times (message_start + deltas + finalization), and each copy carries
// the SAME full `usage` block — so summing every line over-counts badly (observed
// 2.6x on a real session: 250 raw records collapsed to 101 unique message.ids).
// Keep one record per id (last write wins → the final cumulative usage). Lines
// with no id (shouldn't happen for usage-bearing records) get a unique key so
// each is still counted once.
const byId = new Map();
for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  let j;
  try { j = JSON.parse(line); } catch { continue; }
  const u = j.message && j.message.usage;
  if (!u) continue;
  const id = (j.message && j.message.id) || `nomsgid:${byId.size}`;
  byId.set(id, { model: j.message.model || 'unknown', u });
}

// Aggregate per model so mixed-model sessions price each correctly.
// Also track per-response *context occupancy* = the prompt size a response was
// sent (fresh input + cache-read + cache-write). The last = context at close;
// the peak = how full it ever got (what batch calibration wants).
const byModel = new Map();
let lastContext = 0;
let peakContext = 0;
for (const { model, u } of byId.values()) {
  const a = byModel.get(model) || { in: 0, cw: 0, cr: 0, out: 0, turns: 0 };
  a.in  += u.input_tokens || 0;
  a.cw  += u.cache_creation_input_tokens || 0;
  a.cr  += u.cache_read_input_tokens || 0;
  a.out += u.output_tokens || 0;
  a.turns += 1;
  byModel.set(model, a);
  const ctx = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  lastContext = ctx;
  if (ctx > peakContext) peakContext = ctx;
}

let total = 0;
const tot = { in: 0, cw: 0, cr: 0, out: 0, turns: 0 };
for (const [model, a] of byModel) {
  const r = rateFor(model);
  total += a.in / 1e6 * r.in + a.cw / 1e6 * r.cw + a.cr / 1e6 * r.cr + a.out / 1e6 * r.out;
  for (const k of Object.keys(tot)) tot[k] += a[k];
}

const k = (n) => (n / 1000).toFixed(1) + 'K';
const models = [...byModel.keys()].map((m) => m.replace('claude-', '')).join(', ');

// Machine output: just the dollar total, for `backlog.mjs cost --usd=$(session-cost.mjs <file> --usd-only)`.
if (usdOnly) {
  console.log(total.toFixed(2));
  process.exit(0);
}

// Context window: this user's sessions are all [1m] (1M), so default to 1M. Override with
// CLAUDE_CONTEXT_WINDOW for a standard 200K session.
const window = Number(process.env.CLAUDE_CONTEXT_WINDOW) || 1_000_000;
const pct = Math.round((peakContext / window) * 100);

// One line for the audit + a short breakdown beneath it.
console.log(`Session cost: ~$${total.toFixed(2)} usage-equivalent (${models}, ${tot.turns} responses)`);
console.log(`  in ${k(tot.in)} · cache-write ${k(tot.cw)} · cache-read ${k(tot.cr)} · out ${k(tot.out)}`);
console.log(`Context peak: ~${k(peakContext)} tokens = ${pct}% of ${(window / 1e6).toFixed(1)}M window  (context-pct=${pct})`);
