export const meta = {
  name: 'batch-parallel-execute',
  description: 'Execute an opt-in /batch --parallel: probe → partition into provably-disjoint lanes → work lanes concurrently in isolated worktrees → merge serially with a full gate per merge → regenerate derived artifacts once. Returns a ledger.',
  whenToUse: 'Invoked by the batch-backlog-items skill ONLY for /batch --parallel, after the main loop has done the conversational pack/plan/one-"go". Not for the default serial batch.',
  phases: [
    { title: 'Probe', detail: 'predict each item\'s real touch-set (frontmatter files are a lower bound)' },
    { title: 'Lanes', detail: 'one agent per provably-disjoint lane, in its own git worktree' },
    { title: 'Integrate', detail: 'merge clean lanes one at a time, full gate per merge, replay a conflicted lane serially' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// /batch --parallel execute phase (backlog #1147, epic #1143).
//
// WHY THIS IS SAFE — the design contract (mirrors the SKILL.md "Parallel lanes" non-negotiables):
//   1. Serial is the safe baseline. Anything not PROVABLY independent runs in one serial lane.
//   2. Partition only on provable independence: two items share a lane unless their predicted touch-sets
//      are disjoint AND neither is on the other's blockedBy edge.
//   3. Each lane keeps the full serial arc (claim → work → per-lane gate) in its OWN git worktree.
//   4. Git is the conflict detector: merge clean lanes ONE AT A TIME; a conflict ⇒ the partition was wrong,
//      so abort that lane and replay its items serially on the merged result. Never force-merge.
//   5. No silent speculation: every partition + every replay is logged.
//
// WHAT THE REGISTRY SPLIT (#1145/#1146) CHANGED: shared registries are now per-entry files
// (src/_data/<reg>/<id>.json), so a lane adding/editing a registry entry just writes its OWN new/edited
// file — disjoint across lanes, merges clean, NO integrator-applied manifest. The effects-manifest is now
// NARROW: it covers only the residual shared mutations a lane must NOT commit itself —
//   • DERIVED artifacts that are regenerated (AGENTS.md inventory, src/_data/referenceIndex.json): two
//     lanes regenerating them collide, so lanes leave them alone and the integrator regenerates ONCE.
//   • Rare edits to a still-MONOLITHIC low-churn registry (projects/capabilities/adapters/capabilityMatrix/
//     designSystems): the integrator applies these serially after merge.
//
// This script runs in the Workflow JS sandbox: no fs, no child_process, no Date/Math.random. ALL
// side effects (git, backlog.mjs, npm gates) happen INSIDE agents via Bash; the script only does control
// flow (partition, the budget loop, sequencing).
//
// args (passed by the main loop after the conversational pack/plan/"go"):
//   {
//     batchSlug:   'batch-<date>-<NNN>-<NNN>…',   // the session label (already reserved by the main loop)
//     budgetPoints: <number>,                      // the points budget (sole stop driver)
//     items: [ { num, slug, file, locus, cost, declaredFiles: [..], blockedBy: [..] }, … ]  // the packed Tier-A items
//   }
// Returns: { ledger: [ { num, status, cost, lane, drop? } … ], lanes, conflictsReplayed, derivedRegenerated }
// ─────────────────────────────────────────────────────────────────────────────

const a = args || {};
const items = Array.isArray(a.items) ? a.items : [];
const batchSlug = a.batchSlug || 'batch-parallel';
const budgetPoints = Number.isFinite(a.budgetPoints) ? a.budgetPoints : Infinity;

if (items.length === 0) {
  log('No packed items passed — nothing to execute.');
  return { ledger: [], lanes: 0, conflictsReplayed: 0, derivedRegenerated: false };
}

// ── Schemas ──────────────────────────────────────────────────────────────────

// A per-item effect probe: the REAL touch-set predicted from the body, not just the frontmatter (which is
// a lower bound — work spills past the declared files). `confident` gates a guess down to "must serialize".
const PROBE_SCHEMA = {
  type: 'object',
  required: ['num', 'predictedFiles', 'confident'],
  additionalProperties: false,
  properties: {
    num: { type: 'string', description: 'the backlog NNN this probe is for' },
    predictedFiles: {
      type: 'array', items: { type: 'string' },
      description: 'every repo-relative file this item will plausibly create or edit — code, its own backlog/NNN.md, and any per-entry registry file (src/_data/<reg>/<id>.json). Err WIDE: a missed file corrupts a merge.',
    },
    touchesMonolith: {
      type: 'array', items: { type: 'string' },
      description: 'still-monolithic shared files it must edit (e.g. src/_data/projects.json) — these force the integrator path, list them explicitly.',
    },
    confident: { type: 'boolean', description: 'false if the touch-set is uncertain — the item is then forced into the serial lane (safe default).' },
  },
};

// The registry-effects manifest a lane returns — NARROW (see header). Lanes never commit derived artifacts
// or splice monolithic registries; they report what the integrator must do after the merge.
const LANE_RESULT_SCHEMA = {
  type: 'object',
  required: ['lane', 'worked', 'laneGate'],
  additionalProperties: false,
  properties: {
    lane: { type: 'string' },
    worked: {
      type: 'array',
      items: {
        type: 'object',
        required: ['num', 'status'],
        additionalProperties: true,
        properties: {
          num: { type: 'string' },
          status: { type: 'string', enum: ['resolved', 'carried', 'dropped'] },
          cost: { type: 'number' },
          drop: { type: 'string', description: 'drop-reason if not resolved (taken/blocked-in-fact/not-batchable/outgrew)' },
        },
      },
    },
    branch: { type: 'string', description: 'the git branch/worktree ref holding this lane\'s commits, for the integrator to merge.' },
    changedFiles: {
      type: 'array', items: { type: 'string' },
      description: 'EVERY repo-relative file this lane actually changed (git diff --name-only against the base). Used to surface files touched by more than one lane — the residual silent-merge risk a human should eyeball.',
    },
    derivedArtifacts: {
      type: 'array', items: { type: 'string' },
      description: 'derived files this lane WOULD have regenerated but deliberately did NOT (AGENTS.md, src/_data/referenceIndex.json) — the integrator regenerates once.',
    },
    monolithEdits: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'summary'],
        additionalProperties: true,
        properties: { file: { type: 'string' }, summary: { type: 'string', description: 'the exact entry/change to re-apply on the integrated tree' } },
      },
      description: 'edits to still-monolithic shared registries the lane is NOT committing — the integrator applies them serially.',
    },
    laneGate: { type: 'string', enum: ['green', 'red'], description: 'result of the per-lane LOCAL gate (check:standards --local --files=<lane files>).' },
    notes: { type: 'string' },
  },
};

