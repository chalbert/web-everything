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
 *   node scripts/backlog.mjs claim   <NNN> [--as=preparing]      # open    → active (or preparing, for /prepare) + dateStarted=today; prints rename slug
 *   node scripts/backlog.mjs resolve <NNN> [--graduated-to=X]    # active  → resolved + dateResolved=today (+ graduatedTo)
 *   node scripts/backlog.mjs release <NNN>                       # active|preparing → open (abandon/redirect; stamps untouched)
 *   node scripts/backlog.mjs scaffold --type=idea --workitem=story --size=3 --title="..." [--digest="..."] [--blocked-by=NNN,NNN] [--parent=NNN]
 *   node scripts/backlog.mjs reserve   <NNN...> --session=<slug>     # soft-hold planned items (#083 cross-session deprioritize)
 *   node scripts/backlog.mjs unreserve [--session=<slug>] [<NNN...>] # release soft holds (whole session, or specific items)
 *   add --json to any verb for machine-readable output.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTransition, readField } from './backlog/frontmatter.mjs';
import { nextNum, slugify, renderItem } from './backlog/scaffold.mjs';
import { parseReservations, emptyState, addHolds, removeBySession, removeNums, pruneExpired, serialize } from './readiness/reservations.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'backlog');
const CAPACITY_PATH = join(ROOT, '.claude/skills/batch-backlog-items/capacity.json');
const RESERVATIONS_PATH = join(ROOT, '.claude/skills/batch-backlog-items/reservations.json');
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
  // No git/commit check here: concurrency is owned by the status transition itself — `claim` only
  // succeeds from `open`, so a second claimer hits an already-`active` item and the transition errors
  // (plus the `reserve` session soft-holds, #083). The working tree's commit state is irrelevant to
  // ownership (a perpetually-dirty tree is the normal baseline), so claim never inspects it.
  const as = flag('as');
  if (v === 'claim' && as && as !== 'active' && as !== 'preparing') die(`--as="${as}" is not valid — use --as=preparing (a /prepare claim) or omit for a normal active claim`);
  const res = applyTransition(before, v, { today: today(), graduatedTo: flag('graduated-to'), as });
  if (res.error) die(`#${file.match(/^\d+/)[0]} — ${res.error}`);
  writeFileSync(abs, res.content);
  const id = file.replace(/\.md$/, '');
  const slug = id; // the rename slug is the full id (NNN-slug)
  if (v === 'claim') {
    // Clear-on-claim (#083 invariant 2): a hard claim supersedes any soft reservation on this item —
    // drop it so the now-`active` item never lingers as a stale hold against another session.
    saveReservations(removeNums(loadReservations(), [file.match(/^\d+/)[0]]));
  }
  if (v === 'claim') {
    const claimedStatus = as === 'preparing' ? 'preparing' : 'active';
    const verbWord = claimedStatus === 'preparing' ? 'prepping' : 'claimed';
    ok({ verb: v, id, file: rel, slug, status: claimedStatus },
      `${GRN}✓ ${verbWord}${RST} ${id} ${DIM}→ ${claimedStatus} (dateStarted ${today()})${RST}\n\n${DIM}Rename this chat via the tab menu to label this session — copy:${RST}\n\`\`\`\n${slug}\n\`\`\``);
  }
  if (v === 'resolve') {
    const g = flag('graduated-to');
    ok({ verb: v, id, file: rel, status: 'resolved', graduatedTo: g },
      `${GRN}✓ resolved${RST} ${id} ${DIM}→ resolved (dateResolved ${today()}${g ? `, graduatedTo ${g}` : ''})${RST}${g ? '' : `\n${YEL}note:${RST} ${DIM}no --graduated-to set; if a resolved idea spawned no entity, set graduatedTo=none by hand${RST}`}`);
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
  const type = flag('type') || 'idea';
  const workitem = flag('workitem') || 'story';
  const size = flag('size') !== undefined ? Number(flag('size')) : undefined;
  const title = flag('title');
  if (!title) die('scaffold needs --title="…"');
  if (workitem === 'story' && !Number.isFinite(size)) die('a story needs --size=<Fibonacci>');
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
  const content = renderItem({ type, workItem: workitem, size, slug, title, today: today(), blockedBy, parent, digest: flag('digest') });
  writeFileSync(finalAbs, content);
  const id = finalName.replace(/\.md$/, '');
  const filled = !!flag('digest');
  ok({ verb: 'scaffold', id, num: finalNum, file: `backlog/${finalName}`, digestFilled: filled },
    `${GRN}✓ scaffolded${RST} ${BLD}#${finalNum}${RST} ${DIM}backlog/${finalName}${RST}\n${YEL}→ ${filled ? 'add the body (digest set), then re-run check:standards' : 'fill the digest (TODO line) and body, then re-run check:standards'}${RST}`);
}

