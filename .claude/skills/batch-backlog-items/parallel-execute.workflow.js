export const meta = {
  name: 'batch-parallel-execute',
  description: 'Execute a /workflow (parallel) batch: probe → partition into provably-independent items (own worktree, concurrent) + an entangled/uncertain serial lane → work each item as its OWN agent → merge worktrees serially with a full gate per merge → regenerate derived artifacts once. Per-item progress. Returns a ledger.',
  whenToUse: 'Invoked by the batch-backlog-items skill ONLY for /workflow (or --parallel), after the main loop has done the conversational pack/plan/one-"go". Not for the default serial /batch.',
  phases: [
    { title: 'Probe', detail: 'predict each item\'s real touch-set (frontmatter files are a lower bound)' },
    { title: 'Items', detail: 'one agent per provably-independent item, each in its own git worktree, concurrent' },
    { title: 'Integrate', detail: 'serial lane first, then merge worktrees one at a time, full gate per merge, replay a conflicted item serially' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// /workflow (parallel) execute phase (backlog #1147, epic #1143; per-item refactor).
//
// WHY THIS IS SAFE — the design contract (mirrors the SKILL.md "Parallel lanes" non-negotiables):
//   1. Serial is the safe baseline. Anything not PROVABLY independent runs in the serial lane.
//   2. Partition only on provable independence: an item runs concurrently ONLY if its predicted touch-set is
//      disjoint from EVERY other item's AND it is on no blockedBy edge with another item. Anything else → serial.
//   3. Each item is its OWN agent — concurrent items in their OWN git worktree; serial items one-at-a-time
//      INSIDE a dedicated integration worktree (never the user's shared checkout). Per-item full single-item
//      arc (claim → work → gate). The workflow NEVER runs `git switch` on the live checkout (#1147 promise).
//   4. Git is the conflict detector: merge worktrees ONE AT A TIME; a conflict ⇒ the partition was wrong, so
//      abort that item's merge and replay it serially on the merged result. Never force-merge.
//   5. No silent speculation: every partition decision + every replay is logged (per item).
//
// PER-ITEM GRANULARITY (vs the old per-lane model): every item is a distinct agent() call, so /workflows shows
// a log line as each item lands — not one line per multi-item lane. Independent items each get their own
// worktree (so they're pairwise-disjoint and merge clean — no replay among them); the only residual conflict
// risk is a concurrent item vs the serial lane, which the merge-one-at-a-time + replay step still catches.
//
// WHAT THE REGISTRY SPLIT (#1145/#1146/#1157) CHANGED: every hand-authored COLLECTION registry is now
// per-entry files (src/_data/<reg>/<id>.json) — #1157 finished the set (plugs/projects/capabilities/
// references/designSystems/analytics/renderStrategies/states/resources/expressiveAssets, after the
// #1145/#1146 churned set). An item adding/editing a registry entry just writes its OWN file — disjoint,
// merges clean, NO integrator-applied manifest. The effects-manifest is NARROW: it covers only the residual
// shared mutations an item must NOT commit itself —
//   • DERIVED artifacts that are regenerated (AGENTS.md, src/_data/referenceIndex.json): two items
//     regenerating them collide, so items leave them alone and the integrator regenerates ONCE.
//   • The handful of registries that are NOT collections of independent entries — single structured config
//     docs (src/_data/{traits,docs,capabilityMatrix}.json), nested-group registries (adapters.json's
//     items[]), single protocol docs (webhandlers/webportals.json), and the sweep/generated artifacts
//     (workbench*/benchmark*/capabilityWorkedExample.json). Splitting them per-key is incoherent, so an
//     item that must edit one is forced into the serial lane (probe flags touchesMonolith). These are the
//     ONLY monoliths left — no collection registry forces the serial lane anymore (#1157).
//
// This script runs in the Workflow JS sandbox: no fs, no child_process, no Date/Math.random. ALL side effects
// (git, backlog.mjs, npm gates) happen INSIDE agents via Bash; the script only does control flow.
//
// args (passed by the main loop after the conversational pack/plan/"go"):
//   { batchSlug, budgetPoints, items: [ { num, slug, file, locus, cost, declaredFiles: [..], blockedBy: [..] } … ] }
// Returns: { integrationBranch, ledger, concurrentItems, serialItems, conflictsReplayed, multiLaneFiles, … }
// ─────────────────────────────────────────────────────────────────────────────

// `args` may arrive as a parsed object OR as a JSON string (the Workflow runtime serializes it in some
// environments — caught by the #1153 first-real-run validation). Tolerate both so `items` is never
// silently empty.
const a = (typeof args === 'string' ? (() => { try { return JSON.parse(args); } catch { return {}; } })() : (args || {}));
const items = Array.isArray(a.items) ? a.items : [];
const batchSlug = a.batchSlug || 'batch-parallel';
const budgetPoints = Number.isFinite(a.budgetPoints) ? a.budgetPoints : Infinity;

if (items.length === 0) {
  log('No packed items passed — nothing to execute.');
  return { ledger: [], concurrentItems: 0, serialItems: 0, conflictsReplayed: 0, derivedRegenerated: false };
}

// ── Schemas ──────────────────────────────────────────────────────────────────

// A per-item effect probe: the REAL touch-set predicted from the body, not just the frontmatter (a lower
// bound — work spills past the declared files). `confident` gates a guess down to "must serialize".
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
      description: 'genuinely-monolithic shared files it must edit (the single-doc registries src/_data/{traits,docs,capabilityMatrix}.json, adapters.json, webhandlers/webportals.json, sweep artifacts workbench*/benchmark*.json) — these force the serial lane, list them explicitly. Per-entry registry files (src/_data/<reg>/<id>.json) are NOT monolithic — never list them.',
    },
    confident: { type: 'boolean', description: 'TRUE when every predicted file is one this item OWNS (its own impl/code, its own demo page, its own backlog/NNN.md, its own per-entry registry entries, its own test file). FALSE *only* when work plausibly spills into a SHARED surface another item could also touch: a still-monolithic registry, shared runtime (plugs/bootstrap.ts), a shared *.njk include, shared test specs, build config (tsconfig/vite/package.json), or a broad cross-file refactor. Routine uncertainty about the exact file COUNT is NOT a reason for false; only genuine shared-surface risk is. Per-entry registry writes do NOT lower confidence. False forces the serial lane.' },
  },
};