const INTEGRATE_SCHEMA = {
  type: 'object',
  required: ['lane', 'merged', 'gate'],
  additionalProperties: true,
  properties: {
    lane: { type: 'string' },
    merged: { type: 'boolean', description: 'true if the lane merged clean into the integration branch.' },
    conflicted: { type: 'boolean', description: 'true if git reported a merge conflict (partition was wrong → replay serially).' },
    gate: { type: 'string', enum: ['green', 'red'], description: 'full check:standards on the merged tree.' },
    notes: { type: 'string' },
  },
};

// ── Phase 1 — Probe each item's real touch-set (parallel), then partition (pure JS) ──────────────
phase('Probe');
log(`Probing ${items.length} packed item(s) for their real touch-sets…`);

const probes = await parallel(items.map((it) => () =>
  agent(
    [
      `You are scoping backlog item #${it.num} ("${it.slug}") for a PARALLEL batch. Read we:backlog/${it.file}`,
      `and any files it references. Predict EVERY repo-relative file this item will create or edit if worked now:`,
      `its impl/code files, its own we:backlog/${it.num}.md, and any per-entry registry file it would add`,
      `(src/_data/<registry>/<id>.json — registries are one-file-per-entry since #1145/#1146).`,
      `Frontmatter declares: ${JSON.stringify(it.declaredFiles || [])} — treat that as a LOWER BOUND only.`,
      `List still-monolithic shared files it must edit separately in touchesMonolith.`,
      `Set confident=false if you are at all unsure of the touch-set — a missed file corrupts a merge, so`,
      `uncertainty must fall back to serial. Return ONLY the structured object.`,
    ].join(' '),
    { label: `probe:${it.num}`, phase: 'Probe', schema: PROBE_SCHEMA, effort: 'low' },
  ).then((p) => ({ ...it, probe: p })).catch(() => ({ ...it, probe: null })),
));

// Greedy partition into lanes. Lane 0 is the SERIAL fallback lane: every item that can't be PROVEN
// independent (probe failed, low-confidence, touches a monolith, or shares a file / blockedBy edge with an
// already-placed item) lands here and runs one-after-another. Other lanes are provably-disjoint singletons-
// or-clusters that can run concurrently.
const numToItem = new Map(items.map((it) => [String(it.num), it]));
const lanes = [[]]; // lanes[0] = serial fallback
const laneFiles = [new Set()];

