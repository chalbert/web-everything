#!/usr/bin/env node
/**
 * backlog.mjs — the mechanical backlog-status CLI (claim / resolve / release / scaffold).
 *
 * The deterministic counterpart to `check-readiness.mjs --select` (which tells you *what* to work):
 * this performs the *mechanical* state changes the agent otherwise does by hand on every item — flip
 * `status`, stamp `dateStarted`/`dateResolved`, set `graduatedTo`, allocate the next free `NNN`. Each
 * is a surgical frontmatter splice (the body is never touched — see `backlog/frontmatter.mjs`), guarded
 * by the legal `from` status so the script can't double-claim or resolve an open item. One command
 * replaces a re-read → reason → Edit round-trip, saving a tool call and context on every transition.
 *
 * It does the EDIT only — never the gate. `claim` doesn't run tests; `resolve` assumes you've already
 * run the close-out gate (tests + check:standards green). And it stays out of the chat-rename
 * discipline: `claim` prints the rename slug for you to copy, but the script can't (and doesn't) rename.
 *
 * Usage:
 *   node scripts/backlog.mjs claim   <NNN> [--as=preparing] [--force]  # open    → active (or preparing, for /prepare) + dateStarted=today; prints rename slug. Refuses if the item's own file is dirty (claim-first guard); --force overrides
 *   node scripts/backlog.mjs resolve <NNN> [--graduated-to=X] [--codified-to=Y] [--force]  # active → resolved + dateResolved=today (+ graduatedTo); a kind:decision REQUIRES --codified-to=<doc#anchor|one-off> (#911 gate); an epic with open children is refused unless --force (#658 no-open-slice guard)
 *   node scripts/backlog.mjs release <NNN>                       # active|preparing → open (abandon/redirect; stamps untouched)
 *   node scripts/backlog.mjs scaffold --kind=story --size=3 --title="..." [--digest="..."] [--blocked-by=NNN,NNN] [--parent=NNN] [--session=<slug>]   # --kind ∈ story|epic|task|decision (#466/#487). --session ⇒ born `active`+`scaffoldedBy` (owned until settle, #670); without it, born `open` (default)
 *   node scripts/backlog.mjs settle   <NNN>                         # born-active scaffold (--session) → open: publish it once digest+edges+body are authored (#670)
 *   node scripts/backlog.mjs reserve   <NNN...> --session=<slug>     # soft-hold planned items (#083 cross-session deprioritize)
 *   node scripts/backlog.mjs unreserve [--session=<slug>] [<NNN...>] # release soft holds (whole session, or specific items)
 *   add --json to any verb for machine-readable output.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTransition, readField } from './backlog/frontmatter.mjs';
import { nextNum, slugify, renderItem } from './backlog/scaffold.mjs';
import { parseReservations, emptyState, addHolds, removeBySession, removeNums, pruneExpired, serialize } from './readiness/reservations.mjs';
import { parseClaims, serializeClaims, pruneExpiredClaims, recordClaim, porcelainFiles } from './readiness/claimScope.mjs';
import { fitAffineCost, budgetFromFit, impliedCapacity, isKnownStopReason, KNOWN_STOP_REASONS } from './backlog/capacity.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'backlog');
const CAPACITY_PATH = join(ROOT, '.claude/skills/batch-backlog-items/capacity.json');
const RESERVATIONS_PATH = join(ROOT, '.claude/skills/batch-backlog-items/reservations.json');
const CLAIMS_PATH = join(ROOT, '.claude/skills/batch-backlog-items/claims.json');
const RED = '\x1b[31m', GRN = '\x1b[32m', YEL = '\x1b[33m', DIM = '\x1b[2m', BLD = '\x1b[1m', RST = '\x1b[0m';

const argv = process.argv.slice(2);
const JSON_MODE = argv.includes('--json');
const verb = argv[0];
const flag = (name) => { const m = argv.find((a) => a.startsWith(`--${name}=`)); return m ? m.slice(name.length + 3) : undefined; };
const positional = argv.slice(1).filter((a) => !a.startsWith('--'));

const today = () => new Date().toISOString().slice(0, 10);
const files = () => readdirSync(DIR).filter((f) => f.endsWith('.md'));

function die(msg) {
  if (JSON_MODE) console.log(JSON.stringify({ ok: false, error: msg }));
  else console.error(`${RED}✗${RST} ${msg}`);
  process.exit(1);
}
function ok(payload, human) {
  if (JSON_MODE) console.log(JSON.stringify({ ok: true, ...payload }));
  else console.log(human);
  process.exit(0);
}

/**
 * Enumerate the open children of an epic by `parent:` EDGE (never the body's "N children" prose, which
 * goes stale — the #658 footgun). Returns every child item whose `status` isn't `resolved`, so `resolve`
 * can refuse to close an umbrella with live work under it BEFORE writing the bad state (instead of the
 * post-hoc `check:standards` catch). Mirrors the gate's resolved-epic-with-open-child rule.
 * @param {string} padded  The epic's zero-padded NNN.
 * @returns {{ num: string, status: string }[]}
 */
