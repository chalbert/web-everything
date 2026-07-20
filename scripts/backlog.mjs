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
 *   node scripts/backlog.mjs retype  <NNN> [--to=<kind>] [--size=N] [--status=parked]  # SANCTIONED pack-phase flag-fix — retype a mis-flagged item / bump size / park it through the CLI instead of a raw primary-tree Edit (no LANE_GUARD_OFF). Frontmatter-only (#2123)
 *   node scripts/backlog.mjs yield    <NNN-slug>                 # move a LOCAL-ONLY NNN collision to the next free number (the guard's "a new item takes the next free number; yield this one"). Refuses a git-tracked file — NNN is immutable
 *   node scripts/backlog.mjs scaffold --kind=story --size=3 --title="..." [--digest="..."] [--blocked-by=NNN,NNN] [--parent=NNN] [--session=<slug>]   # --kind ∈ story|epic|task|decision (#466/#487). --session ⇒ born `active`+`scaffoldedBy` (owned until settle, #670); without it, born `open` (default)
 *   node scripts/backlog.mjs settle   <NNN>                         # born-active scaffold (--session) → open: publish it once digest+edges+body are authored (#670)
 *   node scripts/backlog.mjs reserve   <NNN...> --session=<slug>     # soft-hold planned items (#083 cross-session deprioritize)
 *   node scripts/backlog.mjs unreserve [--session=<slug>] [<NNN...>] # release soft holds (whole session, or specific items)
 *   node scripts/backlog.mjs queue     <NNN...> [--lane=<ref>] [--session=<slug>]  # mark ready-to-merge (#2138 Fork 4) — claim/release refuse a queued item until the drain lands it
 *   node scripts/backlog.mjs unqueue   <NNN...>                     # clear the ready-to-merge mark (the drain's single clear point at landing)
 *   node scripts/backlog.mjs build-queue [--next] [--config=<path>]  # READ-ONLY (#2527): the ordered build queue — ready items in next-to-build order (tier→score→rank), each row annotated with its tier + score + buildQueued; --next prints the top CLEARED item (what the builder pulls); --config previews under a hypothetical config WITHOUT persisting. Distinct from the drain `queue` verb above
 *   node scripts/backlog.mjs build-queue add|remove <NNN>            # MANUAL CLEAR-FOR-BUILD gate (#2530): `add` sets buildQueued:true (the supervised builder may pull it); `remove` clears it. Frontmatter-only, lane-gated; never touches blockedBy/readiness. The builder pulls ONLY cleared items, so re-prioritizing never arms a build
 *   add --json to any verb for machine-readable output.
 */
import { readdirSync, readFileSync, writeFileSync, writeSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { applyTransition, applySettle, readField, setFrontmatterField, removeFrontmatterField, accrueCost } from './backlog/frontmatter.mjs';
import { parseCostTokens, formatCostTokens } from './backlog/cost-rates.mjs';
import { nextNum, slugify, renderItem } from './backlog/scaffold.mjs';
import { nextHash, normalizeId, idFromName, isHash, slugFromName } from './backlog/id.mjs';
import { parseReservations, emptyState, addHolds, removeBySession, removeNums, pruneExpired, serialize, sessionForNum } from './readiness/reservations.mjs';
import { parseClaims, serializeClaims, pruneExpiredClaims, recordClaim, recordTouch, mostRecentSession, porcelainFiles } from './readiness/claimScope.mjs';
import { parseQueued, emptyQueuedState, isQueued, queuedNums, addQueued, removeQueued, serializeQueued } from './readiness/queued-state.mjs';
import { parseHolds, emptyHoldState, isHeld, heldBy, heldNums, addHold, removeHold, pruneExpired as pruneHolds, leaseUntilIso, serializeHolds, DEFAULT_LEASE_MINUTES } from './readiness/prepare-hold-state.mjs';
import { fitAffineCost, budgetFromFit, impliedCapacity, isKnownStopReason, KNOWN_STOP_REASONS } from './backlog/capacity.mjs';
import { scanRepoLocusPrefixes } from './check-standards-rules.mjs';
import { numberPendingHashes } from './lane-drain.mjs';
import { laneGuardDecision, resolveReal } from './guard-lane.mjs';
import { TIERS, rankBetween, DEFAULT_CONFIG, validateConfig, orderQueueDetailed } from './lib/build-queue.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'backlog');
const requireCjs = createRequire(import.meta.url);
const BUILD_QUEUE_CONFIG_PATH = join(ROOT, 'scripts', 'build-queue-config.json');
const CAPACITY_PATH = join(ROOT, '.claude/skills/batch-backlog-items/capacity.json');
const RESERVATIONS_PATH = join(ROOT, '.claude/skills/batch-backlog-items/reservations.json');
const CLAIMS_PATH = join(ROOT, '.claude/skills/batch-backlog-items/claims.json');
const QUEUED_PATH = join(ROOT, '.claude/skills/batch-backlog-items/queued.json');
const PREPARE_HOLD_PATH = join(ROOT, '.claude/skills/batch-backlog-items/prepare-hold.json');
const RED = '\x1b[31m', GRN = '\x1b[32m', YEL = '\x1b[33m', DIM = '\x1b[2m', BLD = '\x1b[1m', RST = '\x1b[0m';

const argv = process.argv.slice(2);
const JSON_MODE = argv.includes('--json');
const verb = argv[0];
const flag = (name) => { const m = argv.find((a) => a.startsWith(`--${name}=`)); return m ? m.slice(name.length + 3) : undefined; };
const positional = argv.slice(1).filter((a) => !a.startsWith('--'));

const today = () => new Date().toISOString().slice(0, 10);
const files = () => readdirSync(DIR).filter((f) => f.endsWith('.md'));

/**
 * Write a line to a fd SYNCHRONOUSLY and completely, then return. `console.log` writes ASYNC to a pipe, and
 * `process.exit()` drops the unflushed tail — so a large payload (e.g. `build-queue --json`, ~37KB) is
 * silently truncated when a parent captures our stdout via a pipe (execFile), while a TTY/redirect-to-file
 * happens to win the race. A synchronous `writeSync` fully drains BEFORE `process.exit` runs, and crucially
 * keeps `die()`/`ok()` SYNCHRONOUS — every `die()` is a guard that must halt the caller in place (an async
 * write callback would let the code after the guard keep running). The EAGAIN loop handles a full
 * non-blocking pipe. The console `/api/backlog/queue` seam and the future builder both shell us over a pipe.
 */
function writeAllSync(fd, line) {
  // Coerce defensively: every caller passes a string today, but `String(...)` locks that in so a future
  // non-string payload degrades predictably rather than throwing inside the write loop.
  const buf = Buffer.from(String(line) + '\n', 'utf8');
  let off = 0;
  while (off < buf.length) {
    try { off += writeSync(fd, buf, off, buf.length - off); }
    catch (e) { if (e.code === 'EAGAIN') continue; if (e.code === 'EPIPE') break; throw e; }
  }
}
function die(msg) {
  if (JSON_MODE) writeAllSync(1, JSON.stringify({ ok: false, error: msg }));
  else writeAllSync(2, `${RED}✗${RST} ${msg}`);
  process.exit(1);
}
function ok(payload, human) {
  writeAllSync(1, JSON_MODE ? JSON.stringify({ ok: true, ...payload }) : human);
  process.exit(0);
}

// #1574 gap (1) — the CLI write path is the dominant locus-prefix leak: `scaffold`/`resolve`/`settle` write
// digest + body + `## Progress` prose straight to `fs`, never through the `Edit`/`Write` tools, so the
// load-bearing PreToolUse `--pre` hook never sees that content (#1364/#1454/#1455 all landed this way). Run
// the SAME pure detector the gate + `--pre` hook use on the content about to hit disk, and refuse with the
// same message — shift-left at the source (#883 "enforce at write-time"). Exempt cases (fenced code, md
// links, `@scope/pkg`, globs) are handled inside `scanRepoLocusPrefixes`, so only a genuine bare ref blocks.
function writeBacklogMd(abs, rel, content) {
  // Enforce the lane-isolation rule (#2302/#104/#2219/#2339) at the SOURCE, not only in the
  // PreToolUse(Bash) hook (guard-bash). That hook fires ONLY for Bash-*tool* calls in a session that
  // loads .claude/settings.json — a workflow/subagent/cron/headless caller that runs `backlog.mjs
  // cost|resolve|…` bypasses it and stamps the card straight onto the primary tree (observed 2026-07-10:
  // three `cost` stamps left uncommitted in primary). EVERY card-content mutation
  // (cost/claim/resolve/release/scaffold/settle/retype/yield/prepare-stamp) funnels through this one
  // writer; the drain's JIT-numbering + `number-stranded` use a SEPARATE writer (numberPendingHashes) and
  // are intentionally unaffected. Reuse guard-lane's realpath classification so there is a single source of
  // truth for "is this path a primary checkout"; ignore its message (that guard's LANE_GUARD_OFF escape does
  // NOT apply here — #2219/#2339 ratified nothing ever splices to primary, so this denial has no override).
  if (laneGuardDecision(resolveReal(abs), ROOT)) {
    die(`backlog item-mutation BLOCKED — "${rel}" resolves under the shared PRIMARY checkout. Every card ` +
        `mutation (cost/claim/resolve/release/scaffold/settle/retype/yield/prepare-stamp) must run in a LANE ` +
        `clone, never the primary tree — running it here stamps the item on primary and bypasses lane ` +
        `isolation (#2302/#104/#2219/#2339). Enforced at the source so non-Bash-tool channels ` +
        `(workflow/subagent/cron/headless) are covered too, not just the PreToolUse(Bash) hook. cd into a ` +
        `lane clone (~/workspace/.lanes/<repo>/lane-N) and run it there. There is no override.`);
  }
  const findings = scanRepoLocusPrefixes([{ file: rel, content }]);
  if (findings.length) {
    const { count, sample } = findings[0];
    die(`locus-prefix: ${count} bare code-path ref(s) in ${rel} lack a <repo>: prefix (#883; e.g. "${sample}" → "we:${sample}"). Prefix them now — don't leave it for the gate.`);
  }
  writeFileSync(abs, content);
  recordCliTouch(rel);
}

/**
 * 2-C touch-recording (#1661): record a file this CLI just spliced against the active session's `touched`
 * set, so `check:standards --scope` attributes a finding on a file already-dirty-at-claim but edited here as
 * **mine** (not a foreign red). The session is the `--session` flag when present, else the most-recently
 * claimed one (`mostRecentSession`). Best-effort — never let attribution bookkeeping fail a mutation.
 * (`recordTouch` no-ops if the session row doesn't exist yet, e.g. the very first claim before `recordClaim`
 * runs — there the baseline-diff already catches the newly-dirtied file.)
 */
function recordCliTouch(rel) {
  try {
    const claims = loadClaims();
    const session = flag('session') ?? mostRecentSession(claims);
    if (session) saveClaims(recordTouch(claims, { session, files: [rel], nowIso: new Date().toISOString() }));
  } catch { /* best-effort — attribution is advisory, never the lock */ }
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
    if (status !== 'resolved') open.push({ num: idFromName(f), status });
  }
  return open;
}