/**
 * calibrate — fold one session's observed (points resolved ÷ context fraction) into the
 * session-capacity estimate that sizes a points-budgeted batch (capacity.json). This is the close-out
 * feedback loop: the count cap is gone, so the budget must stay honest about what a session actually
 * fits. `--points` = cost-points resolved (sum of each item's batchCost: a story's size, a task = 2);
 * `--context-pct` = the share of the window consumed at close (the editor's context meter, 1–100).
 *
 * Estimator = a CONTEXT-WEIGHTED MEAN over the retained 12-sample window, NOT a fixed-α EMA. A fixed-α
 * blend perpetually tracks the last few sessions and never tightens — more samples don't shrink the
 * error, they just slide the window (it can't get more accurate with time). A weighted mean over the
 * stored history converges as samples accumulate AND finally *uses* that history. Each sample's implied
 * capacity is trusted in proportion to how much of a window it exercised: a 53%-context reading is a
 * strong measurement; a ~13% one (usually an early non-budget stop — empty pool / fork / gate, whose
 * `points ÷ tiny-fraction` extrapolation is near-noise and biased low by fixed startup overhead) barely
 * counts. The 12-sample window still ages out old sessions, so it stays adaptive to a real regime change
 * (e.g. a new model). Weighting by context-fraction is the natural "fraction of a session observed" trust.
 */
function calibrate() {
  const points = Number(flag('points'));
  const ctxPct = Number(flag('context-pct'));
  if (!Number.isFinite(points) || points <= 0) die('calibrate needs --points=<cost-points resolved this session>');
  if (!Number.isFinite(ctxPct) || ctxPct <= 0 || ctxPct > 100) die('calibrate needs --context-pct=<1–100, context consumed at close>');

  let cap;
  try { cap = JSON.parse(readFileSync(CAPACITY_PATH, 'utf8')); }
  catch { die(`cannot read ${CAPACITY_PATH} — run a batch in this repo first (the file ships seeded)`); }

  const implied = Math.round(points / (ctxPct / 100)); // what a full session would have fit at this rate
  const prev = Number.isFinite(cap.capacityPoints) ? cap.capacityPoints : implied;

  const samples = [...(Array.isArray(cap.samples) ? cap.samples : []),
    { date: today(), points, contextPct: ctxPct, impliedCapacity: implied }].slice(-12);
  // Context-weighted mean over the window: Σ(impliedᵢ · ctxᵢ) / Σ(ctxᵢ).
  const wsum = samples.reduce((s, x) => s + (Number(x.contextPct) || 0), 0);
  const next = wsum > 0
    ? Math.round(samples.reduce((s, x) => s + (Number(x.impliedCapacity) || 0) * (Number(x.contextPct) || 0), 0) / wsum)
    : implied;

  cap.capacityPoints = next;
  cap.samples = samples;
  delete cap.ema; // legacy fixed-α weight — no longer used (the estimator is now a weighted window mean)
  writeFileSync(CAPACITY_PATH, JSON.stringify(cap, null, 2) + '\n');

  const budget = Math.round(next * (cap.targetFraction ?? 0.5));
  ok({ verb: 'calibrate', points, contextPct: ctxPct, impliedCapacity: implied, capacityPoints: next, budget },
    `${GRN}✓ calibrated${RST} ${DIM}— ${points} pts at ${ctxPct}% → implied ${implied}; capacity ${prev} → ${BLD}${next}${RST}${DIM} (context-weighted mean of ${samples.length}); next batch budget ≈ ${RST}${BLD}${budget} pts${RST}`);
}

switch (verb) {
  case 'claim': case 'resolve': case 'release': transition(verb); break;
  case 'scaffold': scaffold(); break;
  case 'calibrate': calibrate(); break;
  case 'reserve': reserve(); break;
  case 'unreserve': unreserve(); break;
  default:
    console.error(`${BLD}backlog.mjs${RST} — mechanical backlog-status CLI\n` +
      `  ${GRN}claim${RST} <NNN> [--as=preparing]   open → active (or preparing, /prepare) + dateStarted\n` +
      `  ${GRN}resolve${RST} <NNN> [--graduated-to=X]   active → resolved + dateResolved\n` +
      `  ${GRN}release${RST} <NNN>               active|preparing → open\n` +
      `  ${GRN}scaffold${RST} --type= --workitem= --size= --title= [--digest=] [--blocked-by=] [--parent=]\n` +
      `  ${GRN}calibrate${RST} --points= --context-pct=   fold a session into the batch point-budget estimate\n` +
      `  ${GRN}reserve${RST} <NNN...> --session=<slug>    soft-hold planned items (deprioritize for other sessions)\n` +
      `  ${GRN}unreserve${RST} [--session=<slug>] [<NNN...>]  release soft holds (clear a session, or specific items)\n` +
      `  (add --json for machine output)`);
    process.exit(verb ? 1 : 0);
}
