/**
 * Health smell — LIVE INCIDENT, 2026-09-26 ~10:34-10:55 ET (epic #4075 continuation). An orphaned
 * `scratchpad/spawn-hog2.sh` (reparented to launchd — its own shell session had ended) forked ~50 copies of
 * itself, each spawning `node -e 1` in a loop. Machine load hit 293 with 0% idle, the drain's pass took 19 min
 * (normally ~1), and nothing flagged it — a human had to notice "drain slow" and go looking by hand.
 *
 * `notifyEvenInShadow: true` — same opt-in as `claude-auth-expired` (#4077 continuation, PR #2717): a machine
 * pinned at load 293 is exactly the class of "urgent enough that even the observe-only slice should say
 * something", not something to sit on until slice 2's agent investigation exists.
 *
 * `probes: ['processes', 'machineLoad']` — a `ps -Ao pid,ppid,pcpu,etime,command` snapshot
 * ({@link parsePsOutput}, `we:scripts/conveyor/health-watch-core.mjs`) plus `os.loadavg()`/`os.cpus().length`
 * (`we:scripts/conveyor/health-watch.mjs#probeMachineLoad`). Both are cheap, so this runs `every-tick`, unlike
 * the `gh`-cadenced probes.
 *
 * `openAfter: 2` — the trigger is deliberately SUSTAINED load (loadavg per core above `loadPerCoreThreshold`
 * for 2+ consecutive checks), not one noisy sample; a momentary spike closes on its own the next tick.
 *
 * Naming the culprit (the actual point of this sign — a bare "load is high" alert would have told the operator
 * nothing they didn't already suspect from "drain slow"): `evaluate` groups the `ps` snapshot into PROCESS
 * TREES by root ancestor (walk each row's `ppid` chain; a row whose `ppid` is 1, or missing from the snapshot,
 * or itself — the malformed-row guard — is a tree root), then further groups those trees into FAMILIES sharing
 * the same root command (the 50 spawn-hog2.sh copies are 50 separate one-hop trees under launchd, collapsed
 * into one family so the report reads "50 × …" instead of 50 near-identical episodes). A family whose root is
 * an ORPHAN (`ppid === 1`) and whose command path lives in a scratch/tmp dir is flagged `likelyRunaway` — most
 * `ppid === 1` processes are perfectly normal launchd-started daemons; the scratch/tmp path is what narrows it
 * to "this looks like a leaked one-off script", per the incident's own shape.
 */
import { MINUTE } from '../health-watch-core.mjs';

const SCRATCH_OR_TMP = /(^|[\s/])(\/private\/tmp\/|\/tmp\/|\/var\/folders\/|[\w.-]*\/scratchpad\/|[\w.-]*\/scratch\/)/i;

function normalizeCommand(cmd) {
  return String(cmd ?? '').trim().replace(/\s+/g, ' ');
}

/** PURE: group a `ps` snapshot into process trees by root ancestor. */
export function buildProcessTrees(processes) {
  const rows = Array.isArray(processes) ? processes : [];
  const byPid = new Map(rows.map((p) => [p.pid, p]));
  const rootCache = new Map();
  const rootOf = (pid) => {
    if (rootCache.has(pid)) return rootCache.get(pid);
    const chain = [];
    let cur = pid;
    for (;;) {
      if (rootCache.has(cur)) { const r = rootCache.get(cur); for (const c of chain) rootCache.set(c, r); return r; }
      chain.push(cur);
      const proc = byPid.get(cur);
      const parentKnown = proc && byPid.has(proc.ppid) && proc.ppid !== proc.pid && proc.ppid !== 1 && !chain.includes(proc.ppid);
      if (!parentKnown) { for (const c of chain) rootCache.set(c, cur); return cur; }
      cur = proc.ppid;
    }
  };
  const trees = new Map();
  for (const p of rows) {
    const r = rootOf(p.pid);
    if (!trees.has(r)) trees.set(r, { rootPid: r, root: byPid.get(r) ?? null, members: [] });
    trees.get(r).members.push(p);
  }
  return [...trees.values()];
}

