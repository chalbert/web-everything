#!/usr/bin/env node
/**
 * lane-resume.mjs — discover STUCK ready-to-merge lanes and plan their takeover (#2200).
 *
 * The consumer side of a recurring situation: a producer (`/workflow`, `/batch`) opens a
 * `ready-to-merge` PR per item, but some never land — a conflict with a peer that landed first, a red
 * required `test` (the lane shipped a real bug), or a `blockedBy` item that isn't landed yet. `/drain`
 * only lands couples that are ALREADY ready; it skips these. This engine finds them, says WHY each is
 * stuck, and orders them so the `/resume` skill can hand each to a finisher subagent (seeded with the
 * EXISTING lane ref — reuse the ~done work, repair only the broken part) and then land it via the
 * normal drain transport.
 *
 * Subcommands:
 *   node scripts/lane-resume.mjs discover [--json]   # classify + blockedBy-order every stuck lane
 *
 * Landing is NOT re-implemented here: once a finisher agent rebases its lane onto main, resolves the
 * conflict / fixes the test, drops the transient `.lane-manifest.json`, and confirms CI green, the PR
 * is CLEAN and `/drain` (`scripts/merge-ai-prs.mjs --label=ready-to-merge`) lands it under the same
 * self-approved transport. So `/resume` = repair-then-hand-to-drain; this file is the discover brain.
 *
 * Guard-safe: read-only (git show / gh list). Fails soft — a PR whose manifest can't be read is
 * reported as `unknown`, never crashes the plan.
 */
import { execFileSync } from 'node:child_process';

const READY_LABEL = 'ready-to-merge';

// ─────────────────────────── pure logic (exported, unit-tested) ───────────────────────────

/**
 * Classify ONE lane's takeover disposition from its already-collected signals.
 * @param {{num:number, mergeable:string, mergeState:string, testConclusion:string|null,
 *          item:number|null, repos:Array<{repo:string,ref:string,carriesResolve?:boolean}>,
 *          blockedBy:number[]}} pr
 * @param {Set<number>} resolvedItems — items whose backlog file is status:resolved on main (blocker landed)
 * @returns {{num, item, repos, blockedBy, crossRepo, disposition, reason}}
 *   disposition ∈ 'ready' | 'conflict' | 'test-red' | 'blocked' | 'unknown'
 */
export function classifyLane(pr, resolvedItems) {
  const blockedBy = pr.blockedBy || [];
  const unlanded = blockedBy.filter((b) => !resolvedItems.has(b));
  const crossRepo = (pr.repos || []).some((r) => r.repo && r.repo !== 'we');
  const base = { num: pr.num, item: pr.item ?? null, repos: pr.repos || [], blockedBy, crossRepo };

  // BLOCKED wins: a finisher cannot land a lane whose blocker isn't on main yet (impl-first / dep-first).
  if (unlanded.length) return { ...base, disposition: 'blocked', reason: `blockedBy not landed: ${unlanded.join(',')}` };

  // A red required check means the lane shipped a real bug — the finisher must FIX code, not just rebase.
  if (pr.testConclusion && String(pr.testConclusion).toUpperCase() === 'FAILURE')
    return { ...base, disposition: 'test-red', reason: 'required `test` check is red (lane bug to fix)' };

  // A conflict is repairable by rebase-onto-main + resolve (+ regen derived artifacts) — mechanical.
  if (pr.mergeable === 'CONFLICTING' || pr.mergeState === 'DIRTY')
    return { ...base, disposition: 'conflict', reason: 'conflicts with main (rebase + resolve)' };

  // Clean + green ⇒ not stuck at all; `/drain` will take it. Surfaced so the plan is complete.
  if (pr.mergeable === 'MERGEABLE' && (!pr.testConclusion || String(pr.testConclusion).toUpperCase() === 'SUCCESS'))
    return { ...base, disposition: 'ready', reason: 'clean + green — `/drain` lands it' };

  return { ...base, disposition: 'unknown', reason: `mergeable=${pr.mergeable} state=${pr.mergeState} test=${pr.testConclusion ?? '—'}` };
}

/**
 * Order lanes so a lane never precedes a lane it is blockedBy (topological within the stuck set).
 * `blocked` lanes (blocker not landed at all) sort last — they can't run this pass. Ties keep PR order.
 * @param {ReturnType<typeof classifyLane>[]} lanes
 */