function openChildrenOf(padded) {
  const open = [];
  for (const f of files()) {
    const content = readFileSync(join(DIR, f), 'utf8');
    const parent = readField(content, 'parent');
    if (parent !== padded) continue;
    const status = readField(content, 'status') || 'open';
    if (status !== 'resolved') open.push({ num: f.match(/^\d+/)[0], status });
  }
  return open;
}

/** Resolve a bare NNN (or NNN-slug) to its current filename, or die if it's missing/ambiguous. */
function resolveFile(ref) {
  if (!ref) die('missing <NNN> — e.g. `backlog.mjs claim 122`');
  const num = (String(ref).match(/^(\d+)/) || [])[1];
  if (!num) die(`"${ref}" is not a valid NNN reference`);
  const padded = num.padStart(3, '0');
  const matches = files().filter((f) => f.startsWith(`${padded}-`));
  if (matches.length === 0) die(`no backlog item #${padded} on disk`);
  if (matches.length > 1) die(`#${padded} is ambiguous: ${matches.join(', ')}`);
  return matches[0];
}

function transition(v) {
  const file = resolveFile(positional[0]);
  const rel = `backlog/${file}`;
  const abs = join(DIR, file);
  const before = readFileSync(abs, 'utf8');
  // No WHOLE-tree git/commit check here: concurrency is owned by the status transition itself — `claim`
  // only succeeds from `open`, so a second claimer hits an already-`active` item and the transition errors
  // (plus the `reserve` session soft-holds, #083). The tree's commit state at large is irrelevant to
  // ownership (a perpetually-dirty tree is the normal baseline), so claim never inspects the tree —
  // EXCEPT the per-item cleanliness guard below, which inspects only the single file being claimed.
  const as = flag('as');
  if (v === 'claim' && as && as !== 'active' && as !== 'preparing') die(`--as="${as}" is not valid — use --as=preparing (a /prepare claim) or omit for a normal active claim`);
  // Claim-first guard: a claim must be the FIRST action on an item — grounding, editing, and presenting
  // its substance all come AFTER the flip (next turn). The status transition alone can't catch a session
  // that read + edited the body BEFORE claiming: claim would silently bundle those pre-claim edits into the
  // claimed file (it doesn't break — it absorbs them, which is worse, since the two-go arc was skipped).
  // So for `claim` we additionally refuse when THE ITEM'S OWN FILE is already dirty — scoped to this one
  // file (via `-- <path>`) so a routinely-dirty tree or concurrent sessions on OTHER items never trip it.
  // Best-effort: a git hiccup must never block a claim. `--force` overrides for the rare legit case (e.g.
  // claiming a freshly-scaffolded, not-yet-committed item). NOTE: a pre-claim READ + chat presentation
  // leaves no on-disk trace and so cannot be gated here — the skill's claim-first STOP covers that path.
  if (v === 'claim' && !argv.includes('--force')) {
    let dirty = '';
    try { dirty = execFileSync('git', ['status', '--porcelain', '--', rel], { cwd: ROOT, encoding: 'utf8' }).trim(); }
    catch { /* best-effort — never block a claim on a git/IO hiccup */ }
    if (dirty) die(`#${file.match(/^\d+/)[0]} — ${rel} has uncommitted edits; a claim must be the first action on an item (ground / edit / present AFTER claiming, next turn). Commit, stash, or revert those edits and re-claim — or pass --force if this is deliberate (e.g. a freshly-scaffolded item).`);
  }
  // No-open-slice guard (#658): an epic can't close while live work sits under it. Enumerate children by
  // the `parent:` EDGE (not the body's stale "N children" listing) and refuse BEFORE writing — so the
  // `resolved-epic-with-open-child` contradiction is never created, not just caught later by the gate.
  // `--force` overrides for the rare deliberate mid-re-parent case (prints what it stepped over).
  if (v === 'resolve' && readField(before, 'kind') === 'epic') {
    const padded = file.match(/^\d+/)[0];
    const openKids = openChildrenOf(padded);
    if (openKids.length && !argv.includes('--force'))
      die(`#${padded} is an epic with ${openKids.length} open child slice(s) — resolve or re-parent them first, or pass --force:\n${openKids.map((k) => `    #${k.num} — ${k.status}`).join('\n')}`);
    if (openKids.length) console.error(`${YEL}warning:${RST} ${DIM}--force: resolving epic #${padded} over ${openKids.length} open child(ren): ${openKids.map((k) => `#${k.num}`).join(', ')}${RST}`);
  }
  const res = applyTransition(before, v, { today: today(), graduatedTo: flag('graduated-to'), codifiedTo: flag('codified-to'), as });
  if (res.error) die(`#${file.match(/^\d+/)[0]} — ${res.error}`);
  writeFileSync(abs, res.content);
  const id = file.replace(/\.md$/, '');
  const slug = id; // the rename slug is the full id (NNN-slug)
  if (v === 'claim') {
    // Clear-on-claim (#083 invariant 2): a hard claim supersedes any soft reservation on this item —
    // drop it so the now-`active` item never lingers as a stale hold against another session.
    saveReservations(removeNums(loadReservations(), [file.match(/^\d+/)[0]]));
    // Gate-attribution baseline (#952, #949 Fork 2-A): snapshot the files ALREADY dirty (everyone else's
    // in-flight + pre-existing) the first time this session claims, and stamp the owning id. Lets
    // `check:standards --scope=<session>` later block only on files THIS session dirtied. Best-effort —
    // a git/IO hiccup must never fail the claim (attribution is an opt-in convenience, not the lock).
    const session = flag('session');
    if (session) {
      try {
        const baselineFiles = [...porcelainFiles(execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }))];
        saveClaims(recordClaim(loadClaims(), { session, id, baselineFiles, nowIso: new Date().toISOString() }));
      } catch { /* attribution is best-effort — never block a claim on it */ }
    }
  }
  if (v === 'claim') {
    const claimedStatus = as === 'preparing' ? 'preparing' : 'active';
    const verbWord = claimedStatus === 'preparing' ? 'prepping' : 'claimed';
    // The hard-stop ("claim turn ends here") guards the /decision two-go arc: claim and ratify are two
    // distinct turns so a present+discuss can't collapse into a commit, and a concurrent session can't be
    // raced. /prepare has no such arc — prep is autonomous agent work (research + authoring, no ruling),
    // so a `preparing` claim flows straight into the passes in the same turn. Emit the stop only for the
    // decision claim (#1397).
    const tail = claimedStatus === 'preparing'
      ? `\n\n${DIM}Proceed with the prep passes now — claiming and preparing are one turn (prep makes no ruling, so there is no two-go arc to split).${RST}`
      : `\n\n${YEL}⏸ This is the claim turn — it ends here.${RST} Do NOT ground, present, or discuss the item's substance now. Stop, let the chat be renamed, and begin the work next turn (the claim and its substance are two distinct turns — collapsing them races concurrent sessions and skips the two-go arc).`;
    ok({ verb: v, id, file: rel, slug, status: claimedStatus },
      `${GRN}✓ ${verbWord}${RST} ${id} ${DIM}→ ${claimedStatus} (dateStarted ${today()})${RST}\n\n${DIM}Rename this chat via the tab menu to label this session — copy:${RST}\n\`\`\`\n${slug}\n\`\`\`${tail}`);
  }
  if (v === 'resolve') {
    const g = flag('graduated-to');
    const c = flag('codified-to');
    ok({ verb: v, id, file: rel, status: 'resolved', graduatedTo: g, codifiedIn: c },
      `${GRN}✓ resolved${RST} ${id} ${DIM}→ resolved (dateResolved ${today()}${g ? `, graduatedTo ${g}` : ''}${c ? `, codifiedIn ${c}` : ''})${RST}${g ? '' : `\n${YEL}note:${RST} ${DIM}no --graduated-to set; if a resolved idea spawned no entity, set graduatedTo=none by hand${RST}`}`);
  }
  ok({ verb: v, id, file: rel, status: 'open' }, `${GRN}✓ released${RST} ${id} ${DIM}→ open${RST}`);
}

