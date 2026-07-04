export const meta = {
  name: 'batch-parallel-execute',
  description: 'Execute a /workflow (parallel) batch on the #2183 PR-fan-out model: a light probe detects the constellation repos each item spans → provision a lane pool per affected repo (+ create the ready-to-merge label once) → work each item as its OWN agent in its coupled lane CLONE (claim-in-lane, work, resolve, write .lane-manifest.json, commit, push lane/<n> per repo), then OPEN A READY-TO-MERGE PR per pushed ref (pr-land --label-on-green: wait for required checks, label only when green — #2199). The producer makes ZERO commits to main, never integrates inline, and never launches or waits on the drain — it completes when every item is an open ready-to-merge PR. A separate, optional drain lands them later in blockedBy order. Per-item progress. Returns a ledger.',
  whenToUse: 'Invoked by the batch-backlog-items skill ONLY for /workflow (or --parallel), after the main loop has done the conversational pack/plan/one-"go". Not for the default serial /batch.',
  phases: [
    { title: 'Probe', detail: 'light: detect the non-WE constellation repos each item spans (for pool provisioning + per-repo PRs)' },
    { title: 'Provision', detail: 'provision a lane pool PER affected repo + ensure the ready-to-merge label exists (NO pre-claim, NO base ref, NO commit to main)' },
    { title: 'Lanes', detail: 'one agent per item in its coupled clone: claim-in-lane → work → resolve → manifest → push lane/<n> per repo → open a ready-to-merge PR per ref' },
    { title: 'Finalize', detail: 'record a local (uncommitted) ready-to-merge signal per PR’d item so the same checkout does not re-offer it; NO integrate, NO drain launch' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// /workflow (parallel) execute phase — the #2183 PR-FAN-OUT orchestrator (spin-off #2189).
//
// SUPERSEDES the #1933 disjoint-partition + inline-integrate model (F2 = DROP, ratified 2026-07-03). Under
// #2183 EVERY edit lands via a ready-to-merge PR and the drain is a fully independent optional lander the
// producer never launches or waits on. Consequences vs the old orchestrator:
//   • NO probe→partition. There is no concurrent-vs-serial split, no confidence/monolith/merge-risk predicate,
//     no serial lane, and no write-time file-lock layer (#1945/#1936). With PR-per-item + a drain that
//     serialises with rebase-retry, "git is the arbiter" is complete: two PRs touching one file just cost the
//     drain a rebase, never a silent bad merge. Every packed item runs in its OWN lane, concurrently.
//   • NO central pre-claim commit to main, NO lane/_base ref. Each lane resets its clone to origin/main and
//     CLAIMS ITS OWN item there; the claim + resolve ride the item's PR. An item that fails in-lane is never
//     left `active` on main, so the #2072 "reopen unlanded" reconcile is unnecessary here.
//   • NO inline integrate (the old Phase 4b–4h: merge, rebase-retry, id-heal, derived-regen, reconcile,
//     reopen, publish). All landing moves to the drain (we:scripts/lane-drain.mjs), which already does the
//     id-collision heal (via we:scripts/pr-land.mjs #2071), derived regen (#2173) and reopen-on-fail (#2175).
//   • The PRODUCER'S SUCCESS CONTRACT: every completed item is an OPEN READY-TO-MERGE PR; ZERO commits to
//     main; correct with NO drain running. The PRs sit until some drain (`/drain`, `/merge`, or CI auto-merge)
//     lands them, after which local main pulls.
//
// A LIGHT probe is retained ONLY to detect the non-WE constellation repos (#96 — frontierui, plateau-app) an
// item's impl spans, so the right lane pools are provisioned and a PR is opened per repo. A cross-repo item
// becomes ONE PR per repo; the WE PR carries the item's `.lane-manifest.json` (#2163) so the drain lands the
// couple impl-first/WE-last in cross-item blockedBy order.
//
// THE READY-TO-MERGE SIGNAL (#2183 F1 = a PR LABEL). Each opened PR is labelled `ready-to-merge` (created once
// in Provision). This is the forward signal the drain↔/merge convergence (#2188) will discover by. As an
// interim so the EXISTING drain works today, Finalize also writes a LOCAL (uncommitted) `queued.json` entry
// per PR'd item via `backlog.mjs queue` — it lets `we:scripts/lane-drain.mjs` land the couples now (it reads
// the manifest off the pushed lane ref) AND gives readiness/claim an offline "don't re-offer" signal (Rule
// #105) WITHOUT committing anything to main.
//
// This script runs in the Workflow JS sandbox: no fs, no child_process, no Date/Math.random. ALL side effects
// (git, lane-pool.mjs, backlog.mjs, pr-land.mjs, gh, npm gates) happen INSIDE agents via Bash; the script only
// does control flow.
//
// NEW-ITEM PUBLISH (#2215). Lanes claim items that exist on origin/main, so a batch of items that DON'T exist
// yet must reach main first. The old setup did that as a `backlog.mjs scaffold` in the PRIMARY + a direct
// `git push` to main — the exact #2203 primary-write the strict lock now forbids. Fixed by SCAFFOLD-IN-LANE:
// an item may carry a `seed` ({ kind, size, title, digest, blockedBy?, parent? }); its lane scaffolds it in its
// OWN clone (`backlog.mjs scaffold --session`, born active+owned), works it, and it rides that lane's PR — no
// pre-publish to main at all. Cross-lane NNN collisions are healed at land by pr-land (#2071/#2213). An item
// WITHOUT a seed is an existing backlog item, claimed-in-lane as before. (Alternative not taken: a gated
// pre-publish PR that lands before dispatch — one extra PR-cycle of latency; the in-lane seed avoids it.)
//
// args (passed by the main loop after the conversational pack/plan/"go"):
//   { batchSlug, budgetPoints, primaryRoot,
//     items: [ { num, slug, file, locus, cost, declaredFiles, blockedBy,
//                seed? /* #2215: {kind,size,title,digest?,blockedBy?,parent?} → this is a NEW item scaffolded
//                         in-lane; num/file are absent until the lane allocates them */ } … ],
//     laneModel? }  — laneModel (e.g. 'sonnet') downgrades ONLY the per-item lane work agents; the probe and
//   the report steps stay on the inherited model. Omit → all agents inherit the session model. (deferredDrain
//   from #2174 is GONE — under #2183 defer-and-decouple is the ONLY mode; there is no inline fallback.)
// Returns: { ledger, itemsWorked, prsOpened, queued, crossRepoItems, reposProvisioned, pointsSpent,
//            budgetPoints, prUrls }
//   No integration branch, no landed state — the result is a set of OPEN ready-to-merge PRs the drain lands.
// ─────────────────────────────────────────────────────────────────────────────

// `args` may arrive as a parsed object OR as a JSON string (the Workflow runtime serializes it in some
// environments). Tolerate both so `items` is never empty.
const a = (typeof args === 'string' ? (() => { try { return JSON.parse(args); } catch { return {}; } })() : (args || {}));
const items = Array.isArray(a.items) ? a.items : [];
const batchSlug = a.batchSlug || 'batch-parallel';
const budgetPoints = Number.isFinite(a.budgetPoints) ? a.budgetPoints : Infinity;
// LANE EXECUTION MODEL POLICY (user directive 2026-07-03): lane work is NEVER on Fable. Default Sonnet — it
// handles the vast majority of batchable items; the orchestrator escalates a lane to Opus ONLY when the probe
// flagged that item `complex` (rare). An explicit laneModel arg overrides the DEFAULT tier (Sonnet) but is
// force-floored off Fable; per-item Opus escalation still applies. Quality stays protected regardless: a bad PR
// is caught by the required `test` check (the drain never merges red) — the cheap model never has the final
// say. A model is ALWAYS passed, so a lane never inherits a Fable session model.
const laneModelOverride = (typeof a.laneModel === 'string' && a.laneModel && !/fable/i.test(a.laneModel)) ? a.laneModel : undefined;
const laneModelFor = (it) => (it && it.complex) ? 'opus' : (laneModelOverride || 'sonnet');
// The PRIMARY WE checkout's absolute path (the sandbox has no `process`; the main loop passes its cwd). The
// Finalize step's don't-re-offer `queued.json` write runs here. Fallback to '.' keeps a degenerate run alive.
const PRIMARY_ROOT = a.primaryRoot || '.';

// The ready-to-merge PR label (#2183 F1) — created once in Provision, applied to every opened PR.
const READY_LABEL = 'ready-to-merge';

// ── The constellation (#96) — cross-repo registry ─────────────────────────────
// `we` is implicit for every item (its backlog/<NNN>.md lives here) and is the primary checkout. Non-WE repos
// are coupled clones an item works when its impl spans them. INTEGRATION_ORDER puts WE LAST (the drain lands
// impl-first/WE-last so WE's resolve is the last write — the cross-repo atomicity guarantee it enforces).
const REPOS = {
  we: { name: 'webeverything', path: null /* primary checkout = the agents' cwd */, gate: 'npm run check:standards', primary: true },
  frontierui: { name: 'frontierui', path: '~/workspace/frontierui', gate: 'npm run check:standards' },
  'plateau-app': { name: 'plateau-app', path: '~/workspace/plateau-app', gate: 'npm run build' },
};
const INTEGRATION_ORDER = ['frontierui', 'plateau-app', 'we']; // impl repos first, WE last (carries the resolve)

// ── Subagent return-hygiene contract (#1861) ──────────────────────────────────
// Prepended to every spawned-agent prompt. Keeps returns as CONCLUSIONS, not transcripts, and kills the
// confidently-invented-specifics failure. Canonical prose: we:docs/agent/backlog-workflow.md.
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

// The LIGHT probe (#2183): the ONLY thing predicted is which NON-WE constellation repos the item's impl spans,
// so the orchestrator provisions the right lane pools and opens a PR per repo. No touch-set / confidence /
// monolith prediction — there is no partition to feed. Most items are WE-only (extraRepos empty).
const PROBE_SCHEMA = {
  type: 'object',
  required: ['num', 'extraRepos'],
  additionalProperties: false,
  properties: {
    num: { type: 'string', description: 'the backlog NNN this probe is for' },
    extraRepos: {
      type: 'array',
      items: { type: 'string', enum: ['frontierui', 'plateau-app'] },
      description: 'the NON-WE constellation repos this item\'s impl spans (#96). The backlog item always lives in WE, so WE is implicit — list here only the non-WE repos the body clearly reaches into. Empty for a WE-only item (the common case).',
    },
    complex: {
      type: 'boolean',
      description: 'the lane-model escalation verdict. DEFAULT false — the lane runs on Sonnet, which handles the vast majority of batchable items. Return true ONLY for a genuinely hard item (subtle cross-cutting design, dense algorithmic/protocol reasoning, or a large multi-file refactor where a cheaper model would plausibly ship a wrong-but-plausible edit) → that lane escalates to Opus. RARE; when in doubt, false. Never selects Fable — lane execution is Sonnet-or-Opus only.',
    },
    notes: { type: 'string' },
  },
};

// What each ITEM lane agent returns. CLONE model: the lane reports the `lane/*` ref it pushed AND the PR it
// opened in EACH affected repo. A WE-only item reports one repo; a cross-repo item reports one per repo.
const ITEM_RESULT_SCHEMA = {
  type: 'object',
  required: ['num', 'status', 'gate'],
  additionalProperties: false,
  properties: {
    num: { type: 'string' },
    status: { type: 'string', enum: ['pr-open', 'carried', 'dropped'] },
    cost: { type: 'number' },
    drop: { type: 'string', description: 'drop-reason if no PR opened (taken/blocked-in-fact/not-batchable/outgrew/gate-red)' },
    prs: {
      type: 'array',
      items: {
        type: 'object', required: ['repo', 'ref'], additionalProperties: true,
        properties: {
          repo: { type: 'string', description: 'we | frontierui | plateau-app' },
          ref: { type: 'string', description: 'the lane/<slug>-<NNN> ref this repo\'s PR head points at' },
          pr: { type: 'number', description: 'the opened PR number in THAT repo' },
          url: { type: 'string', description: 'the PR url' },
          labelled: { type: 'boolean', description: 'true if the ready-to-merge label was applied' },
        },
      },
      description: 'one entry per repo this item opened a ready-to-merge PR in (we + any frontierui/plateau-app). For a WE-only item this is just the we entry. The we entry\'s ref is the one whose commit carries the .lane-manifest.json the drain reads.',
    },
    resolveCommit: { type: 'string', description: 'the full SHA of the WE commit that resolved this item (git rev-parse HEAD in the WE clone after the resolve+manifest commit).' },
    changedFiles: {
      type: 'array', items: { type: 'string' },
      description: 'EVERY file this item changed, REPO-QUALIFIED as "<repo>:<repo-relative-path>" (e.g. "we:backlog/2189.md", "frontierui:src/foo.ts").',
    },
    gate: { type: 'string', enum: ['green', 'red'], description: 'the WE lane FULL-suite result (#2199: check:standards whole-repo + npm test, run before push — not the file-scoped fast-fail). green = clean (or n/a); red = a real error the lane could not fix → NO PR opened.' },
    dismissedFindings: {
      type: 'array',
      items: {
        type: 'object', required: ['finding', 'reason'], additionalProperties: true,
        properties: {
          finding: { type: 'string' },
          reason: { type: 'string' },
          severity: { type: 'string' },
          location: { type: 'string' },
        },
      },
      description: 'the #2170 pre-PR independent-review findings this lane REVIEWED and DISMISSED (fixed the rest in-lane) — recorded in the PR body as the audit trail. Empty = a clean review or all findings fixed.',
    },
    notes: { type: 'string' },
  },
};

// ── Helpers (pure) ─────────────────────────────────────────────────────────────
// Repos an item touches, ordered impl-first / WE-last. WE is always present (the backlog item lives there).
function affectedReposOf(entry) {
  const repos = new Set(['we']);
  const xr = entry && Array.isArray(entry.extraRepos) ? entry.extraRepos : [];
  for (const r of xr) if (REPOS[r]) repos.add(r);
  return INTEGRATION_ORDER.filter((r) => repos.has(r));
}
function isCrossRepo(entry) {
  return affectedReposOf(entry).some((r) => r !== 'we');
}
// A stable, num-independent key for an item's lane ref. An EXISTING item keys by its NNN; a NEW (seeded) item
// has no NNN until its lane scaffolds it in-lane (#2215), so it keys by `new-<slug>` — deterministic and
// collision-free across a batch (slugs are unique in a pack), and independent of which NNN the scaffold lands.
function laneKeyOf(it) {
  return it && it.seed ? `new-${it.slug}` : String(it.num);
}
// The lane/* ref an item pushes — namespaced under lane/ (the #1934 guard carve-out) and scoped by slug/num so
// concurrent batches never collide. The SAME name is used in each affected repo's own origin.
function laneRefFor(it) {
  return `lane/${batchSlug}-${laneKeyOf(it)}`;
}
// Per-repo lane assignment: for each repo, the items touching it form an ordered list; an item's lane index in
// that repo = its position. So we provision exactly as many lanes per repo as items touch it, and item↔lane is
// deterministic without threading state.
function repoLanePlan(workItems) {
  const plan = {}; // repo -> [item, …] in stable order
  for (const it of workItems) {
    for (const repo of affectedReposOf(it)) {
      (plan[repo] || (plan[repo] = [])).push(it);
    }
  }
  return plan;
}
function laneIndexOf(plan, it, repo) {
  return (plan[repo] || []).indexOf(it);
}

if (items.length === 0) {
  log('No packed items passed — nothing to execute.');
  return { ledger: [], itemsWorked: 0, prsOpened: 0, queued: [], crossRepoItems: 0, reposProvisioned: [], pointsSpent: 0, budgetPoints, prUrls: [] };
}

// ── Phase 1 — Probe each item's constellation footprint (parallel, light) ──────
phase('Probe');
log(`Probing ${items.length} packed item(s) for the constellation repos they span (light — no partition)…`);

let probedCount = 0;
const probedRaw = await parallel(items.map((it) => () =>
  agent(
    [
      RETURN_HYGIENE,
      ``,
      it.seed
        ? `You are scoping a NEW backlog item to be scaffolded ("${it.slug}") for a PARALLEL batch. It has no file yet — scope it from its seed: ${JSON.stringify({ kind: it.seed.kind, title: it.seed.title || it.slug, digest: it.seed.digest })}.`
        : `You are scoping backlog item #${it.num} ("${it.slug}") for a PARALLEL batch. Read we:backlog/${it.file} and any files it references.`,
      `Report ONLY which NON-WE constellation repos (#96) this item's impl SPANS:`,
      `frontierui and/or plateau-app. The backlog item + its resolve ALWAYS live in WE, so WE is implicit and`,
      `you do NOT list it. Most items are WE-only → return an empty extraRepos. List a non-WE repo ONLY when the`,
      `body clearly reaches into it (e.g. a standard authored in WE but implemented in frontierui, or surfaced`,
      `in plateau-app). You do NOT need to predict files — the lane computes its own touch-set.`,
      `ALSO set \`complex\`: default false (the lane runs on Sonnet). Return true ONLY for a genuinely hard item`,
      `(subtle cross-cutting design, dense algorithmic/protocol reasoning, or a large multi-file refactor where a`,
      `cheaper model would plausibly ship a wrong-but-plausible edit) → that lane escalates to Opus. Rare; when in`,
      `doubt, false. Return ONLY the structured object { num, extraRepos, complex }.`,
    ].join(' '),
    { label: `probe:${it.num}`, phase: 'Probe', schema: PROBE_SCHEMA, effort: 'low' },
  ).then((p) => {
    probedCount++;
    const xr = p && Array.isArray(p.extraRepos) ? p.extraRepos.filter((r) => REPOS[r]) : [];
    log(`  probe ${probedCount}/${items.length}: #${it.num} — ${xr.length ? 'spans ' + xr.join('+') : 'WE-only'}`);
    return { ...it, extraRepos: xr, complex: !!(p && p.complex), probeOk: true };
  }).catch(() => {
    probedCount++;
    // A failed probe defaults to WE-only (the safe common case) — the item still runs; a genuinely cross-repo
    // item that mis-probes WE-only just fails its impl push and is carried (recoverable), never a bad merge.
    log(`  probe ${probedCount}/${items.length}: #${it.num} — probe FAILED → treat as WE-only`);
    return { ...it, extraRepos: [], complex: false, probeOk: false };
  }),
));

const workItems = probedRaw.filter(Boolean);
// CIRCUIT-BREAKER (#2040): a probe that dies is harmless here (WE-only default). But if a LARGE fraction die at
// once, that is a systemic API outage — bail BEFORE provisioning (nothing is mutated) so trouble rides the
// completion wake in seconds. The floor is unchanged: re-run when the API recovers, or use serial /batch.
const probeFailures = workItems.filter((e) => e.probeOk === false).map((e) => String(e.num));
const failFrac = workItems.length ? probeFailures.length / workItems.length : 0;
if (workItems.length >= 4 && failFrac >= 0.5) {
  log(`⚠ CIRCUIT-BREAKER: ${probeFailures.length}/${workItems.length} probes died (#${probeFailures.join(', #')}) — a systemic API failure, not per-item noise. Aborting BEFORE any provision/claim (nothing was mutated); re-run when the API recovers, or use serial /batch.`);
  return { ledger: [], itemsWorked: 0, prsOpened: 0, queued: [], crossRepoItems: 0, reposProvisioned: [], pointsSpent: 0, budgetPoints, prUrls: [], probeFailures, aborted: 'probe-storm' };
}
const crossRepoCount = workItems.filter(isCrossRepo).length;
log(`Probed ${workItems.length} item(s); ${crossRepoCount} span >1 repo. Every item runs in its OWN lane → its OWN ready-to-merge PR (no partition, no serial lane).`);

// ── Phase 2 — Provision a lane pool PER affected repo + ensure the ready-to-merge label ──
// NO pre-claim, NO base ref, NO commit to main (the #2183 core simplification). This step only provisions the
// persistent lane pools the lanes reset into, and creates the ready-to-merge label once so the lanes can apply it.
phase('Provision');

const lanePlan = repoLanePlan(workItems);
const provisionPlan = INTEGRATION_ORDER
  .filter((repo) => (lanePlan[repo] || []).length > 0)
  .map((repo) => ({ repo, name: REPOS[repo].name, path: REPOS[repo].path, count: lanePlan[repo].length }));
let lanePools = {}; // repo -> [absolute lane dir, …] (index-aligned to lanePlan[repo])

const setup = await agent(
  [
    RETURN_HYGIENE,
    ``,
    `You are the PROVISION step of a #2183 PR-fan-out parallel batch (slug ${batchSlug}), running in the PRIMARY`,
    `WE checkout on branch main. Do EXACTLY this — and make ZERO commits to main, claim NOTHING, push NO refs:`,
    ``,
    `1. ENSURE the ready-to-merge PR label exists (idempotent): \`gh label create ${READY_LABEL} --color 0E8A16`,
    `   --description "Producer-complete; a drain may land this PR" --force\`. (--force upserts; ignore "already`,
    `   exists".) If gh is unavailable, report labelReady:false and continue — the lanes will still open PRs.`,
    ``,
    `2. PROVISION a lane pool PER affected repo. we:scripts/lane-pool.mjs is repo-parameterized — run it from`,
    `   THIS WE checkout, passing --repo for non-WE repos. For each entry below run`,
    `   \`node scripts/lane-pool.mjs provision --count=<count> [--repo=<path>]\` (omit --repo for WE) then`,
    `   \`node scripts/lane-pool.mjs list --json [--repo=<path>]\`. Pools are PERSISTENT — a re-run reuses`,
    `   existing clones. Provision plan (JSON): ${JSON.stringify(provisionPlan)}.`,
    ``,
    `Report labelReady (boolean) and lanePools — an OBJECT keyed by repo ("we"/"frontierui"/"plateau-app")`,
    `whose value is the ORDERED array of that repo's absolute lane-clone dirs (lane-1, lane-2, … as listed).`,
    `Return ONLY the object.`,
  ].join(' '),
  {
    label: 'setup:provision+label', phase: 'Provision',
    schema: {
      type: 'object', required: ['lanePools'], additionalProperties: true,
      properties: {
        labelReady: { type: 'boolean' },
        lanePools: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } },
        notes: { type: 'string' },
      },
    },
  },
).catch(() => null);

if (!setup || !setup.lanePools || typeof setup.lanePools !== 'object') {
  log(`⚠ provision FAILED — cannot dispatch lanes (no lane pools). Aborting the parallel run; fall back to a serial /batch. (Nothing was claimed, pushed, or committed.)`);
  return { ledger: [], itemsWorked: 0, prsOpened: 0, queued: [], crossRepoItems: crossRepoCount, reposProvisioned: [], pointsSpent: 0, budgetPoints, prUrls: [], aborted: 'provision-failed' };
}
lanePools = setup.lanePools;
const labelReady = setup.labelReady !== false;
const poolSummary = Object.keys(lanePools).map((r) => `${r}:${(lanePools[r] || []).length}`).join(', ') || 'none';
log(`Provisioned lane pools — ${poolSummary}. ready-to-merge label ${labelReady ? 'ready' : 'NOT created (lanes will still open PRs, unlabelled)'}.`);

// ── Phase 3 — Work each item in its coupled clone → open a ready-to-merge PR ────
phase('Lanes');

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
  const ref = laneRefFor(it);
  const repos = affectedReposOf(it); // impl-first, WE last
  const weDir = laneDirs.we || '';
  const implRepos = repos.filter((r) => r !== 'we');
  const reposManifest = repos.map((r) => ({ repo: r, ref, carriesResolve: r === 'we' }));
  const seed = it.seed || null; // #2215 — a NEW item scaffolded IN-LANE (no NNN yet), vs an existing claimed item.
  // The token used to name the item in every step below: an existing item's NNN, or the literal placeholder
  // `NUM` for a seeded new item — the lane reads the id the in-lane scaffold allocated and substitutes the
  // real number for NUM in each command (NOT a shell variable — shell state does not survive across the lane's
  // separate Bash calls, so a `$NUM` capture would be empty by step 5).
  const N = seed ? 'NUM' : String(it.num);
  const lines = [
    RETURN_HYGIENE,
    ``,
    `You are PARALLEL batch item ${seed ? `"${it.slug}" (a NEW item you will SCAFFOLD in-lane — it has no NNN yet)` : `#${it.num} ("${it.slug}")`} running in your OWN persistent lane CLONES (each has`,
    `its own HEAD — the git-branch/lane guard never fires on it). This item spans these repos: ${repos.join(', ')}.`,
    `Lane clones: ${JSON.stringify(laneDirs)}. Do EXACTLY this, in order. The PRODUCER CONTRACT (#2183): you`,
    `open a READY-TO-MERGE PR per repo and STOP — you NEVER merge, NEVER push main, NEVER commit to main, and`,
    `NEVER launch a drain. The only pushes you make are to lane/* refs (the #1934 carve-out).`,
    ``,
    `1. PREP each clone — reset to its own origin/main (NOT a base ref; there is no central pre-claim now):`,
    `   • WE clone (${weDir}): \`cd ${weDir} && git fetch origin --prune --quiet && git reset --hard`,
    `     origin/main --quiet && git clean -fd --quiet\`.`,
  ];
  for (const r of implRepos) {
    lines.push(`   • ${r} clone (${laneDirs[r]}): \`cd ${laneDirs[r]} && git fetch origin --prune --quiet && git reset --hard origin/main --quiet && git clean -fd --quiet\`.`);
  }
  lines.push(
    `   Ensure deps in each clone (the pool installed them; if node_modules is missing run \`npm ci\` there).`,
    ``,
    seed
      // #2215 (preferred fix) — SCAFFOLD-IN-LANE: a new item is born in THIS lane and rides THIS lane's PR, so
      // it never needs a direct scaffold+push to main (the #2203 primary-write the strict lock forbids). Two
      // lanes may allocate the same NNN off origin/main; the pr-land id-collision heal (#2071/#2213) yields the
      // later-landing one at land — never a pre-publish barrier.
      ? [
          `2. SCAFFOLD-IN-LANE (#2215 — the new item is BORN in this lane and rides its PR; it is NEVER scaffolded`,
          `   on main, so no direct push to main is ever needed). In the WE clone run:`,
          `   \`node scripts/backlog.mjs scaffold --kind=${seed.kind} --size=${seed.size ?? ''} --title=${JSON.stringify(seed.title || it.slug)}${seed.digest ? ` --digest=${JSON.stringify(seed.digest)}` : ''}${seed.blockedBy && seed.blockedBy.length ? ` --blocked-by=${seed.blockedBy.join(',')}` : ''}${seed.parent ? ` --parent=${seed.parent}` : ''} --session=${batchSlug} --json\``,
          `   — \`--session\` makes it born active+owned (#670), so the claim already rode with the scaffold. The`,
          `   command prints \`{ "num": <id>, "file": "<NNN>-<slug>.md", … }\`. READ the allocated id and, in EVERY`,
          `   command below, SUBSTITUTE that real number wherever these steps write NUM (do NOT use a shell`,
          `   variable — the lane's Bash calls don't share state). Two lanes can allocate the same NNN off`,
          `   origin/main; that is EXPECTED — the pr-land id-collision heal (#2071/#2213) yields the later-landing`,
          `   one at land. If the scaffold FAILED, STOP: report status:"dropped" drop:"scaffold-failed", open NO PR.`,
        ].join('\n')
      : [
          `2. CLAIM-IN-LANE (#2183 — the claim rides the PR, it is NOT pre-committed to main). In the WE clone run`,
          `   \`node scripts/backlog.mjs claim ${it.num} --session=${batchSlug}\` (open→active + dateStarted). If it`,
          `   ERRORS because #${it.num} is already active/queued (another session owns it), STOP: report`,
          `   status:"carried" drop:"taken", open NO PR. Do NOT --force.`,
        ].join('\n'),
    ``,
    `3. WORK the item across its repos — the full single-item arc MINUS the ${seed ? 'scaffold' : 'claim'} (just done). Edit ONLY this`,
    `   item's own files in each clone: its WE impl/code + ${seed ? `its own new backlog file (the scaffold created \`backlog/$NUM-*.md\`)` : `its own we:backlog/${it.file}`} in the WE clone, and`,
    `   its own impl files in ${implRepos.length ? implRepos.join('/') : '(no other repos)'}. Per-entry registry`,
    `   files (src/_data/<reg>/<id>.json) are your own; do NOT splice a monolithic shared registry — if the item`,
    `   genuinely needs that, STOP, report status:"dropped" drop:"outgrew".`,
    ``,
    `4. LANE FULL-SUITE GATE (#2199 — run every check the PR runs, BEFORE pushing). In the WE clone run the FULL`,
    `   locally-runnable suite — \`npm run check:standards\` (whole-repo, NOT the \`--local --files\` fast-fail) AND`,
    `   \`npm test\` (the unit suite the PR's required \`test\` check runs) — BEFORE the resolve/push. A red result`,
    `   is a bug YOU authored: FIX it in THIS lane now (cheapest — full context in hand); NEVER push known-broken`,
    `   work. Only if it is genuinely un-fixable here → gate:"red", status:"carried", open NO PR. Impl repos run`,
    `   their own repo's gate in their clone; their final authority is the PR's own required \`test\` check on GitHub.`,
    ``,
    `5. RESOLVE (only after the WE fast-fail is green). In the WE clone: \`node scripts/backlog.mjs resolve`,
    `   ${N} [--graduated-to=…] [--codified-to=…]\` (a kind:decision resolve REQUIRES --codified-to, #911).`,
    `   Then COMMIT each repo's own files (git add <explicit paths>; NEVER -A; NEVER stage another item's files).`,
    `   Commit message per repo: \`backlog: resolve #${N} — ${it.slug}\`.`,
    ``,
    `6. WRITE THE MANIFEST (the drain reads it to land the couple in order). In the WE clone, AFTER the resolve`,
    `   commit: \`node scripts/lane-manifest-write.mjs --item=${N} --repos='${JSON.stringify(reposManifest)}'${it.blockedBy && it.blockedBy.length ? ` --blocked-by=${it.blockedBy.join(',')}` : ''} --batch-slug=${batchSlug}\``,
    `   then \`git add .lane-manifest.json && git commit --amend --no-edit\` (ONE commit carries work + resolve +`,
    `   manifest — a one-sided ADD keeps the WE-lane merge conflict-free). Only the WE clone writes the manifest.`,
    ``,
    `7. PRE-PR INDEPENDENT REVIEW (#2170) — in the WE clone, AFTER the manifest commit, BEFORE the PR. Get your`,
    `   lane diff (\`node scripts/lane-review.mjs diff --base=origin/main\`) and SPAWN AN INDEPENDENT REVIEW`,
    `   SUBAGENT over it (the Task tool, the /code-review model) — hand it ONLY the diff. FIX every accepted`,
    `   finding IN THIS LANE now (re-run the scoped fast-fail, then \`git commit --amend --no-edit\` onto the`,
    `   resolve commit). Findings you DISMISS go in dismissedFindings (finding + one-line reason [+ severity/`,
    `   location]); NEVER drop one silently — they become the PR body audit trail.`,
    `   • #2171 — if you DISMISSED any finding, re-stamp the manifest with the count so the drain's escalation`,
    `     rubric sees its strongest signal: \`node scripts/lane-manifest-write.mjs --item=${N} --repos='${JSON.stringify(reposManifest)}'${it.blockedBy && it.blockedBy.length ? ` --blocked-by=${it.blockedBy.join(',')}` : ''} --batch-slug=${batchSlug} --dismissed=<count>\``,
    `     then \`git add .lane-manifest.json && git commit --amend --no-edit\` (fold into the same one commit).`,
    ``,
    `8. OPEN A READY-TO-MERGE PR PER REPO (#2199 — labelled ONLY when green). For EACH repo in ${JSON.stringify(repos)}`,
    `   (impl first, WE last), run pr-land in \`--label-on-green\` mode: it opens a self-approved PR, WAITS for the`,
    `   required checks, and applies the ready-to-merge label ONLY once they pass — it does NOT merge (the drain`,
    `   lands it). This makes ready-to-merge mean "every required check is green", not "a local lint passed"; a`,
    `   PR whose CI ends up red is thus never labelled (the lane already fixed it in step 4, so this is a backstop).`,
    `   Compose the PR body from your dismissed findings first: \`node scripts/lane-review.mjs body`,
    `   --base=origin/main > /tmp/pr-body-${laneKeyOf(it)}.md\` (best-effort; if it fails, skip --body-file).`,
    `   • WE PR (run from ${weDir}): \`node scripts/pr-land.mjs --ref=${ref} --label-on-green --body-file=/tmp/pr-body-${laneKeyOf(it)}.md --json\``,
    `     (publishes your HEAD → the lane ref, opens the PR, waits for required checks, labels when green — no merge).`,
    `     Parse the PR number (\`pr\`) and \`labelApplied\` from its JSON. reason:"labelled-on-green" = labelled OK;`,
    `     reason:"check-red"/"check-timeout" = PR open but UNLABELLED (carried for labelling — the lane's CI wasn't green).`,
  );
  for (const r of implRepos) {
    lines.push(`   • ${r} PR (from ${laneDirs[r]}): \`node scripts/pr-land.mjs --repo=${laneDirs[r]} --ref=${ref} --label-on-green --json\` (from the WE clone, or cd into ${laneDirs[r]}). Parse \`pr\` + \`labelApplied\`.`);
  }
  lines.push(
    labelReady
      ? `   • pr-land applies the ${READY_LABEL} label itself once required checks are green — set labelled = its JSON \`labelApplied\`. Do NOT label by hand before green.`
      : `   • (the ${READY_LABEL} label was not created — pr-land's apply is best-effort; report labelled:false if it could not.)`,
    `   If a repo's pr-land FAILS (push/gh error), report that repo WITHOUT a pr number (the item is carried for`,
    `   that repo; the others may still have opened). A WE PR that fails to open ⇒ status:"carried".`,
    ``,
    `Report: num (${seed ? 'the NNN the in-lane scaffold ALLOCATED — the real number, not the placeholder' : `${it.num}`}), status ("pr-open" if the WE PR opened, else`,
    `"carried"/"dropped"), cost, prs (one {repo, ref, pr, url, labelled} per repo you opened a PR in),`,
    `resolveCommit (git rev-parse HEAD in the WE clone after the manifest commit), changedFiles (REPO-QUALIFIED`,
    `"<repo>:<path>"), dismissedFindings, gate (green/red). Return ONLY the structured object.`,
  );
  return lines.join('\n');
}

log(`Working ${workItems.length} item(s) concurrently — each opens its own ready-to-merge PR the instant it lands…`);
{
  const esc = workItems.filter((it) => it.complex).map((it) => `#${it.num}`);
  log(`  lane execution: Sonnet default${laneModelOverride ? ` (override '${laneModelOverride}')` : ''}, Opus for ${esc.length ? esc.length + ' complex item(s): ' + esc.join(', ') : 'none flagged complex'}; NEVER Fable. The PR's required \`test\` check is the quality floor — the drain never merges a red PR.`);
}

let itemsDone = 0;
const results = await parallel(workItems.map((it) => () => {
  const laneDirs = laneDirsForItem(it);
  // A seeded new item has no NNN until it scaffolds in-lane (#2215) — display by its lane key (`new-<slug>`).
  const disp = it.seed ? laneKeyOf(it) : `#${it.num}`;
  if (!laneDirs.we) {
    itemsDone++;
    log(`  ✗ ${disp} (${itemsDone}/${workItems.length}): no WE lane clone available → skipped [${it.slug}]`);
    return Promise.resolve(null);
  }
  return agent(laneItemPrompt(it, laneDirs), { label: `lane:${disp}`, phase: 'Lanes', schema: ITEM_RESULT_SCHEMA, model: laneModelFor(it) })
    .then((r) => {
      itemsDone++;
      const prN = r && Array.isArray(r.prs) ? r.prs.filter((p) => p && p.pr).length : 0;
      log(`  ${r && r.status === 'pr-open' && prN > 0 ? '✓' : '~'} ${r && r.num ? '#' + r.num : disp} (${itemsDone}/${workItems.length}): ${r ? r.status + ', gate ' + r.gate + (prN ? `, ${prN} PR(s) opened` : ', no PR') : 'no result'} [${it.slug}]`);
      return r ? { ...r, num: r.num || (it.seed ? undefined : String(it.num)), _item: it } : null;
    })
    .catch(() => { itemsDone++; log(`  ✗ ${disp} (${itemsDone}/${workItems.length}) died → carried [${it.slug}]`); return null; });
}));

// ── Phase 4 — Finalize: build the ledger + write the local don't-re-offer signal (NO integrate, NO drain) ──
phase('Finalize');

const ledger = [];
const prUrls = [];
const toQueue = []; // { num, weRef } — items with an open WE PR (get a local queued.json entry so the same
                    // checkout won't re-offer them AND the existing drain can land them)
for (let i = 0; i < results.length; i++) {
  const cr = results[i];
  const it = workItems[i];
  // A seeded item's real NNN is only known from the lane result; fall back to its lane key when it carried/died.
  const num = String((cr && cr.num) || it.num || laneKeyOf(it));
  const laneLabel = it.seed ? laneKeyOf(it) : `#${it.num}`;
  const prs = cr && Array.isArray(cr.prs) ? cr.prs.filter((p) => p && p.repo && p.ref) : [];
  const wePr = prs.find((p) => p.repo === 'we' && p.pr);
  for (const p of prs) if (p.url) prUrls.push(p.url);
  if (cr && cr.status === 'pr-open' && wePr) {
    toQueue.push({ num, weRef: wePr.ref });
    ledger.push({ num, status: 'pr-open', cost: cr.cost, lane: laneLabel, repos: prs.map((p) => p.repo), prs, resolveCommit: cr.resolveCommit, changedFiles: cr.changedFiles });
  } else {
    ledger.push({ num, status: 'carried', drop: cr ? (cr.drop || 'no-we-pr') : 'no-result', cost: cr && cr.cost, lane: laneLabel });
  }
}

const prsOpened = ledger.filter((l) => l.status === 'pr-open').length;
log(`Fan-out complete: ${prsOpened}/${workItems.length} item(s) are now OPEN ready-to-merge PR(s); ${workItems.length - prsOpened} carried. ZERO commits to main; no drain launched.`);

// Record the local (uncommitted) ready-to-merge signal per PR'd item: `backlog.mjs queue` writes queued.json
// so (a) the SAME checkout's next readiness pack won't re-offer the item (offline, Rule #105) and (b) the
// EXISTING drain (we:scripts/lane-drain.mjs) can land the couples now — it reads the manifest off each pushed
// lane ref. This does NOT commit or push anything (main stays clean); it is a working-tree signal only. The
// forward F1 signal is the PR label (#2188 converges the drain onto it).
const queued = [];
if (toQueue.length) {
  const res = await agent(
    [
      RETURN_HYGIENE, ``,
      `In the PRIMARY WE checkout (${PRIMARY_ROOT}) on branch main, record a LOCAL ready-to-merge signal for the`,
      `items that opened a PR this run — WITHOUT committing or pushing anything (main must stay clean, #2183).`,
      `For EACH item below run \`node scripts/backlog.mjs queue <num> --lane=<weRef> --session=${batchSlug}\``,
      `(this writes queued.json in the working tree — do NOT \`git add\` or commit it, do NOT push). Items`,
      `(JSON): ${JSON.stringify(toQueue)}. This lets a later \`node scripts/lane-drain.mjs drain\` land these`,
      `ready-to-merge PRs (it reads each item's manifest off its pushed lane ref) and stops the next readiness`,
      `pack from re-offering them. Do NOT merge, do NOT integrate, do NOT delete any lane/* ref. Return`,
      `{ queued: [nums written], notes }.`,
    ].join(' '),
    {
      label: 'finalize:local-queue-signal', phase: 'Finalize',
      schema: { type: 'object', required: ['queued'], additionalProperties: true, properties: { queued: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } } },
    },
  ).catch(() => null);
  if (res) for (const n of (res.queued || [])) queued.push(String(n));
  else log('⚠ local queue-signal step produced no result — the PRs are open + labelled ready-to-merge (correct), but this checkout may re-offer the items until a drain lands them.');
}

const resolvedCost = ledger.filter((l) => l.status === 'pr-open').reduce((s, l) => s + (Number(l.cost) || 0), 0);
const reposProvisioned = Object.keys(lanePools).filter((r) => (lanePools[r] || []).length > 0);
log(`Parallel batch (PR-fan-out) done: ${prsOpened} open ready-to-merge PR(s), ${crossRepoCount} cross-repo, ${queued.length} marked ready-to-merge locally. Land them anytime with \`node scripts/lane-drain.mjs drain\` (or \`/merge\`) — the producer neither launched nor waited on a drain.`);

return {
  // No integration branch, no landed state — the result is a set of OPEN ready-to-merge PRs a drain lands.
  ledger,
  itemsWorked: workItems.length,
  prsOpened,
  prUrls,
  queued,                      // items given a local (uncommitted) ready-to-merge signal
  crossRepoItems: crossRepoCount,
  reposProvisioned,
  probeFailures,
  pointsSpent: resolvedCost,
  budgetPoints,
  note: 'PR-FAN-OUT producer (#2183/#2189): every worked item is an OPEN ready-to-merge PR; ZERO commits to main; no inline integrate; the drain was neither launched nor awaited. Lane refs are PRESERVED (the PRs point at them).',
};