// What each ITEM agent returns (concurrent-worktree item OR serial-lane item). NARROW effects manifest (see
// header): items never commit derived artifacts or splice monolithic registries; they report what the
// integrator must do after the merge.
const ITEM_RESULT_SCHEMA = {
  type: 'object',
  required: ['num', 'status', 'gate'],
  additionalProperties: false,
  properties: {
    num: { type: 'string' },
    status: { type: 'string', enum: ['resolved', 'carried', 'dropped'] },
    cost: { type: 'number' },
    drop: { type: 'string', description: 'drop-reason if not resolved (taken/blocked-in-fact/not-batchable/outgrew)' },
    branch: { type: 'string', description: 'the git branch/worktree ref holding this item\'s commit, for the integrator to merge (worktree items only; omit for serial-lane items already on the integration branch).' },
    changedFiles: {
      type: 'array', items: { type: 'string' },
      description: 'EVERY repo-relative file this item actually changed (git diff --name-only vs base). Used to surface files touched by more than one item — the residual silent-merge risk a human should eyeball.',
    },
    derivedArtifacts: {
      type: 'array', items: { type: 'string' },
      description: 'derived files this item WOULD have regenerated but deliberately did NOT (AGENTS.md, src/_data/referenceIndex.json) — the integrator regenerates once.',
    },
    monolithEdits: {
      type: 'array',
      items: {
        type: 'object', required: ['file', 'summary'], additionalProperties: true,
        properties: { file: { type: 'string' }, summary: { type: 'string', description: 'the exact entry/change to re-apply on the integrated tree' } },
      },
      description: 'edits to still-monolithic shared registries the item is NOT committing — the integrator applies them serially.',
    },
    gate: { type: 'string', enum: ['green', 'red'], description: 'result of this item\'s gate (per-item LOCAL gate for worktree items, whole-repo check:standards for serial-lane items).' },
    notes: { type: 'string' },
  },
};