/** PURE: collapse trees that share the same root command into one reported family, sorted by size. */
export function summarizeProcessFamilies(trees) {
  const families = new Map();
  for (const t of trees) {
    if (!t.root) continue; // a tree whose "root" pid appears only as someone's ppid, never its own row — skip
    const key = normalizeCommand(t.root.command);
    if (!families.has(key)) families.set(key, { command: t.root.command, trees: [] });
    families.get(key).trees.push(t);
  }
  return [...families.values()].map((f) => {
    const rootPids = f.trees.map((t) => t.rootPid);
    const totalMembers = f.trees.reduce((s, t) => s + t.members.length, 0);
    const totalCpu = f.trees.reduce((s, t) => s + t.members.reduce((s2, m) => s2 + (Number(m.pcpu) || 0), 0), 0);
    const orphaned = f.trees.every((t) => t.root?.ppid === 1);
    const scratchOrTmp = SCRATCH_OR_TMP.test(f.command);
    const childCommands = new Set();
    for (const t of f.trees) for (const m of t.members) if (m.pid !== t.rootPid) childCommands.add(normalizeCommand(m.command));
    return {
      command: f.command, instances: rootPids.length, totalMembers, totalCpu,
      orphaned, scratchOrTmp, likelyRunaway: orphaned && scratchOrTmp,
      rootPids: rootPids.slice(0, 6), childCommands: [...childCommands].slice(0, 3),
    };
  }).sort((a, b) => (b.totalMembers - a.totalMembers) || (b.totalCpu - a.totalCpu));
}

function shorten(cmd, max = 90) { return cmd.length > max ? `…${cmd.slice(-(max - 1))}` : cmd; }

function describeFamily(f) {
  const tag = f.orphaned ? ' (orphaned, parent launchd)' : '';
  const spawning = f.childCommands.length ? ` spawning \`${f.childCommands.join(', ')}\`` : '';
  return f.instances > 1
    ? `${f.instances} × ${shorten(f.command)}${tag}${spawning}`
    : `${shorten(f.command)}${tag}${spawning} (${f.totalMembers} proc, ${f.totalCpu.toFixed(0)}% cpu)`;
}

export default {
  id: 'machine-overload',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['processes', 'machineLoad'],
  openAfter: 2,
  closeAfter: 2,
  severity: 'high',
  action: 'alert',
  notifyEvenInShadow: true,
  loadPerCoreThreshold: 3,
  idleFloorPct: 5,
  topN: 3,
  windowMs: 15 * MINUTE,
  diagnose: { command: 'ps', args: ['-Ao', 'pid,ppid,pcpu,etime,command'], timeoutMs: 15_000 },
  recommendationHint: 'The machine is at sustained high load or near-zero idle CPU — the report names the process tree(s) responsible.',
  evaluate({ processes, machineLoad }) {
    const rows = Array.isArray(processes) ? processes : [];
    const load = machineLoad || {};
    const cpuCount = Math.max(1, Number(load.cpuCount) || 1);
    const perCoreLoad = (Number(load.load1) || 0) / cpuCount;
    // Aggregate %CPU across every live process, normalized to 100 per core — the same rows the family grouping
    // below reads, so "idle" and "who is using it" can never disagree about which snapshot they came from.
    const busyPct = Math.min(100, rows.reduce((s, p) => s + (Number(p.pcpu) || 0), 0) / cpuCount);
    const idlePct = Math.max(0, 100 - busyPct);
    const breach = perCoreLoad >= this.loadPerCoreThreshold || idlePct <= this.idleFloorPct;

    const families = summarizeProcessFamilies(buildProcessTrees(rows));
    const top = families.slice(0, this.topN);
    const runaway = families.find((f) => f.likelyRunaway) ?? null;

    const summary = breach
      ? `machine overload: loadavg/core ${perCoreLoad.toFixed(1)} (threshold ${this.loadPerCoreThreshold}), idle ~${idlePct.toFixed(0)}%. `
        + `Top process tree(s): ${top.length ? top.map(describeFamily).join('; ') : '(no process snapshot)'}.`
      : `machine load normal: loadavg/core ${perCoreLoad.toFixed(1)}, idle ~${idlePct.toFixed(0)}%.`;

    const recommendation = !breach
      ? this.recommendationHint
      : runaway
        ? `stop tree ${runaway.rootPids[0]}${runaway.rootPids.length > 1 ? ` (+${runaway.instances - 1} more matching \`${shorten(runaway.command)}\`, each orphaned under launchd and living in a scratch/tmp dir — a likely runaway)` : ' (orphaned under launchd, living in a scratch/tmp dir — a likely runaway)'} — the watch never kills anything itself; confirm, then stop it by hand.`
        : top.length
          ? `stop tree ${top[0].rootPids[0]} (\`${shorten(top[0].command)}\`, ${top[0].totalMembers} process(es), ${top[0].totalCpu.toFixed(0)}% cpu) if it should not be running — the watch never kills anything itself.`
          : 'Investigate the load spike — no process snapshot was available to name a culprit.';

    return [{
      subject: 'machine',
      breach,
      measure: {
        perCoreLoad: Number(perCoreLoad.toFixed(2)), load1: load.load1 ?? null, cpuCount,
        idlePct: Number(idlePct.toFixed(1)), busyPct: Number(busyPct.toFixed(1)), processCount: rows.length,
        topFamilies: top, likelyRunawayCommand: runaway?.command ?? null,
      },
      summary,
      recommendation,
    }];
  },
};