/** Read the cross-session reservation registry (#083); a missing/unreadable file degrades to empty. */
function loadReservations() {
  try { return parseReservations(readFileSync(RESERVATIONS_PATH, 'utf8')); }
  catch { return emptyState(); }
}
/** Write the registry, self-pruning expired holds on every write (TTL hygiene). */
function saveReservations(state) {
  writeFileSync(RESERVATIONS_PATH, serialize(pruneExpired(state, Date.now())));
}

/** Read the per-session claim-baseline registry (#952); a missing/unreadable file degrades to empty. */
function loadClaims() {
  try { return parseClaims(readFileSync(CLAIMS_PATH, 'utf8')); }
  catch { return parseClaims(''); }
}
/** Write the claim registry, self-pruning expired session baselines on every write (TTL hygiene). */
function saveClaims(state) {
  writeFileSync(CLAIMS_PATH, serializeClaims(pruneExpiredClaims(state, Date.now())));
}

/**
 * reserve <NNN...> --session=<slug> — soft-hold the items a batch PLANS at plan-approval (#083). A live
 * hold deprioritizes (never excludes) those items for OTHER sessions' `check:readiness --select`, so a
 * second concurrent batch packs around them. Advisory: the real lock is still `claim`. First-holder-wins
 * (a num already held by another session is left alone); the holding session is recorded for cleanup.
 */