function filesOf(entry) {
  const p = entry.probe;
  const base = new Set([`backlog/${entry.file}`]);
  if (p && Array.isArray(p.predictedFiles)) for (const f of p.predictedFiles) base.add(f);
  if (Array.isArray(entry.declaredFiles)) for (const f of entry.declaredFiles) base.add(f);
  return base;
}
function disjoint(setA, setB) {
  for (const f of setA) if (setB.has(f)) return false;
  return true;
}
function onBlockEdge(entry, laneItems) {
  const bb = new Set((entry.blockedBy || []).map(String));
  for (const li of laneItems) {
    if (bb.has(String(li.num))) return true;
    if ((li.blockedBy || []).map(String).includes(String(entry.num))) return true;
  }
  return false;
}

for (const entry of probes.filter(Boolean)) {
  const f = filesOf(entry);
  const mustSerialize = !entry.probe || entry.probe.confident === false ||
    (entry.probe.touchesMonolith && entry.probe.touchesMonolith.length > 0);
  if (mustSerialize) { lanes[0].push(entry); for (const x of f) laneFiles[0].add(x); continue; }
  // try to place in an existing PARALLEL lane (index ≥ 1) it is disjoint with; else open a new lane.
  let placed = false;
  for (let i = 1; i < lanes.length; i++) {
    if (disjoint(f, laneFiles[i]) && !onBlockEdge(entry, lanes[i])) {
      lanes[i].push(entry); for (const x of f) laneFiles[i].add(x); placed = true; break;
    }
  }
  if (!placed) { lanes.push([entry]); laneFiles.push(new Set(f)); }
}

const parallelLanes = lanes.slice(1).filter((l) => l.length > 0);
const serialLane = lanes[0];
log(`Partition: ${parallelLanes.length} parallel lane(s) + ${serialLane.length} item(s) in the serial fallback lane. ` +
    (parallelLanes.length === 0 ? 'No provably-disjoint pair → this degenerates to a serial batch (correct, not a failure).' : ''));
for (let i = 0; i < parallelLanes.length; i++) {
  log(`  lane ${i + 1}: ${parallelLanes[i].map((e) => '#' + e.num).join(', ')} — disjoint files: ${[...filesOf(parallelLanes[i][0])].slice(0, 4).join(', ')}…`);
}

// ── Phase 2 — Work each parallel lane concurrently in its OWN worktree (barrier) ─────────────────
phase('Lanes');

function laneAgentPrompt(laneId, laneItems) {
  return [
    `You are PARALLEL batch lane "${laneId}" running in your OWN isolated git worktree. Work these items`,
    `one-after-another, full single-item arc each: ${laneItems.map((e) => `#${e.num} (${e.slug})`).join(' → ')}.`,
    `Follow the batch-backlog-items SKILL.md / docs/agent/backlog-workflow.md arc per item:`,
    `claim (node scripts/backlog.mjs claim <NNN>) → work, editing ONLY this lane's own files: impl/code,`,
    `the item's own we:backlog/<NNN>.md, and any per-entry registry file (src/_data/<reg>/<id>.json).`,
    ``,
    `HARD RULES (the parallel-safety contract):`,
    `• Do NOT edit any other item's files, and do NOT splice a still-monolithic shared registry`,
    `  (projects/capabilities/adapters/capabilityMatrix/designSystems). If an item genuinely needs that,`,
    `  STOP that item, mark it dropped:"outgrew", and report it in monolithEdits for the integrator.`,
    `• Do NOT regenerate or stage derived artifacts: AGENTS.md, src/_data/referenceIndex.json. If your work`,
    `  changes the inventory, just LIST them in derivedArtifacts — the integrator regenerates once.`,
    `• Gate per item with the LOCAL per-lane gate: npm run check:standards -- --local --files=<this item's`,
    `  changed files> (#1144). A red on YOUR files is a stop for that item (mark carried/dropped).`,
    `• Commit each resolved item's own files inside this worktree (git add <explicit paths>; never -A; never`,
    `  push). Resolve only after its local gate is green.`,
    ``,
    `Report: the branch ref holding your commits, each item's status, the full list of files you changed`,
    `(changedFiles = git diff --name-only against the base — used to flag files touched by >1 lane),`,
    `derivedArtifacts you deferred, and any monolithEdits. Return ONLY the structured object.`,
  ].join('\n');
}

