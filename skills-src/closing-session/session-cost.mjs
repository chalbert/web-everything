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

// DUPLICATE of the canonical rate table. CANONICAL COPY: scripts/backlog/cost-rates.mjs — keep the numbers
// identical to that file. (This estimator is copied standalone into ~/.claude/skills/, so it cannot import
// a repo path.) Per-Mtok USD, current 2026 pricing:
//   opus (4.8): in 5 / out 25 / cache_read 0.5 (0.1x input)
//   sonnet:     in 3 / out 15 / cache_read 0.3
//   haiku:      in 1 / out 5  / cache_read 0.1
// Cache WRITES are tiered: 5-min = 1.25x input (cw5m), 1-hour = 2x input (cw1h). NO long-context premium on
// Opus 4.8 — the 1M window is standard-priced. Matched by first substring hit, so order specific → general.
const RATES = [
  { m: 'opus',   in: 5, out: 25, cr: 0.5, cw5m: 6.25, cw1h: 10 },
  { m: 'sonnet', in: 3, out: 15, cr: 0.3, cw5m: 3.75, cw1h: 6  },
  { m: 'haiku',  in: 1, out: 5,  cr: 0.1, cw5m: 1.25, cw1h: 2  },
];
// FAIL LOUD on an unknown model: no silent opus fallback. Returns null; the caller warns + excludes it.
const rateFor = (model = '') =>
  RATES.find((r) => String(model).toLowerCase().includes(r.m)) || null;

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
const usdOnly = args.includes('--usd-only');       // print just the dollar total
const tokensOnly = args.includes('--tokens-only'); // print just the aggregate token breakdown (for `backlog.mjs cost --tokens=`)
const fileArg = args.find((a) => !a.startsWith('--'));
const file = fileArg || newestTranscript();
if (!file || !fs.existsSync(file)) {
  if (usdOnly) console.log('0');
  else if (tokensOnly) console.log('in=0 cw=0 cr=0 out=0');
  else console.log('session cost: no transcript found');
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
// Cache WRITES split by tier when the usage exposes per-tier fields (cache_creation.ephemeral_5m/1h);
// else the aggregate cache_creation_input_tokens is treated as the 1-hour tier (this user's regime).
const byModel = new Map();
let lastContext = 0;
let peakContext = 0;
for (const { model, u } of byId.values()) {
  const a = byModel.get(model) || { in: 0, cw5m: 0, cw1h: 0, cr: 0, out: 0, turns: 0 };
  const cc = u.cache_creation;
  const cw5m = cc && Number.isFinite(cc.ephemeral_5m_input_tokens) ? cc.ephemeral_5m_input_tokens : 0;
  const cw1h = cc && Number.isFinite(cc.ephemeral_1h_input_tokens)
    ? cc.ephemeral_1h_input_tokens
    : (u.cache_creation_input_tokens || 0) - cw5m; // no per-tier split → aggregate is 1h
  a.in   += u.input_tokens || 0;
  a.cw5m += cw5m;
  a.cw1h += Math.max(0, cw1h);
  a.cr   += u.cache_read_input_tokens || 0;
  a.out  += u.output_tokens || 0;
  a.turns += 1;
  byModel.set(model, a);
  const ctx = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  lastContext = ctx;
  if (ctx > peakContext) peakContext = ctx;
}

// Price each model at its own rates (5m + 1h cache writes at their tier). An unknown model is EXCLUDED
// from both the dollar total AND the forwarded token breakdown — never silently priced as opus — so the
// card, which re-derives usd at opus rates, is never fed foreign-model tokens under the wrong rate.
let total = 0;
const tot = { in: 0, cw: 0, cr: 0, out: 0, turns: 0 };
const excluded = [];
for (const [model, a] of byModel) {
  const r = rateFor(model);
  if (!r) { excluded.push(model); continue; }
  total += a.in / 1e6 * r.in + a.cw5m / 1e6 * r.cw5m + a.cw1h / 1e6 * r.cw1h + a.cr / 1e6 * r.cr + a.out / 1e6 * r.out;
  tot.in  += a.in;
  tot.cw  += a.cw5m + a.cw1h;
  tot.cr  += a.cr;
  tot.out += a.out;
  tot.turns += a.turns;
}
if (excluded.length) {
  process.stderr.write(`session-cost: WARNING — unknown model(s) matched no rate family and were EXCLUDED from the cost total and token breakdown: ${excluded.join(', ')}\n`);
}

const k = (n) => (n / 1000).toFixed(1) + 'K';
// Only the PRICED models feed the summary line — an excluded unknown model isn't part of the total.
const models = [...byModel.keys()].filter((m) => rateFor(m)).map((m) => m.replace('claude-', '')).join(', ');

// Machine output: the aggregate token breakdown (raw integers, summed across priced models), for
// `backlog.mjs cost --tokens="$(session-cost.mjs <file> --tokens-only)"`. This is the DURABLE input the
// card stores; usd is derived from it downstream.
if (tokensOnly) {
  console.log(`in=${tot.in} cw=${tot.cw} cr=${tot.cr} out=${tot.out}`);
  process.exit(0);
}

// Machine output: just the dollar total (legacy — prefer --tokens-only so the card can re-derive usd).
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