function reserve() {
  const session = flag('session');
  if (!session) die('reserve needs --session=<batch-slug> — the session that holds these (e.g. batch-2026-06-12-083)');
  const nums = positional.map((p) => (String(p).match(/^(\d+)/) || [])[1]).filter(Boolean);
  if (!nums.length) die('reserve needs one or more <NNN> to soft-hold');
  for (const n of nums) resolveFile(n); // a typo must not hold a phantom item
  const state = addHolds(pruneExpired(loadReservations(), Date.now()), nums, session, new Date().toISOString());
  saveReservations(state);
  const padded = nums.map((n) => n.padStart(3, '0'));
  ok({ verb: 'reserve', session, held: padded, ttlMinutes: state.ttlMinutes },
    `${GRN}✓ reserved${RST} #${padded.join(', #')} ${DIM}→ soft-held by ${session} (deprioritized for other sessions; advisory, TTL ${state.ttlMinutes}m)${RST}\n${DIM}clear on stop: ${RST}node scripts/backlog.mjs unreserve --session=${session}`);
}

/**
 * unreserve [--session=<slug>] [<NNN...>] — release soft holds (#083 invariant 2). `--session` clears
 * the WHOLE session's holds (the batch stop/hand-off path); bare `<NNN>` releases specific items. At
 * least one must be given. Idempotent — releasing an already-free item is a no-op.
 */
function unreserve() {
  const session = flag('session');
  const nums = positional.map((p) => (String(p).match(/^(\d+)/) || [])[1]).filter(Boolean);
  if (!session && !nums.length) die('unreserve needs --session=<slug> (clear a whole session) and/or one or more <NNN>');
  let state = loadReservations();
  const before = state.held.length;
  if (session) state = removeBySession(state, session);
  if (nums.length) state = removeNums(state, nums);
  state = pruneExpired(state, Date.now());
  saveReservations(state);
  const cleared = before - state.held.length;
  ok({ verb: 'unreserve', session: session ?? null, nums: nums.map((n) => n.padStart(3, '0')), cleared },
    `${GRN}✓ unreserved${RST} ${DIM}— released ${cleared} hold(s)${session ? ` for ${session}` : ''}; ${state.held.length} still held${RST}`);
}