const laneResults = await parallel(parallelLanes.map((laneItems, idx) => () =>
  agent(laneAgentPrompt(`L${idx + 1}`, laneItems), {
    label: `lane:L${idx + 1}`,
    phase: 'Lanes',
    schema: LANE_RESULT_SCHEMA,
    isolation: 'worktree',
  }).catch(() => null),
));

// ── Phase 3 — Integrate: merge clean lanes ONE AT A TIME, full gate per merge, replay on conflict ─
// SAFETY (#1147 refinement): ALL of this happens on a throwaway INTEGRATION BRANCH off HEAD — the
// workflow NEVER writes the user's live working branch. It returns the integration branch ref; the main
// agent does the single landing merge after the workflow returns green (smallest possible write-window on
// the shared branch, a natural abort point, and any concurrent-session divergence handled by ONE merge).
phase('Integrate');

const ledger = [];
let conflictsReplayed = 0;
const integrationBranch = `batch-parallel/${batchSlug}`;

// 3.0 — Cut the integration branch off the current HEAD. Everything below works on it.
await agent(
  `Create and switch to a throwaway integration branch "${integrationBranch}" off the current HEAD ` +
  `(git switch -c ${integrationBranch}). This branch is where the whole parallel batch is assembled; the ` +
  `user's live working branch must stay untouched. Just create+switch and confirm. Never push.`,
  { label: 'integrate:setup', phase: 'Integrate' },
).catch(() => null);

// 3a. The serial fallback lane runs FIRST, on the INTEGRATION branch (no worktree) — the safe baseline the
// parallel lanes merge on top of. Delegated to one agent that works it as an ordinary serial batch segment.
if (serialLane.length > 0) {
  log(`Serial fallback lane: working ${serialLane.length} item(s) on the integration branch…`);
  const serial = await agent(
    [
      `You are the SERIAL segment of a parallel batch (slug ${batchSlug}), working on the integration branch`,
      `"${integrationBranch}" (already checked out; no worktree). Work these items one-after-another, full`,
      `single-item arc each, gating + committing per item exactly like a normal serial batch:`,
      `${serialLane.map((e) => `#${e.num} (${e.slug})`).join(' → ')}.`,
      `These were placed here because they could not be PROVEN independent. Use the full whole-repo gate`,
      `(npm run check:standards) before each resolve. Commit per item on this branch (never push). Return the`,
      `structured lane result (include changedFiles).`,
    ].join(' '),
    { label: 'serial-lane', phase: 'Integrate', schema: LANE_RESULT_SCHEMA },
  ).catch(() => null);
  if (serial && Array.isArray(serial.worked)) {
    for (const w of serial.worked) ledger.push({ ...w, lane: 'serial' });
  }
}

// 3b. Merge each parallel lane in turn. The JS loop is single-threaded, so integrations are naturally
// serialized (the mutex the SKILL requires). A conflicted or red lane is replayed serially on the merged
// result — never force-merged.
for (let i = 0; i < laneResults.length; i++) {
  const lr = laneResults[i];
  const laneId = `L${i + 1}`;
  if (!lr) { log(`lane ${laneId} produced no result (died/skipped) — replaying its items serially.`); }

  if (lr && lr.laneGate === 'red') {
    log(`lane ${laneId} gate RED in its worktree — not merging; replaying its items serially on the integrated tree.`);
  }

  const mergeable = lr && lr.laneGate === 'green' && lr.branch;
  let integrated = null;
  if (mergeable) {
    integrated = await agent(
      [
        `Integrate parallel batch lane ${laneId} (branch "${lr.branch}") into the current integration branch.`,
        `Merge it ONE lane at a time: attempt the merge; if git reports a CONFLICT, ABORT the merge`,
        `(git merge --abort) and report conflicted:true — DO NOT force it. On a clean merge, run the FULL gate`,
        `(npm run check:standards) on the merged tree and report gate green/red. Never push.`,
      ].join(' '),
      { label: `integrate:${laneId}`, phase: 'Integrate', schema: INTEGRATE_SCHEMA },
    ).catch(() => null);
  }

  const needsReplay = !mergeable || !integrated || integrated.conflicted || !integrated.merged || integrated.gate === 'red';
  if (needsReplay) {
    conflictsReplayed++;
    log(`lane ${laneId} could not land clean (${!mergeable ? 'lane red/no-branch' : integrated && integrated.conflicted ? 'merge conflict' : 'post-merge gate red'}) — replaying its items serially.`);
    const replay = await agent(
      [
        `Replay parallel batch lane ${laneId}'s items SERIALLY on the current integration branch (its worktree`,
        `merge was aborted/failed). Items: ${parallelLanes[i].map((e) => `#${e.num} (${e.slug})`).join(' → ')}.`,
        `Work each as an ordinary serial item (claim if not already active, redo the edits on THIS tree, full`,
        `whole-repo gate, commit per item). Return the structured lane result.`,
      ].join(' '),
      { label: `replay:${laneId}`, phase: 'Integrate', schema: LANE_RESULT_SCHEMA },
    ).catch(() => null);
    const src = replay || lr;
    if (src && Array.isArray(src.worked)) for (const w of src.worked) ledger.push({ ...w, lane: `${laneId}-replayed` });
  } else {
    for (const w of (lr.worked || [])) ledger.push({ ...w, lane: laneId });
  }
}