const INTEGRATE_SCHEMA = {
  type: 'object',
  required: ['num', 'merged', 'gate'],
  additionalProperties: true,
  properties: {
    num: { type: 'string' },
    merged: { type: 'boolean', description: 'true if the item\'s worktree branch merged clean into the integration branch.' },
    conflicted: { type: 'boolean', description: 'true if git reported a merge conflict (partition was wrong → replay serially).' },
    gate: { type: 'string', enum: ['green', 'red'], description: 'full check:standards on the merged tree.' },
    notes: { type: 'string' },
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
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
function mustSerialize(entry) {
  const p = entry.probe;
  return !p || p.confident === false || (Array.isArray(p.touchesMonolith) && p.touchesMonolith.length > 0);
}
function blockEdge(x, y) {
  const xbb = new Set((x.blockedBy || []).map(String));
  const ybb = new Set((y.blockedBy || []).map(String));
  return xbb.has(String(y.num)) || ybb.has(String(x.num));
}
function conflicts(x, y) {
  return !disjoint(filesOf(x), filesOf(y)) || blockEdge(x, y);
}

// ── Phase 1 — Probe each item's real touch-set (parallel), then partition (pure JS) ──────────────
phase('Probe');
log(`Probing ${items.length} packed item(s) for their real touch-sets…`);

let probedCount = 0;
const probes = await parallel(items.map((it) => () =>
  agent(
    [
      `You are scoping backlog item #${it.num} ("${it.slug}") for a PARALLEL batch. Read we:backlog/${it.file}`,
      `and any files it references. Predict EVERY repo-relative file this item will create or edit if worked now:`,
      `its impl/code files, its own we:backlog/${it.num}.md, and any per-entry registry file it would add`,
      `(src/_data/<registry>/<id>.json — every collection registry is one-file-per-entry since #1145/#1146/#1157).`,
      `Frontmatter declares: ${JSON.stringify(it.declaredFiles || [])} — treat that as a LOWER BOUND only.`,
      `Per-entry registry files (src/_data/<registry>/<id>.json) are DISJOINT by construction (#1145/#1146/#1157):`,
      `writing your OWN new/edited entry never collides with another item, so do NOT list them in touchesMonolith`,
      `and they do NOT lower your confidence. List in touchesMonolith ONLY the genuinely-monolithic shared files`,
      `(the single-doc registries src/_data/{traits,docs,capabilityMatrix}.json, adapters.json, webhandlers/`,
      `webportals.json, the sweep artifacts workbench*/benchmark*.json; plus plugs/bootstrap.ts, build config).`,
      `Set confident=TRUE when every file you'll touch is one this item clearly OWNS — its own impl/code, its own`,
      `demo page, its own we:backlog/${it.num}.md, its own per-entry registry entries, its own test file.`,
      `Set confident=FALSE *only* when the work plausibly SPILLS into a shared surface another item could also`,
      `touch (a monolithic registry, plugs/bootstrap.ts, a shared *.njk include, a shared test spec, tsconfig/vite/`,
      `package.json, or a broad cross-file refactor). Routine uncertainty about the exact file COUNT is NOT a reason`,
      `for false — only genuine shared-surface risk is; default disjoint-looking work to TRUE. Return ONLY the structured object.`,
    ].join(' '),
    { label: `probe:${it.num}`, phase: 'Probe', schema: PROBE_SCHEMA, effort: 'low' },
  ).then((p) => {
    // Per-probe heartbeat — fires as each probe lands (parallel() is a barrier, but these .then callbacks
    // run the moment each agent resolves), so /workflows shows incremental scoping progress.
    probedCount++;
    const fileN = p && Array.isArray(p.predictedFiles) ? p.predictedFiles.length : 0;
    const verdict = !p ? 'no result → serial' : p.confident === false ? 'low-confidence → serial' :
      (p.touchesMonolith && p.touchesMonolith.length) ? 'touches monolith → serial' : `${fileN} file(s), candidate for concurrent`;
    log(`  probe ${probedCount}/${items.length}: #${it.num} — ${verdict}`);
    return { ...it, probe: p };
  }).catch(() => { probedCount++; log(`  probe ${probedCount}/${items.length}: #${it.num} — probe FAILED → serial`); return { ...it, probe: null }; }),
));

// Partition into a CONCURRENT set (each item provably independent of every other → its own worktree, run
// concurrently) and a SERIAL lane (everything else: probe-uncertain, touches a monolith, or shares files /
// a blockedBy edge with another item → run one-at-a-time on the integration branch). An item is concurrent
// ONLY if it conflicts with NO other candidate — so the concurrent set is pairwise-disjoint by construction
// and its worktrees merge clean (no replay among them).
const probed = probes.filter(Boolean);
const serialFromProbe = probed.filter(mustSerialize);
const candidates = probed.filter((e) => !mustSerialize(e));
const concurrent = [];
const entangled = [];
for (const item of candidates) {
  const clashes = candidates.some((o) => o !== item && conflicts(item, o));
  (clashes ? entangled : concurrent).push(item);
}
const serialItems = [...serialFromProbe, ...entangled];

log(`Partition: ${concurrent.length} independent item(s) → own worktree, concurrent; ${serialItems.length} item(s) → serial lane (sequential on the integration branch). ` +
    (concurrent.length === 0 ? 'No provably-independent item → this degenerates to a serial batch (correct, not a failure).' : ''));
for (const e of concurrent) {
  log(`  concurrent: #${e.num} (${e.slug}) — disjoint files: ${[...filesOf(e)].slice(0, 4).join(', ')}…`);
}
for (const e of serialItems) {
  const why = !e.probe ? 'probe failed' : e.probe.confident === false ? 'low-confidence touch-set' :
    (e.probe.touchesMonolith && e.probe.touchesMonolith.length) ? 'touches a monolithic registry' : 'shares files / a blockedBy edge with another item';
  log(`  serial: #${e.num} (${e.slug}) — ${why}`);
}

// ── Phase 2 — Work each independent item concurrently, ONE agent per item in its OWN worktree ────
phase('Items');

function itemWorktreePrompt(it) {
  return [
    `You are PARALLEL batch item #${it.num} ("${it.slug}") running ALONE in your OWN isolated git worktree.`,
    `Work EXACTLY this one item, full single-item arc (batch-backlog-items SKILL.md / docs/agent/backlog-workflow.md):`,
    `claim (node scripts/backlog.mjs claim ${it.num}) → work, editing ONLY this item's own files: impl/code,`,
    `its own we:backlog/${it.file}, and any per-entry registry file (src/_data/<reg>/<id>.json).`,
    ``,
    `HARD RULES (the parallel-safety contract):`,
    `• Do NOT edit any other item's files, and do NOT splice a still-monolithic shared registry`,
    `  (the single-doc registries src/_data/{traits,docs,capabilityMatrix}.json, adapters.json, webhandlers/`,
    `  webportals.json, sweep artifacts workbench*/benchmark*.json). If this item genuinely needs that,`,
    `  STOP, mark status:"dropped" drop:"outgrew", and report it in monolithEdits for the integrator.`,
    `• Do NOT regenerate or stage derived artifacts: AGENTS.md, src/_data/referenceIndex.json. If your work`,
    `  changes the inventory, just LIST them in derivedArtifacts — the integrator regenerates once.`,
    `• Gate with the LOCAL per-item gate: npm run check:standards -- --local --files=<this item's changed`,
    `  files> (#1144). A red on YOUR files → status carried/dropped and gate:"red".`,
    `• Commit this item's own files inside this worktree (git add <explicit paths>; never -A; never push).`,
    `  Resolve only after its local gate is green.`,
    ``,
    `Report: num, status, cost, the branch ref holding your commit, changedFiles (git diff --name-only vs`,
    `the base — used to flag files touched by >1 item), derivedArtifacts you deferred, any monolithEdits, and`,
    `gate green/red. Return ONLY the structured object.`,
  ].join('\n');
}

if (concurrent.length > 0) {
  log(`Working ${concurrent.length} independent item(s) concurrently, each in its own worktree — each item is logged the instant it lands…`);
}
let itemsDone = 0;
const concurrentResults = await parallel(concurrent.map((it) => () =>
  agent(itemWorktreePrompt(it), { label: `item:#${it.num}`, phase: 'Items', schema: ITEM_RESULT_SCHEMA, isolation: 'worktree' })
    .then((r) => {
      // Per-ITEM heartbeat — fires the moment each item's agent resolves (not after the barrier).
      itemsDone++;
      log(`  ${r && r.status === 'resolved' ? '✓' : '~'} #${it.num} (${itemsDone}/${concurrent.length}): ${r ? r.status + ', gate ' + r.gate : 'no result → replay'} [${it.slug}]`);
      return r ? { ...r, num: r.num || String(it.num), _item: it } : null;
    })
    .catch(() => { itemsDone++; log(`  ✗ #${it.num} (${itemsDone}/${concurrent.length}) died → will replay serially [${it.slug}]`); return null; }),
));

// ── Phase 3 — Integrate: serial lane FIRST, then merge worktrees one at a time, replay on conflict ─
// SAFETY (#1147): ALL of this happens in a throwaway INTEGRATION WORKTREE on a throwaway branch off HEAD —
// the workflow NEVER switches or writes the user's live checkout. The integration branch is assembled in its
// OWN worktree directory (git worktree add), so the user's branch + working tree stay exactly as they were
// for the whole run. The workflow returns the integration branch ref AND its worktree path; the main agent
// does the single landing merge after a green return, then removes the worktree.
phase('Integrate');

const ledger = [];
let conflictsReplayed = 0;
const integrationBranch = `batch-parallel/${batchSlug}`;
const integrationWorktree = `.claude/worktrees/integrate-${batchSlug}`;

// 3.0 — Cut the integration branch in its OWN worktree off the current HEAD. NEVER `git switch` the shared
// checkout — that would move the user's branch out from under them. Everything below works inside the worktree.
await agent(
  `Create a throwaway integration WORKTREE for assembling a parallel batch, WITHOUT touching the user's ` +
  `current checkout or branch. Run exactly: \`git worktree add ${integrationWorktree} -b ${integrationBranch} HEAD\` ` +
  `(this creates branch "${integrationBranch}" checked out in the NEW directory ${integrationWorktree}; the ` +
  `user's live working tree + branch are left completely untouched — do NOT run \`git switch\`/\`git checkout\` ` +
  `in the main checkout). Then make gates runnable in the worktree: \`ln -sfn "$(pwd)/node_modules" ` +
  `${integrationWorktree}/node_modules\`. Confirm the worktree exists and is on ${integrationBranch}. Never push.`,
  { label: 'integrate:setup', phase: 'Integrate' },
).catch(() => null);

// 3a. The serial lane runs FIRST, inside the INTEGRATION WORKTREE, ONE item per agent so each lands its own
// progress line. These items could not be PROVEN independent, so they're the safe baseline the concurrent
// worktrees merge on top of.
if (serialItems.length > 0) {
  log(`Serial lane: working ${serialItems.length} item(s) sequentially in the integration worktree…`);
  let sIdx = 0;
  for (const it of serialItems) {
    sIdx++;
    const r = await agent(
      [
        `You are the SERIAL segment of a parallel batch (slug ${batchSlug}), working item #${it.num}`,
        `("${it.slug}"). Do ALL work INSIDE the integration worktree: \`cd ${integrationWorktree}\` first (it is`,
        `on branch "${integrationBranch}"); never touch the user's main checkout. This item is here because it`,
        `could not be PROVEN independent (uncertain touch-set, touches a monolithic registry, or shares files /`,
        `a blockedBy edge with another item). Work the FULL single-item arc: claim → work → FULL whole-repo gate`,
        `(npm run check:standards, run from inside the worktree) → commit this item's files on this branch`,
        `(never push). Resolve only after green. Return the structured ITEM result (include changedFiles).`,
      ].join(' '),
      { label: `serial:#${it.num}`, phase: 'Integrate', schema: ITEM_RESULT_SCHEMA },
    ).catch(() => null);
    log(`  serial ${sIdx}/${serialItems.length}: #${it.num} — ${r ? r.status + ' (gate ' + r.gate + ')' : 'no result'}`);
    if (r) ledger.push({ num: r.num || String(it.num), status: r.status, cost: r.cost, drop: r.drop, lane: 'serial', changedFiles: r.changedFiles, derivedArtifacts: r.derivedArtifacts });
  }
}

// 3b. Merge each concurrent item's worktree in turn. The JS loop is single-threaded, so merges are naturally
// serialized (the mutex the SKILL requires). The concurrent set is pairwise-disjoint, so these merge clean;
// the only residual conflict risk is vs the serial lane — a conflicted or red item is replayed serially on
// the merged result, never force-merged.
if (concurrentResults.length > 0) log(`Integrating ${concurrentResults.length} item worktree(s) one at a time, full gate per merge…`);
for (let i = 0; i < concurrentResults.length; i++) {
  const cr = concurrentResults[i];
  const it = concurrent[i];
  if (!cr) { log(`#${it.num} produced no result (died/skipped) — replaying serially.`); }
  if (cr && cr.gate === 'red') { log(`#${it.num} gate RED in its worktree — not merging; replaying serially on the integrated tree.`); }

  const mergeable = cr && cr.gate === 'green' && cr.branch;
  let integrated = null;
  if (mergeable) {
    log(`  merging #${it.num} (${i + 1}/${concurrentResults.length})…`);
    integrated = await agent(
      [
        `Inside the integration worktree (\`cd ${integrationWorktree}\`, on branch "${integrationBranch}"; never`,
        `touch the user's main checkout), integrate parallel batch item #${it.num} (branch "${cr.branch}").`,
        `Merge it: attempt the merge; if git reports a CONFLICT, ABORT the merge (git merge --abort) and report`,
        `conflicted:true — DO NOT force it. On a clean merge, run the FULL gate (npm run check:standards) on the`,
        `merged tree and report gate green/red. Never push. Return { num:"${it.num}", merged, conflicted, gate, notes }.`,
      ].join(' '),
      { label: `integrate:#${it.num}`, phase: 'Integrate', schema: INTEGRATE_SCHEMA },
    ).catch(() => null);
  }

  const needsReplay = !mergeable || !integrated || integrated.conflicted || !integrated.merged || integrated.gate === 'red';
  if (needsReplay) {
    conflictsReplayed++;
    const reason = !mergeable ? 'item red/no-branch' : integrated && integrated.conflicted ? 'merge conflict' : 'post-merge gate red';
    log(`#${it.num} could not land clean (${reason}) — replaying it serially.`);
    const replay = await agent(
      [
        `Inside the integration worktree (\`cd ${integrationWorktree}\`, on branch "${integrationBranch}"; never`,
        `touch the user's main checkout), replay parallel batch item #${it.num} ("${it.slug}") SERIALLY (its`,
        `worktree merge was aborted/failed). Work it as an ordinary serial item: claim if not already active,`,
        `redo the edits on THIS tree, FULL whole-repo gate (npm run check:standards), commit (never push).`,
        `Return the structured ITEM result (include changedFiles).`,
      ].join(' '),
      { label: `replay:#${it.num}`, phase: 'Integrate', schema: ITEM_RESULT_SCHEMA },
    ).catch(() => null);
    const src = replay || cr;
    if (src) ledger.push({ num: src.num || String(it.num), status: src.status, cost: src.cost, drop: src.drop, lane: `#${it.num}-replayed`, changedFiles: src.changedFiles, derivedArtifacts: src.derivedArtifacts });
    log(`  replay #${it.num}: ${replay ? replay.status + ' (gate ' + replay.gate + ')' : 'no result'}`);
  } else {
    ledger.push({ num: cr.num || String(it.num), status: cr.status, cost: cr.cost, drop: cr.drop, lane: `#${it.num}`, changedFiles: cr.changedFiles, derivedArtifacts: cr.derivedArtifacts });
  }
}

// 3c. Regenerate derived artifacts ONCE on the fully-merged tree, then a final whole-repo gate.
const derived = new Set();
for (const l of ledger) if (l && Array.isArray(l.derivedArtifacts)) for (const d of l.derivedArtifacts) derived.add(d);
for (const cr of concurrentResults) if (cr && Array.isArray(cr.derivedArtifacts)) for (const d of cr.derivedArtifacts) derived.add(d);
let derivedRegenerated = false;
if (derived.size > 0) {
  log(`Regenerating ${derived.size} derived artifact(s) once on the merged tree: ${[...derived].join(', ')}`);
  const regen = await agent(
    [
      `Inside the integration worktree (\`cd ${integrationWorktree}\`, on branch "${integrationBranch}"; never`,
      `touch the user's main checkout), regenerate the derived artifacts the items deferred:`,
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

// 3d. Surface files touched by MORE THAN ONE item — the residual silent-merge risk (a clean merge that's
// semantically wrong). The concurrent set is disjoint by construction, so this flags only a concurrent item
// that overlaps a serial-lane item. After #1145/#1146 it is usually empty (per-entry registries keep
// changesets disjoint).
const fileItemCount = new Map();
for (const l of ledger) {
  if (!l || !Array.isArray(l.changedFiles)) continue;
  for (const f of new Set(l.changedFiles)) fileItemCount.set(f, (fileItemCount.get(f) || 0) + 1);
}
const multiLaneFiles = [...fileItemCount.entries()].filter(([, n]) => n > 1).map(([f]) => f);
if (multiLaneFiles.length > 0) {
  log(`⚠ ${multiLaneFiles.length} file(s) were changed by more than one item — eyeball for a silent clean-but-wrong merge: ${multiLaneFiles.join(', ')}`);
}

const resolved = ledger.filter((l) => l.status === 'resolved');
const spent = resolved.reduce((s, l) => s + (Number(l.cost) || 0), 0);
log(`Parallel batch assembled on ${integrationBranch} (in worktree ${integrationWorktree}): ${resolved.length}/${ledger.length} resolved, ${conflictsReplayed} item(s) replayed serially, ${multiLaneFiles.length} multi-item file(s), ${spent}/${budgetPoints} points. The user's checkout was never touched. The MAIN AGENT now lands ${integrationBranch} onto the live branch, then removes the worktree (git worktree remove ${integrationWorktree}).`);

return {
  // The workflow never touched the user's checkout/branch — it assembled everything in its own worktree.
  // The main agent lands this (single merge from the live branch) after a green return, then removes the worktree.
  integrationBranch,
  integrationWorktree,  // the isolated worktree holding the assembled branch; main agent removes it after landing
  ledger,
  concurrentItems: concurrent.length,
  serialItems: serialItems.length,
  conflictsReplayed,
  multiLaneFiles,       // files touched by >1 item — the close-skill audit surfaces these for a human glance
  derivedRegenerated,
  pointsSpent: spent,
  budgetPoints,
};