export function orderByBlockedBy(lanes) {
  const byItem = new Map(lanes.filter((l) => l.item != null).map((l) => [l.item, l]));
  const seen = new Set();
  const out = [];
  const visit = (l, stack) => {
    if (seen.has(l.num) || stack.has(l.num)) return; // cycle-safe: a back-edge is just skipped
    stack.add(l.num);
    for (const b of l.blockedBy) { const dep = byItem.get(b); if (dep) visit(dep, stack); }
    stack.delete(l.num);
    if (!seen.has(l.num)) { seen.add(l.num); out.push(l); }
  };
  for (const l of lanes) visit(l, new Set());
  // stable partition: attemptable (ready/conflict/test-red/unknown) before blocked
  return [...out.filter((l) => l.disposition !== 'blocked'), ...out.filter((l) => l.disposition === 'blocked')];
}

// ─────────────────────────────────── IO helpers ───────────────────────────────────

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const shJSON = (cmd, args, dflt) => { try { return JSON.parse(sh(cmd, args) || 'null') ?? dflt; } catch { return dflt; } };

/** Read a lane's manifest off its head ref (origin). Returns {item, repos, blockedBy} or null. */
function readManifest(ref) {
  for (const rev of [`origin/${ref}`, ref]) {
    try {
      const m = JSON.parse(execFileSync('git', ['show', `${rev}:.lane-manifest.json`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
      return { item: m.item ?? null, repos: m.repos || [], blockedBy: m.blockedBy || [] };
    } catch { /* try next rev */ }
  }
  return null;
}

/** Item numbers whose backlog file is status:resolved on origin/main (a blocker counts as landed). */
function resolvedItemSet() {
  const set = new Set();
  let files = [];
  try { files = sh('git', ['ls-tree', '-r', '--name-only', 'origin/main']).split('\n').filter((f) => /^backlog\/\d+-/.test(f)); } catch { return set; }
  for (const f of files) {
    const n = Number((f.match(/^backlog\/(\d+)-/) || [])[1]);
    try {
      const head = execFileSync('git', ['show', `origin/main:${f}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).slice(0, 400);
      if (/^status:\s*resolved/m.test(head)) set.add(n);
    } catch { /* skip */ }
  }
  return set;
}

function discover(asJson) {
  execFileSync('git', ['fetch', 'origin', '--quiet'], { stdio: 'ignore' });
  const prs = shJSON('gh', ['pr', 'list', '--label', READY_LABEL, '--state', 'open', '--json', 'number,mergeable,mergeStateStatus,headRefName,statusCheckRollup', '--limit', '200'], []);
  const resolved = resolvedItemSet();
  const lanes = prs.map((p) => {
    const man = readManifest(p.headRefName) || { item: null, repos: [], blockedBy: [] };
    const test = (p.statusCheckRollup || []).find((c) => (c.name || c.context) === 'test');
    return classifyLane({
      num: p.number, mergeable: p.mergeable, mergeState: p.mergeStateStatus,
      testConclusion: test ? (test.conclusion || test.state || null) : null,
      item: man.item, repos: man.repos, blockedBy: man.blockedBy,
    }, resolved);
  });
  const ordered = orderByBlockedBy(lanes);
  const bucket = (d) => ordered.filter((l) => l.disposition === d);
  const result = {
    ok: true,
    counts: { ready: bucket('ready').length, conflict: bucket('conflict').length, testRed: bucket('test-red').length, blocked: bucket('blocked').length, unknown: bucket('unknown').length },
    ready: bucket('ready'), conflict: bucket('conflict'), testRed: bucket('test-red'), blocked: bucket('blocked'), unknown: bucket('unknown'),
    order: ordered.map((l) => ({ pr: l.num, item: l.item, disposition: l.disposition, crossRepo: l.crossRepo, blockedBy: l.blockedBy, reason: l.reason })),
  };
  if (asJson) { process.stdout.write(JSON.stringify(result, null, 2) + '\n'); return; }
  const line = (l) => `  ${l.disposition === 'ready' ? '✓' : l.disposition === 'blocked' ? '⊘' : '→'} #${l.num}${l.item ? ` (#${l.item})` : ''}${l.crossRepo ? ' [cross-repo]' : ''} — ${l.reason}`;
  process.stderr.write(`lane-resume · ${prs.length} labelled PR(s): ${JSON.stringify(result.counts)}\n`);
  for (const d of ['ready', 'conflict', 'test-red', 'blocked', 'unknown']) {
    const b = bucket(d); if (!b.length) continue;
    process.stderr.write(`\n${d.toUpperCase()} (${b.length}):\n${b.map(line).join('\n')}\n`);
  }
}

const IS_CLI = process.argv[1] && process.argv[1].endsWith('lane-resume.mjs');
if (IS_CLI) {
  const argv = process.argv.slice(2);
  const cmd = argv.find((a) => !a.startsWith('--')) || 'discover';
  if (cmd === 'discover') discover(argv.includes('--json'));
  else { process.stderr.write(`unknown subcommand: ${cmd}\nusage: lane-resume.mjs discover [--json]\n`); process.exit(2); }
}
