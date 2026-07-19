/**
 * review-parked-prs.mjs — encode the drain's PARKED-PR review loop as a Workflow-harness script (#2437,
 * slice of epic #2418). Collapses the ~24 hand-run main-loop steps of reviewing a drain-parked PR
 * (fetch the diff → run a fresh-context multi-lens panel → reduce to a verdict + disposition + comment)
 * into ONE launch, one item per parked PR flowing independently through the pipeline.
 *
 * HARNESS SANDBOX — structured EXACTLY like the proven reference
 * `we:skills-src/batch-backlog-items/parallel-execute.workflow.js`: a PURE literal `export const meta` followed
 * by a TOP-LEVEL body that uses the injected Workflow-runtime primitives — `agent()`, `parallel()`,
 * `pipeline()`, `phase()`, `log()`, and the `args` global — and ends with a top-level `return`. The harness
 * strips the `export const meta` and runs the rest as a wrapped body; this file is therefore NOT an importable
 * ES module (`node --check` fails on the top-level `return`, exactly as it does on the reference). Consequences:
 *   • NO `import` statements — the body cannot pull in `review-core.mjs` or any repo module.
 *   • NO `child_process` / filesystem / `Date.now()` / `Math.random()` in the body — it has no Node API.
 *   • EVERYTHING that shells a command or reads a file happens INSIDE an `agent(prompt, {schema})` call: the
 *     subagent runs `node scripts/fetch-parked.mjs` / `node scripts/review-core-cli.mjs …` and returns
 *     structured data. Small PURE orchestration helpers are inlined as top-level `function` declarations.
 *
 * THE BOUNDARY (epic #2418 / INVARIANT 2) — this workflow RETURNS a ledger of verdicts and NOTHING ELSE:
 *   • It NEVER applies a label, posts a comment, or merges anything — the operator/caller decides what a verdict
 *     does (the "decisions stay in the loop" boundary). The panel JUDGES; acting on the judgment is the caller's.
 *   • It reviews the AGENT-CLEARABLE `review:pending` class ONLY. It NEVER touches a `review:human` PR — a
 *     gate-self / statute PR is a human's to clear (conflict of interest). The guard holds on EVERY path: each
 *     candidate PR's CURRENT labels are fetched fresh (never trusting caller-supplied/absent labels) and any
 *     `review:human` PR — or any PR whose labels could not be verified — is filtered out (fail-closed).
 *
 * SAFETY — a reviewer that did not run NEVER reads as accept. If a MANDATORY lens (correctness/security) reviewer
 * crashes, or the diff cannot be fetched at all, that PR degrades to `needs-human` with a human disposition
 * (autoLand=false) — it is never silently accepted on missing signal.
 *
 * SCOPE (MVP). The `review` skill (`we:skills-src/review/SKILL.md`) states the panel↔editor CONVERGENCE loop is
 * v2, epic #2285. So this MVP builds ONLY the one-shot panel→reduce→render pipeline. The `editorRound` +
 * `reReview` negotiation is DEFERRED to epic #2285 (`buildEditorMandate`/`deriveNegotiationOutcome` exist there).
 *
 * LIVE VALIDATION awaits a real parked PR — a harness workflow is not unit-testable (it needs live agents + the
 * runtime primitives); it is validated by a live run against an actual `review:pending` PR.
 */

