#!/usr/bin/env node
/**
 * pr-state.mjs — the one-line-per-PR state view the drain reruns ~6× by hand (#2434, one of three drain
 * fetch/state helpers under `scripts/`).
 *
 * WHY: while draining, a reviewer re-runs `gh pr view <n>` per PR just to read "is it OPEN, mergeable, green?"
 * — repeatedly, across several numbers. This is the ONE compact status board: one `gh pr view` per number, one
 * line out. Green/red is single-sourced through the SHARED `classifyChecks` (from `./pr-land.mjs`, normalized
 * from the rollup via `rollupToCheckRows` from `./fetch-parked.mjs`) so the `checks=` token matches exactly what
 * pr-land waits for and what `fetch-parked` reports.
 *
 * Split mirrors the house idiom (`scripts/push-if-green.mjs`, `scripts/review-detail.mjs`): a PURE
 * `formatPrStateLine(view)` turns one parsed `gh pr view … --json` object into the display line; a thin impure
 * CLI does the `gh` calls and prints the table.
 *
 * Usage:
 *   node scripts/pr-state.mjs 472 471 470          # human table, one line per PR (default)
 *   node scripts/pr-state.mjs 12 --repo=~/workspace/frontierui
 *   node scripts/pr-state.mjs 472 --json           # JSON array, one record per PR
 *
 * Flags:
 *   <num…>          one or more PR numbers (positional)
 *   --repo=<path>   filesystem checkout to run gh in (default: cwd) — PRs may live in WE/frontierui/plateau-app
 *   --json          emit a JSON array (else the human one-line-per-PR table)
 *
 * Tolerant of a missing PR: emits an error line/record for it and continues. Exit 0 when ≥1 number given; 2 on
 * a usage error (no numbers).
 */
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { classifyChecks } from './pr-land.mjs';
import { rollupToCheckRows } from './fetch-parked.mjs';

/**
 * The PURE structured state record for one PR (#2434). Distills a parsed `gh pr view … --json` object into the
 * fields the display line + `--json` array carry. The `checks` token comes from the SHARED `classifyChecks` over
 * the rollup normalized by `rollupToCheckRows` — the single green/red truth. Never throws on a missing field.
 * @param {object} view - parsed `gh pr view <n> --json number,state,mergeable,mergeStateStatus,statusCheckRollup,title`
 * @returns {{number:number, state:string, mergeable:string, mergeStateStatus:string, checks:string, title:string}}
 */
export function prStateRecord(view) {
  const v = view || {};
  return {
    number: Number(v.number) || 0,
    state: String(v.state || ''),
    mergeable: String(v.mergeable || ''),
    mergeStateStatus: String(v.mergeStateStatus || ''),
    checks: classifyChecks(rollupToCheckRows(v.statusCheckRollup)).status,
    title: String(v.title || ''),
  };
}

/**
 * The PURE one-line display for a PR's state (#2434), e.g.
 *   `#472 OPEN mergeable=MERGEABLE checks=passed mss=CLEAN  scripts: drain helpers`
 * @param {object} view - the parsed `gh pr view` object (see `prStateRecord`).
 * @returns {string}
 */
export function formatPrStateLine(view) {
  const r = prStateRecord(view);
  return `#${r.number} ${r.state} mergeable=${r.mergeable} checks=${r.checks} mss=${r.mergeStateStatus}  ${r.title}`;
}

// Allow importing the pure formatters without running the CLI (the test file imports this module).
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_CLI) runCli();

function runCli() {
  const args = process.argv.slice(2);
  const expandHome = (p) => (p && p.startsWith('~') ? join(homedir(), p.slice(1)) : p);
  const asJson = args.includes('--json');
  const repoFlag = (args.find((a) => a.startsWith('--repo=')) || '').slice('--repo='.length);
  const cwd = repoFlag ? resolve(expandHome(repoFlag)) : process.cwd();
  const nums = args.filter((a) => /^\d+$/.test(a));

  if (nums.length === 0) {
    process.stdout.write(`${JSON.stringify({ error: 'usage: pr-state <num…> [--repo=<path>] [--json]' })}\n`);
    process.exit(2);
  }

  const records = [];
  const lines = [];
  for (const num of nums) {
    try {
      const view = JSON.parse(execFileSync('gh', [
        'pr', 'view', num, '--json', 'number,state,mergeable,mergeStateStatus,statusCheckRollup,title',
      ], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim());
      records.push(prStateRecord(view));
      lines.push(formatPrStateLine(view));
    } catch (e) {
      const msg = String((e && (e.stderr || e.message)) || e).split('\n').filter(Boolean).pop() || 'gh pr view failed';
      records.push({ number: Number(num) || 0, error: msg });
      lines.push(`#${num} ERROR ${msg}`);
    }
  }

  if (asJson) process.stdout.write(`${JSON.stringify(records, null, 2)}\n`);
  else process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(0);
}