function scaffold() {
  // One `kind` axis (#466/#487). Prefer --kind; accept legacy --type/--workitem (a `decision` type wins,
  // else the workItem carries the kind) so older skill/doc invocations don't break mid-migration.
  let kind = flag('kind');
  if (!kind) {
    const legacyType = flag('type');
    const legacyWorkitem = flag('workitem');
    if (legacyType || legacyWorkitem) kind = legacyType === 'decision' ? 'decision' : (legacyWorkitem || 'story');
    else kind = 'story';
  }
  if (!['story', 'epic', 'task', 'decision'].includes(kind)) die(`--kind must be story|epic|task|decision (got "${kind}")`);
  const size = flag('size') !== undefined ? Number(flag('size')) : undefined;
  const title = flag('title');
  if (!title) die('scaffold needs --title="…"');
  if (kind === 'story' && !Number.isFinite(size)) die('a story needs --size=<Fibonacci>');
  const slug = flag('slug') || slugify(title);
  const blockedBy = (flag('blocked-by') || '').split(',').map((s) => s.trim()).filter(Boolean).map((n) => n.padStart(3, '0'));
  const parent = flag('parent') ? flag('parent').padStart(3, '0') : undefined;

  const existing = files().map((f) => (f.match(/^(\d+)/) || [])[1]).filter(Boolean);
  const num = nextNum(existing);
  const fileName = `${num}-${slug}.md`;
  const abs = join(DIR, fileName);
  // Re-glob immediately before write to win the id race; if taken, bump once.
  let finalNum = num, finalName = fileName, finalAbs = abs;
  if (files().some((f) => f.startsWith(`${num}-`))) {
    finalNum = nextNum([...existing, num]);
    finalName = `${finalNum}-${slug}.md`;
    finalAbs = join(DIR, finalName);
  }
  // Born-active when a creating session owns it (#670): `scaffold --session=<slug>` stamps the item
  // `status: active` + `scaffoldedBy`, so it is excluded from every OTHER session's batch pool until the
  // author `settle`s it (closes the born-public, half-authored-item race). Without `--session` (ad-hoc /
  // hand / non-batch callers) it stays born-open, the long-standing default.
  const session = flag('session');
  const content = renderItem({ kind, size, slug, title, today: today(), blockedBy, parent, digest: flag('digest'), scaffoldedBy: session });
  writeFileSync(finalAbs, content);
  const id = finalName.replace(/\.md$/, '');
  const filled = !!flag('digest');
  const nextStep = session
    ? `owned by ${session} (born active) — author digest + edges + body, then \`settle ${finalNum}\` to publish it (→ open)`
    : (filled ? 'add the body (digest set), then re-run check:standards' : 'fill the digest (TODO line) and body, then re-run check:standards');
  ok({ verb: 'scaffold', id, num: finalNum, file: `backlog/${finalName}`, digestFilled: filled, status: session ? 'active' : 'open', scaffoldedBy: session ?? null },
    `${GRN}✓ scaffolded${RST} ${BLD}#${finalNum}${RST} ${DIM}backlog/${finalName}${RST}\n${YEL}→ ${nextStep}${RST}`);
}

/**
 * settle <NNN> — publish a born-active scaffold (#670): flip a `scaffold --session` item from
 * `active` (owned, half-authored, pool-excluded) to `open` (claimable by anyone), once its digest +
 * `blockedBy`/`parent` edges + body are written. Explicit, not auto-on-digest-fill, because only the
 * author knows the edges are final. Refuses an item that is not a born-active scaffold (no `scaffoldedBy`)
 * — a claim-active item is settled by `resolve`, not this.
 */
function settle() {
  const id = positional[0];
  if (!id) die('settle needs <NNN> — the born-active scaffold to publish (→ open)');
  const padded = String(id).padStart(3, '0');
  const file = files().find((f) => f.startsWith(`${padded}-`));
  if (!file) die(`settle: no backlog item #${padded}`);
  const abs = join(DIR, file);
  let src = readFileSync(abs, 'utf8');
  if (!/^scaffoldedBy:/m.test(src))
    die(`settle: #${padded} is not a born-active scaffold (no scaffoldedBy) — a claimed item is closed by \`resolve\`, not \`settle\``);
  // active → open, and drop the ownership stamps (settled = published, no longer session-owned).
  src = src.replace(/^status: active$/m, 'status: open')
           .replace(/^scaffoldedBy: .*\n/m, '')
           .replace(/^dateScaffolded: .*\n/m, '');
  writeFileSync(abs, src);
  const rel = `backlog/${file}`;
  ok({ verb: 'settle', id: file.replace(/\.md$/, ''), file: rel, status: 'open' },
    `${GRN}✓ settled${RST} ${file.replace(/\.md$/, '')} ${DIM}→ open (published; ownership stamps cleared)${RST}`);
}