// 3c. Regenerate derived artifacts ONCE on the fully-merged tree, then a final whole-repo gate.
const derived = new Set();
for (const lr of laneResults) if (lr && Array.isArray(lr.derivedArtifacts)) for (const d of lr.derivedArtifacts) derived.add(d);
let derivedRegenerated = false;
if (derived.size > 0) {
  log(`Regenerating ${derived.size} derived artifact(s) once on the merged tree: ${[...derived].join(', ')}`);
  const regen = await agent(
    [
      `On the current integration branch, regenerate the derived artifacts the lanes deferred:`,
      `${[...derived].join(', ')}. Run the canonical generators (e.g. npm run gen:inventory for AGENTS.md,`,
      `npm run gen:reference-index for src/_data/referenceIndex.json), then run the FULL gate`,
      `(npm run check:standards) and commit the regenerated artifacts in ONE commit. Report gate green/red.`,
      `Return { gate: 'green'|'red', notes }.`,
    ].join(' '),
    { label: 'integrate:derived', phase: 'Integrate', schema: { type: 'object', required: ['gate'], additionalProperties: true, properties: { gate: { type: 'string', enum: ['green', 'red'] }, notes: { type: 'string' } } } },
  ).catch(() => null);
  derivedRegenerated = !!regen;
  if (regen && regen.gate === 'red') log('Derived-artifact regen left the gate RED — surface this at close-out; do not mark the batch clean.');
}

// 3d. Surface files touched by MORE THAN ONE lane — the residual silent-merge risk (a clean merge that's
// semantically wrong). git already flags textual conflicts; this flags the files where two lanes' changes
// COULD interact even when the merge was clean, so the close-skill audit (and a human) can eyeball them.
// After #1145/#1146 this list is usually empty (per-entry registries make lane changesets disjoint).
const fileLaneCount = new Map();
const allLaneResults = [...laneResults, /* serial lane is on-branch, its files can't cross-lane-conflict */];
for (const lr of allLaneResults) {
  if (!lr || !Array.isArray(lr.changedFiles)) continue;
  for (const f of new Set(lr.changedFiles)) fileLaneCount.set(f, (fileLaneCount.get(f) || 0) + 1);
}
const multiLaneFiles = [...fileLaneCount.entries()].filter(([, n]) => n > 1).map(([f]) => f);
if (multiLaneFiles.length > 0) {
  log(`⚠ ${multiLaneFiles.length} file(s) were changed by more than one lane — eyeball for a silent clean-but-wrong merge: ${multiLaneFiles.join(', ')}`);
}

const resolved = ledger.filter((l) => l.status === 'resolved');
const spent = resolved.reduce((s, l) => s + (Number(l.cost) || 0), 0);
log(`Parallel batch assembled on ${integrationBranch}: ${resolved.length}/${ledger.length} resolved, ${conflictsReplayed} lane(s) replayed serially, ${multiLaneFiles.length} multi-lane file(s), ${spent}/${budgetPoints} points. The MAIN AGENT now lands ${integrationBranch} onto the live branch.`);

return {
  // The workflow never touched the live branch. The main agent lands this (single merge) after a green return.
  integrationBranch,
  ledger,
  lanes: parallelLanes.length,
  serialItems: serialLane.length,
  conflictsReplayed,
  multiLaneFiles,       // files touched by >1 lane — the close-skill audit surfaces these for a human glance
  derivedRegenerated,
  pointsSpent: spent,
  budgetPoints,
};
