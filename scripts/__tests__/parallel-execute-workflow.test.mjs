/**
 * @file scripts/__tests__/parallel-execute-workflow.test.mjs
 * @description Structural-invariant guard for the parallel /workflow orchestrator
 *   (`.claude/skills/batch-backlog-items/parallel-execute.workflow.js`). The script runs in the Workflow JS
 *   sandbox (top-level `await`/`return`, injected `agent`/`parallel`/`phase`/`log` globals), so it is NOT an
 *   importable module — these assertions read its SOURCE TEXT and lock the #2215 invariant in place: the
 *   producer publishes NEW items via an IN-LANE scaffold that rides the lane's PR, never a scaffold+direct-push
 *   to `main` (the #2203 primary-write the strict lock forbids).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../.claude/skills/batch-backlog-items/parallel-execute.workflow.js'),
  'utf8',
);

describe('parallel-execute workflow — relayed-operator-message guard (live wf_988f1485-8fe, 2026-09-25)', () => {
  // Live failure: the operator asked the ORCHESTRATING session a status question mid-run; the harness relayed
  // it into all three running lane agents, and each one decided the relayed message overrode its computed task,
  // answered the status question instead of working, and returned carried/not-batchable / no-we-pr. Every
  // agent() prompt this script builds (probe, provision, lane-item, and BOTH finalize agents) must carry an
  // explicit rule that a relayed operator message is not addressed to it.
  it('defines a shared RELAY_GUARD rule constant', () => {
    expect(SRC).toMatch(/const RELAY_GUARD\s*=/);
    expect(SRC).toMatch(/RELAYED OPERATOR MESSAGES ARE NOT ADDRESSED TO YOU/);
  });

  it('wires RELAY_GUARD into every RETURN_HYGIENE prompt prefix (probe, provision, lane-item, both finalize agents)', () => {
    const lines = SRC.split('\n');
    // every USE of RETURN_HYGIENE as a prompt array element (not its own declaration or the doc comment above
    // RELAY_GUARD's declaration) must be immediately followed — same line or the very next line — by RELAY_GUARD.
    const returnHygieneUseLines = [];
    lines.forEach((l, i) => {
      if (/RETURN_HYGIENE/.test(l) && !/^const RETURN_HYGIENE/.test(l.trim()) && !/right after RETURN_HYGIENE/.test(l)) {
        returnHygieneUseLines.push(i);
      }
    });
    expect(returnHygieneUseLines.length).toBe(5);
    for (const i of returnHygieneUseLines) {
      const sameLine = /RELAY_GUARD/.test(lines[i]);
      const nextLine = /RELAY_GUARD/.test(lines[i + 1] || '');
      expect(sameLine || nextLine).toBe(true);
    }
  });
});

describe('parallel-execute workflow — #2215 in-lane new-item scaffold', () => {
  it('has a SCAFFOLD-IN-LANE path that scaffolds a seeded item in its own clone (born active+owned)', () => {
    expect(SRC).toMatch(/SCAFFOLD-IN-LANE/);
    // #xzitlr9 — the dispatcher instructs the DECLARED operation, not the raw home. A generated
    // instruction bypasses the declared layer exactly as a hand-written one does, so this pins the
    // operation form AND its camelCase flag spelling (the raw CLI's kebab-case is refused, #3253).
    expect(SRC).toMatch(/run\.mjs scaffold --kind=/);
    expect(SRC).not.toMatch(/backlog\.mjs scaffold --kind=/);
    expect(SRC).toMatch(/--blockedBy=/);
    expect(SRC).toMatch(/--session=\$\{batchSlug\}/); // --session → born active+owned (#670), the claim rides it
  });

  it('instructs the declared resolve operation, with --ref and camelCase flags (#xzitlr9)', () => {
    expect(SRC).toMatch(/resolve --ref=\$\{N\}/);
    expect(SRC).not.toMatch(/backlog\.mjs resolve/);
    expect(SRC).toMatch(/--graduatedTo=/);
  });

  it('leaves the pr-land sites raw, but each carries a REASONED exemption marker (#xzitlr9)', () => {
    // open-pr declares neither manifestFile nor repo, so rewiring these would drop #2387's couple
    // manifest and break cross-repo PRs. The marker is the sanctioned way to record that.
    const prLandLines = SRC.split('\n').filter((l) => /node scripts\/pr-land\.mjs/.test(l));
    expect(prLandLines.length).toBeGreaterThan(0);
    const markers = SRC.split('\n').filter((l) => /@operation-home-ok: #xzitlr9/.test(l));
    expect(markers.length).toBe(prLandLines.length);
    for (const m of markers) expect(m).toMatch(/manifestFile|repo/);
  });

  it('branches on a per-item `seed` (new item) vs an existing claimed item', () => {
    expect(SRC).toMatch(/const seed = it\.seed/);
    // the existing-item path still claims-in-lane
    expect(SRC).toMatch(/CLAIM-IN-LANE/);
    expect(SRC).toMatch(/backlog\.mjs claim \$\{it\.num\}/);
  });

  it('names lane refs by a num-independent key so a seeded item (no NNN yet) still gets a stable ref', () => {
    expect(SRC).toMatch(/function laneKeyOf\(it\)/);
    expect(SRC).toMatch(/function laneRefFor\(it\)/);
    expect(SRC).toMatch(/new-\$\{it\.slug\}/); // the seeded key
  });

  it('documents that a seeded item is NEVER scaffolded on main (rides the lane PR) — the #2215 fix', () => {
    expect(SRC).toMatch(/#2215/);
    expect(SRC).toMatch(/NEVER scaffolded[\s\S]{0,40}on main/);
  });

  it('preserves the producer contract: zero commits to main, never merges/pushes main', () => {
    // The producer prompt still forbids a direct push to main — the seed path must not reintroduce one.
    expect(SRC).toMatch(/NEVER push main/);
    expect(SRC).toMatch(/ZERO commits to\s+main/);
    // no scaffold-then-push-to-main pattern (the #2203 footgun): a `scaffold` must never be followed by a push
    // to a main ref in the same instruction.
    expect(SRC).not.toMatch(/scaffold[\s\S]{0,120}push\s+origin\s+(HEAD:)?(refs\/heads\/)?main\b/);
  });
});

describe('parallel-execute workflow — #2429 self-excluding pr-land wait', () => {
  it('prescribes a FOREGROUND pr-land bounded under the Bash ceiling, never a background run + poll (#x36vidg)', () => {
    expect(SRC).toMatch(/#2429/);
    // #x36vidg superseded #2429's "background it and wait for the notification": that advice is what produced
    // the measured tasks/<id>.output sleep-polls. The wait is now a foreground call with an explicit 10-min Bash
    // timeout, and pr-land's own check wait is bounded inside it.
    expect(SRC).toMatch(/FOREGROUND with an explicit Bash timeout of 600000/);
    expect(SRC).toMatch(/NEVER run it with run_in_background/);
    const prLandCalls = SRC.match(/node scripts\/pr-land\.mjs [^`]*--label-on-green --no-require-verified[^`]*`/g) || [];
    const laneCalls = prLandCalls.filter((c) => !c.includes('<ref>'));
    expect(laneCalls.length).toBeGreaterThan(0);
    for (const c of laneCalls) expect(c).toMatch(/--timeout-min=9/);
  });

  it('bans a self-matching process-poll wait on pr-land (the #2429 hang)', () => {
    // The banned construct: `kill -0 $(pgrep -f "pr-land …")` — pgrep matches the waiter's OWN shell (the ref
    // string is in its argv), so `kill -0` never fails and the loop idles to the Monitor timeout. The lane body
    // must never emit this. We match the command-substitution self-match form, which is absent from the prose
    // that documents the ban.
    expect(SRC).not.toMatch(/kill\s+-0\s+\$\(\s*pgrep/);
    expect(SRC).not.toMatch(/pgrep\s+-f\s+["'][^"'\n]*pr-land/);
  });
});

describe('parallel-execute workflow — #2478/#2216 Finalize label reconcile', () => {
  it('collects every OPEN PR a lane left labelled:false into a reconcile set', () => {
    expect(SRC).toMatch(/#2478/);
    expect(SRC).toMatch(/#2216/);
    expect(SRC).toMatch(/const toReconcile\s*=/);
    // detection: an opened PR (has a pr number) the lane could NOT label (labelled:false / unknown)
    expect(SRC).toMatch(/p\.pr\s*&&\s*!p\.labelled/);
  });

  it('has a Finalize label-reconcile agent step that labels the now-green ones via pr-land --label-on-green', () => {
    expect(SRC).toMatch(/finalize:label-reconcile/);
    expect(SRC).toMatch(/LABEL RECONCILE/);
    // it uses the pure-producer label path (labels, never merges) — not a merge/drain
    expect(SRC).toMatch(/--label-on-green/);
  });

  it('keeps Finalize a pure producer — the reconcile never merges, integrates, or launches a drain', () => {
    // the reconcile prompt must forbid the landing ops (the #2183 producer contract holds through the fix)
    expect(SRC).toMatch(/Do NOT merge, do NOT integrate, do NOT launch a drain/);
  });

  it('carries a still-unlabelled (not-green) PR as a definite carried-for-label outcome for /resume — never a silent drop', () => {
    expect(SRC).toMatch(/carried-for-label/);
    expect(SRC).toMatch(/const carriedForLabel\s*=/);
    // both outcomes ride out in the return object so /resume can pick up the strand
    expect(SRC).toMatch(/reconciledLabels,/);
    expect(SRC).toMatch(/carriedForLabel,/);
  });

  it('#984 finding 4 — a DELIBERATELY-held PR (p.held) is NOT collected for reconcile (never re-labelled)', () => {
    // The detection excludes a held strand: re-running pr-land on it would re-add the go-ahead the hold stripped
    // (a held↔ready flip-flop) and record a false carried-for-label. `held` is the signal distinct from labelApplied:false.
    expect(SRC).toMatch(/p\.pr\s*&&\s*!p\.labelled\s*&&\s*!p\.held/);
    // the per-PR schema carries the `held` field, and the lane is told to set it from pr-land's JSON `held:true`
    expect(SRC).toMatch(/held:\s*\{\s*type:\s*'boolean'/);
    expect(SRC).toMatch(/held:true/);
  });

  it('#984 minor 5 — a held PR is SURFACED in Finalize (never a silent drop / silent liveness-reconcile opt-out)', () => {
    // Held PRs are excluded from the reconcile, so without a visibility line the operator gets no signal a strand is
    // waiting on their review — and a mis-set held:true would silently opt a stranded PR out of the reconcile unseen.
    expect(SRC).toMatch(/heldStrands\s*=/);
    expect(SRC).toMatch(/p\.pr\s*&&\s*p\.held/);         // collected
    expect(SRC).toMatch(/Held for review/);              // logged
  });
});

describe('parallel-execute workflow — xpnhz4o LANE GATE is diff-selected, never a hand-run full suite', () => {
  // dd4beb5e5 (2026-09-25) made the LOCAL gate diff-selected everywhere in this repo and the Bash guard now
  // DENIES a bare full-suite unit run (`npm test` / `npm run test:unit` / a bare `vitest`/`vitest run`, raw or
  // wrapped through heavy-admission) from an agent session. The lane gate must use the SAME sanctioned call the
  // fix/ci-heal briefs use (`verify-lane.mjs run`), never its own hand-rolled heavy-admission-wrapped pair.
  const gateBlock = SRC.slice(SRC.indexOf('4. LANE GATE'), SRC.indexOf('5. RESOLVE'));

  it('runs the diff-selected verify-lane gate for the WE clone', () => {
    expect(SRC).toMatch(/node scripts\/verify-lane\.mjs run --repo=\./);
    expect(gateBlock).toMatch(/node scripts\/verify-lane\.mjs run --repo=\./);
  });

  it('impl repos run the SAME verify-lane tool against their own clone (#3919), not a bespoke wrapped command', () => {
    expect(gateBlock).toMatch(/node \$\{weDir\}\/scripts\/verify-lane\.mjs run --repo=\$\{laneDirs\[r\]\}/);
  });

  it('never instructs a bare or heavy-admission-wrapped full-suite run in the gate step', () => {
    expect(gateBlock).not.toMatch(/heavy-admission\.mjs run/);
    expect(gateBlock).not.toMatch(/--\s*npm run check:standards`/);
    expect(gateBlock).not.toMatch(/--\s*npm test -- run`/);
    expect(gateBlock).not.toMatch(/`npm run check:standards`/);
    expect(gateBlock).not.toMatch(/`npm test`/);
    expect(gateBlock).not.toMatch(/`npm run test:unit`/);
    expect(gateBlock).not.toMatch(/`vitest run`/);
  });

  it('explains why this is NOT plain verify-lane.mjs (sha-keyed marker staleness), so the `run`-mode choice is documented', () => {
    expect(gateBlock).toMatch(/sha-keyed[\s\S]{0,40}\.git\/\.lane-verify[\s\S]{0,40}stale/);
    expect(gateBlock).toMatch(/records no marker/);
  });

  it('the #3321 --no-require-verified rationale still cites the ACTUAL gate command, not the old full-suite pair', () => {
    const markerBlock = SRC.slice(SRC.indexOf('#3321 — WHY EVERY pr-land'), SRC.indexOf('7. OPEN A READY-TO-MERGE PR'));
    expect(markerBlock).not.toMatch(/npm run check:standards` plus/);
    expect(markerBlock).not.toMatch(/npm test -- run`, the same pair/);
    expect(markerBlock).toMatch(/verify-lane\.mjs run --repo=\./);
  });
});

describe('parallel-execute workflow — dd4beb5e5 lanes never spawn a subagent or another session', () => {
  // The #2170 pre-PR independent-review step used to spawn a Task-tool subagent over the lane's own diff before
  // opening its PR. Operator policy (2026-09-25): the review daemon reviews every PR once it is open, so a lane
  // spawning its own reviewer is a second, un-independent actor — and a nested Agent/Task call inside a
  // dispatched lane is exactly the kind of unsupervised sub-session that must never run. The step is REMOVED,
  // not replaced with a self-review, and the guard rule is wired into every agent this file spawns.
  it('defines a shared no-full-suite / no-subagent guard constant', () => {
    expect(SRC).toMatch(/const NO_FULL_SUITE_NO_SUBAGENT_GUARD\s*=/);
    expect(SRC).toMatch(/NEVER run the full test suite yourself/);
    expect(SRC).toMatch(/NEVER spawn a subagent/);
  });

  it('wires NO_FULL_SUITE_NO_SUBAGENT_GUARD into every RETURN_HYGIENE prompt prefix (probe, provision, lane-item, both finalize agents)', () => {
    const lines = SRC.split('\n');
    const returnHygieneUseLines = [];
    lines.forEach((l, i) => {
      if (/RETURN_HYGIENE/.test(l) && !/^const RETURN_HYGIENE/.test(l.trim()) && !/right after RETURN_HYGIENE/.test(l)) {
        returnHygieneUseLines.push(i);
      }
    });
    expect(returnHygieneUseLines.length).toBe(5);
    for (const i of returnHygieneUseLines) {
      const window = [lines[i], lines[i + 1] || '', lines[i + 2] || ''].join('\n');
      expect(window).toMatch(/NO_FULL_SUITE_NO_SUBAGENT_GUARD/);
    }
  });

  it('has no PRE-PR INDEPENDENT REVIEW step and never instructs spawning a review subagent', () => {
    expect(SRC).not.toMatch(/PRE-PR INDEPENDENT REVIEW/);
    expect(SRC).not.toMatch(/SPAWN AN INDEPENDENT REVIEW/);
    expect(SRC).not.toMatch(/SUBAGENT over it/);
  });

  it('dropped the now-unfed dismissedFindings field/plumbing from this lane\'s own return + manifest write', () => {
    // Nothing in THIS workflow feeds a dismissal count any more (the only source was the removed review step) —
    // the drain's escalation rubric still reads one off any OTHER manifest that supplies it (fix/ci-heal briefs,
    // solo lanes), so the CLI flag itself stays; this file just never calls it.
    expect(SRC).not.toMatch(/dismissedFindings/);
    expect(SRC).not.toMatch(/--dismissed=<count>/);
    expect(SRC).not.toMatch(/lane-review\.mjs (diff|body)/);
  });

  it('renumbered the remaining lane steps with no gap (RESOLVE=5, MANIFEST=6, OPEN A READY-TO-MERGE PR=7, RELEASE=8)', () => {
    expect(SRC).toMatch(/`5\. RESOLVE/);
    expect(SRC).toMatch(/`6\. WRITE THE MANIFEST/);
    expect(SRC).toMatch(/`7\. OPEN A READY-TO-MERGE PR PER REPO/);
    expect(SRC).toMatch(/`8\. RELEASE each lane/);
  });
});

describe('parallel-execute workflow — #3892/#3916/#3917 queue over free lanes instead of dropping items', () => {
  // The workflow script runs in the Workflow JS sandbox (top-level await/return, injected globals) so it is NOT
  // an importable module. To exercise the ACTUAL shipped scheduling algorithm (not a hand-reimplementation that
  // could silently drift from it), extract the exact function/const text for the pieces `buildLaneSchedule`
  // depends on and evaluate them together, matching the closures the real script builds them under
  // (`lanePlan = repoLanePlan(workItems)`, `lanePools` set by Provision, both closed over by buildLaneSchedule).
  function extractBraceBlock(declStart, braceStart) {
    let depth = 0, i = braceStart;
    for (; i < SRC.length; i++) {
      if (SRC[i] === '{') depth++;
      else if (SRC[i] === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    return SRC.slice(declStart, i);
  }
  function extractFunction(name) {
    const start = SRC.indexOf(`function ${name}(`);
    if (start === -1) throw new Error(`function ${name} not found in SRC`);
    return extractBraceBlock(start, SRC.indexOf('{', start));
  }
  function extractConstStatement(name) {
    const start = SRC.indexOf(`const ${name} =`);
    if (start === -1) throw new Error(`const ${name} not found in SRC`);
    let depth = 0, i = start;
    for (; i < SRC.length; i++) {
      const c = SRC[i];
      if (c === '{' || c === '[' || c === '(') depth++;
      else if (c === '}' || c === ']' || c === ')') depth--;
      else if (c === ';' && depth === 0) { i++; break; }
    }
    return SRC.slice(start, i);
  }

  // Builds a `run(workItems, lanePools) -> Map` matching the real script's `buildLaneSchedule(workItems)`, with
  // `lanePlan` computed the same way (`repoLanePlan(workItems)`) and `lanePools` injected per test.
  function makeScheduler() {
    const body = [
      extractConstStatement('REPOS'),
      extractConstStatement('INTEGRATION_ORDER'),
      extractFunction('affectedReposOf'),
      extractFunction('repoLanePlan'),
      extractFunction('laneIndexOf'),
      extractFunction('laneNumFromDir'),
      'let lanePlan = {};',
      'let lanePools = {};',
      extractFunction('buildLaneSchedule'),
      'return function run(workItems, pools) {',
      '  lanePools = pools;',
      '  lanePlan = repoLanePlan(workItems);',
      '  return buildLaneSchedule(workItems);',
      '};',
    ].join('\n');
    // eslint-disable-next-line no-new-func -- deliberately evaluating the SHIPPED source, not new logic
    return new Function(body)();
  }

  // Runs every item's schedule entry to completion, recording (item, laneDir) execution order and asserting no
  // two items are ever concurrently occupying the same lane dir — the exact clobber the old `idx % pool.length`
  // ban was written to prevent, now made safe by queueing instead of dropping.
  async function execute(schedule, workItems, repo = 'we') {
    const busy = new Set();
    const order = [];
    await Promise.all(workItems.map(async (it) => {
      const assign = schedule.get(it);
      if (!assign) { order.push({ item: it.num, dir: null }); return; }
      await Promise.all(Object.values(assign.perRepo).map((p) => p.waitFor));
      const dir = assign.perRepo[repo].dir;
      if (busy.has(dir)) throw new Error(`CLOBBER: two items concurrently on ${dir} (item ${it.num})`);
      busy.add(dir);
      order.push({ item: it.num, dir });
      await new Promise((res) => setTimeout(res, 1)); // simulate in-flight lane work
      busy.delete(dir);
      for (const p of Object.values(assign.perRepo)) p.release();
    }));
    return order;
  }

  it('4 items over 1 lane: all 4 run — sequentially — on that lane', async () => {
    const run = makeScheduler();
    const workItems = [1, 2, 3, 4].map((i) => ({ num: String(i) }));
    const schedule = run(workItems, { we: ['/lanes/lane-9'] });
    // none dropped
    expect(workItems.every((it) => schedule.get(it) !== null)).toBe(true);
    const order = await execute(schedule, workItems);
    expect(order.map((o) => o.dir)).toEqual(['/lanes/lane-9', '/lanes/lane-9', '/lanes/lane-9', '/lanes/lane-9']);
    // items 2-4 are NOT first in the lane-9 queue → each logs/records queued-behind
    expect(schedule.get(workItems[1]).queuedBehind).toEqual(['we lane-9']);
    expect(schedule.get(workItems[2]).queuedBehind).toEqual(['we lane-9']);
    expect(schedule.get(workItems[3]).queuedBehind).toEqual(['we lane-9']);
    // item 1 is first — nothing to queue behind
    expect(schedule.get(workItems[0]).queuedBehind).toEqual([]);
  });

  it('3 items over 2 lanes: lane A runs 2, lane B runs 1 — never two items on one lane at once', async () => {
    const run = makeScheduler();
    const workItems = [1, 2, 3].map((i) => ({ num: String(i) }));
    const schedule = run(workItems, { we: ['/lanes/lane-1', '/lanes/lane-2'] });
    const order = await execute(schedule, workItems); // throws on any clobber
    const perLane = {};
    for (const o of order) perLane[o.dir] = (perLane[o.dir] || 0) + 1;
    expect(perLane).toEqual({ '/lanes/lane-1': 2, '/lanes/lane-2': 1 });
    // the 2nd item onto lane-1 (item 3, round-robin position 2) is queued; item 2 (alone on lane-2) is not
    expect(schedule.get(workItems[2]).queuedBehind).toEqual(['we lane-1']);
    expect(schedule.get(workItems[1]).queuedBehind).toEqual([]);
  });

  it('0 lanes: every item is dropped for lack of a lane, none silently coupled onto a phantom one', () => {
    const run = makeScheduler();
    const workItems = [1, 2, 3, 4].map((i) => ({ num: String(i) }));
    const schedule = run(workItems, { we: [] });
    expect(workItems.every((it) => schedule.get(it) === null)).toBe(true);
  });

  it('the orchestrator maps a null schedule entry to ledger drop:"no-lane", never "no-result"', () => {
    // "no-result" must stay reserved for a genuinely-dead agent; a structurally lane-less item is a distinct,
    // definite outcome the ledger must be able to tell apart (per-item log line required too).
    expect(SRC).toMatch(/drop:\s*'no-lane'/);
    expect(SRC).toMatch(/NO acquirable lane provisioned/);
  });

  it('logs that a waiting item is queued behind a specific lane', () => {
    expect(SRC).toMatch(/queued behind \$\{assign\.queuedBehind\.join\(', '\)\}/);
  });
});