/**
 * calibrate — fold one session's `(points resolved, context% at close)` into the **pooled affine
 * context-cost model** that sizes a points-budgeted batch (capacity.json; ratified in #1505). This is the
 * close-out feedback loop: the count cap is gone, so the budget must stay honest about what a session
 * actually fits. `--points` = cost-points resolved (sum of each item's batchCost: a story's size, a
 * task = 2); `--context-pct` = the share of the window consumed at close (the editor's context meter,
 * 1–100); `--stop-reason` (optional) = why the batch stopped, recorded as **audit metadata only** — since
 * #1505 every batch trains the model regardless of stop reason (see capacity.mjs for why).
 *
 * Estimator = a Deming (errors-in-variables) fit of `context% = overhead + cost·points` over EVERY
 * sample's raw `(points, context%)` in the retained 12-sample window. The fixed overhead is the intercept
 * (real work in every batch), so it is measured rather than misattributed to per-point cost, and the old
 * work-bound exclusion gate is gone — work-bound is the common case, so dropping it stops the estimate
 * starving on the rare capacity-bound stop. The next budget is the largest P under a context ceiling minus
 * a data-driven margin (`budgetFromFit`); `contextCeiling`/`marginK` in the JSON tune it (defaults 80/1),
 * replacing the arbitrary ×0.6. The 12-sample window ages out old sessions, staying adaptive to a regime
 * change (a new model); RLS-with-forgetting is the planned successor (#1516).
 */
