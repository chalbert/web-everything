#!/usr/bin/env node
/**
 * measure-judge-spawn.mjs — argv in, loaded-context and wall clock out (#3028).
 *
 * WHY THIS SCRIPT EXISTS AT ALL, IN ONE PARAGRAPH. #3028's recipe rests on a claim: `--safe-mode --tools ""`
 * cuts a juror's loaded context by roughly an order of magnitude and shortens wall clock with it. Two
 * separate hand measurements of that exact recipe DISAGREED on the absolute numbers and NEITHER recorded
 * its conditions, so both were withdrawn and the item carries only the DIRECTION. This script is the
 * condition under which a figure may exist again: anyone can re-run it, and every number it prints comes
 * back stamped with the cwd, model, effort, prompt, CLI version and commit that produced it. A figure
 * quoted without the block this prints is not a measurement — it is a memory.
 *
 * WHAT IT COMPARES. Two arms, IDENTICAL prompt, model, effort and schema; the ONLY difference is the two
 * flags under test:
 *   • treatment — the real recipe from `we:scripts/lib/judge-spawn.mjs#buildJudgeArgv`, `--safe-mode --tools ""`.
 *   • control   — the same spawn WITHOUT them: repo instructions, skills, plugins and the full tool set.
 * Running the control from inside a repo is the point: the context the flags strip is the repo's own.
 *
 * WHAT "LOADED CONTEXT" MEANS HERE. `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`,
 * read from the CLI's OWN `usage` block — never estimated, never a token-counter approximation. Cache reads
 * are included deliberately: they are context the model was given, and cheapness is not absence. Output
 * tokens are excluded — they are the answer, not the context.
 *
 * WHAT IT CANNOT CONTROL, STATED SO THE NUMBER IS READ HONESTLY. Prompt-cache state (a warm cache moves
 * both wall clock and the cache split), server-side load, model routing, and the repo's size at the commit
 * measured. Wall clock is the NOISIEST figure here and a single pair proves nothing about it — use
 * `--repeat` and read the median. Loaded context is far more stable, because it is a property of what was
 * assembled rather than of how fast the network was.
 *
 * USAGE
 *   node scripts/measure-judge-spawn.mjs                       # one pair, haiku, this cwd
 *   node scripts/measure-judge-spawn.mjs --repeat=3            # three pairs, medians reported
 *   node scripts/measure-judge-spawn.mjs --model=sonnet        # a costlier arm
 *   node scripts/measure-judge-spawn.mjs --json                # machine-readable, conditions included
 *   node scripts/measure-judge-spawn.mjs --treatment-only      # skip the expensive control arm
 *
 * COST. Each pair is two real API calls. The control arm is the expensive one by construction. The default
 * model is `haiku` and every spawn carries `--max-budget-usd`, so a default run is cents; `--model=opus
 * --repeat=5` is not. The script prints the total it actually spent.
 */

import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { hostname, platform, release } from 'node:os';
import { buildJudgeArgv, deriveSessionId, parseJudgeOutcome, loadedContextTokens } from './lib/judge-spawn.mjs';

// ── The fixed stimulus. Held constant across both arms and across runs, so the only variable is the flags. ──

const MANDATE = 'You are a code reviewer. Answer only through the provided schema. Be terse.';
const INPUT = 'Review this change: a function `half(n)` was added that returns `n / 0`. State one finding.';
const SHAPE = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['accept', 'reject'] },
    finding: { type: 'string' },
  },
  required: ['verdict', 'finding'],
  additionalProperties: false,
};

// ── Argv. The treatment arm is the SHIPPED function, never a copy — a drifted recipe must break this. ──────

/** The recipe under test, straight from the helper every `judge` step calls. */
function treatmentArgv({ model, effort, budget, sessionId }) {
  return buildJudgeArgv({ mandate: MANDATE, shape: SHAPE, model, effort, budget, sessionId });
}

/** The same spawn WITHOUT `--safe-mode` and WITHOUT `--tools ""` — everything else identical. */
function controlArgv({ model, effort, budget, sessionId }) {
  return treatmentArgv({ model, effort, budget, sessionId })
    .filter((tok, i, a) => tok !== '--safe-mode' && tok !== '--tools' && !(i > 0 && a[i - 1] === '--tools'));
}

// ── One spawn. Deliberately NOT `judgeSpawn`, because the control arm is not a legal judge call. ────────────

function runOnce(argv, { cwd, cli }) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(cli, argv, { cwd, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => resolve({ error: `could not start ${cli}: ${e.message}`, wallMs: Date.now() - startedAt }));
    child.on('close', () => {
      const wallMs = Date.now() - startedAt;
      try {
        const o = parseJudgeOutcome(out, err);
        resolve({ wallMs, tokens: loadedContextTokens(o.usage), costUsd: o.costUsd, apiMs: o.durationMs, usage: o.usage });
      } catch (e) {
        resolve({ error: e.message.slice(0, 400), wallMs });
      }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(INPUT);
  });
}

// ── Conditions. Printed with every number, because a number without them is what got withdrawn. ────────────