// ─────────────────────────────────────────────────────────────────────────────
// meta — a PURE literal (no computation): the harness reads it to name/describe the workflow and render its
// phase timeline. Kept in sync with the body below.
// ─────────────────────────────────────────────────────────────────────────────
export const meta = {
  name: 'review-parked-prs',
  description:
    'Review the drain\'s PARKED PRs in one launch: per parked PR, a fresh-context multi-lens panel (one agent per '
    + 'lens: correctness/security/simplicity/standards-conformance — correctness and security are mandatory) '
    + 'judges one shared diff snapshot, then a reduce step shells the shared review core (review-core-cli '
    + 'reduce/comment) to a verdict + disposition + rendered comment body. Returns a ledger of '
    + '{ pr, repo, disposition, verdict, commentBody } — it NEVER applies a label, posts a comment, or merges '
    + '(the operator decides what a verdict does; the "decisions stay in the loop" boundary of epic #2418). '
    + 'Reviews the agent-clearable review:pending class ONLY — a review:human PR (its labels re-fetched fresh on '
    + 'every path) is filtered out and never touched (INVARIANT 2). A mandatory reviewer that fails to run '
    + 'degrades that PR to needs-human — a dead reviewer never reads as accept. The panel↔editor convergence '
    + 'loop (editorRound + reReview) is DEFERRED to v2, epic #2285.',
  whenToUse:
    'Invoked to review the PRs the drain parked with review:pending, as one batched launch instead of the '
    + '~24 hand-run review steps per PR. NOT for a review:human PR (only a human clears those — use /review). It '
    + 'produces verdicts for the operator to act on; it never lands or labels anything itself.',
  phases: [
    { title: 'Discover', detail: 'collect the review:pending parked PRs (from args, or `gh pr list --label review:pending` across the constellation repos), re-fetch each candidate\'s CURRENT labels, and DROP any review:human / label-unverifiable PR (fail-closed, INVARIANT 2)' },
    { title: 'Panel', detail: 'per PR: fetch the diff + escalation reason ONCE, read the advisory care-level (review-core-cli rigor) to dial the jury size, then fan out jurorsPerLens fresh-context reviewer(s) per lens (correctness/security/simplicity/standards-conformance) over that single shared snapshot — reduced by diversity-selection (#2567)' },
    { title: 'Reduce', detail: 'per PR: an agent shells review-core-cli (reduce + comment) to reduce the panel to one verdict + disposition + rendered comment body; a failed mandatory lens / unfetchable diff degrades to needs-human' },
    { title: 'Deferred (#2285)', detail: 'the editorRound + reReview panel↔editor convergence loop is NOT built in this MVP — it is v2, epic #2285' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Inline PURE helpers (top-level `function` declarations, like the reference's affectedReposOf/laneKeyOf) —
// plain JS only, no repo deps, no Node API. Deterministic (no Date.now/Math.random — unavailable in the sandbox).
// ─────────────────────────────────────────────────────────────────────────────

// The #96 constellation repos a parked PR can live in — the `we` primary (its `gh` slug + cwd checkout) and the
// two impl repos (reached by their checkout path). web-everything is the common case; the other two rarely carry
// a review:pending PR (only a cross-repo park). `we` uses no --repo path (the agents' own cwd). Paths use $HOME
// (NOT `~`): bash does not tilde-expand `~` mid-argument, so `--repo=~/…` would pass a literal tilde; `$HOME` is
// a variable expansion bash DOES perform inside an argument, yielding an absolute path.
const REPOS = {
  we: { slug: 'chalbert/web-everything', path: '' },
  frontierui: { slug: 'frontierui', path: '$HOME/workspace/frontierui' },
  'plateau-app': { slug: 'plateau-app', path: '$HOME/workspace/plateau-app' },
};
const DEFAULT_REPO = 'we';

// The review-label vocabulary (kept as literals — no import in the sandbox; mirrors REVIEW_LABELS in
// we:scripts/lib/review-escalation.mjs). review:human is the one this workflow must NEVER touch (INVARIANT 2).
const REVIEW_HUMAN = 'review:human';
const REVIEW_PENDING = 'review:pending';

// The panel lenses — the `/code-review` dimensions, one fresh-context reviewer each. MANDATORY (must both
// accept to land): correctness, security. ADVISORY (surfaced, never blocking): simplicity, standards-conformance.
// These are the exact tokens `review-core-cli.mjs mandate --lens=<lens>` / the panel reduction accept (the
// standards lens is `standards-conformance`, not `standards` — the CLI validates against that spelling).
const LENSES = ['correctness', 'security', 'simplicity', 'standards-conformance'];
const MANDATORY_LENSES = ['correctness', 'security'];

/** `repo#pr` — a stable per-PR tag, unique across repos (a PR number alone collides between repos). */
function prTag(item) {
  return `${(item && item.repo) || DEFAULT_REPO}#${item && item.pr}`;
}

/** The `--repo=<path>` flag (or '' for the `we` cwd checkout) an agent passes to fetch-parked for this repo. */
function repoPathFlag(repo) {
  const path = (REPOS[repo] && REPOS[repo].path) || '';
  return path ? ` --repo=${path}` : '';
}

/**
 * Normalize the workflow's `args` into a flat list of `{pr, repo, labels?}` items. Pure. Tolerates the three
 * input shapes the launcher may pass (and a JSON string, which the runtime serializes `args` as in some
 * environments): an ARRAY of `{pr, repo}` (or `{number, repo}`) objects / bare PR numbers; an OBJECT
 * `{prs:[...], repo}`; or EMPTY/absent → `[]` (the caller then discovers via `gh pr list`). A missing per-entry
 * repo defaults to the object-level `repo`, else `we`. `labels` is preserved when present. Drops a
 * non-numeric/non-positive `pr` (never a NaN item); de-dupes on `repo#pr`.
 */
function normalizeParkedInput(rawArgs) {
  let a = rawArgs;
  if (typeof a === 'string') {
    try { a = JSON.parse(a); } catch { a = {}; }
  }
  let list = [];
  let defaultRepo = DEFAULT_REPO;
  if (Array.isArray(a)) {
    list = a;
  } else if (a && typeof a === 'object') {
    if (typeof a.repo === 'string' && a.repo) defaultRepo = a.repo;
    if (Array.isArray(a.prs)) list = a.prs;
  }

  const out = [];
  const seen = new Set();
  for (const entry of list) {
    let pr;
    let repo = defaultRepo;
    let labels;
    if (entry && typeof entry === 'object') {
      pr = Number(entry.pr != null ? entry.pr : entry.number);
      if (typeof entry.repo === 'string' && entry.repo) repo = entry.repo;
      if (Array.isArray(entry.labels)) labels = entry.labels;
    } else {
      pr = Number(entry);
    }
    if (!Number.isFinite(pr) || pr <= 0) continue;
    const key = `${repo}#${pr}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(labels ? { pr, repo, labels } : { pr, repo });
  }
  return out;
}

/**
 * Partition a parked-PR list into the AGENT-CLEARABLE set, the SKIPPED `review:human` set, and the
 * label-UNVERIFIED set — INVARIANT 2, FAIL-CLOSED. Pure; reads each entry's own `labels`. An entry with a
 * verified labels array that does NOT include `review:human` is clearable. An entry WITH `review:human` is
 * skipped as human. An entry with NO labels array at all (its labels could not be fetched) is skipped as
 * unverified — never reviewed, because we cannot prove it is not a review:human PR.
 */
function filterAgentClearable(prs) {
  const clearable = [];
  const skippedHuman = [];
  const skippedUnverified = [];
  for (const item of Array.isArray(prs) ? prs : []) {
    if (!Array.isArray(item.labels)) { skippedUnverified.push({ pr: item.pr, repo: item.repo }); continue; }
    if (item.labels.includes(REVIEW_HUMAN)) { skippedHuman.push({ pr: item.pr, repo: item.repo }); continue; }
    clearable.push({ pr: item.pr, repo: item.repo });
  }
  return { clearable, skippedHuman, skippedUnverified };
}

// ── Return-hygiene contract (mirrors the reference's #1861 rider) — prepended to every agent prompt. ──
const RETURN_HYGIENE = [
  'RETURN HYGIENE — return the conclusion the parent will keep, not a transcript:',
  '• NEVER fabricate specifics. No invented file:line refs, API names, flags, or counts — if you did not READ',
  '  it in this run, do not state it as fact. An honest "unknown / not verified" beats a plausible guess.',
  '• If returning a structured object, every field must be grounded — leave it empty rather than guess.',
].join('\n');

// ─────────────────────────────────────────────────────────────────────────────
// Agent I/O schemas — validated shapes the spawned agents return (the `agent(prompt, {schema})` form).
// ─────────────────────────────────────────────────────────────────────────────

// What the DISCOVER / LABEL-FETCH agents return — parked PRs, each with its CURRENT label names (so the
// review:human guard reads verified labels, never caller-supplied ones).
const DISCOVER_SCHEMA = {
  type: 'object',
  required: ['prs'],
  additionalProperties: true,
  properties: {
    prs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['pr', 'repo', 'labels'],
        additionalProperties: true,
        properties: {
          pr: { type: 'number' },
          repo: { type: 'string', description: 'the constellation repo id: we | frontierui | plateau-app' },
          labels: { type: 'array', items: { type: 'string' }, description: 'the PR\'s CURRENT label names' },
        },
      },
    },
    notes: { type: 'string' },
  },
};

// What the single per-PR FETCH agent returns — the ONE shared diff snapshot + escalation reason every lens judges.
const FETCH_SCHEMA = {
  type: 'object',
  required: ['pr', 'diff'],
  additionalProperties: true,
  properties: {
    pr: { type: 'number' },
    diff: { type: 'string', description: 'the full unified diff from fetch-parked ("" if the PR could not be read)' },
    title: { type: 'string' },
    escalationReason: { type: 'array', items: { type: 'string' }, description: 'the bare decorated reasons under the PR body\'s "## Escalation reason" heading' },
    error: { type: 'string', description: 'set if fetch-parked could not read the PR' },
  },
};

// What ONE lens reviewer returns — its lens tag + that lens's findings (empty if the diff survives scrutiny).
const LENS_SCHEMA = {
  type: 'object',
  required: ['lens', 'findings'],
  additionalProperties: true,
  properties: {
    lens: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['summary'],
        additionalProperties: true,
        properties: {
          file: { type: 'string' },
          summary: { type: 'string' },
          failure_scenario: { type: 'string' },
          category: { type: 'string' },
          line: { type: 'number' },
        },
      },
    },
    notes: { type: 'string' },
  },
};

// What the REDUCE agent returns — the panel verdict + disposition + rendered comment body, all from the CLI.
const VERDICT_SCHEMA = {
  type: 'object',
  required: ['verdict', 'commentBody'],
  additionalProperties: true,
  properties: {
    verdict: { type: 'string', description: 'accept | changes | needs-human (from review-core-cli reduce)' },
    disposition: {
      type: ['object', 'null'],
      additionalProperties: true,
      properties: { mode: { type: 'string' }, autoLand: { type: 'boolean' } },
      description: 'from deriveReviewDisposition over the escalation reasons; null when there are none',
    },
    commentBody: { type: 'string', description: 'the markdown PR-comment body from review-core-cli comment' },
    notes: { type: 'string' },
  },
};

// What the RIGOR agent returns (#2567) — the advisory care-level + the panel rigor it dials, from the shared core.
const RIGOR_SCHEMA = {
  type: 'object',
  required: ['careLevel', 'jurorsPerLens'],
  additionalProperties: true,
  properties: {
    careLevel: { type: 'string', description: 'none | low | elevated | high (from review-core-cli rigor)' },
    jurorsPerLens: { type: 'number', description: 'independent reviewers per lens the care-level dials (>=1)' },
    rounds: { type: 'number' },
    aggregation: { type: 'string', description: 'always diversity-selection — never a majority vote' },
    notes: { type: 'string' },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builders + pipeline stages (top-level functions; they call the injected `agent`/`parallel` primitives
// at run time — never at load time).
// ─────────────────────────────────────────────────────────────────────────────

/** The RIGOR prompt (#2567) — shell the shared review core to turn this PR's escalation reasons into the advisory
 *  care-level + the panel rigor it dials (jurors per lens). Single-sourced: the workflow never re-derives the dial. */
function rigorPrompt(item, escalationReason) {
  const flag = repoPathFlag(item.repo);
  const where = flag ? `the checkout at ${REPOS[item.repo].path}` : 'this checkout (your cwd)';
  return [
    RETURN_HYGIENE,
    '',
    `Compute the advisory panel RIGOR for drain-parked PR #${item.pr} (repo id: ${item.repo}) from its escalation`,
    'reasons, using ONLY the shared review core (hand-roll NO judgement). Run, in ' + where + ':',
    `  node scripts/review-core-cli.mjs rigor --reasons=${JSON.stringify(escalationReason.join(', '))} --json`,
    'It prints { careLevel, rigor: { rounds, lenses, jurorsPerLens, aggregation } }.',
    'Return { careLevel: <that careLevel>, jurorsPerLens: <rigor.jurorsPerLens>, rounds: <rigor.rounds>,',
    'aggregation: <rigor.aggregation> }. Return ONLY the structured object.',
  ].join('\n');
}

/** The DISCOVER prompt — enumerate the review:pending parked PRs across the constellation repos, with labels. */
function discoverPrompt() {
  const repoList = Object.keys(REPOS).map((id) => ({ id, slug: REPOS[id].slug, path: REPOS[id].path || '(this cwd)' }));
  return [
    RETURN_HYGIENE,
    '',
    'You are the DISCOVER step of the review-parked-prs workflow. Produce the list of PARKED pull requests to',
    'review, each with its CURRENT label names. You do READ-ONLY gh calls only — never edit, label, comment, or merge.',
    '',
    'For the `we` repo (the common case) run in THIS checkout (your cwd):',
    `  gh pr list --repo ${REPOS.we.slug} --label ${REVIEW_PENDING} --json number,labels`,
    'For the other constellation repos (best-effort — a repo whose checkout is absent or has no pending PR simply',
    'contributes nothing), run `gh pr list --label ' + REVIEW_PENDING + ' --json number,labels` in that repo\'s',
    'checkout path if it exists.',
    '',
    `Constellation repos (id → gh slug / checkout path): ${JSON.stringify(repoList)}.`,
    '',
    'Return { prs: [{ pr, repo, labels }] } — `repo` is the constellation id (we | frontierui | plateau-app),',
    '`labels` the PR\'s CURRENT label-name strings. Include EVERY review:pending PR you found (do NOT pre-filter',
    'review:human — the workflow filters it deterministically). Return ONLY the structured object.',
  ].join('\n');
}

/** The LABEL-FETCH prompt (explicit-args path) — re-fetch the CURRENT labels for caller-named PRs so the
 *  review:human guard NEVER trusts caller-supplied/absent labels (INVARIANT 2 holds on every path). */
function labelFetchPrompt(prs) {
  const repoList = Object.keys(REPOS).map((id) => ({ id, slug: REPOS[id].slug, path: REPOS[id].path || '(this cwd)' }));
  return [
    RETURN_HYGIENE,
    '',
    'Fetch the CURRENT GitHub labels for these explicitly-named parked PRs so the workflow can enforce the',
    'review:human guard (INVARIANT 2 — a review:human PR is never agent-cleared). READ-ONLY gh only.',
    '',
    `PRs to look up (JSON): ${JSON.stringify(prs.map((p) => ({ pr: p.pr, repo: p.repo })))}.`,
    'For each, in the PR\'s repo run `gh pr view <pr> --repo <slug> --json number,labels` (the `we` id → slug',
    'chalbert/web-everything, run in your cwd; for a non-we id, use its slug or run gh in its checkout path).',
    'If a PR genuinely cannot be read, OMIT it (do not invent labels) — the workflow fails closed and skips it.',
    '',
    `Constellation repos (id → gh slug / checkout path): ${JSON.stringify(repoList)}.`,
    '',
    'Return { prs: [{ pr, repo, labels }] } with the CURRENT label names for each PR you could read. Return',
    'ONLY the structured object.',
  ].join('\n');
}

/** The single per-PR FETCH prompt — one read-only fetch of the diff + escalation reason all four lenses share. */
function fetchPrompt(pr, repo) {
  const flag = repoPathFlag(repo);
  const where = flag ? `the checkout at ${REPOS[repo].path}` : 'this checkout (your cwd)';
  return [
    RETURN_HYGIENE,
    '',
    `Fetch the review bundle for drain-parked PR #${pr} (repo id: ${repo}) — a SINGLE read-only fetch that the`,
    'whole review panel will share (do NOT fetch per-lens). Run, in ' + where + ':',
    `  node scripts/fetch-parked.mjs ${pr}${flag} --json`,
    'It prints a JSON array; take the entry whose `number` is this PR. Use its `diff` and `body`.',
    'Parse escalationReason from the `body`: the "- <reason>" bullet lines under the "## Escalation reason"',
    'heading (up to the next "##" heading), as bare strings (may be empty).',
    'If the entry has an `error` field (the PR could not be read), return { pr, diff: "", error: <that message> }.',
    'Do NOT `git checkout`/`switch` to the PR branch. Return ONLY { pr, diff, title, escalationReason, error? }.',
  ].join('\n');
}

/** ONE lens reviewer's prompt — judges the SHARED diff snapshot (no fetch); gets its mandate from the CLI. When
 *  the care-level dialed a JURY (jurorsPerLens > 1), each juror is told it is one independent member judging the
 *  lens on its own — the diversity that a high-care change earns (#2567). */
function lensPrompt(pr, repo, lens, diff, escalationReason, title, juror = 0, jurorsPerLens = 1) {
  const juryFraming = jurorsPerLens > 1
    ? `You are juror ${juror + 1} of ${jurorsPerLens} INDEPENDENT ${lens} reviewers on this high-care PR — judge the diff entirely on your own, do NOT try to agree with the other jurors; the panel keeps any concern ANY juror raises (diversity-selection, never a majority vote).`
    : '';
  return [
    RETURN_HYGIENE,
    '',
    `You are the ${lens} reviewer on the review panel for drain-parked PR #${pr} (repo ${repo})${title ? ` — ${title}` : ''}.`,
    juryFraming,
    `Get your lens mandate and follow it: run  node scripts/review-core-cli.mjs mandate --lens=${lens}`,
    escalationReason.length ? `The drain escalated this PR for: ${escalationReason.join('; ')}.` : 'No escalation reason block was present on the PR body.',
    'You review ONLY the diff below + the PR description + the escalation reason. NEVER `git checkout`/`switch`',
    'to the PR branch (#2336) — judge from this diff text alone.',
    '',
    'The diff to review (the ONLY code context — do not fetch or check out anything else):',
    '```diff',
    diff || '(empty diff)',
    '```',
    '',
    `Return { lens: "${lens}", findings: [{ summary, file?, failure_scenario?, category?, line? }] }. Return an`,
    'EMPTY findings array if the diff survives scrutiny (do not pad with nitpicks). Return ONLY the structured object.',
  ].join('\n');
}

/** The REDUCE prompt — shell review-core-cli to derive per-lens verdicts, the panel verdict + disposition, and
 *  the rendered comment body. `humanRequired` (a mandatory reviewer did not run / the diff was unfetchable)
 *  forces needs-human; the step-4 panel verdict is threaded INTO the comment payload so the comment headline
 *  matches the reduced verdict (not a re-derivation over flattened findings). No judgement is hand-rolled. */
function reducePrompt(pr, repo, okLenses, failedLenses, escalationReason, humanRequired) {
  return [
    RETURN_HYGIENE,
    '',
    `Reduce the review panel for parked PR #${pr} (repo ${repo}) to a verdict + disposition + comment, using ONLY`,
    'the shared review-core CLI (`node scripts/review-core-cli.mjs`). Hand-roll NO judgement — every value comes',
    'from the CLI.',
    '',
    `Lenses that RAN (JSON, each with its findings): ${JSON.stringify(okLenses)}`,
    `Lenses that FAILED to run (their verdict is "unknown"): ${JSON.stringify(failedLenses)}`,
    `Escalation reasons (JSON): ${JSON.stringify(escalationReason || [])}`,
    `humanRequired: ${humanRequired ? 'true' : 'false'}  (true ⇒ a mandatory reviewer did not run, or the diff was`,
    'unfetchable → the panel must NOT auto-accept; the reduce will return needs-human).',
    '',
    'Steps (write temp files under a temp dir, e.g. $(mktemp -d)):',
    `1. Build lensVerdicts: for EACH lens that RAN, write {"findings": <that lens's findings array>} to a temp`,
    '   file, run  node scripts/review-core-cli.mjs reduce --file=<tmp> --json , read its `.verdict`, and record',
    '   lensVerdicts["<lens>"] = <verdict>. For EACH lens that FAILED, record lensVerdicts["<lens>"] = "unknown".',
    '2. FLATTEN the RAN lenses\' findings into ONE array, setting each finding\'s `category` to its lens name.',
    '3. Write payloadA = { "lensVerdicts": <step 1>, "findings": <step 2>, "humanRequired": ' + (humanRequired ? 'true' : 'false') + ',',
    '   "reasons": <the escalation reasons array> } — but OMIT the "reasons" key entirely if that array is empty.',
    '4. Run  node scripts/review-core-cli.mjs reduce --file=payloadA --json  → read `.verdict` (the PANEL verdict)',
    '   and `.disposition` (absent when there are no reasons → treat as null).',
    '5. Write payloadB = payloadA PLUS "verdict": <the step-4 panel verdict> (so the comment headline uses the',
    '   reduced verdict verbatim, not a re-derivation). Run  node scripts/review-core-cli.mjs comment',
    '   --file=payloadB  → its stdout is the markdown comment body.',
    '',
    'Return { verdict: <step-4 panel verdict>, disposition: <step-4 disposition or null>, commentBody: <step 5> }.',
    'Return ONLY the structured object.',
  ].join('\n');
}

/**
 * #2567 — the panel RIGOR for this PR, dialed by its advisory CARE-LEVEL. An agent shells the shared review core
 * (`review-core-cli rigor --reasons=…`) so the dial is single-sourced (never re-derived here). Returns
 * `{ careLevel, jurorsPerLens, aggregation }` — `jurorsPerLens` is how many INDEPENDENT reviewers judge each lens
 * (a high-care change earns a diverse jury), and the panel is aggregated by diversity-SELECTION (the strictest
 * verdict wins — never a majority vote). Fails safe to the baseline (1 juror) if the dial can't be read.
 */
async function careRigorFor(item, escalationReason) {
  if (!escalationReason.length) return { careLevel: 'low', jurorsPerLens: 1, aggregation: 'diversity-selection' };
  const r = await agent(rigorPrompt(item, escalationReason), { label: `rigor:${prTag(item)}`, phase: 'Panel', schema: RIGOR_SCHEMA }).catch(() => null);
  const jurorsPerLens = (r && Number.isFinite(Number(r.jurorsPerLens)) && Number(r.jurorsPerLens) >= 1) ? Math.floor(Number(r.jurorsPerLens)) : 1;
  const careLevel = (r && typeof r.careLevel === 'string') ? r.careLevel : 'low';
  const aggregation = (r && typeof r.aggregation === 'string') ? r.aggregation : 'diversity-selection';
  return { careLevel, jurorsPerLens, aggregation };
}

/** Reduce ONE lens's JURY (jurorsPerLens independent reviewers) to that lens's findings by diversity-SELECTION:
 *  the UNION of every juror's findings (any juror's concern carries — the strictest read wins, never a vote).
 *  A lens counts as run (`ok:true`) iff AT LEAST ONE juror ran; it fails only if the whole jury failed. */
function reduceLensJury(lens, jurorResults) {
  const ran = jurorResults.filter((j) => j.ok);
  if (!ran.length) return { lens, ok: false, findings: [] };
  return { lens, ok: true, findings: ran.flatMap((j) => j.findings) };
}

/** Pipeline STAGE 1 — one shared fetch, then the fresh-context multi-lens panel over that single snapshot, with
 *  panel rigor (jurors per lens) dialed by the PR's advisory care-level (#2567). Each lens is tagged ok/failed:
 *  a failed MANDATORY lens (or a failed fetch) must degrade to needs-human. */
async function panelReview(item) {
  const { pr, repo } = item;
  const fetched = await agent(fetchPrompt(pr, repo), { label: `fetch:${prTag(item)}`, phase: 'Panel', schema: FETCH_SCHEMA }).catch(() => null);
  const diff = (fetched && typeof fetched.diff === 'string') ? fetched.diff : '';
  const title = (fetched && fetched.title) ? String(fetched.title) : '';
  const escalationReason = (fetched && Array.isArray(fetched.escalationReason)) ? fetched.escalationReason : [];
  const fetchOk = !!(fetched && !fetched.error && diff.length > 0);
  if (!fetchOk) {
    log(`  ${prTag(item)}: FETCH failed${fetched && fetched.error ? ` (${fetched.error})` : ''} — the panel has no diff to judge; this PR will degrade to needs-human.`);
  }

  // #2567 — care-level dials the jury size; the reviewer set (LENSES) is constant, jurorsPerLens scales.
  const { careLevel, jurorsPerLens, aggregation } = await careRigorFor(item, escalationReason);

  // Each lens is judged by jurorsPerLens INDEPENDENT reviewers, then reduced by diversity-selection (union).
  const lensResults = await parallel(LENSES.map((lens) => () =>
    parallel(Array.from({ length: jurorsPerLens }, (_unused, juror) => () =>
      agent(lensPrompt(pr, repo, lens, diff, escalationReason, title, juror, jurorsPerLens), { label: `panel:${prTag(item)}:${lens}${jurorsPerLens > 1 ? `#${juror + 1}` : ''}`, phase: 'Panel', schema: LENS_SCHEMA })
        .then((r) => ({ ok: true, findings: (r && Array.isArray(r.findings)) ? r.findings : [] }))
        .catch(() => {
          log(`  ${prTag(item)}: the ${lens} reviewer${jurorsPerLens > 1 ? ` (juror ${juror + 1}/${jurorsPerLens})` : ''} FAILED to run.`);
          return { ok: false, findings: [] };
        }),
    )).then((jurors) => reduceLensJury(lens, jurors)),
  ));
  const ran = lensResults.filter((r) => r.ok).map((r) => `${r.lens}:${r.findings.length}`).join(', ');
  const failed = lensResults.filter((r) => !r.ok).map((r) => r.lens);
  log(`  ${prTag(item)}: panel done (care=${careLevel}, ${jurorsPerLens} juror(s)/lens, ${aggregation}) — ran [${ran || 'none'}]${failed.length ? `; FAILED [${failed.join(', ')}]` : ''}${escalationReason.length ? `; escalated for ${escalationReason.join('; ')}` : ''}.`);
  return { pr, repo, lensResults, escalationReason, fetchOk, careLevel };
}

/** Pipeline STAGE 2 — reduce the panel to a verdict + disposition + comment via the review-core CLI (agent).
 *  A failed MANDATORY lens or an unfetchable diff DEGRADES to needs-human with a human disposition — a reviewer
 *  that did not run never reads as accept (enforced both in the reduce's `humanRequired` AND as a safety net). */
async function reducePanelVerdict(panel) {
  const { pr, repo, lensResults, escalationReason, fetchOk } = panel;
  const failedLenses = lensResults.filter((r) => !r.ok).map((r) => r.lens);
  const failedMandatory = failedLenses.filter((l) => MANDATORY_LENSES.includes(l));
  const degrade = failedMandatory.length > 0 || !fetchOk;
  if (degrade) {
    const why = !fetchOk ? 'the diff could not be fetched' : `mandatory reviewer(s) failed to run: ${failedMandatory.join(', ')}`;
    log(`  ${prTag(panel)}: DEGRADING to needs-human — ${why} (a reviewer that did not run NEVER reads as accept).`);
  }

  const okLenses = lensResults.filter((r) => r.ok).map((r) => ({ lens: r.lens, findings: r.findings }));
  const r = await agent(reducePrompt(pr, repo, okLenses, failedLenses, escalationReason, degrade), { label: `reduce:${prTag(panel)}`, phase: 'Reduce', schema: VERDICT_SCHEMA }).catch(() => null);

  let verdict = (r && r.verdict) || (degrade ? 'needs-human' : 'unknown');
  let disposition = (r && r.disposition) || null;
  const commentBody = (r && r.commentBody) || '';

  // SAFETY NET — a degraded panel is needs-human with a human disposition regardless of what the reduce agent
  // returned (a missing-signal PR must go to a human, never auto-land).
  if (degrade) {
    verdict = 'needs-human';
    disposition = { mode: 'human', autoLand: false };
  }

  log(`  ${prTag(panel)}: verdict ${verdict}${disposition ? `, disposition ${disposition.mode} (autoLand=${disposition.autoLand})` : ''}.`);
  return { pr, repo, disposition, verdict, commentBody };
}

// ─────────────────────────────────────────────────────────────────────────────
// The harness body — TOP-LEVEL control flow (no function wrapper), ending in a top-level `return`.
// ─────────────────────────────────────────────────────────────────────────────

// ── Phase 1 — Discover the parked PRs, re-fetch CURRENT labels, then DROP review:human / unverifiable (INVARIANT 2). ──
phase('Discover');

// `args` may be an object, a JSON string, or absent — normalizeParkedInput tolerates all three.
const provided = normalizeParkedInput(args);
let parked;
if (provided.length) {
  log(`Given ${provided.length} PR(s) explicitly: ${provided.map(prTag).join(', ')} — re-fetching their CURRENT labels to enforce the review:human guard (caller-supplied labels are never trusted).`);
  const fetchedLabels = await agent(labelFetchPrompt(provided), { label: 'labels:explicit', phase: 'Discover', schema: DISCOVER_SCHEMA }).catch(() => null);
  parked = normalizeParkedInput({ prs: (fetchedLabels && Array.isArray(fetchedLabels.prs)) ? fetchedLabels.prs : [] });
} else {
  log('No PRs given — discovering the review:pending parked PRs across the constellation repos.');
  const disc = await agent(discoverPrompt(), { label: 'discover:parked', phase: 'Discover', schema: DISCOVER_SCHEMA }).catch(() => null);
  parked = normalizeParkedInput({ prs: (disc && Array.isArray(disc.prs)) ? disc.prs : [] });
}

const { clearable, skippedHuman, skippedUnverified } = filterAgentClearable(parked);
if (skippedHuman.length) {
  log(`Skipping ${skippedHuman.length} review:human PR(s) — never agent-cleared, a human clears those via /review: ${skippedHuman.map(prTag).join(', ')}.`);
}
if (skippedUnverified.length) {
  log(`Skipping ${skippedUnverified.length} PR(s) whose CURRENT labels could not be verified (fail-closed — INVARIANT 2): ${skippedUnverified.map(prTag).join(', ')}.`);
}
log(`${clearable.length} agent-clearable review:pending PR(s) to review${clearable.length ? ': ' + clearable.map(prTag).join(', ') : ''}.`);

if (clearable.length === 0) {
  log('No agent-clearable parked PRs — nothing to review.');
  return { ledger: [], reviewed: 0, skippedHuman: skippedHuman.length, skippedUnverified: skippedUnverified.length, note: 'no agent-clearable review:pending PRs; the editorRound + reReview convergence loop is deferred to epic #2285.' };
}

// ── Phase 2+3 — run every clearable PR through the pipeline INDEPENDENTLY (fetch+panel → reduce). ──
phase('Panel');
log(`Reviewing ${clearable.length} parked PR(s): shared-snapshot multi-lens panel → reduce (each PR flows independently)…`);

const ledger = (await pipeline(clearable, panelReview, reducePanelVerdict)) || [];

// ── Deferred note (#2285) — the panel↔editor convergence loop is intentionally NOT built in this MVP. ──
log('editorRound + reReview (the panel↔editor CONVERGENCE loop) deferred to v2, epic #2285 — this MVP is '
  + 'panel→reduce→render only (buildEditorMandate/deriveNegotiationOutcome already exist in review-core.mjs).');

const list = Array.isArray(ledger) ? ledger.filter(Boolean) : [];
log(`Done: ${list.length} verdict(s) produced. This workflow RETURNS the verdicts — it applied NO label, posted `
  + 'NO comment, and merged NOTHING. The operator decides what each verdict does (epic #2418 boundary).');

// The workflow RETURNS the ledger and nothing else acts on it (INVARIANT 2 + "decisions stay in the loop").
// Each entry: { pr, repo, disposition, verdict, commentBody }.
return {
  ledger: list,
  reviewed: list.length,
  skippedHuman: skippedHuman.length,
  skippedUnverified: skippedUnverified.length,
  note: 'review-parked-prs MVP (#2437): returns verdicts ONLY — no label applied, no comment posted, nothing '
    + 'merged; review:human PRs never touched, a failed mandatory reviewer degrades to needs-human. The '
    + 'editorRound + reReview convergence loop is deferred to epic #2285.',
};