function calibrate() {
  const points = Number(flag('points'));
  const ctxPct = Number(flag('context-pct'));
  const stopReason = flag('stop-reason'); // optional; audit metadata only since #1505 (every batch trains)
  if (!Number.isFinite(points) || points <= 0) die('calibrate needs --points=<cost-points resolved this session>');
  if (!Number.isFinite(ctxPct) || ctxPct <= 0 || ctxPct > 100) die('calibrate needs --context-pct=<1–100, context consumed at close>');
  // Fail-closed on an unrecognised --stop-reason (#968): reject a typo / un-listed token rather than
  // recording a garbage audit tag.
  if (stopReason && !isKnownStopReason(stopReason))
    die(`calibrate: unknown --stop-reason="${stopReason}" — use one of: ${[...KNOWN_STOP_REASONS].join(', ')} (or omit it)`);

  let cap;
  try { cap = JSON.parse(readFileSync(CAPACITY_PATH, 'utf8')); }
  catch { die(`cannot read ${CAPACITY_PATH} — run a batch in this repo first (the file ships seeded)`); }

  const sample = { date: today(), points, contextPct: ctxPct };
  if (stopReason) sample.stopReason = stopReason;
  // #1516: the hard 12-sample window is gone — the RLS forgetting factor (below) ages old samples out
  // smoothly instead of by a cutoff, so ALL history is kept and weighted by recency. The `.slice(-200)`
  // is a pure storage bound (the file can't grow without limit), not a statistical window: at the default
  // forgetting ≈ 0.99 a 200-old sample already weighs 0.99^199 ≈ 0.13, well past the effective window.
  const samples = [...(Array.isArray(cap.samples) ? cap.samples : []), sample].slice(-200);

  const ceiling = Number.isFinite(cap.contextCeiling) ? cap.contextCeiling : 80;
  const k = Number.isFinite(cap.marginK) ? cap.marginK : 1;
  // RLS forgetting factor (#1516): tunable via capacity.json, default 0.99 (the ≈0.98–0.995 band ratified
  // in #1505). Newest samples dominate; a regime change ages out smoothly. `1` → unweighted pooled fit.
  const forgetting = Number.isFinite(cap.forgetting) && cap.forgetting > 0 && cap.forgetting <= 1 ? cap.forgetting : 0.99;
  const fit = fitAffineCost(samples, { forgetting });
  const budget = budgetFromFit(fit, { ceiling, k });
  const capPts = impliedCapacity(fit);

  // Fall back to the prior estimate only when the fit is degenerate (e.g. < 2 samples on a fresh file).
  const prevBudget = Number.isFinite(cap.budgetPoints) ? cap.budgetPoints
    : Number.isFinite(cap.capacityPoints) ? Math.round(cap.capacityPoints * (cap.targetFraction ?? 0.5)) : null;
  const nextBudget = budget ?? prevBudget;

  cap.samples = samples;
  if (fit) {
    cap.fit = { overhead: Math.round(fit.overhead * 100) / 100, cost: Math.round(fit.cost * 10000) / 10000, n: fit.n, nEff: Math.round(fit.nEff * 10) / 10, residualStd: Math.round(fit.residualStd * 100) / 100 };
    if (capPts != null) cap.capacityPoints = capPts;
  }
  cap.contextCeiling = ceiling;
  cap.marginK = k;
  cap.forgetting = forgetting;
  if (nextBudget != null) cap.budgetPoints = nextBudget;
  delete cap.ema; // legacy fixed-α weight — long unused
  delete cap.targetFraction; // superseded by contextCeiling/marginK (#1505); budgetPoints is now stored directly
  writeFileSync(CAPACITY_PATH, JSON.stringify(cap, null, 2) + '\n');

  const note = fit
    ? `affine fit over ${fit.n} (nEff ${cap.fit.nEff} @ forgetting ${forgetting}; overhead ${cap.fit.overhead}%, cost ${cap.fit.cost}%/pt); capacity ≈ ${capPts}`
    : `fit degenerate (need ≥2 samples) — held prior budget`;
  ok({ verb: 'calibrate', points, contextPct: ctxPct, stopReason: stopReason ?? null, fit: cap.fit ?? null, capacityPoints: cap.capacityPoints ?? null, budget: nextBudget },
    `${GRN}✓ calibrated${RST} ${DIM}— ${points} pts at ${ctxPct}% → ${note}; next batch budget ≈ ${RST}${BLD}${nextBudget ?? '?'} pts${RST}`);
}

switch (verb) {
  case 'claim': case 'resolve': case 'release': transition(verb); break;
  case 'scaffold': scaffold(); break;
  case 'settle': settle(); break;
  case 'calibrate': calibrate(); break;
  case 'reserve': reserve(); break;
  case 'unreserve': unreserve(); break;
  default:
    console.error(`${BLD}backlog.mjs${RST} — mechanical backlog-status CLI\n` +
      `  ${GRN}claim${RST} <NNN> [--as=preparing] [--force]   open → active (or preparing, /prepare) + dateStarted; refuses on a dirty item file (claim-first), --force overrides\n` +
      `  ${GRN}resolve${RST} <NNN> [--graduated-to=X] [--codified-to=Y] [--force]   active → resolved + dateResolved (decision REQUIRES --codified-to=<doc#anchor|one-off>; an epic with open children is refused unless --force)\n` +
      `  ${GRN}release${RST} <NNN>               active|preparing → open\n` +
      `  ${GRN}scaffold${RST} --kind=story|epic|task|decision --size= --title= [--digest=] [--blocked-by=] [--parent=] [--session=<slug>]   --session ⇒ born active+owned (#670), publish with settle\n` +
      `  ${GRN}settle${RST} <NNN>               born-active scaffold (--session) → open (publish once authored)\n` +
      `  ${GRN}calibrate${RST} --points= --context-pct= [--stop-reason=budget|context|empty-pool|fork|gate|outgrew|manual|abort]   fold a session into the batch point-budget estimate\n` +
      `  ${GRN}reserve${RST} <NNN...> --session=<slug>    soft-hold planned items (deprioritize for other sessions)\n` +
      `  ${GRN}unreserve${RST} [--session=<slug>] [<NNN...>]  release soft holds (clear a session, or specific items)\n` +
      `  (add --json for machine output)`);
    process.exit(verb ? 1 : 0);
}
