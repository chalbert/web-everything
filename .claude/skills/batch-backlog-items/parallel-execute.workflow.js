export const meta = {
  name: 'batch-parallel-execute',
  description: 'Execute a /workflow (parallel) batch on the #1933 CLONE model, CROSS-REPO (slice 4): probe each item for its real touch-set ACROSS the constellation (WE → frontierui → plateau-app) → partition into provably-independent items (repo-qualified disjointness) + a serial lane → central pre-claim in WE (push a lane/_base ref) → work each independent item as its OWN agent across COUPLED lane clones (one clone per affected repo, own HEAD, guard-immune), push HEAD:lane/<n> in EACH repo → central integrator merges each repo into its main IMPL-REPOS-FIRST, WE LAST (WE carries the resolve, so a failed impl never leaves a false "resolved"), full gate per merge, rebase-and-retry on conflict, deletes the remote refs, regenerates derived artifacts once. Per-item progress. Returns a ledger.',
  whenToUse: 'Invoked by the batch-backlog-items skill ONLY for /workflow (or --parallel), after the main loop has done the conversational pack/plan/one-"go". Not for the default serial /batch.',
  phases: [
    { title: 'Probe', detail: 'predict each item\'s real touch-set across the constellation (frontmatter files are a lower bound)' },
    { title: 'Claim', detail: 'central pre-claim ALL items in WE + provision a lane pool PER affected repo + push the lane/_base ref' },
    { title: 'Lanes', detail: 'one agent per provably-independent item, working its COUPLED clones (one per repo), concurrent → push lane/<n> in each repo' },
    { title: 'Integrate', detail: 'serial lane on main, then merge each item\'s repos impl-first/WE-last (full gate per merge, rebase-retry on conflict), delete refs, regen derived once' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// /workflow (parallel) execute phase — the #1933 CLONE-based orchestrator, CROSS-REPO (epic #1933,
// slice 3 = #1942 WE-only floor; slice 4 = #1943 lifts it to the constellation).
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
// CROSS-REPO (slice 4 = #1943). The constellation (#96) is WE → frontierui → plateau-app: a single item's
// impl often spans repos (e.g. a standard authored in WE, implemented in frontierui, surfaced in plateau-app).
// The backlog item itself + claims.json ALWAYS live in WE, so WE is implicit for every item; the probe also
// reports any NON-WE repos it touches (extraRepos). The orchestrator then:
//   • Repo-qualifies every predicted file ("<repo>:<path>") so partition disjointness holds ACROSS repos —
//     `index.ts` in WE and `index.ts` in frontierui no longer collide spuriously.
//   • Provisions a lane pool PER affected repo (scripts/lane-pool.mjs is repo-parameterized — slice 2 #1940),
//     and dispatches each concurrent item across its COUPLED clones (one clone per repo it touches).
//   • Pushes the item's work to a `lane/<slug>-<n>` ref in EACH repo's own origin (per-repo, so the same ref
//     name never collides), then integrates each repo into its OWN main.
//
// CROSS-REPO ATOMICITY — the ordering / rollback story (the slice-4 hard part). One logical change spanning
// two repos is TWO independent merges; there is no distributed transaction. We bound the damage by ORDERING:
//   IMPL REPOS FIRST, WE LAST. WE carries the item's `active→resolved` flip (the commit point), so it lands
//   only AFTER every impl repo has landed clean. Consequences:
//     • If an impl-repo merge fails, WE is NOT merged → the resolve never lands → the item stays `active`
//       (the #1869 reconcile, keyed off WE's backlog status, correctly does NOT count it resolved). Worst
//       case is impl-landed-but-item-still-active — a recoverable partial, never a false "resolved".
//     • All lane work for every repo is durable on its origin (`lane/*` refs) BEFORE any merge; a per-repo
//       ref is deleted only AFTER that repo's merge lands. A mid-integration failure loses nothing.
//     • A failed cross-repo item is reported in `partialCrossRepo` (which repos landed, where it stopped) and
//       left `carried`; the human / next run re-attempts. (A WE-only item that fails still serial-replays on
//       main, the slice-3 floor — only true cross-repo items skip auto-replay, since replaying coupled work
//       across primary checkouts is out of this v1's scope.)
//
// THE DESIGN CONTRACT (mirrors SKILL.md "Parallel lanes" + the ratified decisions #1935/#1936/#1937):
//   1. Serial is the safe baseline, always reachable — but reached only when NEEDED (optimistic-first, #1950),
//      never pre-emptively. A failed probe, or a real conflict with another item, lands in the serial lane.
//   2. Partition optimistic-first (#1950 — see the partition predicate below): an item runs concurrently
//      UNLESS it (a) has no usable probe, (b) sits on a blockedBy edge with another item, (c) shares a
//      merge-risk (blacklist) file with another — the clean-but-wrong structured-merge case the optimistic
//      floor can't catch — or (d) is low-confidence AND overlaps another on any file. Confident items whose
//      only overlaps are ordinary (build config, barrels, own spill) run concurrent and lean on the optimistic
//      floor (rebase-retry → serial-replay). A wrong "concurrent" call costs a replay, never correctness.
//   3. Central pre-claim in WE (#1933 choice 2). The orchestrator claims ALL items up front in the PRIMARY WE
//      checkout (`backlog.mjs claim` → status:active + the central claims.json), commits, and pushes the
//      post-claim state to a throwaway `lane/_base-<slug>` ref in WE's origin. Each item's WE lane clone
//      `reset --hard`s to that base (already `active`); the impl-repo clones reset to their own origin/main
//      (no backlog there). Because the WE merge-base is `lane/_base`, the `active→resolved` flip is a
//      one-sided change → the WE lane→main merge is conflict-free on that file.
//   4. Git is the conflict detector: merge each repo ONE AT A TIME; a conflict ⇒ rebase the lane onto current
//      main and retry (#1933) — NEVER force; if a real semantic conflict survives, that repo's merge fails
//      (→ partial / replay). A FULL gate runs per merge in THAT repo (#1937). The remote `lane/*` ref is
//      deleted only AFTER its merge lands.
//   5. No silent speculation: every partition decision + every rebase/replay/partial is logged (per item).
//
// SAFETY-MODEL SHIFT vs the worktree model (deliberate, decision-mandated): the worktree model's "workflow
// NEVER writes the live branch; the main agent lands" is replaced by "all lane work is durable on origin
// before any merge, so the central integrator lands directly on each repo's main." The MAIN AGENT therefore
// does NOT do a landing merge after this returns; it reports the ledger and surfaces multiLaneFiles / stranded
// / partialCrossRepo.
//
// REGISTRY SPLIT (#1145/#1146/#1157): every hand-authored COLLECTION registry is per-entry files
// (src/_data/<reg>/<id>.json) — an item adding/editing a registry entry writes its OWN file (disjoint, merges
// clean, NO integrator-applied manifest). The effects-manifest is NARROW: only the residual shared mutations
// an item must NOT commit itself — DERIVED artifacts regenerated once (AGENTS.md inventory block,
// src/_data/referenceIndex.json, src/_data/capabilityWorkedExample.json) and the handful of genuinely-
// monolithic single-doc registries, which force the touching item into the serial lane.
//
// This script runs in the Workflow JS sandbox: no fs, no child_process, no Date/Math.random. ALL side effects
// (git, lane-pool.mjs, backlog.mjs, npm gates) happen INSIDE agents via Bash; the script only does control flow.
//
// args (passed by the main loop after the conversational pack/plan/"go"):
//   { batchSlug, budgetPoints, primaryRoot, items: [ { num, slug, file, locus, cost, declaredFiles, blockedBy } … ],
//     laneModel? }  — laneModel (e.g. 'sonnet') downgrades ONLY the concurrent lane work agents; set it for
//   a mechanically-clear, file-disjoint pack. Drops re-adjudicate + resolves re-gate on the default model, so
//   the quality floor is unchanged (see the laneModel comment below). Omit → all agents inherit the session model.
// Returns: { ledger, concurrentItems, serialItems, crossRepoItems, conflictsReplayed, stranded,
//            multiLaneFiles, partialCrossRepo, reposProvisioned, derivedRegenerated, pointsSpent,
//            budgetPoints, baseRef }
//   The result is already landed on each repo's main — there is NO integration branch for the main agent.
//   stranded (#1869 defect 2): items an agent reported `resolved` whose WE resolve was NOT verified reachable
//   from HEAD (a post-assembly git reconcile) — reclassified, never counted resolved.
//   partialCrossRepo (slice 4): cross-repo items whose impl landed in some repos but whose WE resolve did NOT
//   land (so the item is `active`, not `resolved`) — surfaced for a human / next-run re-attempt.
// ─────────────────────────────────────────────────────────────────────────────

// `args` may arrive as a parsed object OR as a JSON string (the Workflow runtime serializes it in some
// environments — caught by the #1153 first-real-run validation). Tolerate both so `items` is never empty.
const a = (typeof args === 'string' ? (() => { try { return JSON.parse(args); } catch { return {}; } })() : (args || {}));
const items = Array.isArray(a.items) ? a.items : [];
const batchSlug = a.batchSlug || 'batch-parallel';
const budgetPoints = Number.isFinite(a.budgetPoints) ? a.budgetPoints : Infinity;
// OPTIONAL per-batch model downgrade for the CONCURRENT lane work agents only (e.g. laneModel: 'sonnet').
// "Sonnet only when no effect on quality": this applies SOLELY to the provably-independent concurrent items
// (the mechanical, file-disjoint edit work). Quality stays protected by two existing floors that need no
// extra code — so a downgraded lane can only ever speed up, never weaken correctness:
//   1. A downgraded lane that DROPS (or fails to push) produces no ref → it falls through to the serial
//      REPLAY on the DEFAULT model (Phase 4b, the Opus floor), which RE-ADJUDICATES the drop. So an
//      over-cautious cheap-model drop is caught and corrected by the strong model — never silently carried.
//   2. A downgraded lane that RESOLVES still has its work re-gated by the DEFAULT-model integrate step
//      (the full per-merge gate, #1937) before it lands. The cheap model never has the final say.
// Everything else stays on the inherited (default) model: the probe, the partition/claim setup, the SERIAL
// lane (higher-judgment, un-provable-independence items whose drop is final), the integrate/replay/regen/
// reconcile steps. Omit laneModel → every agent inherits the session model (unchanged behaviour).
const laneModel = typeof a.laneModel === 'string' && a.laneModel ? a.laneModel : undefined;
// The throwaway base ref carrying the central post-claim state WE lanes reset to. Slashes keep it under the
// lane/* namespace the #1934 carve-out allows (push + delete). One per batch (slug-scoped). WE-only: the
// pre-claim (backlog + claims.json) lives only in WE, so only WE's origin gets a _base ref.
const baseRef = `lane/_base-${batchSlug}`;
// The CENTRAL lock authority (#1945/#1936 Fork-1a): the ONE local lock home all lanes share. The
// orchestrator runs in the PRIMARY WE checkout, so this is `<primary>/.claude/locks`. Lanes are clones,
// so they point `--root` at THIS absolute path (not their own clone's) — a single lock dir = a single
// reservation authority across concurrent lanes. Local + never committed/pushed (sidesteps O_EXCL-on-NFS).
// The sandbox has no `process` (see header) — the PRIMARY WE checkout's absolute path is passed in via
// args.primaryRoot by the main loop (which knows its own cwd). Fallback to a relative path keeps a
// degenerate run from crashing, though lane clones need the absolute form.
const PRIMARY_ROOT = a.primaryRoot || '.';
const CENTRAL_LOCK_ROOT = `${PRIMARY_ROOT}/.claude/locks`;

// ── The constellation (#96) — cross-repo registry (slice 4) ────────────────────
// `we` is implicit for every item (its backlog/<NNN>.md + claims.json live here) and is the primary checkout
// the workflow's agents run in. The non-WE repos are coupled clones an item works when its impl spans them.
// `path` is shell-expandable (agents `cd` into it); `gate` is that repo's own local gate. INTEGRATION_ORDER
// puts WE LAST so its resolve commit is the last write — the cross-repo atomicity guarantee (see header).
const REPOS = {
  we: { name: 'webeverything', path: null /* primary checkout = the agents' cwd */, gate: 'npm run check:standards', primary: true },
  frontierui: { name: 'frontierui', path: '~/workspace/frontierui', gate: 'npm run check:standards' },
  'plateau-app': { name: 'plateau-app', path: '~/workspace/plateau-app', gate: 'npm run build' },
};
const INTEGRATION_ORDER = ['frontierui', 'plateau-app', 'we']; // impl repos first, WE last (carries the resolve)

// ── The MANDATORY write-time lock layer (#1945 — the #1935 Fork-2 / #1936 pessimistic tier) ─────
// The optimistic git-merge floor (slice 3, #1942) only DETECTS a clean-but-wrong structured merge after
// the fact (the post-hoc `multiLaneFiles` scan, Phase 4d). This adds the pessimistic tier #1935 Fork 2 +
// #1936 ratified: BEFORE a lane edits a merge-risk file it RESERVES that path via an atomic O_EXCL/lock-dir
// primitive under the central checkout (#1936 Fork 1a) with a heartbeat-TTL lease for stale-lock reclaim
// (#1936 Fork 2a + a same-machine PID-liveness fast path); a second lane needing a held path WAITS or DEFERS.
// CANONICAL, TESTED home of the lock logic (lease floor + PID fast-path + broker fencing): the pure module
// `we:scripts/readiness/file-locks.mjs` (proved by `we:scripts/readiness/__tests__/file-locks.test.mjs`).
// Mirrored here as a CONTRACT because a workflow script has no filesystem read at runtime (same pattern as
// RETURN_HYGIENE). Lanes acquire/release via `node scripts/readiness/file-locks-cli.mjs` in their WE clone.
//
// RESERVED_MERGE_RISK = the residual ③ static denylist AFTER #1938 shrank the monolith set (adapters split
// per-entry + the 3 pure-derived artifacts now regenerate-on-merge, so they LEFT the lock-set). These are
// the genuinely-monolithic shared WE files no format change makes disjoint — a lane editing one MUST hold its
// lock. Per-entry registry files (src/_data/<reg>/<id>.json, INCLUDING src/_data/adapters/<id>.json) are
// disjoint by construction and are NEVER reserved. The DERIVED artifacts are regenerated once post-merge
// (Phase 4c), never lane-edited, so they are not here either.
// PER-REPO merge-risk map (#1951, slice B). The clean-but-wrong-merge blacklist, keyed by repo so a cross-repo
// monolith (e.g. frontierui:src/_data/blocks.json) gets the same protection a WE one does — without this, slice
// A's repo-qualified partition gave cross-repo monoliths NONE (isReservedMergeRisk only matched `we:`). NOT here
// (#1952): build config + line-structured singletons (optimistic-merge bucket). frontierui = its monolithic
// single-doc registries (blocks/plugs/traits arrays, the adapters/demos maps). plateau-app = none (its shared
// surfaces are CODE, where a real conflict surfaces and replays). MIRROR of lane-partition.mjs — keep in sync.
const RESERVED_MERGE_RISK_BY_REPO = {
  we: [
    'src/_data/traits.json', 'src/_data/capabilityMatrix.json', 'src/_data/docs.json',
    'src/_data/webhandlers.json', 'src/_data/webportals.json',
    'src/_data/benchmarkCorpus.json', 'src/_data/workbenchTools.json', 'src/_data/workbenchFeatures.json',
    'AGENTS.md', // its hand-authored PROSE body is locked; the AUTO-GENERATED inventory sub-block is derived (regen-on-merge), not locked
  ],
  frontierui: [
    'src/_data/blocks.json', 'src/_data/plugs.json', 'src/_data/traits.json',
    'src/_data/adapters.js', 'src/_data/demos.js',
  ],
  'plateau-app': [],
};
// The WE set — the `reservedPathsFor` runtime lock-planner (the #1945 backstop) is WE-scoped: it reserves the
// WE merge-risk paths an item touches. Cross-repo merge-risk is handled at the PARTITION level (a shared
// cross-repo monolith → same lane via conflicts()), with multiLaneFiles catching any unpredicted spill post-hoc.
const RESERVED_MERGE_RISK = RESERVED_MERGE_RISK_BY_REPO.we;
// The merge-risk WE paths a given item intends to touch — its probed `touchesMonolith` ∩ the reserved set
// (benchmark*/workbench* matched by prefix). These are the paths the item must RESERVE before editing.
function reservedPathsFor(entry) {
  const probe = entry && entry.probe;
  const wants = (probe && Array.isArray(probe.touchesMonolith)) ? probe.touchesMonolith.map(String) : [];
  const out = new Set();
  for (const w of wants) {
    const f = w.replace(/^we:/, '');
    if (RESERVED_MERGE_RISK.includes(f) || /^src\/_data\/(benchmark|workbench)/.test(f)) out.add(f);
  }
  return [...out];
}

if (items.length === 0) {
  log('No packed items passed — nothing to execute.');
  return { ledger: [], concurrentItems: 0, serialItems: 0, crossRepoItems: 0, conflictsReplayed: 0, partialCrossRepo: [], derivedRegenerated: false, baseRef };
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
// `extraRepos` (slice 4) reports the NON-WE constellation repos the item's impl spans.
const PROBE_SCHEMA = {
  type: 'object',
  required: ['num', 'predictedFiles', 'confident'],
  additionalProperties: false,
  properties: {
    num: { type: 'string', description: 'the backlog NNN this probe is for' },
    predictedFiles: {
      type: 'array', items: { type: 'string' },
      description: 'every WE-repo-relative file this item will create or edit in webeverything — code, its own backlog/NNN.md, and any per-entry registry file (src/_data/<reg>/<id>.json). Files in OTHER constellation repos go in extraRepos, NOT here. Err WIDE: a missed file corrupts a merge.',
    },
    extraRepos: {
      type: 'array',
      items: {
        type: 'object', required: ['repo', 'files'], additionalProperties: false,
        properties: {
          repo: { type: 'string', enum: ['frontierui', 'plateau-app'], description: 'a NON-WE constellation repo this item touches' },
          files: { type: 'array', items: { type: 'string' }, description: 'every repo-relative file this item will create or edit in THAT repo' },
        },
      },
      description: 'CROSS-REPO (slice 4): constellation repos OTHER than WE this item\'s impl spans (#96 — frontierui, plateau-app). The backlog item + claims.json always live in WE, so WE is implicit; list here only the non-WE repos + their repo-relative files. Empty/omit for a WE-only item (the common case).',
    },
    touchesMonolith: {
      type: 'array', items: { type: 'string' },
      description: 'genuinely-monolithic shared files it must edit (the single-doc registries src/_data/{traits,docs,capabilityMatrix}.json, webhandlers/webportals.json, the curated-sweep artifacts workbench*/benchmark*.json, and the hand-authored PROSE body of AGENTS.md — its AUTO-GENERATED inventory block is a derived artifact, see derivedArtifacts) — list them explicitly. These are the merge-risk (blacklist) files: an item serializes against ANOTHER item only when BOTH touch the same one (a clean git merge of two edits to one of these can be silently wrong); a lone toucher still runs concurrent. Per-entry registry files (src/_data/<reg>/<id>.json, INCLUDING src/_data/adapters/<id>.json since #1938) are NOT monolithic — never list them.',
    },
    confident: { type: 'boolean', description: 'TRUE when every predicted file (in WE AND every extraRepo) is one this item OWNS (its own impl/code, its own demo page, its own backlog/NNN.md, its own per-entry registry entries, its own test file). FALSE *only* when work plausibly spills into a SHARED surface another item could also touch: a still-monolithic registry, shared runtime (plugs/bootstrap.ts), a shared *.njk include, shared test specs, or a broad cross-file refactor — in ANY affected repo. Build config (tsconfig/vite/package.json/vitest.config) does NOT lower confidence (#1952): it is line-structured and merges optimistically, so a build-config edit is owned, not shared-risk. Routine uncertainty about the exact file COUNT is NOT a reason for false; only genuine shared-surface risk is. Per-entry registry writes do NOT lower confidence. NOTE (#1950): confident:false NO LONGER forces the serial lane on its own — it only tightens the pairwise check (a low-confidence item serializes against ANOTHER item it overlaps on any file). A confident:false item that is file-disjoint from every other still runs concurrent under the optimistic floor.' },
  },
};

// What each ITEM agent returns. NARROW effects manifest (see header): items never commit derived artifacts or
// splice monolithic registries; they report what the integrator must do. CLONE model: a concurrent item
// reports the `lane/*` ref it PUSHED in EACH affected repo (pushedRefs); a serial item works in-place (no ref).
const ITEM_RESULT_SCHEMA = {
  type: 'object',
  required: ['num', 'status', 'gate'],
  additionalProperties: false,
  properties: {
    num: { type: 'string' },
    status: { type: 'string', enum: ['resolved', 'carried', 'dropped'] },
    cost: { type: 'number' },
    drop: { type: 'string', description: 'drop-reason if not resolved (taken/blocked-in-fact/not-batchable/outgrew)' },
    pushedRef: { type: 'string', description: 'DEPRECATED single-repo field — the WE lane/<NNN>-<n> ref. Prefer pushedRefs (cross-repo). Kept for back-compat: if set and pushedRefs is empty, the integrator treats it as the WE ref.' },
    pushedRefs: {
      type: 'array',
      items: {
        type: 'object', required: ['repo', 'ref'], additionalProperties: false,
        properties: { repo: { type: 'string', description: 'we | frontierui | plateau-app' }, ref: { type: 'string', description: 'the lane/<NNN>-<n> ref pushed to THAT repo\'s origin' } },
      },
      description: 'cross-repo: every {repo, lane ref} this concurrent item pushed — one per affected repo (we + any frontierui/plateau-app). The integrator merges these impl-first/WE-last. For a WE-only item this is just [{repo:"we", ref:"…"}]. Omit for serial-lane items (already on main).',
    },
    resolveCommit: { type: 'string', description: 'the full SHA of the WE commit that resolved this item (git rev-parse HEAD in the WE clone right after the resolve commit). The integrator asserts this commit is reachable from WE HEAD before trusting status:"resolved" — an un-merged resolve is reclassified "stranded" (#1869 defect 2).' },
    changedFiles: {
      type: 'array', items: { type: 'string' },
      description: 'EVERY file this item actually changed, REPO-QUALIFIED as "<repo>:<repo-relative-path>" (e.g. "we:backlog/1943.md", "frontierui:src/foo.ts"). Used to surface files touched by more than one item across the constellation — the residual silent-merge risk a human should eyeball.',
    },
    derivedArtifacts: {
      type: 'array', items: { type: 'string' },
      description: 'WE derived files this item WOULD have regenerated but deliberately did NOT (the AGENTS.md inventory block — NOT its hand-authored prose body, which is a monolith edit; src/_data/referenceIndex.json; src/_data/capabilityWorkedExample.json) — the integrator regenerates once.',
    },
    monolithEdits: {
      type: 'array',
      items: {
        type: 'object', required: ['file', 'summary'], additionalProperties: true,
        properties: { file: { type: 'string' }, summary: { type: 'string', description: 'the exact entry/change to re-apply on the integrated tree' } },
      },
      description: 'edits to still-monolithic shared registries the item is NOT committing — the integrator applies them serially.',
    },
    gate: { type: 'string', enum: ['green', 'red'], description: 'The WE lane fast-fail result (#1937 Fork C / #1939) — the scoped `check:standards --local --files` gate in the WE clone, the ONLY lane gate. green = clean (or not applicable); red = a real file-local error (it cannot false-red — global rules are demoted). red → push NOTHING. Impl repos are NOT gated in-lane; their authority is the central per-repo full gate after merge.' },
    notes: { type: 'string' },
  },
};

const INTEGRATE_SCHEMA = {
  type: 'object',
  required: ['num', 'merged', 'gate'],
  additionalProperties: true,
  properties: {
    num: { type: 'string' },
    repo: { type: 'string', description: 'which constellation repo this per-repo merge was for' },
    merged: { type: 'boolean', description: 'true if the lane ref merged (clean, or clean after a rebase-retry) into that repo\'s main.' },
    rebased: { type: 'boolean', description: 'true if the first merge conflicted and the lane was rebased onto main before a successful retry.' },
    conflicted: { type: 'boolean', description: 'true if a real semantic conflict SURVIVED the rebase-retry. NOT set for a conflict the rebase resolved.' },
    gate: { type: 'string', enum: ['green', 'red'], description: 'full gate on the merged tree in THAT repo.' },
    refDeleted: { type: 'boolean', description: 'true if the remote lane/* ref was deleted after a clean land.' },
    renderCheck: { type: 'string', enum: ['pass', 'fail', 'n/a'], description: '#2000: the cross-origin visual render check on the WE consumer — "pass"/"fail" for a visual-touching WE merge, "n/a" otherwise (non-visual lane, or an impl-repo merge).' },
    notes: { type: 'string' },
  },
};

// #2000 (#2078 folded in) — repo-qualified visual-touch predicate. A batch lane warrants the render
// check on the WE consumer when it edits a WE presentation surface (*.njk / *.css / src/_includes/**)
// OR a FUI theme/token source (frontierui plugs/webtheme/**) — because WE consumes FUI theming
// cross-origin (#96) and the FUI lane's own gate never paints. This mirrors `isVisualTouch` in
// scripts/lib/render-check.mjs (the unit-tested source of truth); the workflow sandbox can't import it,
// so this inline copy must stay in sync (the lib test pins the intended behaviour). Input: the item's
// repo-qualified changed files ("<repo>:<path>", the ITEM_RESULT_SCHEMA.changedFiles shape), falling
// back to the probe's predicted touch-set when the lane reported none.
function isVisualTouchQualified(files) {
  if (!Array.isArray(files)) return false;
  return files.some((qualified) => {
    if (typeof qualified !== 'string') return false;
    const idx = qualified.indexOf(':');
    const repo = idx === -1 ? 'we' : qualified.slice(0, idx);
    const path = idx === -1 ? qualified : qualified.slice(idx + 1);
    if (repo === 'we') return /\.njk$/.test(path) || /\.css$/.test(path) || /^src\/_includes\//.test(path);
    if (repo === 'frontierui' || repo === 'fui') return /(^|\/)plugs\/webtheme\//.test(path);
    return false;
  });
}
// The item's touch-set as repo-qualified paths, preferring what the lane actually changed, falling back
// to the probe's prediction (predictedFiles are WE-relative → prefix "we:"; extraRepos are repo-relative).
function qualifiedTouchSet(it, cr) {
  if (cr && Array.isArray(cr.changedFiles) && cr.changedFiles.length) return cr.changedFiles;
  const p = it && it.probe;
  const out = [];
  if (p && Array.isArray(p.predictedFiles)) for (const f of p.predictedFiles) out.push(`we:${f}`);
  if (p && Array.isArray(p.extraRepos)) for (const er of p.extraRepos) if (er && Array.isArray(er.files)) for (const f of er.files) out.push(`${er.repo}:${f}`);
  return out;
}

// ── Helpers (pure — exercised by the verification harness) ─────────────────────
// Files are REPO-QUALIFIED ("<repo>:<path>") so disjointness holds across the constellation: the same path in
// two different repos never collides, and a genuine same-repo overlap still does. For a WE-only item this
// degenerates to the slice-3 behaviour with a uniform "we:" prefix.
function filesOf(entry) {
  const p = entry.probe;
  const base = new Set([`we:backlog/${entry.file}`]);
  if (p && Array.isArray(p.predictedFiles)) for (const f of p.predictedFiles) base.add(`we:${f}`);
  if (Array.isArray(entry.declaredFiles)) for (const f of entry.declaredFiles) base.add(`we:${f}`);
  if (p && Array.isArray(p.extraRepos)) {
    for (const er of p.extraRepos) {
      if (er && REPOS[er.repo] && Array.isArray(er.files)) for (const f of er.files) base.add(`${er.repo}:${f}`);
    }
  }
  return base;
}
// Repos an item touches, ordered impl-first / WE-last. WE is always present (the backlog item lives there).
function affectedReposOf(entry) {
  const repos = new Set(['we']);
  const p = entry.probe;
  if (p && Array.isArray(p.extraRepos)) for (const er of p.extraRepos) if (er && REPOS[er.repo]) repos.add(er.repo);
  return INTEGRATION_ORDER.filter((r) => repos.has(r));
}
function isCrossRepo(entry) {
  return affectedReposOf(entry).some((r) => r !== 'we');
}
function disjoint(setA, setB) {
  for (const f of setA) if (setB.has(f)) return false;
  return true;
}
// ── Optimistic-first partition predicate (#1950, slice A) — INLINE MIRROR of the canonical, TESTED module
// `we:scripts/readiness/lane-partition.mjs` (the sandbox can't import; that module + its test are the spec —
// keep these in sync). THE MODEL: serial is reached ONLY when actually needed, never pre-emptively. An item
// is forced serial ONLY by (a) a failed/absent probe (mustSerialize), (b) a real blockedBy edge, (c) a shared
// MERGE-RISK (blacklist) file — the one case the optimistic git-merge floor can't catch (a clean-but-wrong
// structured merge of a monolith), or (d) a low-confidence item that ALSO overlaps another on ANY file.
// Confident items whose only overlaps are ORDINARY (build config, barrels, their own spill) run CONCURRENT and
// lean on the optimistic floor (rebase-retry → serial-replay → multiLaneFiles). A wrong "concurrent" call costs
// SPEED (a replay), never correctness — so reliability is unchanged while disjoint work stops collapsing to one
// serial chain. SUPERSEDES the prior `confident:false → serial` + `any-overlap → serial` gate.
// Is a REPO-QUALIFIED path ("<repo>:<path>") a reserved merge-risk file? Matches the remainder against THAT
// repo's set (#1951, slice B); the curated-sweep prefix is WE-only. Unknown/unqualified repo → false.
function isReservedMergeRisk(repoQualifiedPath) {
  const s = String(repoQualifiedPath);
  const i = s.indexOf(':');
  if (i < 0) return false;
  const repo = s.slice(0, i);
  const f = s.slice(i + 1);
  const set = RESERVED_MERGE_RISK_BY_REPO[repo];
  if (!set) return false;
  if (set.includes(f)) return true;
  return repo === 'we' && /^src\/_data\/(benchmark|workbench)/.test(f);
}
// The MERGE-RISK files an item touches = its touchesMonolith (WE-qualified) ∪ any blacklist member of its set.
function mergeRiskFilesOf(entry) {
  const out = new Set();
  const p = entry.probe;
  if (p && Array.isArray(p.touchesMonolith)) for (const f of p.touchesMonolith) out.add(`we:${String(f).replace(/^we:/, '')}`);
  for (const f of filesOf(entry)) if (isReservedMergeRisk(f)) out.add(f);
  return out;
}
function mustSerialize(entry) {
  return !entry.probe; // only a genuinely-unknown touch-set is unconditional; the rest is the pairwise check
}
function blockEdge(x, y) {
  const xbb = new Set((x.blockedBy || []).map(String));
  const ybb = new Set((y.blockedBy || []).map(String));
  return xbb.has(String(y.num)) || ybb.has(String(x.num));
}
function conflicts(x, y) {
  if (blockEdge(x, y)) return true;                                       // (b) real dependency
  if (!disjoint(mergeRiskFilesOf(x), mergeRiskFilesOf(y))) return true;   // (c) shared merge-risk file
  const lowConf = (x.probe && x.probe.confident === false) || (y.probe && y.probe.confident === false);
  if (lowConf && !disjoint(filesOf(x), filesOf(y))) return true;          // (d) low-confidence + any overlap
  return false;                                                          // confident + only ordinary overlap → concurrent
}
// The lane/* ref an item pushes — namespaced under lane/ (the #1934 carve-out) and scoped by slug + num so
// concurrent batches never collide on a ref name. The SAME name is used in each affected repo's own origin
// (different remotes ⇒ no collision); the integrator fetches it per-repo.
function laneRefFor(num) {
  return `lane/${batchSlug}-${num}`;
}
// Per-repo lane assignment: for each repo, the concurrent items touching it form an ordered list, and an
// item's lane index in that repo = its position in that list. So we provision exactly as many lanes per repo
// as items touch it (no over-provisioning), and item↔lane mapping is deterministic without threading state.
function repoLanePlan(concurrentItems) {
  const plan = {}; // repo -> [item, …] in stable order
  for (const it of concurrentItems) {
    for (const repo of affectedReposOf(it)) {
      (plan[repo] || (plan[repo] = [])).push(it);
    }
  }
  return plan;
}
function laneIndexOf(plan, it, repo) {
  return (plan[repo] || []).indexOf(it);
}

// ── Phase 1 — Probe each item's real touch-set (parallel), then partition (pure JS) ──────────────
phase('Probe');
log(`Probing ${items.length} packed item(s) for their real touch-sets across the constellation…`);

let probedCount = 0;
const probes = await parallel(items.map((it) => () =>
  agent(
    [
      RETURN_HYGIENE,
      ``,
      `You are scoping backlog item #${it.num} ("${it.slug}") for a PARALLEL batch. Read we:backlog/${it.file}`,
      `and any files it references. Predict EVERY file this item will create or edit if worked now, ACROSS the`,
      `constellation (#96): webeverything (WE), frontierui, and plateau-app.`,
      ``,
      `• WE files (predictedFiles, WE-repo-relative): its impl/code in WE, its own we:backlog/${it.num}.md, and`,
      `  any per-entry registry file (src/_data/<registry>/<id>.json — every collection registry is one-file-`,
      `  per-entry since #1145/#1146/#1157).`,
      `• NON-WE files (extraRepos): if the item's impl SPANS frontierui or plateau-app (e.g. a standard authored`,
      `  in WE but implemented in frontierui, or surfaced in plateau-app), list each such repo + its repo-`,
      `  relative files. The backlog item + claims.json ALWAYS live in WE, so WE is implicit — extraRepos is for`,
      `  the IMPL spill only. Most items are WE-only: leave extraRepos empty unless the body clearly reaches`,
      `  into another repo.`,
      ``,
      `Frontmatter declares (WE): ${JSON.stringify(it.declaredFiles || [])} — treat that as a LOWER BOUND only.`,
      `Per-entry registry files (src/_data/<registry>/<id>.json) are DISJOINT by construction (#1145/#1146/#1157):`,
      `writing your OWN new/edited entry never collides, so do NOT list them in touchesMonolith and they do NOT`,
      `lower confidence (this INCLUDES src/_data/adapters/<id>.json — split per-adapter since #1938). List in`,
      `touchesMonolith ONLY the genuinely-monolithic shared WE files (the single-doc registries`,
      `src/_data/{traits,docs,capabilityMatrix}.json, webhandlers/webportals.json, the curated-sweep artifacts`,
      `workbench*/benchmark*.json, the AGENTS.md hand-authored prose body; plus plugs/bootstrap.ts). Build config`,
      `(tsconfig/vite/package.json/vitest.config) is NOT a monolith (#1952) — it merges optimistically; never list it.`,
      `Set confident=TRUE when every file you'll touch — in EVERY affected repo — is one this item clearly OWNS.`,
      `Set confident=FALSE *only* when the work plausibly SPILLS into a shared surface another item could also`,
      `touch (a monolithic registry, plugs/bootstrap.ts, a shared *.njk include, a shared test spec, or a broad`,
      `cross-file refactor) in ANY repo — but NOT build config, which is line-structured and merges clean.`,
      `Routine uncertainty about the exact file COUNT`,
      `is NOT a reason for false; default disjoint-looking work to TRUE. (#1950: confident:false no longer forces`,
      `serial by itself — it only tightens the pairwise overlap check — so don't agonize; an honest false on a`,
      `genuinely-disjoint touch-set still runs concurrent.) Return ONLY the structured object.`,
    ].join(' '),
    { label: `probe:${it.num}`, phase: 'Probe', schema: PROBE_SCHEMA, effort: 'low' },
  ).then((p) => {
    probedCount++;
    const fileN = p && Array.isArray(p.predictedFiles) ? p.predictedFiles.length : 0;
    const xr = p && Array.isArray(p.extraRepos) ? p.extraRepos.filter((e) => e && REPOS[e.repo]).map((e) => e.repo) : [];
    const xrTag = xr.length ? ` + ${xr.join('/')}` : '';
    const verdict = !p ? 'no result → serial' :
      (p.touchesMonolith && p.touchesMonolith.length) ? `${fileN} WE file(s)${xrTag} + monolith touch — concurrent unless another item shares it` :
      p.confident === false ? `${fileN} WE file(s)${xrTag}, low-confidence — concurrent unless it overlaps another item` :
      `${fileN} WE file(s)${xrTag}, candidate for concurrent`;
    log(`  probe ${probedCount}/${items.length}: #${it.num} — ${verdict}`);
    return { ...it, probe: p };
  }).catch(() => { probedCount++; log(`  probe ${probedCount}/${items.length}: #${it.num} — probe FAILED → serial`); return { ...it, probe: null }; }),
));

// Partition into a CONCURRENT set (each item provably independent of every other → its own coupled lane
// clones, run concurrently) and a SERIAL lane. OPTIMISTIC-FIRST (#1950): an item goes serial ONLY if its
// probe failed (mustSerialize) or it `conflicts` with another candidate — i.e. a real blockedBy edge, a shared
// merge-risk (blacklist) file, or (when low-confidence) any file overlap. A confident item whose only overlaps
// are ordinary (build config, barrels, its own spill) runs concurrent and leans on the optimistic floor. An
// item is concurrent ONLY if it conflicts with NO other candidate — so the concurrent set is pairwise-non-
// conflicting by construction and its lanes merge clean (or self-correct via rebase-retry / serial-replay).
const probed = probes.filter(Boolean);
// CIRCUIT-BREAKER (watchdog, #2040): a probe that dies (API-overloaded etc.) is normally harmless — the item
// just goes serial. But if a LARGE fraction die at once, that's a systemic API outage, not per-item noise:
// pressing on would grind every item through the serial lane where the same outage makes them carry, wasting
// ~an hour to discover it. Bail BEFORE the pre-claim (nothing is claimed/pushed yet) so trouble rides the
// completion wake in seconds, not at natural run-end. The floor is unchanged: the user just re-runs when the
// API recovers, or falls back to serial /batch.
const probeFailures = probed.filter((e) => !e.probe).map((e) => String(e.num));
const failFrac = probed.length ? probeFailures.length / probed.length : 0;
if (probed.length >= 4 && failFrac >= 0.5) {
  log(`⚠ CIRCUIT-BREAKER: ${probeFailures.length}/${probed.length} probes died (#${probeFailures.join(', #')}) — ` +
      `that is a systemic API failure, not per-item noise. Aborting BEFORE any claim/push (nothing was mutated); ` +
      `re-run when the API recovers, or use serial /batch.`);
  return { ledger: [], concurrentItems: 0, serialItems: 0, crossRepoItems: 0, conflictsReplayed: 0, stranded: [], multiLaneFiles: [], partialCrossRepo: [], reposProvisioned: [], derivedRegenerated: false, pointsSpent: 0, budgetPoints, baseRef, probeFailures, aborted: 'probe-storm' };
}
if (probeFailures.length) log(`Note: ${probeFailures.length} probe(s) failed (#${probeFailures.join(', #')}) → forced serial (recoverable; not a storm).`);
const serialFromProbe = probed.filter(mustSerialize);
const candidates = probed.filter((e) => !mustSerialize(e));
const concurrent = [];
const entangled = [];
for (const item of candidates) {
  const clashes = candidates.some((o) => o !== item && conflicts(item, o));
  (clashes ? entangled : concurrent).push(item);
}
const serialItems = [...serialFromProbe, ...entangled];
const crossRepoCount = concurrent.filter(isCrossRepo).length + serialItems.filter(isCrossRepo).length;

log(`Partition: ${concurrent.length} independent item(s) → coupled lane clones, concurrent; ${serialItems.length} item(s) → serial lane (sequential on main); ${crossRepoCount} cross-repo item(s) span >1 repo. ` +
    (concurrent.length === 0 ? 'No provably-independent item → this degenerates to a serial batch (correct, not a failure).' : ''));
for (const e of concurrent) {
  const repos = affectedReposOf(e);
  log(`  concurrent: #${e.num} (${e.slug}) — repos: ${repos.join('+')} — disjoint files: ${[...filesOf(e)].slice(0, 4).join(', ')}…`);
}
for (const e of serialItems) {
  // Name the SPECIFIC predicate that fired (mirror of lane-partition.mjs serialReason): a failed probe, the
  // contending item's #, a shared merge-risk file, or a low-confidence overlap — never a blanket "monolith".
  const rest = serialItems.concat(concurrent).filter((o) => o !== e);
  let why;
  if (!e.probe) why = 'probe failed — unknown touch-set';
  else {
    const dep = rest.find((o) => blockEdge(e, o));
    const risk = !dep && rest.find((o) => !disjoint(mergeRiskFilesOf(e), mergeRiskFilesOf(o)));
    const ov = !dep && !risk && e.probe.confident === false && rest.find((o) => !disjoint(filesOf(e), filesOf(o)));
    why = dep ? `blockedBy edge with #${dep.num}` : risk ? `shares a merge-risk file with #${risk.num}`
      : ov ? `low-confidence touch-set overlapping #${ov.num}` : 'serial';
  }
  log(`  serial: #${e.num} (${e.slug}) — ${why}${isCrossRepo(e) ? ` (cross-repo: ${affectedReposOf(e).join('+')})` : ''}`);
}

// ── Phase 2 — Central pre-claim ALL items in WE + provision a lane pool PER repo + push the base ──
// SAFETY: the pre-claim (backlog + claims.json) is WE-only (#1933 choice 2 — lanes never touch it). We claim
// EVERY item (concurrent + serial) in the PRIMARY WE checkout, commit, and push to the throwaway
// `lane/_base-<slug>` ref the concurrent WE lanes reset to. Provisioning the persistent lane pools (slice 2)
// runs PER affected repo here so the coupled lane dirs are ready before dispatch.
phase('Claim');

const numsAll = items.map((it) => String(it.num));
const lanePlan = repoLanePlan(concurrent);
// What to provision: each repo that any concurrent item touches, sized to how many concurrent items touch it.
const provisionPlan = INTEGRATION_ORDER
  .filter((repo) => (lanePlan[repo] || []).length > 0)
  .map((repo) => ({ repo, name: REPOS[repo].name, path: REPOS[repo].path, count: lanePlan[repo].length }));
let lanePools = {}; // repo -> [absolute lane dir, …] (index-aligned to lanePlan[repo])
let baseReady = false;
let claimedThisRun = new Set(); // nums this run flipped open→active at pre-claim (scopes the closeout reopen)
if (concurrent.length > 0 || serialItems.length > 0) {
  const setup = await agent(
    [
      RETURN_HYGIENE,
      ``,
      `You are the CENTRAL SETUP step of a #1933 clone-based parallel batch (slug ${batchSlug}), running in the`,
      `PRIMARY WE checkout (the user's live working tree, on branch main). Do EXACTLY this, in order, and report`,
      `the result. NEVER push to main; the ONLY pushes allowed are to lane/* refs (the #1934 guard carve-out).`,
      ``,
      `1. PRE-CLAIM all items (#1933 choice 2 — claims.json + backlog live ONLY in WE; this is the ONLY place`,
      `   they are written for this batch). For EACH num, run: \`node scripts/backlog.mjs claim <NNN>`,
      `   --session=${batchSlug}\` (flips backlog/<NNN>-*.md status open→active + dateStarted, records the central`,
      `   claims.json baseline). Nums: ${JSON.stringify(numsAll)}. If an item is already active (a prior partial`,
      `   run), skip it — do NOT --force. Then commit the post-claim state in ONE commit:`,
      `   \`git add backlog/*.md .claude/skills/batch-backlog-items/claims.json`,
      `   .claude/skills/batch-backlog-items/reservations.json && git commit -m "batch ${batchSlug}: pre-claim`,
      `   ${numsAll.length} item(s)"\` (stage ONLY those paths; never \`git add -A\`).`,
      ``,
      `2. PUSH the post-claim base to WE's throwaway ref so the WE lanes can reset to it:`,
      `   \`git push --force origin HEAD:${baseRef}\` (a lane/* ref → allowed; --force because a re-run replaces`,
      `   a stale base). Confirm it succeeded.`,
      ``,
      `3. PROVISION a lane pool PER affected repo (cross-repo, slice 4). scripts/lane-pool.mjs is repo-`,
      `   parameterized — run it from THIS WE checkout, passing --repo for non-WE repos. For each entry below,`,
      `   run \`node scripts/lane-pool.mjs provision --count=<count> [--repo=<path>]\` (omit --repo for WE) then`,
      `   \`node scripts/lane-pool.mjs list --json [--repo=<path>]\`. The pools are PERSISTENT (slice 2) — a`,
      `   re-run reuses existing clones (fast). Provision plan (JSON): ${JSON.stringify(provisionPlan)}.`,
      `   (If the plan is empty, there are no concurrent items — skip provisioning.)`,
      ``,
      `Report: claimedNums (the nums you actually flipped to active this run), baseRefPushed (boolean), and`,
      `lanePools — an OBJECT keyed by repo ("we"/"frontierui"/"plateau-app") whose value is the ORDERED array of`,
      `that repo's absolute lane-clone dirs (lane-1, lane-2, … as listed). Return ONLY the object.`,
    ].join(' '),
    {
      label: 'setup:pre-claim+provision', phase: 'Claim',
      schema: {
        type: 'object', required: ['baseRefPushed'], additionalProperties: true,
        properties: {
          claimedNums: { type: 'array', items: { type: 'string' } },
          baseRefPushed: { type: 'boolean' },
          lanePools: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } },
          notes: { type: 'string' },
        },
      },
    },
  ).catch(() => null);
  if (!setup || setup.baseRefPushed !== true) {
    log(`⚠ central pre-claim / base-ref push FAILED — cannot dispatch lanes safely. Aborting the parallel run; ` +
        `fall back to a serial /batch. (No lane work was pushed; the user's checkout holds only the pre-claim commit.)`);
    return { ledger: [], concurrentItems: 0, serialItems: serialItems.length, crossRepoItems: crossRepoCount, conflictsReplayed: 0, stranded: [], multiLaneFiles: [], partialCrossRepo: [], reposProvisioned: [], derivedRegenerated: false, pointsSpent: 0, budgetPoints, baseRef, aborted: 'setup-failed' };
  }
  baseReady = true;
  // The nums THIS run actually flipped open→active at pre-claim (setup skips already-active items owned by
  // another session). Closeout reopen (Phase 4g) is scoped to THIS set so an unlanded item another session
  // owns is never reverted (boundary: "never touch an item another session owns").
  claimedThisRun = new Set((setup.claimedNums || []).map(String));
  lanePools = setup.lanePools && typeof setup.lanePools === 'object' ? setup.lanePools : {};
  const poolSummary = Object.keys(lanePools).map((r) => `${r}:${(lanePools[r] || []).length}`).join(', ') || 'none';
  log(`Central pre-claim done: ${(setup.claimedNums || []).length} item(s) flipped active, base pushed to ${baseRef}; lane pools — ${poolSummary}.`);
}

// ── Phase 3 — Work each independent item concurrently across its COUPLED clones (one agent per item) ──
phase('Lanes');

// The coupled lane dirs for an item: one per affected repo, looked up by the item's per-repo lane index.
function laneDirsForItem(it) {
  const dirs = {}; // repo -> dir
  for (const repo of affectedReposOf(it)) {
    const idx = laneIndexOf(lanePlan, it, repo);
    const pool = lanePools[repo] || [];
    dirs[repo] = pool[idx] || pool[idx % Math.max(pool.length, 1)] || '';
  }
  return dirs;
}

function laneItemPrompt(it, laneDirs) {
  const ref = laneRefFor(it.num);
  const repos = affectedReposOf(it); // impl-first, WE last
  const weDir = laneDirs.we || '';
  const implRepos = repos.filter((r) => r !== 'we');
  const reserved = reservedPathsFor(it); // merge-risk WE paths this item must LOCK before editing (#1945)
  const lockOwner = `${batchSlug}-${it.num}`; // the lease owner identity for this lane
  const lines = [
    RETURN_HYGIENE,
    ``,
    `You are PARALLEL batch item #${it.num} ("${it.slug}") running across your OWN persistent lane CLONES (each`,
    `has its own HEAD — the git-branch guard never fires on it). This item spans these repos: ${repos.join(', ')}.`,
    `Lane clones: ${JSON.stringify(laneDirs)}. The item is ALREADY claimed (status:active) in WE's central base`,
    `ref; you do NOT run claim and you NEVER touch claims.json (#1933 choice 2). Do EXACTLY this, in order:`,
    ``,
    `1. PREP each clone:`,
    `   • WE clone (${weDir}): \`cd ${weDir} && git fetch origin --prune --quiet && git reset --hard`,
    `     origin/${baseRef} --quiet\` (points it at the central post-claim base — #${it.num} is already active here).`,
  ];
  for (const r of implRepos) {
    lines.push(`   • ${r} clone (${laneDirs[r]}): \`cd ${laneDirs[r]} && git fetch origin --prune --quiet && git reset --hard origin/main --quiet\` (impl repos have no backlog; reset to their own main).`);
  }
  lines.push(
    `   Ensure deps in each clone (the pool installed them; if node_modules is missing run \`npm ci\` there).`,
    ``,
    ...(reserved.length ? [
      `1b. RESERVE the merge-risk WE path(s) you will edit — the MANDATORY write-time lock (#1945 / #1936). This`,
      `   item's probe flagged these monolithic shared paths: ${JSON.stringify(reserved)}. BEFORE editing any of`,
      `   them, acquire its lease from the CENTRAL lock authority (one dir all lanes share — NOT your clone's):`,
      `     \`node scripts/readiness/file-locks-cli.mjs reserve --owner=${lockOwner} --root=${CENTRAL_LOCK_ROOT} --pid=$$ ${reserved.join(' ')}\``,
      `   (run it FROM your WE clone ${weDir}; the --root is the absolute CENTRAL path above, so all lanes contend`,
      `   on the SAME lock). Exit 0 = you hold every path, proceed. Exit 3 = a LIVE lane holds one (the JSON's`,
      `   \`blocked[]\` names it) → you may NOT edit it: STOP and report status:"carried" drop:"blocked-in-fact"`,
      `   (a second lane needing a held path WAITS or DEFERS — #1936; do not steal it). A stale (lease-expired) or`,
      `   provably-dead owner is reclaimed for you automatically. While you work, if your edits take long, refresh`,
      `   the lease: \`… file-locks-cli.mjs heartbeat --owner=${lockOwner} --root=${CENTRAL_LOCK_ROOT} --pid=$$ ${reserved.join(' ')}\`.`,
      ``,
    ] : []),
    `2. WORK the item across its repos — full single-item arc MINUS the claim (already done). Edit ONLY this`,
    `   item's own files in each clone: its WE impl/code + its own we:backlog/${it.file} in the WE clone, and its`,
    `   own impl files in ${implRepos.length ? implRepos.join('/') : '(no other repos)'}.`,
    ``,
    `HARD RULES (the parallel-safety contract):`,
    `• Do NOT edit any other item's files in ANY repo, do NOT stage claims.json, and do NOT splice a still-`,
    `  monolithic shared registry in WE (src/_data/{traits,docs,capabilityMatrix}.json,`,
    `  webhandlers/webportals.json, curated-sweep artifacts, the AGENTS.md prose body). If this item genuinely`,
    `  needs that, STOP, mark status:"dropped" drop:"outgrew", and report it in monolithEdits for the integrator.`,
    `• Do NOT regenerate or stage WE derived artifacts (the AGENTS.md inventory block — NOT its prose body;`,
    `  src/_data/referenceIndex.json; src/_data/capabilityWorkedExample.json) — just LIST them in`,
    `  derivedArtifacts; the integrator regens once.`,
    `• LANE FAST-FAIL — best-effort, scoped, WE-only (#1937 Fork C / #1939): the ONLY lane gate is the WE scoped`,
    `  one. In the WE clone run \`npm run check:standards -- --local --files=<your WE changed files>\` (the #1159`,
    `  partition) BEFORE you push. It blocks ONLY on file-local truth — global-consistency rules are demoted to`,
    `  notes — so it CANNOT false-red the #1153 4-of-7 way; a red here is therefore a REAL file-local error YOU`,
    `  authored → fast-fail: set gate:"red", status carried/dropped, push NOTHING (a known-broken lane only buys a`,
    `  wasted push+merge round-trip). Do NOT run a FULL gate in ANY clone as a push-gate — a full lane gate`,
    `  false-reds on cross-lane consistency (#1153). Impl repos (${implRepos.length ? implRepos.join('/') : 'none for this item'}) get NO`,
    `  lane gate: their authority is the central per-repo FULL gate AFTER merge (run by the integrator), and the`,
    `  impl-first/WE-last integration order means a red impl is caught BEFORE WE's resolve lands — so a broken`,
    `  impl is carried, never falsely resolved. Skipping the impl check costs only a round-trip, nothing more.`,
    `• 3. Only after the WE lane fast-fail is green (gate:"green"): RESOLVE in the WE clone (\`node`,
    `  scripts/backlog.mjs resolve ${it.num} [--graduated-to=…]\`). Then COMMIT each repo's own files (git add`,
    `  <explicit paths>; NEVER -A; NEVER stage claims.json or derived). Commit message per repo: \`backlog:`,
    `  resolve #${it.num} — <slug>\`.`,
    ...(reserved.length ? [
      `• 3b. FENCE before pushing (#1936 insurance invariant — the broker fencing point). If you reserved any`,
      `  merge-risk path, FIRST confirm your lease was not reclaimed mid-flight (the Kleppmann race: you paused`,
      `  past the lease, another lane reclaimed + edited the path, you'd now silently clobber it):`,
      `    \`node scripts/readiness/file-locks-cli.mjs fence --owner=${lockOwner} --root=${CENTRAL_LOCK_ROOT} ${reserved.join(' ')}\``,
      `  Exit 0 = you still hold every path → push. Exit 3 = a lease was reclaimed (the JSON's \`reclaimed[]\` names`,
      `  it) → DO NOT PUSH: set status:"carried" drop:"blocked-in-fact" and push NOTHING (re-attempt next run).`,
    ] : []),
    `• 4. PUSH each repo's commit to its lane ref (the ONLY pushes you make) — SAME ref name "${ref}" in each`,
    `  repo's own origin, with a BOUNDED RETRY (the only push you make MUST land): from each clone run`,
    `    \`for n in 1 2 3 4 5; do git push --force origin HEAD:${ref} && { pushed=1; break; }; sleep "0.$((RANDOM%6+3))"; done; [ -n "$pushed" ]\``,
    `  Why the loop, not a bare push (#1995): concurrent lanes share ONE origin and finish near-simultaneously, so`,
    `  two pushes can collide on git's ref-transaction lock (\`packed-refs.lock\` / per-ref \`.lock\`) and the loser`,
    `  is rejected ("cannot lock ref" / "failed to update ref") — a TRANSIENT contention, not a real conflict. The`,
    `  retry (≤5 attempts, 0.3–0.8s jittered backoff) recovers it so the lane stays CONCURRENT instead of dropping`,
    `  to the integrator's serial replay. Force-push to your lane-owned ref is idempotent, so retrying is`,
    `  correctness-safe (--force replaces a stale ref; lane/* is allowed by #1934). If all 5 attempts fail the`,
    `  command exits non-zero → report that repo as NOT pushed (omit it from pushedRefs); the serial-replay floor`,
    `  still catches the item.`,
    ...(reserved.length ? [
      `• 5. RELEASE your locks after pushing (or on any early stop) so a queued lane can proceed:`,
      `  \`node scripts/readiness/file-locks-cli.mjs release --owner=${lockOwner} --root=${CENTRAL_LOCK_ROOT} ${reserved.join(' ')}\`.`,
      `  (Release only frees locks YOU own; a reclaimed-away path is skipped. Stale leases also self-reclaim, so a`,
      `  crash that skips this never wedges the fleet — the next contender reclaims after the lease.)`,
    ] : []),
    ``,
    `Report: num, status, cost, pushedRefs (an array of {repo, ref:"${ref}"} — one entry PER repo you pushed),`,
    `resolveCommit (the full SHA — \`git rev-parse HEAD\` in the WE clone after your resolve commit), changedFiles`,
    `(REPO-QUALIFIED "<repo>:<path>" — git diff --name-only vs each repo's base, prefixed by repo), derivedArtifacts`,
    `you deferred, any monolithEdits, and gate green/red (the WE lane fast-fail result — green when it was clean`,
    `or not applicable; impl repos are NOT gated here). Return ONLY the structured object.`,
  );
  return lines.join('\n');
}

if (concurrent.length > 0) {
  log(`Working ${concurrent.length} independent item(s) concurrently across their coupled clones — each item is logged the instant it lands…`);
  if (laneModel) log(`  concurrent lanes run on '${laneModel}' (per-batch downgrade); drops re-adjudicate + resolves re-gate on the default model — no quality floor lowered.`);
}
let itemsDone = 0;
const concurrentResults = await parallel(concurrent.map((it) => () => {
  const laneDirs = laneDirsForItem(it);
  if (!laneDirs.we) {
    itemsDone++;
    log(`  ✗ #${it.num} (${itemsDone}/${concurrent.length}): no WE lane clone available → will replay serially [${it.slug}]`);
    return Promise.resolve(null);
  }
  return agent(laneItemPrompt(it, laneDirs), { label: `lane:#${it.num}`, phase: 'Lanes', schema: ITEM_RESULT_SCHEMA, ...(laneModel ? { model: laneModel } : {}) })
    .then((r) => {
      itemsDone++;
      const refN = r && Array.isArray(r.pushedRefs) ? r.pushedRefs.length : (r && r.pushedRef ? 1 : 0);
      log(`  ${r && r.status === 'resolved' && refN > 0 ? '✓' : '~'} #${it.num} (${itemsDone}/${concurrent.length}): ${r ? r.status + ', gate ' + r.gate + (refN ? `, pushed ${refN} ref(s)` : ', not pushed') : 'no result → replay'} [${it.slug}]`);
      return r ? { ...r, num: r.num || String(it.num), _item: it } : null;
    })
    .catch(() => { itemsDone++; log(`  ✗ #${it.num} (${itemsDone}/${concurrent.length}) died → will replay serially [${it.slug}]`); return null; });
}));

// ── Phase 4 — Integrate: serial lane FIRST, then merge each item's repos impl-first/WE-last ───────
// SAFETY (the clone model): every concurrent item's work is durable on each repo's origin (its lane/* refs)
// before any merge, so a mid-integration failure loses nothing — refs are deleted only AFTER their merge
// lands. The integrator works each repo's PRIMARY checkout on main. For WE the merge-base is lane/_base, so
// the active→resolved flip merges clean. Full gate per merge per repo (#1937). The JS loop is single-threaded
// → merges are naturally serialized. Cross-repo ORDER: impl repos first, WE last (the atomicity guarantee).
phase('Integrate');

const ledger = [];
const partialCrossRepo = [];
let conflictsReplayed = 0;

// 4a. The serial lane runs FIRST, ONE item per agent. These items could not be PROVEN independent, so they're
// the safe baseline the lane refs merge on top of. They are already `active` from the pre-claim. A cross-repo
// serial item works each affected repo's PRIMARY checkout directly (no lanes), naturally serialized.
if (serialItems.length > 0) {
  log(`Serial lane: working ${serialItems.length} item(s) sequentially on main…`);
  let sIdx = 0;
  for (const it of serialItems) {
    sIdx++;
    const repos = affectedReposOf(it);
    const implRepos = repos.filter((r) => r !== 'we');
    const r = await agent(
      [
        RETURN_HYGIENE,
        ``,
        `You are the SERIAL segment of a #1933 clone-based parallel batch (slug ${batchSlug}), working item`,
        `#${it.num} ("${it.slug}") IN PLACE in the PRIMARY checkouts on branch main (never cd into a lane clone).`,
        `This item is here because it could not be PROVEN independent. It spans these repos: ${repos.join(', ')}.`,
        implRepos.length
          ? `For NON-WE repos, work directly in their primary checkouts on main: ${implRepos.map((r2) => `${r2} = ${REPOS[r2].path}`).join('; ')}.`
          : `It is WE-only — work in the WE primary checkout (your cwd).`,
        `It is ALREADY claimed (status:active) from the central pre-claim — do NOT run claim, do NOT touch`,
        `claims.json. Work the FULL arc minus the claim, ORDERED impl-repos-first / WE-last (so the WE resolve is`,
        `the last write): in each impl repo, work → that repo's FULL gate (${implRepos.map((r2) => REPOS[r2].gate).join(' / ') || 'n/a'}) → commit explicit paths on its main (NEVER push). THEN in WE: work → FULL`,
        `\`npm run check:standards\` (no flags) → resolve (\`node scripts/backlog.mjs resolve ${it.num}`,
        `[--graduated-to=…]\`) → commit WE's files on main (git add <explicit paths>; NEVER -A; NEVER push).`,
        `Resolve only after every gate is green; if any gate is red, leave every repo's main clean (revert your`,
        `edits), report status carried/dropped + gate:"red". Return the structured ITEM result (changedFiles`,
        `REPO-QUALIFIED "<repo>:<path>", resolveCommit = git rev-parse HEAD in WE after your resolve commit).`,
      ].join(' '),
      { label: `serial:#${it.num}`, phase: 'Integrate', schema: ITEM_RESULT_SCHEMA },
    ).catch(() => null);
    log(`  serial ${sIdx}/${serialItems.length}: #${it.num} — ${r ? r.status + ' (gate ' + r.gate + ')' : 'no result'}`);
    if (r) ledger.push({ num: r.num || String(it.num), status: r.status, cost: r.cost, drop: r.drop, lane: 'serial', repos, changedFiles: r.changedFiles, derivedArtifacts: r.derivedArtifacts, resolveCommit: r.resolveCommit });
  }
}

// 4b. Merge each concurrent item's repos in turn. Per ITEM: integrate its repos in INTEGRATION_ORDER (impl
// first, WE last). If an impl repo fails to land, STOP that item — do NOT merge WE → the resolve never lands
// → the item is not falsely resolved (recorded in partialCrossRepo). The concurrent set is pairwise-disjoint
// (repo-qualified), so within a repo these merge clean; residual conflict risk is only vs the serial lane.
function integratePrompt(it, repo, ref, visual) {
  const r = REPOS[repo];
  const where = r.primary ? `the PRIMARY WE checkout (your cwd) on branch main` : `the ${repo} primary checkout (\`cd ${r.path}\`) on branch main`;
  // #2000: the WE consumer is where the cross-origin `.fui-card` regression paints, and WE merges LAST,
  // so a landed FUI theme change is already on WE's sibling by now. Join the render check to the WE merge
  // of a visual-touching item, between the gate and the ref-delete.
  const renderStep = repo === 'we' && visual
    ? [
        `4b. VISUAL LANE (#2000): this item touches a WE presentation surface (*.njk/*.css/_includes) or a FUI`,
        `   theme source (plugs/webtheme/**), so the WE consumer must render-verify. Run the cross-origin render`,
        `   check: \`node scripts/dev/render-check.mjs --json\`. It boots its OWN WE docs server on :8130 (NEVER`,
        `   touch the user's running server) and asserts the dogfooded \`.fui-card\` home tiles render a light`,
        `   surface. If it exits non-zero (a dark/transparent tile ⇒ a FUI dark-token leak, the #2050/#2019`,
        `   class), set renderCheck:"fail" AND treat it like a RED gate (set gate:"red"): the merge stands but do`,
        `   NOT delete the ref, and flag the visual regression in notes. If it passes, set renderCheck:"pass".`,
      ].join(' ')
    : null;
  return [
    `In ${where}, integrate parallel batch item #${it.num} from its ${repo} lane ref "${ref}". Steps:`,
    `1. Fetch the ref into THIS checkout: \`git fetch origin --prune "+refs/heads/${ref}:refs/remotes/origin/${ref}"\`.`,
    `2. \`git merge --no-ff origin/${ref} -m "batch ${batchSlug}: merge #${it.num} (${repo})"\`.`,
    `3. If git reports a CONFLICT: \`git merge --abort\`, then REBASE-AND-RETRY (#1933): make a temp local branch`,
    `   at the lane ref, \`git rebase main\` it onto current main; if the rebase is clean, re-run the merge from`,
    `   the rebased branch (set rebased:true). If the rebase ITSELF conflicts (a real semantic conflict),`,
    `   \`git rebase --abort\`, leave main untouched, report conflicted:true, merged:false — do NOT force.`,
    `4. On a clean merge, run THIS repo's FULL gate \`${r.gate}\` on the merged tree → report gate green/red.`,
    `   If gate RED, the merge stands but flag it (a regression on the assembled tree).`,
    ...(renderStep ? [renderStep] : []),
    `5. If merged clean AND gate green${renderStep ? ' AND renderCheck passed' : ''}, DELETE the remote lane ref:`,
    `   \`git push origin --delete ${ref}\` (delete of a lane/* ref → allowed by #1934). Set refDeleted:true. NEVER push main.`,
    `Return { num:"${it.num}", repo:"${repo}", merged, rebased, conflicted, gate, refDeleted, ${renderStep ? 'renderCheck, ' : ''}notes }.`,
  ].join(' ');
}

for (let i = 0; i < concurrentResults.length; i++) {
  const cr = concurrentResults[i];
  const it = concurrent[i];
  // Source of truth for which refs to merge: what the agent actually pushed (pushedRefs), back-compat to pushedRef.
  let refs = cr && Array.isArray(cr.pushedRefs) && cr.pushedRefs.length
    ? cr.pushedRefs.filter((x) => x && x.repo && x.ref && REPOS[x.repo])
    : (cr && cr.pushedRef ? [{ repo: 'we', ref: cr.pushedRef }] : []);
  // Order impl-first / WE-last regardless of report order.
  refs = INTEGRATION_ORDER.flatMap((repo) => refs.filter((x) => x.repo === repo));

  const canMerge = cr && cr.gate === 'green' && refs.length > 0;
  if (!cr) log(`#${it.num} produced no result (died/skipped).`);
  else if (cr.gate === 'red') log(`#${it.num} lane gate RED — not merging.`);
  else if (refs.length === 0) log(`#${it.num} gate green but pushed no lane ref — cannot merge.`);

  let weLanded = false;
  let stoppedAt = null;
  const landedRepos = [];
  if (canMerge) {
    const visual = isVisualTouchQualified(qualifiedTouchSet(it, cr)); // #2000: gate the WE merge visually
    if (visual) log(`  #${it.num} is VISUAL-touching (${refs.map((x) => x.repo).join('+')}) → render-check the WE consumer at its WE merge.`);
    log(`  integrating #${it.num} (${i + 1}/${concurrentResults.length}) across ${refs.map((x) => x.repo).join('+')}, impl-first/WE-last…`);
    for (const { repo, ref } of refs) {
      const res = await agent(integratePrompt(it, repo, ref, visual), { label: `integrate:#${it.num}:${repo}`, phase: 'Integrate', schema: INTEGRATE_SCHEMA }).catch(() => null);
      const ok = res && res.merged && !res.conflicted && res.gate !== 'red';
      log(`    ${ok ? '✓' : '✗'} #${it.num} ${repo}: ${res ? (res.merged ? 'merged' : 'NOT merged') + (res.rebased ? ' (rebased)' : '') + ', gate ' + res.gate : 'no result'}`);
      if (ok) { landedRepos.push(repo); if (repo === 'we') weLanded = true; }
      else { stoppedAt = repo; break; } // impl-first ordering: a failed impl stops the item BEFORE WE lands
    }
  }

  const fullyLanded = weLanded && stoppedAt === null;
  if (fullyLanded) {
    ledger.push({ num: cr.num || String(it.num), status: cr.status, cost: cr.cost, drop: cr.drop, lane: `#${it.num}`, repos: refs.map((x) => x.repo), changedFiles: cr.changedFiles, derivedArtifacts: cr.derivedArtifacts, resolveCommit: cr.resolveCommit });
  } else if (isCrossRepo(it)) {
    // CROSS-REPO ROLLBACK (slice 4): impl may have landed in some repos but WE's resolve did NOT — the item is
    // still `active`, never falsely resolved. We do NOT auto-replay coupled work across primary checkouts in
    // this v1; record the partial (which repos landed, where it stopped) + leave the un-merged refs durable on
    // origin for the human / next run. The item is carried, not resolved.
    conflictsReplayed++; // counts as a non-clean land for the summary
    const reason = !canMerge ? 'lane red / no ref' : `merge failed at ${stoppedAt || '?'}`;
    partialCrossRepo.push({ num: String(it.num), slug: it.slug, landed: landedRepos, stoppedAt: stoppedAt || (canMerge ? null : 'pre-merge'), reason });
    ledger.push({ num: cr ? cr.num || String(it.num) : String(it.num), status: 'carried', drop: 'cross-repo-partial', cost: cr && cr.cost, lane: `#${it.num}-partial`, repos: refs.map((x) => x.repo), changedFiles: cr && cr.changedFiles });
    log(`⚠ #${it.num} is CROSS-REPO and did not fully land (${reason}); landed in [${landedRepos.join(', ') || 'none'}], WE resolve NOT landed → carried (item stays active). Un-merged lane refs remain on origin for re-attempt.`);
  } else {
    // WE-only item that failed → serial-replay on main (the slice-3 floor).
    conflictsReplayed++;
    const reason = !canMerge ? 'lane red / not pushed / no result' : `merge did not land (stopped at ${stoppedAt || 'we'})`;
    log(`#${it.num} (WE-only) could not land clean (${reason}) — replaying it serially on main.`);
    const weRef = (refs.find((x) => x.repo === 'we') || {}).ref || '';
    const replay = await agent(
      [
        RETURN_HYGIENE,
        ``,
        `In the PRIMARY WE checkout on branch main, replay parallel batch item #${it.num} ("${it.slug}") SERIALLY`,
        `(its lane merge was aborted/failed). It is ALREADY claimed (status:active) from the central pre-claim —`,
        `do NOT run claim, do NOT touch claims.json. Redo the edits on the CURRENT main tree, FULL whole-repo`,
        `gate (\`npm run check:standards\`), resolve (\`node scripts/backlog.mjs resolve ${it.num}\`), commit`,
        `(git add <explicit paths>; NEVER -A; NEVER push). If its lane ref "${weRef}" still exists on origin,`,
        `delete it after a clean replay (\`git push origin --delete ${weRef}\`). Return the structured ITEM result`,
        `(changedFiles REPO-QUALIFIED "<repo>:<path>", resolveCommit = git rev-parse HEAD after your resolve commit).`,
      ].join(' '),
      { label: `replay:#${it.num}`, phase: 'Integrate', schema: ITEM_RESULT_SCHEMA },
    ).catch(() => null);
    const src = replay || cr;
    if (src) ledger.push({ num: src.num || String(it.num), status: src.status, cost: src.cost, drop: src.drop, lane: `#${it.num}-replayed`, repos: ['we'], changedFiles: src.changedFiles, derivedArtifacts: src.derivedArtifacts, resolveCommit: src.resolveCommit });
    log(`  replay #${it.num}: ${replay ? replay.status + ' (gate ' + replay.gate + ')' : 'no result'}`);
  }
}

// 4b-collision. HEAL new-item id collisions across the merged lanes (#2071). Parallel lanes partition
// EDITS to existing files but NOT id ALLOCATION for newly-CREATED items: two lanes branching from the same
// base each derive a new item's NNN as `max(existing)+1` and can't see the other's not-yet-existing file,
// so when both land they collide on `#NNN`. The disjointness checker is blind to it (the new file's path is
// in no lane's declared write-set at partition time), so it slips past every earlier guard and surfaces only
// HERE — as `ids must be unique` at the standards gate + an 11ty output conflict (two files → one
// `_site/backlog/NNN/index.html`). This runs AFTER every lane merged (4b) and BEFORE the derived-regen +
// final gate (4c), so the tree is gate-green by close. It applies the sanctioned "newer yields" rule (NNN
// is immutable): the LATER-landing colliding new item is RE-FILED to the next free id — a refile (fs write
// + fs delete via the sanctioned script, NOT a `git mv`, which guard-bash blocks) — and EVERY inbound
// reference to the yielded id is rewritten (`#NNN` short-refs, `/backlog/NNN[/-slug]` URLs, `parent:`/
// `blockedBy:` edges) corpus-wide, so no link dangles. The base ref (`lane/_base-<slug>`) supplies the batch
// base ids so a collision on an id BOTH lanes inherited (a real edit conflict git already flagged, not an
// allocation race) is never renumbered. Idempotent: no collision ⇒ a no-op. Only meaningful for WE (backlog
// lives there); run only when this batch merged lanes onto WE main.
if (baseReady && concurrent.length > 0) {
  const renum = await agent(
    [
      RETURN_HYGIENE,
      ``,
      `In the PRIMARY WE checkout on branch main, HEAL any NEW-ITEM backlog id collision left by the parallel`,
      `lanes (#2071). Two lanes branching from the same base can each allocate the SAME next \`#NNN\` for a`,
      `newly-created item (neither sees the other's not-yet-existing file) — an allocation race the partition`,
      `checker can't catch. Run EXACTLY: \`node scripts/backlog-renumber-collisions.mjs --base-ref=${baseRef} --json\`.`,
      `This detects two backlog/*.md files claiming one NNN, YIELDS the later-landing one to the next free id`,
      `(a sanctioned refile — the raw \`git mv\`/\`rm\` are guarded), and rewrites every inbound reference`,
      `(#NNN, /backlog/NNN[/-slug]/ URLs, parent:/blockedBy: edges) corpus-wide. The --base-ref supplies the`,
      `batch base ids so an id BOTH lanes inherited (a real edit conflict) is left untouched. It is idempotent`,
      `(no collision ⇒ no-op) and exits 0 either way. THEN run \`npm run check:standards\` to confirm the`,
      `\`ids must be unique\` rule is green. If it renumbered anything, commit ONLY the affected backlog files`,
      `in ONE commit: \`git add backlog/*.md && git commit -m "batch ${batchSlug}: renumber new-item id`,
      `collision(s) (#2071)"\` (stage ONLY backlog/*.md; never \`git add -A\`; if it was a no-op, skip the`,
      `commit). NEVER push. Return { renumbered: [{oldNum,newNum}], gate: 'green'|'red', notes }.`,
    ].join(' '),
    {
      label: 'integrate:renumber-collisions', phase: 'Integrate',
      schema: {
        type: 'object', required: ['gate'], additionalProperties: true,
        properties: {
          renumbered: { type: 'array', items: { type: 'object', additionalProperties: true, properties: { oldNum: { type: 'string' }, newNum: { type: 'string' } } } },
          gate: { type: 'string', enum: ['green', 'red'] },
          notes: { type: 'string' },
        },
      },
    },
  ).catch(() => null);
  if (!renum) log('⚠ id-collision renumber step produced no result — if the final gate flags `ids must be unique`, re-run scripts/backlog-renumber-collisions.mjs by hand.');
  else if (Array.isArray(renum.renumbered) && renum.renumbered.length) log(`Healed ${renum.renumbered.length} new-item id collision(s): ${renum.renumbered.map((r) => `#${r.oldNum}→#${r.newNum}`).join(', ')} (gate ${renum.gate}).`);
  else log(`No new-item id collision across the merged lanes (#2071 renumber was a no-op).`);
}

// 4c. Regenerate WE derived artifacts ONCE on the fully-merged WE main, then a final whole-repo gate. The
// #1935 Fork-2 "regenerate-on-merge" set: the AGENTS.md inventory block, src/_data/referenceIndex.json, and
// src/_data/capabilityWorkedExample.json — all reproduced by their deterministic generators. (Derived
// artifacts are WE-only; impl repos have their own build outputs handled by their own gates.)
const derived = new Set();
for (const l of ledger) if (l && Array.isArray(l.derivedArtifacts)) for (const d of l.derivedArtifacts) derived.add(d);
for (const cr of concurrentResults) if (cr && Array.isArray(cr.derivedArtifacts)) for (const d of cr.derivedArtifacts) derived.add(d);
let derivedRegenerated = false;
if (derived.size > 0) {
  log(`Regenerating ${derived.size} WE derived artifact(s) once on the merged main: ${[...derived].join(', ')}`);
  const regen = await agent(
    [
      `In the PRIMARY WE checkout on branch main, regenerate the derived artifacts the items deferred:`,
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
// changedFiles are REPO-QUALIFIED ("<repo>:<path>"), so this detects overlaps WITHIN any constellation repo
// (and never spuriously across repos). The concurrent set is disjoint by construction, so this flags a
// concurrent item overlapping a serial-lane item. This is the OPTIMISTIC-floor (#1935 Option D) post-hoc detector.
const fileItemCount = new Map();
for (const l of ledger) {
  if (!l || !Array.isArray(l.changedFiles)) continue;
  for (const f of new Set(l.changedFiles)) fileItemCount.set(f, (fileItemCount.get(f) || 0) + 1);
}
const multiLaneFiles = [...fileItemCount.entries()].filter(([, n]) => n > 1).map(([f]) => f);
if (multiLaneFiles.length > 0) {
  log(`⚠ ${multiLaneFiles.length} file(s) were changed by more than one item — eyeball for a silent clean-but-wrong merge: ${multiLaneFiles.join(', ')}`);
}

// 4e. RECONCILE (#1869 defect 2) — independently verify, via git on WE main, that every ledger-`resolved`
// item's resolve actually LANDED on HEAD. The resolve lives in WE (and, by the impl-first/WE-last ordering,
// a landed WE resolve implies the impl landed too), so WE is authoritative for the "resolved" determination.
const resolvedToVerify = ledger
  .filter((l) => l && l.status === 'resolved')
  .map((l) => ({ num: String(l.num), resolveCommit: l.resolveCommit || '' }));
let stranded = [];
if (resolvedToVerify.length > 0) {
  const recon = await agent(
    [
      `In the PRIMARY WE checkout on branch main, RECONCILE the parallel batch ledger against git reality (#1869`,
      `defect 2). Confirm \`git rev-parse --abbrev-ref HEAD\` is "main" (set branchOk). Then, for EACH item`,
      `below, verify its resolve actually landed on WE HEAD — it is STRANDED if BOTH signals say so:`,
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
        log(`⚠ #${s.num} reported resolved but its resolve did NOT land on WE main (${s.reason || 'not reachable / backlog status not resolved'}) — reclassified STRANDED, not counted resolved.`);
      }
    }
    if (stranded.length === 0) log(`Reconcile: all ${resolvedToVerify.length} resolved item(s) verified present on WE main.`);
  }
}

// 4f. Clean up the throwaway WE base ref now that every lane has merged (best-effort — harmless clutter).
if (baseReady) {
  await agent(
    [
      `In the PRIMARY WE checkout, delete the throwaway parallel-batch base ref now that integration is done:`,
      `\`git push origin --delete ${baseRef}\` (delete of a lane/* ref → allowed by #1934). Best-effort — if it`,
      `is already gone, that's fine. Return { deleted: boolean }.`,
    ].join(' '),
    { label: 'integrate:cleanup-base', phase: 'Integrate', schema: { type: 'object', additionalProperties: true, properties: { deleted: { type: 'boolean' } } } },
  ).catch(() => null);
}

// 4g. REOPEN unlanded items (#2072) — closeout status reconciliation. Every item was flipped open→active at
// the central pre-claim (Phase 2), but ONLY items whose lane LANDED were flipped to `resolved`. An item that
// failed to integrate (serial-lane carry/drop, a WE-only replay that still didn't land, a cross-repo-partial,
// or a reconcile-reclassified `stranded`) is left `status: active` on WE main with NO claim in claims.json —
// a FALSE ownership signal: `readiness --select` excludes it as "active" (owned) so it silently drops out of
// the pool though nobody is working it. Reconcile each such ledger entry back to `open` (via `backlog.mjs
// release`, which is the canonical active→open transition; it leaves dateStarted as an attempt record) so the
// item honestly re-enters the next pack. Distinct from the #1869 stranded RECLASSIFY (which only re-labels the
// ledger) and the concurrent-id merge self-healing (which heals colliding NEW items) — this fixes the on-disk
// backlog status of items that never merged at all. Boundaries (#2072): only reopen items THIS run flipped
// (claimedThisRun) so an item another session owns is never touched; a cross-repo-partial's durable lane refs
// are PRESERVED (the partial path never deletes them) so the next run resumes rather than redoes.
const reopened = [];
if (baseReady) {
  // Un-resolved ledger entries whose num this run actually claimed. `dropped:"taken"` can't occur here (setup
  // skips already-active items), but scoping to claimedThisRun makes the boundary structural, not incidental.
  // MIRROR of we:scripts/readiness/carry-forward.mjs `computeReopenSet` (the sandbox can't import; that module
  // + its test are the spec — keep in sync). #2086 extracted this decision so a wrong call (which cascades
  // across 12+ items per batch, per the 2026-07-01 closeout) is unit-tested rather than inline-only.
  const claimedKnown = claimedThisRun.size > 0;
  const _seen = new Set();
  const toReopen = [];
  for (const l of ledger) {
    if (!l || l.status === 'resolved') continue;
    const num = String(l.num);
    if (claimedKnown && !claimedThisRun.has(num)) continue; // foreign — another session owns it
    if (_seen.has(num)) continue;
    _seen.add(num);
    toReopen.push(num);
  }
  if (toReopen.length > 0) {
    log(`Reopening ${toReopen.length} unlanded item(s) left active-but-unclaimed by this run so they re-enter the next pack: #${toReopen.join(', #')}`);
    const reop = await agent(
      [
        RETURN_HYGIENE,
        ``,
        `In the PRIMARY WE checkout on branch main, RECONCILE the backlog status of items this parallel batch`,
        `flipped to \`active\` at pre-claim but that NEVER landed \`resolved\` (#2072) — they are stuck`,
        `\`status: active\` with no claim, a false-ownership signal that hides them from the next pack. For EACH`,
        `num below, flip it back to open: \`node scripts/backlog.mjs release <NNN>\` (the canonical active→open`,
        `transition; leaves dateStarted as an attempt record). It is idempotent-ish: if an item is NOT \`active\``,
        `(e.g. it did resolve, or another session re-claimed it after this run started), \`release\` errors on the`,
        `illegal from-status — SKIP that num and record it in \`skipped\` (do NOT --force; never revert an item`,
        `another session owns). Do NOT touch claims.json (these items were never in it), do NOT delete any`,
        `lane/* ref (a cross-repo-partial's refs must stay for the next run to resume). Nums (JSON):`,
        `${JSON.stringify(toReopen)}. After releasing, commit ONLY the reopened backlog files in one commit:`,
        `\`git add ${toReopen.map((n) => `backlog/${n}-*.md`).join(' ')} && git commit -m "batch ${batchSlug}:`,
        `reopen ${toReopen.length} unlanded item(s) (#2072)"\` (stage ONLY those paths; never \`git add -A\`; if`,
        `nothing was actually released, skip the commit). NEVER push. Return { reopened: [nums flipped to open],`,
        `skipped: [{ num, reason }] }.`,
      ].join(' '),
      {
        label: 'integrate:reopen-unlanded', phase: 'Integrate',
        schema: {
          type: 'object', required: ['reopened'], additionalProperties: true,
          properties: {
            reopened: { type: 'array', items: { type: 'string' } },
            skipped: { type: 'array', items: { type: 'object', required: ['num'], additionalProperties: true, properties: { num: { type: 'string' }, reason: { type: 'string' } } } },
          },
        },
      },
    ).catch(() => null);
    if (!reop) {
      log('⚠ reopen-unlanded step produced no result — some items may remain active-but-unclaimed on main; the close-skill audit MUST re-check and reopen them by hand.');
    } else {
      for (const n of (Array.isArray(reop.reopened) ? reop.reopened : [])) reopened.push(String(n));
      const skips = Array.isArray(reop.skipped) ? reop.skipped : [];
      log(`Reopened ${reopened.length}/${toReopen.length} unlanded item(s) → open${skips.length ? `; skipped ${skips.length} (${skips.map((s) => `#${s.num}: ${s.reason || 'not active'}`).join(', ')})` : ''}. They re-enter the next readiness pack instead of hiding as active-but-unclaimed.`);
    }
  }
}

// 4h. PUBLISH main to origin — the gated `pushIfGreen` (#2073). Nothing in the lane/merge flow pushed `main`,
// so `origin/main` silently drifted (observed 185 commits behind local after one parallel batch). The
// integrator lands every lane on each repo's LOCAL main (Phase 4b) and never pushed — a leftover of the
// pre-2026-06-29 never-push stance, now lifted. This is the natural green checkpoint: every repo's tree was
// full-gated at its per-merge (Phase 4b) and WE's final whole-repo gate ran at the derived-regen (Phase 4c),
// so we push via the ONE shared `push-if-green.mjs` helper — the same helper the serial/close path calls.
// Rules (#2073): push a repo's main ONLY when its gate is green, ff-only (never --force; one local main
// serializes all merges so pushes are ff appends), per-repo across the constellation (#96), impl-first/WE-last
// (INTEGRATION_ORDER — WE's resolve is already the last local write, so publishing WE last never fronts a
// resolve whose impl isn't yet on origin). A red gate / non-ff leaves that repo's origin UNTOUCHED and is
// reported (the drift is recoverable — a later green close pushes it). Cadence = push-once-at-close-if-green
// (the default #2073 recommends): we publish here after the whole batch integrates, not per-merge.
const pushed = [];
if (baseReady) {
  // Only publish repos that actually got a lane pool this batch (i.e. had merges land on their local main);
  // a repo with no lane work has nothing new to push. WE is always in play (it carries every resolve).
  const toPublish = INTEGRATION_ORDER.filter((r) => r === 'we' || (lanePools[r] || []).length > 0);
  for (const repo of toPublish) {
    const r = REPOS[repo];
    // The integrator has just full-gated this repo's merged tree (Phase 4b per-merge gate; Phase 4c final WE
    // gate). `--assume-green` is the documented integrator path — re-running the full gate would be wasteful.
    // The push is ff-only and never --force: a non-ff (someone advanced origin) ABORTS and is reported, never
    // forced. `--repo` targets the repo; WE's path is the primary checkout (the agent's cwd).
    const repoArg = repo === 'we' ? '' : ` --repo=${r.path}`;
    const res = await agent(
      [
        `In the ${r.name} checkout on branch main${repo === 'we' ? ' (the PRIMARY WE checkout — your cwd)' : ` (${r.path})`}, PUBLISH main to origin`,
        `via the shared gated-push helper (#2073). Run EXACTLY, from the WE primary checkout:`,
        `\`node scripts/push-if-green.mjs${repoArg} --assume-green --json\`.`,
        `This ff-pushes ${repo}'s local main → origin/main ONLY if it is a genuine fast-forward; it NEVER uses`,
        `--force and NEVER creates a branch. A non-ff / wrong-branch / push failure aborts and leaves origin`,
        `UNTOUCHED (that is fine — the drift is recoverable by a later green push). Report the helper's JSON`,
        `result verbatim. Return { repo:"${repo}", pushed: boolean, reason: string }.`,
      ].join(' '),
      {
        label: `integrate:push:${repo}`, phase: 'Integrate',
        schema: { type: 'object', required: ['pushed'], additionalProperties: true, properties: { repo: { type: 'string' }, pushed: { type: 'boolean' }, reason: { type: 'string' } } },
      },
    ).catch(() => null);
    if (res && res.pushed) { pushed.push(repo); log(`  ✓ published ${repo} main → origin (${res.reason || 'ff-pushed'}).`); }
    else log(`  · ${repo} main NOT pushed (${res ? (res.reason || 'not a fast-forward / gate red') : 'push step produced no result'}) — origin left untouched; recoverable by a later green push.`);
  }
  log(`Published ${pushed.length}/${toPublish.length} repo main(s) to origin: ${pushed.join(', ') || 'none'}.`);
}

const resolved = ledger.filter((l) => l.status === 'resolved');
const spent = resolved.reduce((s, l) => s + (Number(l.cost) || 0), 0);
const reposProvisioned = Object.keys(lanePools).filter((r) => (lanePools[r] || []).length > 0);
log(`Parallel batch (clone model, cross-repo) landed: ${resolved.length}/${ledger.length} resolved, ${stranded.length} stranded, ${partialCrossRepo.length} cross-repo partial, ${conflictsReplayed} item(s) replayed/failed-to-land, ${reopened.length} unlanded item(s) reopened→open, ${multiLaneFiles.length} multi-item file(s), ${spent}/${budgetPoints} points. The result is ALREADY on each repo's main — the main agent does NOT do a landing merge; it reports the ledger and surfaces multiLaneFiles / stranded / partialCrossRepo.`);

return {
  // The clone integrator already landed every lane on each repo's main — there is no integration branch for
  // the main agent to merge. Lane work was durable on each origin (lane/* refs) until each merge landed.
  baseRef,
  ledger,
  concurrentItems: concurrent.length,
  serialItems: serialItems.length,
  crossRepoItems: crossRepoCount,        // items spanning >1 constellation repo (slice 4)
  conflictsReplayed,
  stranded,                              // #1869 defect 2: resolves that did NOT land on WE main — reclassified, never counted resolved
  multiLaneFiles,                        // files (repo-qualified) touched by >1 item — the close-skill audit surfaces these
  partialCrossRepo,                      // slice 4: cross-repo items whose impl landed in some repos but whose WE resolve did NOT — re-attempt next run
  reopened,                              // #2072: unlanded items this run flipped active→open at closeout (else they'd hide as active-but-unclaimed) — re-enter the next pack
  reposProvisioned,                      // which constellation repos got a lane pool this batch
  pushed,                                // #2073: constellation repos whose main was ff-published to origin at close (gated pushIfGreen)
  derivedRegenerated,
  probeFailures,                         // #2040 watchdog: items whose probe died (→ forced serial); a mass die aborts earlier as aborted:'probe-storm'
  pointsSpent: spent,
  budgetPoints,
};