/**
 * Diagnose a not-found item before dying. A missing local file has two very different causes — the item
 * genuinely doesn't exist, or your checkout is simply behind origin (the common case for an item that was
 * just scaffolded and landed on `main` in another session/PR). The flat "not on disk" error conflated the
 * two and sent the caller down a wrong-premise path instead of a `git pull`, so on the FAILURE path only we
 * probe origin and, if the item exists there, say so.
 *
 * This is NOT a Rule #105 violation: #105 forbids a git *ownership* check on the happy path (a dirty tree is
 * never a drop-reason), and this stays true — the happy path resolves purely from local `files()`, fully
 * offline. This is a distinct *existence/freshness* probe that fires only when there is no local match, so
 * the network cost lands solely on the rare not-found death, never on a successful claim/resolve/release.
 * Best-effort throughout: any git hiccup (offline, no remote, timeout) falls back to the original plain message.
 */
function missingItemMessage(padded) {
  const plain = `no backlog item #${padded} on disk`;
  // The probe only ENRICHES an interactive error. `--json` (machine) mode's contract is a fast, offline,
  // deterministic error, so skip the network entirely there — never make a machine consumer block on a fetch.
  if (JSON_MODE) return plain;
  try {
    // Bounded + non-interactive: a stalled remote or a credential prompt must not hang the death path
    // (this also runs unattended in the drain). timeout → SIGTERM → the catch below returns `plain`.
    const gitEnv = { cwd: ROOT, timeout: 5000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } };
    execFileSync('git', ['fetch', '--quiet', 'origin', 'main'], { ...gitEnv, stdio: 'ignore' });
    const onOrigin = execFileSync('git', ['ls-tree', '--name-only', 'FETCH_HEAD', 'backlog/'], { ...gitEnv, encoding: 'utf8' })
      .split('\n')
      .some((p) => p.startsWith(`backlog/${padded}-`));
    if (!onOrigin) return plain;
    // Advice is context-agnostic ON PURPOSE: this CLI runs both in a primary checkout (on `main`, where
    // `git pull --ff-only` is right) AND in `lane/*` clones (#104), where a bare pull can't fast-forward a
    // diverged lane branch and a HEAD..origin/main count would be inflated. So point at the GOAL — sync to
    // origin/main — and name the right move per context, rather than prescribing one command / a wrong count.
    return `#${padded} exists on origin/main but not your checkout — sync to origin/main and retry (a stale-checkout `
      + `miss, not a missing item): \`git pull --ff-only\` on a primary checkout, or refresh the lane `
      + `(\`node scripts/lane-pool.mjs refresh --lane=N\`).`;
  } catch {
    return plain; // offline / no remote / timed out — can't diagnose, keep the plain error
  }
}