function conditions({ cwd, model, effort, budget, cli, repeat }) {
  const safe = (fn, fallback = 'unknown') => { try { return fn(); } catch { return fallback; } };
  return {
    measuredAtUtc: new Date().toISOString(),
    cwd,
    cwdHasClaudeMd: existsSync(`${cwd}/CLAUDE.md`),
    cwdHasAgentsMd: existsSync(`${cwd}/AGENTS.md`),
    gitHead: safe(() => execFileSync('git', ['-C', cwd, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()),
    gitBranch: safe(() => execFileSync('git', ['-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim()),
    cli,
    cliVersion: safe(() => execFileSync(cli, ['--version'], { encoding: 'utf8' }).trim()),
    model,
    effort,
    maxBudgetUsd: budget,
    repeat,
    node: process.version,
    os: `${platform()} ${release()}`,
    host: hostname(),
    mandate: MANDATE,
    input: INPUT,
    shape: SHAPE,
    loadedContextDefinition: 'input_tokens + cache_creation_input_tokens + cache_read_input_tokens (from the CLI usage block)',
  };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

// ── Main ────────────────────────────────────────────────────────────────────────────────────────────────────

async function main() {
  const arg = (name, fallback) => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : fallback;
  };
  const has = (name) => process.argv.includes(`--${name}`);

  const cwd = arg('cwd', process.cwd());
  const model = arg('model', 'haiku');
  const effort = arg('effort', 'medium');
  const budget = Number(arg('budget', '0.5'));
  const cli = arg('cli', 'claude');
  const repeat = Math.max(1, Number(arg('repeat', '1')));
  const treatmentOnly = has('treatment-only');
  const asJson = has('json');

  const cond = conditions({ cwd, model, effort, budget, cli, repeat });
  const pairs = [];

  for (let i = 0; i < repeat; i += 1) {
    // A fresh session id per arm per iteration — a juror is throwaway and must not resume anything.
    const t = await runOnce(treatmentArgv({ model, effort, budget, sessionId: deriveSessionId(`measure-t-${i}-${Date.now()}`) }), { cwd, cli });
    const c = treatmentOnly
      ? null
      : await runOnce(controlArgv({ model, effort, budget, sessionId: deriveSessionId(`measure-c-${i}-${Date.now()}`) }), { cwd, cli });
    pairs.push({ iteration: i + 1, treatment: t, control: c });
    if (!asJson) {
      const fmt = (r) => (r ? (r.error ? `ERROR ${r.error}` : `${r.tokens} tok, ${r.wallMs} ms wall, ${r.apiMs} ms api, $${(r.costUsd ?? 0).toFixed(4)}`) : 'skipped');
      process.stdout.write(`  run ${i + 1}  treatment: ${fmt(t)}\n`);
      process.stdout.write(`  run ${i + 1}  control  : ${fmt(c)}\n`);
    }
  }

  const okT = pairs.map((p) => p.treatment).filter((r) => r && !r.error);
  const okC = pairs.map((p) => p.control).filter((r) => r && !r.error);
  const summary = {
    treatment: { runs: okT.length, medianTokens: median(okT.map((r) => r.tokens)), medianWallMs: median(okT.map((r) => r.wallMs)) },
    control: { runs: okC.length, medianTokens: median(okC.map((r) => r.tokens)), medianWallMs: median(okC.map((r) => r.wallMs)) },
    totalCostUsd: Number([...okT, ...okC].reduce((a, r) => a + (r.costUsd ?? 0), 0).toFixed(4)),
  };
  if (summary.treatment.medianTokens != null && summary.control.medianTokens) {
    summary.contextRatio = Number((summary.control.medianTokens / summary.treatment.medianTokens).toFixed(2));
  }
  if (summary.treatment.medianWallMs != null && summary.control.medianWallMs) {
    summary.wallRatio = Number((summary.control.medianWallMs / summary.treatment.medianWallMs).toFixed(2));
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify({ conditions: cond, pairs, summary }, null, 2)}\n`);
    return;
  }

  process.stdout.write('\n── conditions ──────────────────────────────────────────────\n');
  for (const [k, v] of Object.entries(cond)) {
    if (k === 'shape') continue;
    process.stdout.write(`  ${k.padEnd(26)} ${typeof v === 'string' ? v : JSON.stringify(v)}\n`);
  }
  process.stdout.write('\n── result (medians) ────────────────────────────────────────\n');
  process.stdout.write(`  treatment (--safe-mode --tools "")   ${summary.treatment.medianTokens} tok   ${summary.treatment.medianWallMs} ms\n`);
  process.stdout.write(`  control   (neither flag)             ${summary.control.medianTokens} tok   ${summary.control.medianWallMs} ms\n`);
  if (summary.contextRatio) process.stdout.write(`  context ratio  control / treatment = ${summary.contextRatio}x\n`);
  if (summary.wallRatio) process.stdout.write(`  wall ratio     control / treatment = ${summary.wallRatio}x\n`);
  process.stdout.write(`  spent on this measurement            $${summary.totalCostUsd}\n`);
  process.stdout.write('\n  These numbers are valid ONLY with the conditions block above. #3028: a figure quoted\n');
  process.stdout.write('  without its conditions is what got withdrawn twice. Re-run rather than re-cite.\n');
}

main().catch((e) => { process.stderr.write(`${e.stack}\n`); process.exitCode = 1; });
