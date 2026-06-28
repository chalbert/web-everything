export const meta = {
  name: 'batch-parallel-execute',
  description: 'Execute a /workflow (parallel) batch on the #1933 CLONE model: probe → partition into provably-independent items + a serial lane → central pre-claim (push a lane/_base ref) → work each independent item as its OWN agent in a persistent LANE CLONE (own HEAD, guard-immune), push HEAD:lane/<n> → central integrator (primary checkout) merges each lane into main one-at-a-time with a full gate per merge, rebase-and-retry on conflict, deletes the remote temp ref, regenerates derived artifacts once. Per-item progress. Returns a ledger.',
  whenToUse: 'Invoked by the batch-backlog-items skill ONLY for /workflow (or --parallel), after the main loop has done the conversational pack/plan/one-"go". Not for the default serial /batch.',
  phases: [
    { title: 'Probe', detail: 'predict each item\'s real touch-set (frontmatter files are a lower bound)' },
    { title: 'Claim', detail: 'central pre-claim ALL items + provision the lane pool + push the lane/_base ref' },
    { title: 'Lanes', detail: 'one agent per provably-independent item, each in its own persistent clone, concurrent → push lane/<n>' },
    { title: 'Integrate', detail: 'serial lane on main, then merge each lane ref one-at-a-time (full gate per merge, rebase-retry on conflict), delete refs, regen derived once' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// /workflow (parallel) execute phase — the #1933 CLONE-based orchestrator (epic #1933, slice 3 = #1942).
//
// WHY CLONES, NOT WORKTREES (the #1153 4th-run finding): the previous orchestrator isolated lanes with
// `git worktree add` + assembled on a throwaway `batch-parallel/*` branch. The user-global git-branch guard
// hook denies BOTH `git worktree add` and branch creation in the shared checkout (it protects the shared HEAD
// across concurrent sessions), so the worktree model is STRUCTURALLY blocked. The clone model sidesteps the
// guard entirely: each lane is its OWN clone with its OWN HEAD (no shared-HEAD hazard), and convergence
// happens through the remote — a lane pushes its commit to a throwaway `lane/*` ref (allowed by the #1934
// guard carve-out) and the central integrator merges those into main. Push auth is prompt-free (ssh-agent +
// macOS Keychain).
//
// THE DESIGN CONTRACT (mirrors SKILL.md "Parallel lanes" + the ratified decisions #1935/#1936/#1937):
//   1. Serial is the safe baseline. Anything not PROVABLY independent runs in the serial lane (on main).
//   2. Partition only on provable independence: an item runs concurrently ONLY if its predicted touch-set is
//      disjoint from EVERY other item's AND it is on no blockedBy edge with another item. Else → serial.
//   3. Central pre-claim (#1933 choice 2). The orchestrator claims ALL items up front in the PRIMARY checkout
//      (`backlog.mjs claim` → status:active + the central claims.json), commits, and pushes the post-claim
//      state to a throwaway `lane/_base-<slug>` ref. Lanes `reset --hard` to that base, so each item is
//      already `active` in its clone — lanes NEVER run claim and NEVER stage claims.json (the per-lane
//      claim+push race choice 2 rejects can't happen). Because the merge-base is `lane/_base`, an item's
//      `active→resolved` flip is a one-sided change → every lane→main merge is conflict-free on that file.
//   4. Git is the conflict detector: merge each lane into main ONE AT A TIME; a conflict ⇒ rebase the lane
//      onto current main and retry (#1933) — NEVER force; if a real semantic conflict survives the rebase,
//      replay that item serially on main. A FULL gate runs per merge (#1937: the central gate is the
//      authority). The remote `lane/*` ref is deleted only AFTER its merge lands (so nothing is lost on a
//      mid-integration failure — all lane work stays durable on origin until then).
//   5. No silent speculation: every partition decision + every rebase/replay is logged (per item).
//
// SAFETY-MODEL SHIFT vs the worktree model (deliberate, decision-mandated): the worktree model's "workflow
// NEVER writes the live branch; the main agent lands" is replaced by "all lane work is durable on origin
// before any merge, so the central integrator lands directly on the primary checkout's main." The abort-point
// safety is preserved differently — the source of truth is the remote `lane/*` refs, not a local throwaway
// branch. The MAIN AGENT therefore does NOT do a landing merge after this returns; it reports the ledger and
// surfaces multiLaneFiles/stranded.
//
// REGISTRY SPLIT (#1145/#1146/#1157): every hand-authored COLLECTION registry is per-entry files
// (src/_data/<reg>/<id>.json) — an item adding/editing a registry entry writes its OWN file (disjoint, merges
// clean, NO integrator-applied manifest). The effects-manifest is NARROW: only the residual shared mutations
// an item must NOT commit itself — DERIVED artifacts regenerated once (AGENTS.md inventory block,
// src/_data/referenceIndex.json, src/_data/capabilityWorkedExample.json — the #1935 Fork-2 "regenerate-on-
// merge" set) and the handful of genuinely-monolithic single-doc registries (src/_data/{traits,docs,
// capabilityMatrix}.json, adapters.json, webhandlers/webportals.json, the sweep artifacts workbench*/
// benchmark*.json), which force the touching item into the serial lane.
//
// OUT OF SCOPE for slice 3 (follow-up slices): the pre-lock reservation layer (#1935 Fork 2 / #1936 lock
// primitive / #1938 adapters.json split). This slice ships the OPTIMISTIC git-merge FLOOR (Option D) with
// post-hoc multiLaneFiles detection, per #1942's body and #1935's ratified "D-is-the-floor" ruling.
//
// This script runs in the Workflow JS sandbox: no fs, no child_process, no Date/Math.random. ALL side effects
// (git, lane-pool.mjs, backlog.mjs, npm gates) happen INSIDE agents via Bash; the script only does control flow.
//
// args (passed by the main loop after the conversational pack/plan/"go"):
//   { batchSlug, budgetPoints, items: [ { num, slug, file, locus, cost, declaredFiles: [..], blockedBy: [..] } … ] }
// Returns: { ledger, concurrentItems, serialItems, conflictsReplayed, stranded, multiLaneFiles,
//            derivedRegenerated, pointsSpent, budgetPoints, baseRef }
//   The result is already landed on the primary checkout's main — there is NO integrationBranch to land.
//   stranded (#1869 defect 2): items an agent reported `resolved` whose resolve commit was NOT verified
//   reachable from HEAD (a post-assembly git reconcile) — reclassified, never counted resolved.
// ─────────────────────────────────────────────────────────────────────────────

// `args` may arrive as a parsed object OR as a JSON string (the Workflow runtime serializes it in some
// environments — caught by the #1153 first-real-run validation). Tolerate both so `items` is never empty.
const a = (typeof args === 'string' ? (() => { try { return JSON.parse(args); } catch { return {}; } })() : (args || {}));
const items = Array.isArray(a.items) ? a.items : [];
const batchSlug = a.batchSlug || 'batch-parallel';
const budgetPoints = Number.isFinite(a.budgetPoints) ? a.budgetPoints : Infinity;
// The throwaway base ref carrying the central post-claim state lanes reset to. Slashes keep it under the
// lane/* namespace the #1934 carve-out allows (push + delete). One per batch (slug-scoped).
const baseRef = `lane/_base-${batchSlug}`;

if (items.length === 0) {
  log('No packed items passed — nothing to execute.');
  return { ledger: [], concurrentItems: 0, serialItems: 0, conflictsReplayed: 0, derivedRegenerated: false, baseRef };
}

// ── Subagent return-hygiene contract (#1861, model-usage watch #1855) ──────────
// Prepended to every spawned-agent prompt. Keeps returns as CONCLUSIONS the parent keeps, not transcripts,
// and kills the confidently-invented-specifics failure. Canonical prose: docs/agent/backlog-workflow.md →
// "Subagent return hygiene"; mirrored here because a workflow script has no filesystem read at runtime.
const RETURN_HYGIENE = [
  `RETURN HYGIENE — return the conclusion the parent will keep, not a transcript:`,
  `• NEVER fabricate specifics. No invented version numbers, file:line refs, API names, flags, or counts —`,
  `  if you did not READ it in this run, do not state it as fact. An honest "unknown / not verified" beats a`,
  `  plausible guess (a wrong file:line or version is worse than a gap — it silently misleads the parent).`,
  `• Flag uncertainty explicitly: mark any inference vs. a verified fact.`,
  `• Prefer a tight ranked list over prose; omit raw file dumps and step-by-step narration.`,
  `• If returning a structured object, every field must be grounded — leave it empty rather than guess.`,
].join('\n');

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

// What each ITEM agent returns. NARROW effects manifest (see header): items never commit derived artifacts or
// splice monolithic registries; they report what the integrator must do. CLONE model: a concurrent item
// reports the `lane/*` ref it PUSHED (pushedRef); a serial item works in-place on main (no ref).
const ITEM_RESULT_SCHEMA = {
  type: 'object',
  required: ['num', 'status', 'gate'],
  additionalProperties: false,
  properties: {
    num: { type: 'string' },
    status: { type: 'string', enum: ['resolved', 'carried', 'dropped'] },
    cost: { type: 'number' },
    drop: { type: 'string', description: 'drop-reason if not resolved (taken/blocked-in-fact/not-batchable/outgrew)' },
    pushedRef: { type: 'string', description: 'the lane/<NNN>-<n> ref this concurrent item PUSHED to origin, for the integrator to fetch + merge (concurrent lane items only; omit for serial-lane items already committed on main).' },
    resolveCommit: { type: 'string', description: 'the full SHA of the commit that resolved this item (git rev-parse HEAD right after the resolve commit). The integrator asserts this commit is reachable from HEAD before trusting status:"resolved" — an un-merged resolve is reclassified "stranded", never silently reported resolved (#1869 defect 2).' },
    changedFiles: {
      type: 'array', items: { type: 'string' },
      description: 'EVERY repo-relative file this item actually changed (git diff --name-only vs base). Used to surface files touched by more than one item — the residual silent-merge risk a human should eyeball.',
    },
    derivedArtifacts: {
      type: 'array', items: { type: 'string' },
      description: 'derived files this item WOULD have regenerated but deliberately did NOT (AGENTS.md, src/_data/referenceIndex.json, src/_data/capabilityWorkedExample.json) — the integrator regenerates once.',
    },
    monolithEdits: {
      type: 'array',
      items: {
        type: 'object', required: ['file', 'summary'], additionalProperties: true,
        properties: { file: { type: 'string' }, summary: { type: 'string', description: 'the exact entry/change to re-apply on the integrated tree' } },
      },
      description: 'edits to still-monolithic shared registries the item is NOT committing — the integrator applies them serially.',
    },
    gate: { type: 'string', enum: ['green', 'red'], description: 'result of this item\'s gate (per-item LOCAL fast-fail gate for lane items, whole-repo check:standards for serial-lane items).' },
    notes: { type: 'string' },
  },
};

const INTEGRATE_SCHEMA = {
  type: 'object',
  required: ['num', 'merged', 'gate'],
  additionalProperties: true,
  properties: {
    num: { type: 'string' },
    merged: { type: 'boolean', description: 'true if the lane ref merged (clean, or clean after a rebase-retry) into main.' },
    rebased: { type: 'boolean', description: 'true if the first merge conflicted and the lane was rebased onto main before a successful retry.' },
    conflicted: { type: 'boolean', description: 'true if a real semantic conflict SURVIVED the rebase-retry (partition was wrong → replay serially). NOT set for a conflict the rebase resolved.' },
    gate: { type: 'string', enum: ['green', 'red'], description: 'full check:standards on the merged tree.' },
    refDeleted: { type: 'boolean', description: 'true if the remote lane/* ref was deleted after a clean land.' },
    notes: { type: 'string' },
  },
};

// ── Helpers (pure — exercised by the verification harness) ─────────────────────
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
// The lane/* ref an item pushes — namespaced under lane/ (the #1934 carve-out) and scoped by slug + num so
// concurrent batches never collide on a ref name.
function laneRefFor(num) {
  return `lane/${batchSlug}-${num}`;
}

// ── Phase 1 — Probe each item's real touch-set (parallel), then partition (pure JS) ──────────────
phase('Probe');
log(`Probing ${items.length} packed item(s) for their real touch-sets…`);

let probedCount = 0;
const probes = await parallel(items.map((it) => () =>
  agent(
    [
      RETURN_HYGIENE,
      ``,
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
    probedCount++;
    const fileN = p && Array.isArray(p.predictedFiles) ? p.predictedFiles.length : 0;
    const verdict = !p ? 'no result → serial' : p.confident === false ? 'low-confidence → serial' :
      (p.touchesMonolith && p.touchesMonolith.length) ? 'touches monolith → serial' : `${fileN} file(s), candidate for concurrent`;
    log(`  probe ${probedCount}/${items.length}: #${it.num} — ${verdict}`);
    return { ...it, probe: p };
  }).catch(() => { probedCount++; log(`  probe ${probedCount}/${items.length}: #${it.num} — probe FAILED → serial`); return { ...it, probe: null }; }),
));

// Partition into a CONCURRENT set (each item provably independent of every other → its own lane clone, run
// concurrently) and a SERIAL lane (everything else: probe-uncertain, touches a monolith, or shares files /
// a blockedBy edge with another item → run one-at-a-time on main). An item is concurrent ONLY if it conflicts
// with NO other candidate — so the concurrent set is pairwise-disjoint by construction and its lanes merge
// clean (no replay among them).
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

log(`Partition: ${concurrent.length} independent item(s) → own lane clone, concurrent; ${serialItems.length} item(s) → serial lane (sequential on main). ` +
    (concurrent.length === 0 ? 'No provably-independent item → this degenerates to a serial batch (correct, not a failure).' : ''));
for (const e of concurrent) {
  log(`  concurrent: #${e.num} (${e.slug}) — disjoint files: ${[...filesOf(e)].slice(0, 4).join(', ')}…`);
}
for (const e of serialItems) {
  const why = !e.probe ? 'probe failed' : e.probe.confident === false ? 'low-confidence touch-set' :
    (e.probe.touchesMonolith && e.probe.touchesMonolith.length) ? 'touches a monolithic registry' : 'shares files / a blockedBy edge with another item';
  log(`  serial: #${e.num} (${e.slug}) — ${why}`);
}

// ── Phase 2 — Central pre-claim ALL items + provision the lane pool + push the lane/_base ref ─────
// SAFETY: this is the ONLY place claims.json is written for the batch (#1933 choice 2 — lanes never touch it).
// We claim EVERY item (concurrent + serial) in the PRIMARY checkout, commit the post-claim state, and push it
// to the throwaway `lane/_base-<slug>` ref the concurrent lanes reset to. Provisioning the persistent lane
// pool (slice 2, scripts/lane-pool.mjs) is folded in here so the lane dirs are ready before dispatch.
phase('Claim');

const numsAll = items.map((it) => String(it.num));
let laneDirs = [];
let baseReady = false;
if (concurrent.length > 0 || serialItems.length > 0) {
  const setup = await agent(
    [
      RETURN_HYGIENE,
      ``,
      `You are the CENTRAL SETUP step of a #1933 clone-based parallel batch (slug ${batchSlug}), running in the`,
      `PRIMARY checkout (the user's live working tree, on branch main). Do EXACTLY this, in order, and report`,
      `the result. NEVER push to main; the ONLY pushes allowed are to lane/* refs (the #1934 guard carve-out).`,
      ``,
      `1. PRE-CLAIM all items (#1933 choice 2 — this is the ONLY place claims.json is written for this batch).`,
      `   For EACH of these nums, run: \`node scripts/backlog.mjs claim <NNN> --session=${batchSlug}\``,
      `   (flips backlog/<NNN>-*.md status open→active + dateStarted, and records the central claims.json`,
      `   baseline). Nums: ${JSON.stringify(numsAll)}. If an item is already active (a prior partial run), skip`,
      `   it — do NOT --force. Then commit the post-claim state in ONE commit:`,
      `   \`git add backlog/*.md .claude/skills/batch-backlog-items/claims.json`,
      `   .claude/skills/batch-backlog-items/reservations.json && git commit -m "batch ${batchSlug}: pre-claim`,
      `   ${numsAll.length} item(s)"\` (stage ONLY those paths; never \`git add -A\`).`,
      ``,
      `2. PUSH the post-claim base to the throwaway ref so the lanes can reset to it:`,
      `   \`git push --force origin HEAD:${baseRef}\` (a lane/* ref → allowed; --force because a re-run replaces`,
      `   a stale base). Confirm it succeeded.`,
      ``,
      `3. PROVISION the lane pool for the ${concurrent.length} concurrent item(s) (skip if 0):`,
      `   \`node scripts/lane-pool.mjs provision --count=${Math.max(concurrent.length, 1)}\` then`,
      `   \`node scripts/lane-pool.mjs list --json\`. Return the resulting lane directory paths (absolute) in`,
      `   laneDirs, in order. The pool is PERSISTENT (slice 2) — a re-run reuses existing clones (fast).`,
      ``,
      `Report: claimedNums (the nums you actually flipped to active this run), baseRefPushed (boolean),`,
      `laneDirs (array of absolute lane clone paths), and gate is irrelevant here. Return ONLY the object.`,
    ].join(' '),
    {
      label: 'setup:pre-claim+provision', phase: 'Claim',
      schema: {
        type: 'object', required: ['baseRefPushed'], additionalProperties: true,
        properties: {
          claimedNums: { type: 'array', items: { type: 'string' } },
          baseRefPushed: { type: 'boolean' },
          laneDirs: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' },
        },
      },
    },
  ).catch(() => null);
  if (!setup || setup.baseRefPushed !== true) {
    log(`⚠ central pre-claim / base-ref push FAILED — cannot dispatch lanes safely. Aborting the parallel run; ` +
        `fall back to a serial /batch. (No lane work was pushed; the user's checkout holds only the pre-claim commit.)`);
    return { ledger: [], concurrentItems: 0, serialItems: serialItems.length, conflictsReplayed: 0, stranded: [], multiLaneFiles: [], derivedRegenerated: false, pointsSpent: 0, budgetPoints, baseRef, aborted: 'setup-failed' };
  }
  baseReady = true;
  laneDirs = Array.isArray(setup.laneDirs) ? setup.laneDirs : [];
  log(`Central pre-claim done: ${(setup.claimedNums || []).length} item(s) flipped active, base pushed to ${baseRef}, ${laneDirs.length} lane clone(s) ready.`);
}

// ── Phase 3 — Work each independent item concurrently, ONE agent per item in its OWN lane clone ───
phase('Lanes');

function laneItemPrompt(it, laneDir) {
  const ref = laneRefFor(it.num);
  return [
    RETURN_HYGIENE,
    ``,
    `You are PARALLEL batch item #${it.num} ("${it.slug}") running in your OWN persistent lane CLONE at`,
    `${laneDir} (its own HEAD — the git-branch guard never fires on it). The item is ALREADY claimed`,
    `(status:active) in the central base ref; you do NOT run claim and you NEVER touch claims.json (#1933`,
    `choice 2). Do EXACTLY this, in order:`,
    ``,
    `1. cd ${laneDir} && git fetch origin --prune --quiet && git reset --hard origin/${baseRef} --quiet`,
    `   (this points the clone at the central post-claim base — item #${it.num} is already active here).`,
    `   Ensure deps are present (the pool installed them; if node_modules is missing run \`npm ci\`).`,
    `2. WORK the item — full single-item arc MINUS the claim (already done). Edit ONLY this item's own files:`,
    `   impl/code, its own we:backlog/${it.file}, and any per-entry registry file (src/_data/<reg>/<id>.json).`,
    ``,
    `HARD RULES (the parallel-safety contract):`,
    `• Do NOT edit any other item's files, do NOT stage claims.json, and do NOT splice a still-monolithic`,
    `  shared registry (src/_data/{traits,docs,capabilityMatrix}.json, adapters.json, webhandlers/`,
    `  webportals.json, sweep artifacts workbench*/benchmark*.json). If this item genuinely needs that, STOP,`,
    `  mark status:"dropped" drop:"outgrew", and report it in monolithEdits for the integrator.`,
    `• Do NOT regenerate or stage derived artifacts: AGENTS.md, src/_data/referenceIndex.json,`,
    `  src/_data/capabilityWorkedExample.json. If your work changes the inventory, just LIST them in`,
    `  derivedArtifacts — the integrator regenerates once.`,
    `• Lane fast-fail gate (#1937 best-effort): \`npm run check:standards -- --local --files=<your changed`,
    `  files>\` (#1144/#1159 mode). A red on YOUR files → status carried/dropped and gate:"red"; do NOT push.`,
    `• 3. RESOLVE only after the local gate is green: \`node scripts/backlog.mjs resolve ${it.num}`,
    `  [--graduated-to=…]\`. Then COMMIT this item's own files (git add <explicit paths>; NEVER -A; NEVER`,
    `  stage claims.json or derived artifacts): \`git commit -m "backlog: resolve #${it.num} — <slug>"\`.`,
    `• 4. PUSH your commit to the lane ref (the ONLY push you make): \`git push --force origin HEAD:${ref}\``,
    `  (--force because a re-run replaces a stale lane ref; lane/* is allowed by the #1934 carve-out).`,
    ``,
    `Report: num, status, cost, pushedRef ("${ref}" if you pushed; omit otherwise), resolveCommit (the full`,
    `SHA — \`git rev-parse HEAD\` after your resolve commit), changedFiles (git diff --name-only vs`,
    `origin/${baseRef} — used to flag files touched by >1 item), derivedArtifacts you deferred, any`,
    `monolithEdits, and gate green/red. Return ONLY the structured object.`,
  ].join('\n');
}

if (concurrent.length > 0) {
  log(`Working ${concurrent.length} independent item(s) concurrently, each in its own lane clone — each item is logged the instant it lands…`);
}
let itemsDone = 0;
const concurrentResults = await parallel(concurrent.map((it, i) => () => {
  const laneDir = laneDirs[i] || laneDirs[i % Math.max(laneDirs.length, 1)] || '';
  if (!laneDir) {
    itemsDone++;
    log(`  ✗ #${it.num} (${itemsDone}/${concurrent.length}): no lane clone available → will replay serially [${it.slug}]`);
    return Promise.resolve(null);
  }
  return agent(laneItemPrompt(it, laneDir), { label: `lane:#${it.num}`, phase: 'Lanes', schema: ITEM_RESULT_SCHEMA })
    .then((r) => {
      itemsDone++;
      log(`  ${r && r.status === 'resolved' && r.pushedRef ? '✓' : '~'} #${it.num} (${itemsDone}/${concurrent.length}): ${r ? r.status + ', gate ' + r.gate + (r.pushedRef ? ', pushed ' + r.pushedRef : ', not pushed') : 'no result → replay'} [${it.slug}]`);
      return r ? { ...r, num: r.num || String(it.num), _item: it } : null;
    })
    .catch(() => { itemsDone++; log(`  ✗ #${it.num} (${itemsDone}/${concurrent.length}) died → will replay serially [${it.slug}]`); return null; });
}));

// ── Phase 4 — Integrate on main: serial lane FIRST, then merge each lane ref one at a time ────────
// SAFETY (the clone model): every concurrent item's work is durable on origin (its lane/* ref) before any
// merge, so a mid-integration failure loses nothing — refs are deleted only AFTER their merge lands. The
// central integrator works in the PRIMARY checkout on main (the tree the human watches, #1936); the
// merge-base is the lane/_base commit, so an item's active→resolved flip merges clean. Full gate per merge
// (#1937: central gate is the authority). The JS loop is single-threaded → merges are naturally serialized.
phase('Integrate');

const ledger = [];
let conflictsReplayed = 0;

// 4a. The serial lane runs FIRST, on main in the primary checkout, ONE item per agent. These items could not
// be PROVEN independent (monolith-touching / uncertain / blockedBy edge), so they're the safe baseline the
// lane refs merge on top of. They are already `active` from the pre-claim, so they go straight to work.
if (serialItems.length > 0) {
  log(`Serial lane: working ${serialItems.length} item(s) sequentially on main…`);
  let sIdx = 0;
  for (const it of serialItems) {
    sIdx++;
    const r = await agent(
      [
        RETURN_HYGIENE,
        ``,
        `You are the SERIAL segment of a #1933 clone-based parallel batch (slug ${batchSlug}), working item`,
        `#${it.num} ("${it.slug}") IN PLACE in the PRIMARY checkout on branch main (never cd into a lane clone).`,
        `This item is here because it could not be PROVEN independent (uncertain touch-set, touches a monolithic`,
        `registry, or shares files / a blockedBy edge with another item). It is ALREADY claimed (status:active)`,
        `from the central pre-claim — do NOT run claim, do NOT touch claims.json. Work the FULL arc minus the`,
        `claim: work → FULL whole-repo gate (\`npm run check:standards\`, no flags) → resolve (\`node`,
        `scripts/backlog.mjs resolve ${it.num} [--graduated-to=…]\`) → commit this item's files on main`,
        `(git add <explicit paths>; NEVER -A; NEVER push). Resolve only after the gate is green; if red, leave`,
        `main clean (revert your edits), report status carried/dropped + gate:"red". Return the structured ITEM`,
        `result (include changedFiles and resolveCommit = git rev-parse HEAD after your resolve commit).`,
      ].join(' '),
      { label: `serial:#${it.num}`, phase: 'Integrate', schema: ITEM_RESULT_SCHEMA },
    ).catch(() => null);
    log(`  serial ${sIdx}/${serialItems.length}: #${it.num} — ${r ? r.status + ' (gate ' + r.gate + ')' : 'no result'}`);
    if (r) ledger.push({ num: r.num || String(it.num), status: r.status, cost: r.cost, drop: r.drop, lane: 'serial', changedFiles: r.changedFiles, derivedArtifacts: r.derivedArtifacts, resolveCommit: r.resolveCommit });
  }
}

// 4b. Merge each concurrent item's lane ref in turn, one at a time, full gate per merge. The concurrent set is
// pairwise-disjoint, so these merge clean; the only residual conflict risk is vs the serial lane — a conflict
// triggers rebase-and-retry (never force), and a real semantic conflict that survives the rebase is replayed
// serially on the merged result.
const mergeable = concurrentResults.filter((cr) => cr && cr.gate === 'green' && cr.pushedRef);
if (mergeable.length > 0) {
  log(`Integrating ${mergeable.length} lane ref(s) into main one at a time, full gate per merge…`);
  // Fetch all lane refs once up front so each merge agent works from local refs.
  await agent(
    [
      `In the PRIMARY checkout on main, fetch the parallel batch's lane refs so they can be merged:`,
      `\`git fetch origin --prune ${mergeable.map((cr) => `"+refs/heads/${cr.pushedRef}:refs/remotes/origin/${cr.pushedRef}"`).join(' ')}\`.`,
      `Confirm each ref fetched. Never push, never merge here — just fetch. Return { fetched: <count> }.`,
    ].join(' '),
    { label: 'integrate:fetch-lanes', phase: 'Integrate', schema: { type: 'object', additionalProperties: true, properties: { fetched: { type: 'number' } } } },
  ).catch(() => null);
}

for (let i = 0; i < concurrentResults.length; i++) {
  const cr = concurrentResults[i];
  const it = concurrent[i];
  if (!cr) { log(`#${it.num} produced no result (died/skipped) — replaying serially on main.`); }
  if (cr && cr.gate === 'red') { log(`#${it.num} lane gate RED — not merging; replaying serially on main.`); }
  if (cr && cr.gate === 'green' && !cr.pushedRef) { log(`#${it.num} gate green but never pushed a lane ref — replaying serially on main.`); }

  const canMerge = cr && cr.gate === 'green' && cr.pushedRef;
  let integrated = null;
  if (canMerge) {
    log(`  merging ${cr.pushedRef} (#${it.num}, ${i + 1}/${concurrentResults.length})…`);
    integrated = await agent(
      [
        `In the PRIMARY checkout on branch main, integrate parallel batch item #${it.num} from its lane ref`,
        `"origin/${cr.pushedRef}". Merge it one-at-a-time, NEVER force, full gate per merge:`,
        `1. \`git merge --no-ff origin/${cr.pushedRef} -m "batch ${batchSlug}: merge #${it.num}"\`.`,
        `2. If git reports a CONFLICT: \`git merge --abort\`, then REBASE-AND-RETRY (#1933): create a temp local`,
        `   branch at the lane ref, \`git rebase main\` it onto current main, and if the rebase is clean,`,
        `   re-run the merge from the rebased branch (set rebased:true). If the rebase ITSELF conflicts (a real`,
        `   semantic conflict), \`git rebase --abort\`, leave main untouched, and report conflicted:true,`,
        `   merged:false — do NOT force.`,
        `3. On a clean merge (with or without the rebase), run the FULL gate \`npm run check:standards\` (no`,
        `   flags) on the merged tree → report gate green/red. If gate RED, the merge stands but flag it`,
        `   (a regression on the assembled tree).`,
        `4. If merged clean AND gate green, DELETE the remote lane ref (it's served its purpose):`,
        `   \`git push origin --delete ${cr.pushedRef}\` (delete of a lane/* ref → allowed by #1934). Set`,
        `   refDeleted:true. NEVER push main.`,
        `Return { num:"${it.num}", merged, rebased, conflicted, gate, refDeleted, notes }.`,
      ].join(' '),
      { label: `integrate:#${it.num}`, phase: 'Integrate', schema: INTEGRATE_SCHEMA },
    ).catch(() => null);
  }

  const needsReplay = !canMerge || !integrated || integrated.conflicted || !integrated.merged || integrated.gate === 'red';
  if (needsReplay) {
    conflictsReplayed++;
    const reason = !canMerge ? 'lane red / not pushed / no result' : integrated && integrated.conflicted ? 'semantic conflict survived rebase' : integrated && integrated.gate === 'red' ? 'post-merge gate red' : 'merge did not land';
    log(`#${it.num} could not land clean (${reason}) — replaying it serially on main.`);
    const replay = await agent(
      [
        RETURN_HYGIENE,
        ``,
        `In the PRIMARY checkout on branch main, replay parallel batch item #${it.num} ("${it.slug}") SERIALLY`,
        `(its lane merge was aborted/failed). It is ALREADY claimed (status:active) from the central pre-claim —`,
        `do NOT run claim, do NOT touch claims.json. Redo the edits on the CURRENT main tree, FULL whole-repo`,
        `gate (\`npm run check:standards\`), resolve (\`node scripts/backlog.mjs resolve ${it.num}\`), commit`,
        `(git add <explicit paths>; NEVER -A; NEVER push). If its lane ref "${cr && cr.pushedRef || ''}" still`,
        `exists on origin, delete it after a clean replay (\`git push origin --delete\`). Return the structured`,
        `ITEM result (include changedFiles and resolveCommit = git rev-parse HEAD after your resolve commit).`,
      ].join(' '),
      { label: `replay:#${it.num}`, phase: 'Integrate', schema: ITEM_RESULT_SCHEMA },
    ).catch(() => null);
    const src = replay || cr;
    if (src) ledger.push({ num: src.num || String(it.num), status: src.status, cost: src.cost, drop: src.drop, lane: `#${it.num}-replayed`, changedFiles: src.changedFiles, derivedArtifacts: src.derivedArtifacts, resolveCommit: src.resolveCommit });
    log(`  replay #${it.num}: ${replay ? replay.status + ' (gate ' + replay.gate + ')' : 'no result'}`);
  } else {
    ledger.push({ num: cr.num || String(it.num), status: cr.status, cost: cr.cost, drop: cr.drop, lane: `#${it.num}`, changedFiles: cr.changedFiles, derivedArtifacts: cr.derivedArtifacts, resolveCommit: cr.resolveCommit });
  }
}

// 4c. Regenerate derived artifacts ONCE on the fully-merged main, then a final whole-repo gate. The #1935
// Fork-2 "regenerate-on-merge" set: the AGENTS.md inventory block, src/_data/referenceIndex.json, and
// src/_data/capabilityWorkedExample.json — all reproduced by their deterministic generators from the merged
// inputs, so they leave the lock-set as outputs.
const derived = new Set();
for (const l of ledger) if (l && Array.isArray(l.derivedArtifacts)) for (const d of l.derivedArtifacts) derived.add(d);
for (const cr of concurrentResults) if (cr && Array.isArray(cr.derivedArtifacts)) for (const d of cr.derivedArtifacts) derived.add(d);
let derivedRegenerated = false;
if (derived.size > 0) {
  log(`Regenerating ${derived.size} derived artifact(s) once on the merged main: ${[...derived].join(', ')}`);
  const regen = await agent(
    [
      `In the PRIMARY checkout on branch main, regenerate the derived artifacts the items deferred:`,
      `${[...derived].join(', ')}. Run the canonical generators (e.g. \`npm run gen:inventory\` for the`,
      `AGENTS.md inventory block, \`npm run gen:reference-index\` for src/_data/referenceIndex.json), then run`,
      `the FULL gate (\`npm run check:standards\`) and commit the regenerated artifacts in ONE commit. NEVER`,
      `push. Report gate green/red. Return { gate: 'green'|'red', notes }.`,
    ].join(' '),
    { label: 'integrate:derived', phase: 'Integrate', schema: { type: 'object', required: ['gate'], additionalProperties: true, properties: { gate: { type: 'string', enum: ['green', 'red'] }, notes: { type: 'string' } } } },
  ).catch(() => null);
  derivedRegenerated = !!regen;
  if (regen && regen.gate === 'red') log('Derived-artifact regen left the gate RED — surface this at close-out; do not mark the batch clean.');
}

// 4d. Surface files touched by MORE THAN ONE item — the residual silent-merge risk (a clean-but-wrong merge).
// The concurrent set is disjoint by construction, so this flags only a concurrent item overlapping a
// serial-lane item. This is the OPTIMISTIC-floor (#1935 Option D) post-hoc detector this slice ships.
const fileItemCount = new Map();
for (const l of ledger) {
  if (!l || !Array.isArray(l.changedFiles)) continue;
  for (const f of new Set(l.changedFiles)) fileItemCount.set(f, (fileItemCount.get(f) || 0) + 1);
}
const multiLaneFiles = [...fileItemCount.entries()].filter(([, n]) => n > 1).map(([f]) => f);
if (multiLaneFiles.length > 0) {
  log(`⚠ ${multiLaneFiles.length} file(s) were changed by more than one item — eyeball for a silent clean-but-wrong merge: ${multiLaneFiles.join(', ')}`);
}

// 4e. RECONCILE (#1869 defect 2) — independently verify, via git on main, that every ledger-`resolved` item's
// resolve actually LANDED on HEAD. The ledger status is each agent's self-report; a lane resolve that failed
// to merge (or an agent that over-reported) would otherwise be returned `resolved` and silently lost. This
// re-checks reality and reclassifies any un-landed resolve as `stranded` — never a false `resolved`.
// (Adapted for the clone model: the target IS main/HEAD, the live branch, not a throwaway integration branch.)
const resolvedToVerify = ledger
  .filter((l) => l && l.status === 'resolved')
  .map((l) => ({ num: String(l.num), resolveCommit: l.resolveCommit || '' }));
let stranded = [];
if (resolvedToVerify.length > 0) {
  const recon = await agent(
    [
      `In the PRIMARY checkout on branch main, RECONCILE the parallel batch ledger against git reality (#1869`,
      `defect 2). Confirm \`git rev-parse --abbrev-ref HEAD\` is "main" (set branchOk). Then, for EACH item`,
      `below, verify its resolve actually landed on HEAD — it is STRANDED (resolve did not land) if BOTH`,
      `signals say so:`,
      `  (a) commit reachability: if resolveCommit is non-empty, \`git merge-base --is-ancestor <resolveCommit>`,
      `      HEAD\` exits NON-zero (commit not reachable from main);`,
      `  (b) backlog ground truth: \`backlog/<num>-*.md\` on main does NOT contain a line \`status: resolved\`.`,
      `If resolveCommit is empty, rely on (b) alone. If (a) and (b) disagree, treat (b) — the committed backlog`,
      `status — as authoritative. Items to verify (JSON): ${JSON.stringify(resolvedToVerify)}.`,
      `Return { branchOk: boolean, stranded: [{ num, reason }] } listing ONLY the items whose resolve did not land.`,
    ].join(' '),
    {
      label: 'integrate:reconcile', phase: 'Integrate',
      schema: {
        type: 'object', required: ['branchOk', 'stranded'], additionalProperties: true,
        properties: {
          branchOk: { type: 'boolean' },
          stranded: { type: 'array', items: { type: 'object', required: ['num'], additionalProperties: true, properties: { num: { type: 'string' }, reason: { type: 'string' } } } },
        },
      },
    },
  ).catch(() => null);
  if (!recon) {
    log('⚠ reconcile step produced no result — cannot confirm resolves landed; treating all as UNVERIFIED. The main agent MUST reconcile the ledger vs main before trusting the resolved count.');
  } else {
    if (recon.branchOk === false) log(`⚠ reconcile: HEAD is NOT main (branchOk=false) — the integration landed somewhere unexpected; investigate before trusting it.`);
    stranded = Array.isArray(recon.stranded) ? recon.stranded : [];
    for (const s of stranded) {
      const entry = ledger.find((l) => l && String(l.num) === String(s.num) && l.status === 'resolved');
      if (entry) {
        entry.status = 'stranded';
        log(`⚠ #${s.num} reported resolved but its resolve did NOT land on main (${s.reason || 'not reachable / backlog status not resolved'}) — reclassified STRANDED, not counted resolved.`);
      }
    }
    if (stranded.length === 0) log(`Reconcile: all ${resolvedToVerify.length} resolved item(s) verified present on main.`);
  }
}

// 4f. Clean up the throwaway base ref now that every lane has merged (best-effort — a leftover lane/_base is
// harmless, just clutter on origin).
if (baseReady) {
  await agent(
    [
      `In the PRIMARY checkout, delete the throwaway parallel-batch base ref now that integration is done:`,
      `\`git push origin --delete ${baseRef}\` (delete of a lane/* ref → allowed by #1934). Best-effort — if it`,
      `is already gone, that's fine. Return { deleted: boolean }.`,
    ].join(' '),
    { label: 'integrate:cleanup-base', phase: 'Integrate', schema: { type: 'object', additionalProperties: true, properties: { deleted: { type: 'boolean' } } } },
  ).catch(() => null);
}

const resolved = ledger.filter((l) => l.status === 'resolved');
const spent = resolved.reduce((s, l) => s + (Number(l.cost) || 0), 0);
log(`Parallel batch (clone model) landed on main: ${resolved.length}/${ledger.length} resolved, ${stranded.length} stranded, ${conflictsReplayed} item(s) replayed serially, ${multiLaneFiles.length} multi-item file(s), ${spent}/${budgetPoints} points. The result is ALREADY on the primary checkout's main — the main agent does NOT do a landing merge; it reports the ledger and surfaces multiLaneFiles/stranded.`);

return {
  // The clone integrator already landed every lane on the primary checkout's main — there is no
  // integration branch for the main agent to merge. Lane work was durable on origin (lane/* refs) until each
  // merge landed; refs are deleted after a clean land. The main agent reports + surfaces; no landing op.
  baseRef,
  ledger,
  concurrentItems: concurrent.length,
  serialItems: serialItems.length,
  conflictsReplayed,
  stranded,             // #1869 defect 2: items reported resolved whose resolve did NOT land on main — reclassified, never counted resolved
  multiLaneFiles,       // files touched by >1 item — the close-skill audit surfaces these for a human glance
  derivedRegenerated,
  pointsSpent: spent,
  budgetPoints,
};