/** Resolve a bare ref (NNN or the provisional hash `xNNNNNN`, ± -slug) to its current filename, or die. */
function resolveFile(ref) {
  if (!ref) die('missing <NNN> — e.g. `backlog.mjs claim 122`');
  const id = idFromName(ref); // numeric NNN (landed) or an `xNNNNNN` hash (provisional, #2288)
  if (!id) die(`"${ref}" is not a valid item reference (NNN or xNNNNNN)`);
  const padded = normalizeId(id); // pad a number, leave a hash untouched
  const matches = files().filter((f) => f.startsWith(`${padded}-`));
  if (matches.length === 0) die(missingItemMessage(padded));
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
  // Ready-to-merge (queued) guard (#2138 Fork 4): a queued item pushed a lane and is waiting for the
  // drain. It is still `status: active` on main, so a naive read would re-offer it (claim) or reopen it
  // as abandoned (release — the #2072 closeout reconcile's active→open flip). Read the LOCAL queued token
  // OFFLINE (Rule #105 — no tree read, no ls-remote) and refuse both: a queued item is neither claimable
  // nor abandoned. `--force` overrides for the rare deliberate case (e.g. abandoning a stuck queue entry).
  if ((v === 'claim' || v === 'release') && !argv.includes('--force')) {
    const num = idFromName(file);
    if (isQueued(loadQueued(), num)) {
      die(v === 'claim'
        ? `#${num} is queued (ready-to-merge, #2138 Fork 4) — a lane is pushed and waiting for the drain; it is not claimable. The drain unqueues it at landing; pass --force only to deliberately steal a stuck queue entry.`
        : `#${num} is queued (ready-to-merge, #2138 Fork 4) — it is waiting to be drained, NOT abandoned; releasing it to open would drop its ready-to-merge state and re-offer it. Let the drain land + unqueue it; pass --force only to deliberately abandon the queued lane.`);
    }
  }
  // Prepare-hold guard (#2219 (b) flow / #2264): while a session prepares a fork in a lane the item is still
  // `status: open`, so a naive claim could steal it mid-prep. A LIVE prepare-hold (lease-valid) HARD-refuses a
  // claim — the strengthened replacement for the soft `reserve` deprioritize. Read the LOCAL token OFFLINE
  // (Rule #105). `--force` overrides to deliberately steal a stuck hold; the holder drops it with prepare-release.
  if (v === 'claim' && !argv.includes('--force')) {
    const num = idFromName(file); // two-form id (#2288): numeric NNN or an `xNNNNNN` hash — never a bare `^\d+`
    const holds = loadHolds();
    if (isHeld(holds, num, Date.now())) {
      const by = heldBy(holds, num, Date.now());
      die(`#${num} is prepare-held${by ? ` by ${by}` : ''} (#2219 (b) flow) — a session is preparing it in a lane; it is not claimable until the prepare-hold is released (\`backlog.mjs prepare-release ${num}\`). Pass --force only to deliberately steal a stuck hold.`);
    }
  }
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
    if (dirty) die(`#${idFromName(file)} — ${rel} has uncommitted edits; a claim must be the first action on an item (ground / edit / present AFTER claiming, next turn). Commit, stash, or revert those edits and re-claim — or pass --force if this is deliberate (e.g. a freshly-scaffolded item).`);
  }
  // No-open-slice guard (#658): an epic can't close while live work sits under it. Enumerate children by
  // the `parent:` EDGE (not the body's stale "N children" listing) and refuse BEFORE writing — so the
  // `resolved-epic-with-open-child` contradiction is never created, not just caught later by the gate.
  // `--force` overrides for the rare deliberate mid-re-parent case (prints what it stepped over).
  if (v === 'resolve' && readField(before, 'kind') === 'epic') {
    const padded = idFromName(file);
    const openKids = openChildrenOf(padded);
    if (openKids.length && !argv.includes('--force'))
      die(`#${padded} is an epic with ${openKids.length} open child slice(s) — resolve or re-parent them first, or pass --force:\n${openKids.map((k) => `    #${k.num} — ${k.status}`).join('\n')}`);
    if (openKids.length) console.error(`${YEL}warning:${RST} ${DIM}--force: resolving epic #${padded} over ${openKids.length} open child(ren): ${openKids.map((k) => `#${k.num}`).join(', ')}${RST}`);
  }
  const res = applyTransition(before, v, { today: today(), graduatedTo: flag('graduated-to'), codifiedTo: flag('codified-to'), as });
  if (res.error) die(`#${idFromName(file)} — ${res.error}`);
  writeBacklogMd(abs, rel, res.content);
  const id = file.replace(/\.md$/, '');
  const slug = id; // the rename slug is the full id (NNN-slug)
  if (v === 'claim') {
    // Clear-on-claim (#083 invariant 2): a hard claim supersedes any soft reservation on this item —
    // drop it so the now-`active` item never lingers as a stale hold against another session. Read the
    // reservation's session BEFORE dropping it, so the baseline below can recover it (#1723).
    const num = idFromName(file);
    const reservationsAtClaim = loadReservations();
    saveReservations(removeNums(reservationsAtClaim, [num]));
    // Gate-attribution baseline (#952, #949 Fork 2-A): snapshot the files ALREADY dirty (everyone else's
    // in-flight + pre-existing) the first time this session claims, and stamp the owning id. Lets
    // `check:standards --scope=<session>` later block only on files THIS session dirtied. Best-effort —
    // a git/IO hiccup must never fail the claim (attribution is an opt-in convenience, not the lock).
    //
    // Session inference (#1723): the batch loop runs `claim <NNN>` WITHOUT `--session`, which used to skip
    // baseline recording entirely — leaving `claims.json` empty so `--scope=<slug>` was silently inert.
    // Prefer the explicit flag, else the session that `reserve`-d this item (recorded in reservations.json
    // by the batch's reserve step), else the most-recent claim session. So the baseline records without a
    // per-claim flag.
    const session = flag('session') ?? sessionForNum(reservationsAtClaim, num) ?? mostRecentSession(loadClaims());
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

/** Read the ready-to-merge (queued) registry (#2138 Fork 4); a missing/unreadable file degrades to
 *  empty so the claim/release ownership path never wedges on a corrupt token. */
function loadQueued() {
  try { return parseQueued(readFileSync(QUEUED_PATH, 'utf8')); }
  catch { return emptyQueuedState(); }
}
/** Write the queued registry. */
function saveQueued(state) {
  writeFileSync(QUEUED_PATH, serializeQueued(state));
}

/** Read the prepare-hold registry (#2219 (b) flow / #2264); a missing/unreadable file degrades to empty so
 *  the select/claim path never wedges on a corrupt token. Self-prunes expired holds on each read+write. */
function loadHolds() {
  try { return parseHolds(readFileSync(PREPARE_HOLD_PATH, 'utf8')); }
  catch { return emptyHoldState(); }
}
/** Write the prepare-hold registry, dropping any expired hold (housekeeping). */
function saveHolds(state) {
  writeFileSync(PREPARE_HOLD_PATH, serializeHolds(pruneHolds(state, Date.now())));
}

/**
 * prepare-hold <NNN> [--session=<slug>] [--lease=<minutes>] — place/refresh a HARD local hold while a
 * session prepares a fork in a lane (#2219 (b) flow). `--select` skips a held item and `claim` refuses it,
 * unlike the soft `reserve` deprioritize. Idempotent: re-holding extends the lease (refresh across a long
 * prepare). The token is LOCAL-only (never pushed; read offline per Rule #105) — it is NOT a backlog
 * mutation, so it may run from anywhere. Release with `prepare-release <NNN>` once the one lane→PR lands.
 */
function prepareHold() {
  const num = idFromName(String(positional[0] || '')); // NNN or `xNNNNNN` (#2288)
  if (!num) die('prepare-hold needs a <NNN> to hold');
  resolveFile(num); // a typo must not hold a phantom item
  const holder = flag('session') || process.env.LANE_SESSION || null;
  const leaseMin = Number.isFinite(Number(flag('lease'))) ? Number(flag('lease')) : DEFAULT_LEASE_MINUTES;
  const until = leaseUntilIso(Date.now(), leaseMin);
  saveHolds(addHold(loadHolds(), num, holder, until));
  const padded = normalizeId(num); // pad a number, leave a hash untouched
  ok({ verb: 'prepare-hold', num: padded, holder, leaseUntil: until },
    `${GRN}✓ prepare-held${RST} #${padded} ${DIM}→ hard-excluded from --select + claim until released (lease ${leaseMin}min${holder ? `, holder ${holder}` : ''}). Enter a lane, author + prepare-stamp, land one PR, then \`prepare-release ${padded}\`.${RST}`);
}

/**
 * prepare-stamp <NNN> — write `status: open` + `preparedDate: <today>` into the item's frontmatter (the
 * one flag readiness ranks as `✓ ready to ratify`). Authored IN the lane and landed via the one PR — never
 * a primary-tree splice: like the other item-file mutations it is blocked from a primary cwd (guard-bash
 * #2302) and allowed in a `.lanes/` clone. Idempotent (status:open is a no-op on an already-open item).
 */
function prepareStamp() {
  const file = resolveFile(positional[0]);
  const rel = `backlog/${file}`;
  const abs = join(DIR, file);
  const before = readFileSync(abs, 'utf8');
  let after = setFrontmatterField(before, 'status', 'open', { after: ['kind', 'size'] });
  if (after == null) die(`#${idFromName(file)} — could not splice frontmatter (no frontmatter block?)`);
  const today = new Date().toISOString().slice(0, 10);
  after = setFrontmatterField(after, 'preparedDate', `"${today}"`, { after: ['status', 'dateStarted', 'dateOpened'] });
  writeBacklogMd(abs, rel, after);
  ok({ verb: 'prepare-stamp', num: idFromName(file), preparedDate: today },
    `${GRN}✓ prepare-stamped${RST} #${idFromName(file)} ${DIM}→ preparedDate ${today} (status: open; readiness now ranks it ✓ ready to ratify). Commit this item file + land the lane PR.${RST}`);
}

/** prepare-release <NNN> — drop the prepare-hold (the preparer's clear point once the one lane→PR lands).
 *  Local-only token write; idempotent. */
function prepareRelease() {
  const num = idFromName(String(positional[0] || '')); // NNN or `xNNNNNN` (#2288)
  if (!num) die('prepare-release needs a <NNN> to release');
  const before = heldNums(loadHolds(), Date.now()).length;
  const state = removeHold(loadHolds(), [num]);
  saveHolds(state);
  const padded = normalizeId(num); // pad a number, leave a hash untouched
  ok({ verb: 'prepare-release', num: padded, cleared: before - heldNums(state, Date.now()).length },
    `${GRN}✓ prepare-released${RST} #${padded} ${DIM}— hold dropped; the item is claimable again.${RST}`);
}

/**
 * queue <NNN...> [--lane=<ref>] [--session=<slug>] — mark items ready-to-merge (#2138 Fork 4). The
 * lane-producing session calls this at lane-push so a queued item isn't read as re-claimable/abandoned
 * while it waits for the drain. `unqueue <NNN...>` clears the mark (the drain's single clear point at
 * landing). Idempotent. The lane-push/drain call-sites are wired by the drain command (#2162).
 */
function queue() {
  const nums = positional.map((p) => idFromName(p)).filter(Boolean);
  if (!nums.length) die('queue needs one or more <NNN> to mark ready-to-merge');
  for (const n of nums) resolveFile(n); // a typo must not queue a phantom item
  const state = addQueued(loadQueued(), nums, new Date().toISOString(), { lane: flag('lane'), batchSlug: flag('session') });
  saveQueued(state);
  const padded = nums.map(normalizeId);
  ok({ verb: 'queue', queued: padded },
    `${GRN}✓ queued${RST} #${padded.join(', #')} ${DIM}→ ready-to-merge (claim/release refuse it until the drain lands + unqueues it)${RST}`);
}
function unqueue() {
  const nums = positional.map((p) => idFromName(p)).filter(Boolean);
  if (!nums.length) die('unqueue needs one or more <NNN> to clear');
  const before = queuedNums(loadQueued()).length;
  const state = removeQueued(loadQueued(), nums);
  saveQueued(state);
  const cleared = before - queuedNums(state).length;
  ok({ verb: 'unqueue', nums: nums.map(normalizeId), cleared },
    `${GRN}✓ unqueued${RST} ${DIM}— cleared ${cleared} ready-to-merge mark(s); ${queuedNums(state).length} still queued${RST}`);
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
  const nums = positional.map((p) => idFromName(p)).filter(Boolean);
  if (!nums.length) die('reserve needs one or more <NNN> to soft-hold');
  for (const n of nums) resolveFile(n); // a typo must not hold a phantom item
  const state = addHolds(pruneExpired(loadReservations(), Date.now()), nums, session, new Date().toISOString());
  saveReservations(state);
  const padded = nums.map(normalizeId);
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
  const nums = positional.map((p) => idFromName(p)).filter(Boolean);
  if (!session && !nums.length) die('unreserve needs --session=<slug> (clear a whole session) and/or one or more <NNN>');
  let state = loadReservations();
  const before = state.held.length;
  if (session) state = removeBySession(state, session);
  if (nums.length) state = removeNums(state, nums);
  state = pruneExpired(state, Date.now());
  saveReservations(state);
  const cleared = before - state.held.length;
  ok({ verb: 'unreserve', session: session ?? null, nums: nums.map(normalizeId), cleared },
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
  // Cross-refs may point at a landed item (NNN) or an in-flight sibling (hash) — normalize each, never
  // blindly zero-pad (padding a hash would corrupt it). #2288.
  const blockedBy = (flag('blocked-by') || '').split(',').map((s) => s.trim()).filter(Boolean).map(normalizeId);
  const parent = flag('parent') ? normalizeId(flag('parent')) : undefined;

  // JIT numbering (#2288): a new item is born with a collision-free HASH id, NOT `max+1`. Parallel lanes
  // can no longer race on the next number — the drain (sole serial writer to main, #2290) rewrites the
  // hash to the real sequential NNN at land. The re-glob guards the astronomically-unlikely hash clash.
  const existing = files().map((f) => idFromName(f)).filter(Boolean);
  let finalNum = nextHash(existing);
  let finalName = `${finalNum}-${slug}.md`;
  let finalAbs = join(DIR, finalName);
  if (files().some((f) => f.startsWith(`${finalNum}-`))) {
    finalNum = nextHash([...existing, finalNum]);
    finalName = `${finalNum}-${slug}.md`;
    finalAbs = join(DIR, finalName);
  }
  // Born-active when a creating session owns it (#670): `scaffold --session=<slug>` stamps the item
  // `status: active` + `scaffoldedBy`, so it is excluded from every OTHER session's batch pool until the
  // author `settle`s it (closes the born-public, half-authored-item race). Without `--session` (ad-hoc /
  // hand / non-batch callers) it stays born-open, the long-standing default.
  const session = flag('session');
  const content = renderItem({ kind, size, slug, title, today: today(), blockedBy, parent, digest: flag('digest'), scaffoldedBy: session });
  writeBacklogMd(finalAbs, `backlog/${finalName}`, content);
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
  const padded = normalizeId(id); // a born-active scaffold is hash-keyed (#2288) — pad a number, leave a hash
  const file = files().find((f) => f.startsWith(`${padded}-`));
  if (!file) die(`settle: no backlog item #${padded}`);
  const abs = join(DIR, file);
  const src = readFileSync(abs, 'utf8');
  // active → open, and drop the ownership stamps (settled = published, no longer session-owned).
  const res = applySettle(src);
  if (res.error) die(`settle: ${res.error} (#${padded})`);
  writeBacklogMd(abs, `backlog/${file}`, res.content);
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

/**
 * retype <NNN> [--to=<kind>] [--size=N] [--status=<s>] — the SANCTIONED pack-phase flag-fix (#2123 escape
 * that isn't `LANE_GUARD_OFF`). The batch skill tells the packer to "fix a mis-flagged item in place" — retype
 * a `story` the pre-flight found is really a `decision`, bump a `size` to 13 to drop it from the pool, park it
 * — but the lane guard blocks a raw primary-tree Edit of the item's `.md`, which pushed agents to override the
 * guard by hand. This does the SAME frontmatter splice through the sanctioned CLI (guard-clean, auditable, and
 * the locus-prefix scan still runs), so no `LANE_GUARD_OFF` is needed. Frontmatter-only; the body is untouched.
 */
function retype() {
  const file = resolveFile(positional[0]);
  const rel = `backlog/${file}`;
  const abs = join(DIR, file);
  let src = readFileSync(abs, 'utf8');
  const toKind = flag('to');
  const toSize = flag('size');
  const toStatus = flag('status');
  if (!toKind && toSize === undefined && !toStatus) die('retype needs at least one of --to=<kind> / --size=N / --status=<s>');
  if (toKind && !['story', 'epic', 'task', 'decision'].includes(toKind)) die(`--to must be story|epic|task|decision (got "${toKind}")`);
  const curStatus = readField(src, 'status') || 'open';
  if (curStatus === 'resolved' && !argv.includes('--force')) die(`#${idFromName(file)} is resolved — retyping a closed item is almost certainly a mistake; pass --force if deliberate`);
  const changes = [];
  if (toKind) { src = setFrontmatterField(src, 'kind', toKind, { after: [] }); changes.push(`kind→${toKind}`); }
  if (toSize !== undefined) {
    const n = Number(toSize);
    if (!Number.isFinite(n) || n < 0) die(`--size must be a non-negative number (got "${toSize}")`);
    src = setFrontmatterField(src, 'size', String(n), { after: ['kind'] }); changes.push(`size→${n}`);
  }
  if (toStatus) { src = setFrontmatterField(src, 'status', toStatus, { after: ['kind', 'size'] }); changes.push(`status→${toStatus}`); }
  writeBacklogMd(abs, rel, src);
  const id = file.replace(/\.md$/, '');
  ok({ verb: 'retype', id, file: rel, changes },
    `${GRN}✓ retyped${RST} ${BLD}#${idFromName(file)}${RST} ${DIM}${changes.join(', ')}${RST}`);
}

/**
 * prioritize <NNN> [--to=<value>|--clear] — set or clear the item's `priority` frontmatter (the same field
 * the readiness/batch machinery reads when it ranks work). Frontmatter-only, like {@link retype}. `--to`
 * takes a simple lowercase token (e.g. `low`); `--clear` (or an empty `--to`) removes the field, returning
 * the item to the default (unprioritised). A resolved item is refused without `--force`.
 */
function prioritize() {
  const file = resolveFile(positional[0]);
  const rel = `backlog/${file}`;
  const abs = join(DIR, file);
  let src = readFileSync(abs, 'utf8');
  const to = flag('to');
  const clear = argv.includes('--clear') || to === '';
  if (!to && !clear) die('prioritize needs --to=<value> (e.g. low) or --clear');
  if (to && !clear && !/^[a-z]+$/.test(to)) die(`--to must be a simple lowercase token (e.g. low), got "${to}"`);
  const curStatus = readField(src, 'status') || 'open';
  if (curStatus === 'resolved' && !argv.includes('--force')) die(`#${idFromName(file)} is resolved — reprioritising a closed item is almost certainly a mistake; pass --force if deliberate`);
  let change;
  if (clear) {
    // Remove the `priority:` line from the frontmatter block ONLY (scoped between the two fences).
    const m = src.match(/^(---\n)([\s\S]*?)(\n---)/);
    if (m) src = m[1] + m[2].replace(/^priority:[^\n]*\n?/m, '') + m[3] + src.slice(m[0].length);
    change = 'priority cleared';
  } else {
    src = setFrontmatterField(src, 'priority', to, { after: ['size', 'kind'] });
    change = `priority→${to}`;
  }
  writeBacklogMd(abs, rel, src);
  const id = file.replace(/\.md$/, '');
  ok({ verb: 'prioritize', id, file: rel, change },
    `${GRN}✓ prioritized${RST} ${BLD}#${idFromName(file)}${RST} ${DIM}${change}${RST}`);
}

// ── Build-queue prioritization verbs (#2528) — tier / rank / weights ─────────────────────────────────
// These set the autonomous build queue's ordering fields (epic #2527), per the ratified design #2526. All
// three are FRONTMATTER-ONLY splices, like {@link prioritize}, and NONE touches `blockedBy` or readiness —
// the ratified invariant: prioritization is strictly DOWNSTREAM of readiness (it only orders the ready set).

/** Read a sibling item's `rank` field (for the relative --after/--before rank computation). */
function rankOf(ref) {
  const f = resolveFile(ref);
  return readField(readFileSync(join(DIR, f), 'utf8'), 'rank') || '';
}

/**
 * tier <NNN> --to=<pinned|normal|someday|won't> | --clear — set the coarse build-queue TIER (the primary
 * sort key + the human override). Frontmatter-only. Refuses a resolved item without --force.
 */
function tier() {
  const file = resolveFile(positional[0]);
  const rel = `backlog/${file}`;
  const abs = join(DIR, file);
  let src = readFileSync(abs, 'utf8');
  const to = flag('to');
  const clear = argv.includes('--clear') || to === '';
  if (!to && !clear) die(`tier needs --to=<${TIERS.join('|')}> or --clear`);
  if (to && !clear && !TIERS.includes(to)) die(`--to must be one of ${TIERS.join(', ')} (got "${to}")`);
  if ((readField(src, 'status') || 'open') === 'resolved' && !argv.includes('--force')) {
    die(`#${idFromName(file)} is resolved — re-tiering a closed item is almost certainly a mistake; pass --force if deliberate`);
  }
  let change;
  if (clear) {
    const m = src.match(/^(---\n)([\s\S]*?)(\n---)/);
    if (m) src = m[1] + m[2].replace(/^tier:[^\n]*\n?/m, '') + m[3] + src.slice(m[0].length);
    change = 'tier cleared';
  } else {
    src = setFrontmatterField(src, 'tier', to, { after: ['priority', 'size', 'kind'] });
    change = `tier→${to}`;
  }
  writeBacklogMd(abs, rel, src);
  ok({ verb: 'tier', id: file.replace(/\.md$/, ''), file: rel, change },
    `${GRN}✓ tiered${RST} ${BLD}#${idFromName(file)}${RST} ${DIM}${change}${RST}`);
}

/**
 * rank <NNN> --to=<key> | --after=<NNN> [--before=<NNN>] | --before=<NNN> — set the between-able LexoRank
 * key for manual drag-ordering within a tier. `--after`/`--before` compute the key between the named
 * neighbours' ranks (via the engine's `rankBetween`); `--to` persists an explicit base-36 key.
 */
function rank() {
  const file = resolveFile(positional[0]);
  const rel = `backlog/${file}`;
  const abs = join(DIR, file);
  let src = readFileSync(abs, 'utf8');
  const to = flag('to');
  const after = flag('after');
  const before = flag('before');
  let key;
  if (to) {
    if (!/^[0-9a-z]+$/.test(to)) die(`--to must be a base-36 rank key ([0-9a-z]+), got "${to}"`);
    key = to;
  } else if (after != null || before != null) {
    const lo = after != null ? rankOf(after) : '';
    const hi = before != null ? rankOf(before) : '';
    try { key = rankBetween(lo, hi); }
    catch (e) { die(`cannot rank between ${after != null ? '#' + after : 'start'} and ${before != null ? '#' + before : 'end'}: ${e.message}`); }
  } else {
    die('rank needs --to=<key>, or --after=<NNN> and/or --before=<NNN>');
  }
  if ((readField(src, 'status') || 'open') === 'resolved' && !argv.includes('--force')) {
    die(`#${idFromName(file)} is resolved — re-ranking a closed item is almost certainly a mistake; pass --force if deliberate`);
  }
  src = setFrontmatterField(src, 'rank', key, { after: ['tier', 'priority', 'size', 'kind'] });
  writeBacklogMd(abs, rel, src);
  ok({ verb: 'rank', id: file.replace(/\.md$/, ''), file: rel, change: `rank→${key}`, key },
    `${GRN}✓ ranked${RST} ${BLD}#${idFromName(file)}${RST} ${DIM}rank→${key}${RST}`);
}

/** Load the build-queue scoring config (or the engine's default if none is committed / it's malformed). */
function loadBuildQueueConfig() {
  try {
    const cfg = JSON.parse(readFileSync(BUILD_QUEUE_CONFIG_PATH, 'utf8'));
    // A valid-JSON-but-shapeless file (e.g. a hand-edit missing `criteria`) falls back to the default
    // rather than crashing `--show`'s `criteria.map` (#2528 review).
    return cfg && Array.isArray(cfg.criteria) ? cfg : structuredClone(DEFAULT_CONFIG);
  } catch { return structuredClone(DEFAULT_CONFIG); }
}

/**
 * weights [--show] | --set=<key>=<n> [--set=…] — read or edit the build-queue scoring CONFIG (the criterion
 * weights the WSJF-shaped engine ranks by). Validated on write (sum 100, ≤5 criteria, none >50%); an invalid
 * edit is refused, never persisted. Config is data, separate from items — editing it re-ranks everything.
 */
function weights() {
  const cfg = loadBuildQueueConfig();
  const sets = argv.filter((a) => a.startsWith('--set=')).map((a) => a.slice('--set='.length));
  if (argv.includes('--show') || sets.length === 0) {
    return ok({ verb: 'weights', config: cfg },
      `${BLD}build-queue config${RST}\n${cfg.criteria.map((c) => `  ${c.key}: ${c.weight}`).join('\n')}\n  ${DIM}aging.ratePerDay: ${cfg.aging?.ratePerDay ?? 0}${RST}`);
  }
  for (const s of sets) {
    const eq = s.indexOf('=');
    const rawVal = eq >= 0 ? s.slice(eq + 1) : '';
    const key = eq >= 0 ? s.slice(0, eq) : s;
    const n = Number(rawVal);
    if (eq < 0 || rawVal === '' || Number.isNaN(n)) die(`--set expects <key>=<number>, got "${s}"`);
    const crit = cfg.criteria.find((c) => c.key === key);
    if (!crit) die(`unknown criterion "${key}" (have: ${cfg.criteria.map((c) => c.key).join(', ')})`);
    crit.weight = n;
  }
  const v = validateConfig(cfg);
  if (!v.ok) die(`refused — the config would be invalid: ${v.errors.join('; ')}`);
  // Lane-gate the config write too (#2528 review): like writeBacklogMd, refuse a write that resolves under
  // the shared PRIMARY checkout so this tracked config is never spliced onto the primary tree (#2302/#2339).
  if (laneGuardDecision(resolveReal(dirname(BUILD_QUEUE_CONFIG_PATH)), ROOT)) {
    die(`build-queue config mutation BLOCKED — "${BUILD_QUEUE_CONFIG_PATH}" resolves under the shared PRIMARY checkout; run it in a lane clone, never primary (#2302/#2339). No override.`);
  }
  writeFileSync(BUILD_QUEUE_CONFIG_PATH, `${JSON.stringify(cfg, null, 2)}\n`);
  ok({ verb: 'weights', config: cfg },
    `${GRN}✓ weights updated${RST} ${DIM}${cfg.criteria.map((c) => `${c.key}=${c.weight}`).join(' ')}${RST}`);
}

/**
 * build-queue [--json] [--next] — READ the ordered build queue (epic #2527): every READY item in the exact
 * order the autonomous builder would pull them (tier → effectiveScore → rank → dateOpened → num), each row
 * annotated with WHY it ranks there (build-queue tier + score). PURE READ — nothing on disk changes; the
 * console queue view (#2529) shells this and the builder (#2530) will too, so a user sees exactly what gets
 * built next (one engine, no re-implementation → no drift). `--next` emits just the head (or null when empty).
 *
 * TIER RECOVERY: the single loader overwrites `item.tier` with the derived A/B/C *leverage* tier (#249),
 * which collides in NAME with the build-queue tier (pinned/normal/someday/won't). We RE-READ the raw
 * frontmatter tier for the open set the engine orders, so it sorts on the human's pin, never the readiness
 * rubric. All other engine inputs (status, blockedBy, size, dateOpened, value/timeCriticality/confidence,
 * rank) come straight off the loader (`...data`), which is authoritative for them.
 */
function buildQueue() {
  // `--config=<path>` previews the order under a HYPOTHETICAL config (the console's live weights preview,
  // #2529) WITHOUT persisting it — validated, never written. Absent → the committed/default config.
  const configPath = flag('config');
  let config;
  if (configPath) {
    let parsed;
    try { parsed = JSON.parse(readFileSync(configPath, 'utf8')); }
    catch (e) { die(`--config: cannot read/parse "${configPath}": ${e.message}`); }
    const v = validateConfig(parsed);
    if (!v.ok) die(`--config is invalid: ${v.errors.join('; ')}`);
    config = parsed;
  } else {
    config = loadBuildQueueConfig();
  }
  const loaded = requireCjs(join(ROOT, 'src/_data/backlog.js'))();
  const items = loaded.map((it) => {
    if (it.status !== 'open') return it; // only the open set is ordered; skip the re-read for the rest
    // Recover the raw build-queue tier (the loader clobbers `tier` with the A/B/C leverage tier). A missing
    // file (e.g. fixture-mode dir divergence) falls back to undefined → the engine treats it as `normal`.
    let rawTier;
    try { rawTier = readField(readFileSync(join(DIR, `${it.id}.md`), 'utf8'), 'tier') || undefined; }
    catch { rawTier = undefined; }
    return { ...it, tier: rawTier };
  });
  const detailed = orderQueueDetailed(items, config);
  const rows = detailed.map((r) => ({
    num: r.item.num,
    id: r.item.id,
    title: r.item.title,
    tier: r.tier,
    score: Number(r.score.toFixed(6)),
    unblocks: r.unblocks,
    rank: r.rank || null,
    size: r.item.size ?? null,
    dateOpened: r.item.dateOpened ?? null,
    buildQueued: r.buildQueued, // the human's clear-for-build gate (#2530)
  }));
  if (argv.includes('--next')) {
    // The builder's ACTUAL next = the top-ordered item the human has CLEARED for build (#2530), not merely the
    // top ready one. A ready, high-tier item that hasn't been cleared is never auto-built.
    const head = rows.find((r) => r.buildQueued) ?? null;
    return ok({ verb: 'build-queue', next: head, config },
      head ? `${GRN}next → #${head.num}${RST} ${DIM}[${head.tier} · ${head.score.toFixed(2)}] ${head.title}${RST}`
           : `${DIM}build queue empty (no items cleared for build)${RST}`);
  }
  const clearedCount = rows.filter((r) => r.buildQueued).length;
  return ok({ verb: 'build-queue', count: rows.length, cleared: clearedCount, queue: rows, config },
    `${BLD}build queue${RST} ${DIM}(${rows.length} ready · ${clearedCount} cleared for build · next-to-build order)${RST}\n` +
    rows.slice(0, 25).map((r, i) => `  ${String(i + 1).padStart(2)}. ${r.buildQueued ? `${GRN}✓${RST}` : ' '} ${BLD}#${r.num}${RST} ${DIM}[${r.tier} · ${r.score.toFixed(2)}]${RST} ${r.title}`).join('\n') +
    (rows.length > 25 ? `\n  ${DIM}… +${rows.length - 25} more${RST}` : ''));
}

/**
 * build-queue add|remove <NNN> — the human's manual CLEAR-FOR-BUILD gate (#2530). `add` sets `buildQueued:
 * true` (the supervised builder may then pull it); `remove` clears the flag. Frontmatter-only + lane-gated,
 * like {@link tier}/{@link rank} — and like them it NEVER touches blockedBy/readiness. The builder pulls ONLY
 * cleared items, so re-prioritizing (tier/rank) never arms an autonomous build; only an explicit `add` does.
 */
function buildQueueMark(action) {
  const file = resolveFile(positional[1]); // positional[0] is the sub-verb ('add'/'remove')
  const rel = `backlog/${file}`;
  const abs = join(DIR, file);
  let src = readFileSync(abs, 'utf8');
  if (action === 'add' && (readField(src, 'status') || 'open') !== 'open') {
    die(`#${idFromName(file)} is not open — only an open item can be cleared for build`);
  }
  if (action === 'add') {
    src = setFrontmatterField(src, 'buildQueued', 'true', { after: ['tier', 'priority', 'size', 'kind'] });
  } else {
    src = removeFrontmatterField(src, 'buildQueued'); // CRLF-safe shared helper (not a hand-rolled regex)
  }
  writeBacklogMd(abs, rel, src);
  ok({ verb: 'build-queue', action, id: file.replace(/\.md$/, ''), file: rel, buildQueued: action === 'add' },
    `${GRN}✓ ${action === 'add' ? 'cleared for build' : 'removed from build queue'}${RST} ${BLD}#${idFromName(file)}${RST}`);
}

/**
 * yield <NNN-slug> — resolve an NNN COLLISION by moving a LOCAL-ONLY item to the next free number (the guard's
 * own prescription: "a new item takes the next free number; yield this one"). Renumbering a *committed* item is
 * forbidden — NNN is immutable — so this REFUSES a git-tracked file and only ever moves an untracked/local one.
 * Takes the full `NNN-slug` (or a unique prefix) so it targets the right file when two share a number. Writes
 * the new `<freeNum>-<slug>.md`, deletes the old, and reports the new number — the sanctioned counterpart to a
 * hand `git mv` (which the renumber guard blocks).
 */
function yieldNum() {
  const ref = positional[0];
  if (!ref) die('yield needs <NNN-slug> — the local-only colliding item to move to a free number');
  const matches = files().filter((f) => f === ref || f === `${ref}.md` || f.startsWith(`${ref}`));
  if (matches.length === 0) die(`no backlog file matching "${ref}"`);
  if (matches.length > 1) die(`"${ref}" is ambiguous: ${matches.join(', ')} — pass the full NNN-slug`);
  const file = matches[0];
  const rel = `backlog/${file}`;
  // Immutability guard: only a LOCAL-ONLY (untracked) item may yield; a committed NNN never moves.
  let tracked = true;
  try { execFileSync('git', ['ls-files', '--error-unmatch', rel], { cwd: ROOT, stdio: 'pipe' }); }
  catch { tracked = false; }
  if (tracked && !argv.includes('--force')) die(`${rel} is git-tracked — NNN is immutable, a committed item never renumbers. yield only moves a LOCAL-ONLY (untracked) collision. (If this really is a dup to reconcile, that's a manual call.)`);
  const slug = slugFromName(file.replace(/\.md$/, '')); // two-form id (#2288): strip NNN- or xNNNNNN-
  const existing = files().map((f) => (f.match(/^(\d+)/) || [])[1]).filter(Boolean);
  const newNum = nextNum(existing);
  const newName = `${newNum}-${slug}.md`;
  if (files().some((f) => f.startsWith(`${newNum}-`))) die(`race: #${newNum} just got taken — re-run yield`);
  const content = readFileSync(join(DIR, file), 'utf8');
  writeBacklogMd(join(DIR, newName), `backlog/${newName}`, content);
  unlinkSync(join(DIR, file));
  ok({ verb: 'yield', from: file.replace(/\.md$/, ''), to: newName.replace(/\.md$/, ''), num: newNum, file: `backlog/${newName}` },
    `${GRN}✓ yielded${RST} ${DIM}${file} →${RST} ${BLD}#${newNum}${RST} ${DIM}backlog/${newName}${RST}`);
}

// `cost <NNN> --tokens="in:.. cw:.. cr:.. out:.."` (or --in= --cw= --cr= --out=) — fold a session's usage
// into a card's cumulative accounting (#close cost-on-card). The DURABLE record is the cumulative token
// breakdown `costTokens`; `costUsd` is DERIVED from it through the one shared rate table (cost-rates.mjs)
// at every accrual, so it can never drift from a stale rate and is always regenerable. A pure frontmatter
// splice via `accrueCost`. The close skill decides WHICH card(s) and how much (a single dominant
// decision/prepare session → full cost on one card; a workflow → even-split across the N items it worked;
// slice/resolve attribute nothing). `--sessions=<n>` overrides the +1 session-share. `--usd=` is accepted
// for back-compat but IGNORED — usd is no longer a source of truth, only the tokens are.
function cost() {
  const file = resolveFile(positional[0]);
  // Tokens are the source of truth: a single --tokens="in:.. cw:.. cr:.. out:.." (colon or = separator,
  // e.g. the estimator's `--tokens-only` line) OR the four individual flags. Individual flags override.
  const tokens = parseCostTokens(flag('tokens'));
  for (const k of ['in', 'cw', 'cr', 'out']) {
    const v = flag(k);
    if (v !== undefined) {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) die(`cost --${k}=<non-negative integer token count>, got "${v}"`);
      tokens[k] = n;
    }
  }
  const anyTokens = tokens.in || tokens.cw || tokens.cr || tokens.out;
  if (!anyTokens) die('cost needs the token breakdown — --tokens="in:.. cw:.. cr:.. out:.." (the estimator\'s --tokens-only line) or --in= --cw= --cr= --out=. (usd is now DERIVED from tokens; --usd= is ignored.)');
  if (flag('usd') !== undefined) console.error(`${YEL}note:${RST} ${DIM}--usd is ignored — costUsd is derived from the token breakdown (cost-rates.mjs).${RST}`);
  const sessions = Number(flag('sessions'));
  const rel = `backlog/${file}`;
  const abs = join(DIR, file);
  const before = readFileSync(abs, 'utf8');
  const after = accrueCost(before, tokens, Number.isFinite(sessions) ? { sessions } : {});
  if (after == null) die(`#${idFromName(file)} — could not splice frontmatter (no frontmatter block?)`);
  writeBacklogMd(abs, rel, after);
  const total = readField(after, 'costUsd');
  const toks = readField(after, 'costTokens');
  const n = readField(after, 'costSessions');
  ok({ verb: 'cost', num: idFromName(file), added: tokens, costTokens: toks, costUsd: Number(total), costSessions: Number(n) },
    `${GRN}✓ cost${RST} ${DIM}— +[${formatCostTokens(tokens)}] → $${total} (derived) over ${n} session(s) on #${idFromName(file)}${RST}`);
}

// #2319 — a one-shot repair: number every TRACKED hash-id backlog file in this checkout (a hash that reached
// main via a numbering-bypassing land route, e.g. pr-land --fallback-git). Reuses the drain's numberPendingHashes
// (the same JIT-numbering engine, #2288) so refs (blockedBy/parent/short-refs) are rewritten identically.
// `--dry-run` reports the planned mapping without touching the tree. Run in the checkout carrying the stray
// (the drain does this at land automatically; this verb is the manual backstop for one already on main).
function numberStranded() {
  const dryRun = argv.includes('--dry-run');
  const r = numberPendingHashes(ROOT, { dryRun });
  if (r.error) die(`number-stranded: ${r.error}`);
  if (!r.assigned || r.assigned.length === 0) { console.log('number-stranded: no stranded hash-id files — nothing to number.'); return; }
  const summary = r.assigned.map((a) => `${a.hash} → #${a.nnn}`).join(', ');
  if (dryRun) console.log(`number-stranded (dry-run): would number ${r.assigned.length} — ${summary}`);
  else console.log(`number-stranded: numbered ${r.assigned.length} (${r.committed ? 'committed' : 'NOT committed'}) — ${summary}`);
}

switch (verb) {
  case 'claim': case 'resolve': case 'release': transition(verb); break;
  case 'number-stranded': numberStranded(); break;
  case 'retype': retype(); break;
  case 'prioritize': prioritize(); break;
  case 'tier': tier(); break;
  case 'rank': rank(); break;
  case 'weights': weights(); break;
  case 'build-queue':
    (positional[0] === 'add' || positional[0] === 'remove') ? buildQueueMark(positional[0]) : buildQueue();
    break;
  case 'yield': yieldNum(); break;
  case 'scaffold': scaffold(); break;
  case 'settle': settle(); break;
  case 'calibrate': calibrate(); break;
  case 'cost': cost(); break;
  case 'reserve': reserve(); break;
  case 'unreserve': unreserve(); break;
  case 'queue': queue(); break;
  case 'unqueue': unqueue(); break;
  case 'prepare-hold': prepareHold(); break;
  case 'prepare-stamp': prepareStamp(); break;
  case 'prepare-release': prepareRelease(); break;
  default:
    console.error(`${BLD}backlog.mjs${RST} — mechanical backlog-status CLI\n` +
      `  ${GRN}claim${RST} <NNN> [--as=preparing] [--force]   open → active (or preparing, /prepare) + dateStarted; refuses on a dirty item file (claim-first), --force overrides\n` +
      `  ${GRN}resolve${RST} <NNN> [--graduated-to=X] [--codified-to=Y] [--force]   active → resolved + dateResolved (decision REQUIRES --codified-to=<doc#anchor|one-off>; an epic with open children is refused unless --force)\n` +
      `  ${GRN}release${RST} <NNN>               active|preparing → open\n` +
      `  ${GRN}retype${RST} <NNN> [--to=story|epic|task|decision] [--size=N] [--status=parked]   sanctioned pack-phase flag-fix (no LANE_GUARD_OFF); frontmatter-only\n` +
      `  ${GRN}prioritize${RST} <NNN> [--to=low|--clear]   set or clear the item's \`priority\` frontmatter (the field readiness/batch ranks by); frontmatter-only\n` +
      `  ${GRN}tier${RST} <NNN> --to=pinned|normal|someday|won't [--clear]   set the build-queue TIER (#2528, the coarse ordering bucket); frontmatter-only\n` +
      `  ${GRN}rank${RST} <NNN> --to=<key> | --after=<NNN> [--before=<NNN>]   set the build-queue LexoRank (#2528, manual drag-order within a tier)\n` +
      `  ${GRN}weights${RST} [--show] | --set=<key>=<n>   read/edit the build-queue scoring config (#2528; validated: sum 100, ≤5, none >50%)\n` +
      `  ${GRN}yield${RST} <NNN-slug>            move a LOCAL-ONLY NNN collision to the next free number (refuses a git-tracked item; NNN is immutable)\n` +
      `  ${GRN}number-stranded${RST} [--dry-run]      number every TRACKED hash-id backlog file in this checkout (a hash that reached main via a numbering-bypassing land; #2319/#2288)\n` +
      `  ${GRN}scaffold${RST} --kind=story|epic|task|decision --size= --title= [--digest=] [--blocked-by=] [--parent=] [--session=<slug>]   --session ⇒ born active+owned (#670), publish with settle\n` +
      `  ${GRN}settle${RST} <NNN>               born-active scaffold (--session) → open (publish once authored)\n` +
      `  ${GRN}calibrate${RST} --points= --context-pct= [--stop-reason=budget|context|empty-pool|fork|gate|outgrew|manual|abort]   fold a session into the batch point-budget estimate\n` +
      `  ${GRN}cost${RST} <NNN> --tokens="in:.. cw:.. cr:.. out:.." (or --in= --cw= --cr= --out=) [--sessions=<n>]   accrue a session's token usage into the card's cumulative costTokens; costUsd is DERIVED from it (close cost-on-card)\n` +
      `  ${GRN}reserve${RST} <NNN...> --session=<slug>    soft-hold planned items (deprioritize for other sessions)\n` +
      `  ${GRN}unreserve${RST} [--session=<slug>] [<NNN...>]  release soft holds (clear a session, or specific items)\n` +
      `  ${GRN}queue${RST} <NNN...> [--lane=<ref>] [--session=<slug>]   mark ready-to-merge (#2138 Fork 4); claim/release refuse a queued item until the drain lands it\n` +
      `  ${GRN}unqueue${RST} <NNN...>            clear the ready-to-merge mark (the drain's clear point at landing)\n` +
      `  ${GRN}prepare-hold${RST} <NNN> [--session=<slug>] [--lease=<min>]   HARD local hold while preparing a fork in a lane (#2219 (b)); --select skips + claim refuses it (vs the soft reserve)\n` +
      `  ${GRN}prepare-stamp${RST} <NNN>         write status:open + preparedDate=<today> into the item (in-lane, landed via the one PR; blocked from a primary cwd)\n` +
      `  ${GRN}prepare-release${RST} <NNN>       drop the prepare-hold (clear point once the lane PR lands)\n` +
      `  (add --json for machine output)`);
    process.exit(verb ? 1 : 0);
}
