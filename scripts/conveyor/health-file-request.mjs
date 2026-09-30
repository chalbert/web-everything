/**
 * @file scripts/conveyor/health-file-request.mjs
 * @description #4079 (health daemon slice 5, ruling #4065 clause 5) — turn a finding into an UNCLEARED
 *   filing request. The health process never files from its own clone and never clears readiness: this file
 *   only PLANS a request and keeps the ledger; the lane-bound landing itself is a separate module
 *   (scripts/operations/health-file-request-land.mjs), never run from inside the resident daemon clone.
 *
 * WHY BOTH THE PURE PLANNING AND THE LEDGER'S SMALL FS SURFACE LIVE IN ONE FILE: #4079's own declared
 * `scope:` names exactly one conveyor-side file (this one) alongside the landing operation and
 * health-watch-core.mjs — unlike #4078 (health-investigate-dispatch.mjs + a separate -plan.mjs), this card
 * never declared a fourth file, so the ledger's tiny read/write/lock helpers stay here, clearly separated
 * from the pure section above them, rather than inventing scope the card didn't ask for.
 *
 * TRIGGER (restates, not verbatim, backlog/4079-*.md: "When an episode's smell carries a known-fix template,
 * or the investigation names a concrete product change, the process writes a filing request"): a filing
 * request fires when an open/flapping episode's smell carries a `knownFix` template, OR its recorded
 * investigation (#4078) names a concrete product change (`ep.investigation.recommendation.productChange`).
 * Neither existed as a field before this slice — `knownFix` is new, optional, smell-descriptor-only surface
 * (no change needed to the required-fields shape validator, which only checks presence of the REQUIRED
 * fields).
 *
 * LEDGER — a flat JSON array at `<healthDir>/filing/ledger.json` (mirrors #4078's own ledger shape: no lock
 * around the WHOLE tick, because the tick itself is already single-instance; a lock only around this
 * ledger's own short read-modify-write, so the tick's planning write and the landing pass's claim/finalize
 * writes never race each other into a lost update — the tick's own read+write must go through
 * {@link withLedgerLock} too, exactly like every other read-modify-write here; see health-watch.mjs's filing
 * block). One entry per (smell, subject):
 *   { key, smell, subject, episodeId, title, digest, scope, size, ref, requestedAt,
 *     status: 'pending'|'landing'|'landed'|'abandoned', attemptId, claimedAt, card, cardFile, pr, prUrl, landedAt }
 * `abandoned` is a MANUAL-ONLY status: nothing in this pipeline ever sets it (no automated write below
 * produces it). It exists so an operator can hand-edit the ledger to drop a stuck/wrong entry out of the
 * dedup slot and the daily-cap count (see `isDuplicate`/`countRecent` below) without waiting for it to go
 * stale — the same "manual escape hatch the automation never reaches for itself" shape as `silence`/
 * `unsilence`. If this status is never actually used by an operator, drop the branch and the literal.
 *
 * DEDUP + CAP (spec): the ledger maps (smell, subject) -> request -> card, so a second request for the
 * same live key is refused; at most `fileMaxPerDay` requests in `fileWindowMs`; no request while a
 * `lane-starvation` episode is open (subject-independent — ANY open/flapping lane-starvation episode gates
 * every OTHER smell's filing, since the lane pool itself is what a filing request would need to land).
 */
import {
  existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, unlinkSync,
  openSync, closeSync, fstatSync, readSync, writeSync, ftruncateSync, readdirSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
// `scrubText` is health-watch-core.mjs's ONE redaction pass (tokens/paths/env-shaped values). Applied here too
// (belt-and-suspenders, not the only scrub): production reaches `buildRequest` only through health-watch.mjs's
// tick, AFTER it already scrubs `state.episodes` (see that file's `scrubDeep(result.state)`), and the
// investigation text itself is scrubbed even earlier, at `record` time, by health-investigate-dispatch.mjs.
// But this module's own free-text digest is what a committed card, a commit message and a PUBLIC PR body carry
// (health-file-request-land.mjs), so it must not depend on every caller remembering to scrub before calling —
// a future caller (a test harness standing in for the tick, a hand-built ledger entry) that skips that
// upstream step must not be the one place a credential/path reaches GitHub.
import { scrubText } from './health-watch-core.mjs';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_PER_DAY = 3;
// A `landing` claim older than this is presumed abandoned (crashed process) and reclaimable by a fresh attempt.
export const ATTEMPT_TIMEOUT_MS = 30 * 60 * 1000;

// ── pure ─────────────────────────────────────────────────────────────────────────────────────────────────────

export function keyFor(smell, subject) { return `${smell}::${subject}`; }

/** A deterministic, stable ref name — fixed the moment a request is planned, never re-derived per attempt, so a
 *  retry after a crash always targets the SAME `lane/*` ref (`open-pr`'s own idempotency then protects against
 *  a duplicate PR for it — see health-file-request-land.mjs's header). */
export function refFor(episodeId) { return `lane/health-file-${episodeId}`; }

/**
 * PURE: build a filing request from an episode, or `null` if neither trigger condition holds.
 * @param {object} ep the episode (as stepEpisodes/runHealthTick produce it)
 * @param {object} smellDef the episode's own smell registry entry (may be undefined)
 * @returns {{key,smell,subject,episodeId,title,digest,scope,size}|null}
 */
export function buildRequest(ep, smellDef) {
  // `ep.id` backs `refFor` (the landing pass's stable branch ref) and the ledger's own `episodeId` field — a
  // request built from an id-less episode would collide every such request onto the literal ref
  // `lane/health-file-undefined`, letting the landing pass force-push different cards over ONE branch and
  // `open-pr` merge unrelated requests onto one PR (#4079 review round 2, correctness finding). The existing
  // report-write loop already treats a missing id as "not a real, reportable episode" (`if (!ep?.id) continue`
  // in health-watch.mjs) — this mirrors that same guard at the planning boundary.
  if (!ep?.smell || !ep?.subject || !ep?.id) return null;
  const knownFix = smellDef?.knownFix;
  const rec = ep.investigation?.recommendation;
  const productChange = rec?.productChange;
  if (!knownFix && !productChange) return null;
  const interpolate = (s) => String(s ?? '').replaceAll('${subject}', ep.subject).replaceAll('${smell}', ep.smell);
  let title;
  let digest;
  let scope;
  let size;
  if (knownFix) {
    title = interpolate(knownFix.title) || `Health daemon: ${ep.smell} — ${ep.subject}`;
    digest = interpolate(knownFix.digestTemplate) || `Known-fix template for \`${ep.smell}\` (${ep.subject}).`;
    scope = Array.isArray(knownFix.scope) ? knownFix.scope : [];
    size = knownFix.size != null ? String(knownFix.size) : '3';
  } else {
    title = `Health daemon: ${ep.smell} — ${ep.subject}`;
    digest = [
      rec.whatIsWrong ? `What is wrong: ${rec.whatIsWrong}` : null,
      `Product change: ${productChange}`,
      rec.nextStep ? `Next step: ${rec.nextStep}` : null,
    ].filter(Boolean).join('\n\n');
    scope = [];
    size = '3';
  }
  return {
    key: keyFor(ep.smell, ep.subject), smell: ep.smell, subject: ep.subject, episodeId: ep.id,
    title: scrubText(title).slice(0, 200), digest: scrubText(digest), scope, size,
  };
}

/** Any open/flapping `lane-starvation` episode (any subject) gates EVERY smell's filing — a lane the request
 *  would need to land in is exactly what is starved. */
export function laneStarvationOpen(episodes) {
  return Object.values(episodes || {}).some((e) => e?.smell === 'lane-starvation' && (e.status === 'open' || e.status === 'flapping'));
}

/** A key is "live" (occupies the dedup slot) unless every entry sharing it was explicitly abandoned. */
export function isDuplicate(ledger, key) {
  return (ledger || []).some((e) => e.key === key && e.status !== 'abandoned');
}

export function countRecent(ledger, now, windowMs = DAY_MS) {
  return (ledger || []).filter((e) => e.status !== 'abandoned' && now - e.requestedAt < windowMs).length;
}

/**
 * PURE: decide which open/flapping episodes get a NEW filing request this tick. Never mutates its inputs.
 * @returns {{ toRequest: Array<{key:string, request:object}>, held: Record<string,string> }}
 */
export function planFileRequests({
  episodes = {}, smellsById = {}, ledger = [], config = {}, now = Date.now(),
} = {}) {
  const held = {};
  const toRequest = [];
  // ALLOWLIST, not a blocklist: the spec's trigger window is "open/flapping" episodes, verbatim. `episodes`
  // today only ever holds 'pending'/'open'/'flapping' entries in practice (`stepEpisodes` deletes a closed
  // one into `history` the same tick it closes — health-watch-core.mjs's `applyClean`), so `!== 'pending'`
  // happens to coincide with this today, but that is an invariant of a DIFFERENT module this one should not
  // have to trust silently. Naming the two live statuses directly matches the doc above and stays correct even
  // if a future caller (a test, a hand-edited state.json, a refactor) ever hands this a 'closed'/'abandoned'
  // episode.
  const live = Object.values(episodes).filter((e) => e?.key && (e.status === 'open' || e.status === 'flapping'));
  if (config.fileDispatch !== true) {
    for (const ep of live) held[ep.key] = 'filing dispatch is off (config `fileDispatch`)';
    return { toRequest, held };
  }
  const starved = laneStarvationOpen(episodes);
  const windowMs = config.fileWindowMs ?? DAY_MS;
  const cap = config.fileMaxPerDay ?? MAX_PER_DAY;
  for (const ep of live) {
    const request = buildRequest(ep, smellsById[ep.smell]);
    if (!request) { held[ep.key] = 'no-trigger (no known-fix template and no product-change finding)'; continue; }
    if (starved) { held[ep.key] = 'a lane-starvation episode is open'; continue; }
    if (isDuplicate(ledger, request.key)) { held[ep.key] = 'duplicate — already on the filing ledger'; continue; }
    if (countRecent(ledger, now, windowMs) + toRequest.length >= cap) { held[ep.key] = `at the daily cap (${cap})`; continue; }
    toRequest.push({ key: ep.key, request });
  }
  return { toRequest, held };
}

/** PURE: append a fresh `pending` ledger entry for a just-planned request. */
export function recordRequested(ledger, request, now = Date.now()) {
  const entry = {
    ...request,
    ref: refFor(request.episodeId),
    requestedAt: now,
    status: 'pending',
    attemptId: null,
    claimedAt: null,
    card: null,
    cardFile: null,
    pr: null,
    prUrl: null,
    landedAt: null,
  };
  return [...(ledger || []), entry];
}

/** PURE: markdown lines for the episode report's filing section — `[]` when there is nothing to show. */
export function renderFilingSection(entry) {
  if (!entry) return [];
  const statusLine = {
    pending: 'queued — waiting for the lane-bound landing pass',
    landing: 'landing now (a lane is open for it)',
    landed: `landed as an uncleared card${entry.card ? ` #${entry.card}` : ''}${entry.prUrl ? ` — ${entry.prUrl}` : entry.pr ? ` — PR #${entry.pr}` : ''}`,
  }[entry.status] ?? entry.status;
  const lines = ['## Filing request', '', `- ${statusLine}`, '', `**${entry.title}**`, '', entry.digest, ''];
  if (entry.scope?.length) lines.push(`Scope: ${entry.scope.join(', ')}`, '');
  return lines;
}

// ── ledger IO (this item's own small fs surface — see file header) ─────────────────────────────────────────────

export function filingDir(dir) { return join(dir, 'filing'); }
export function ledgerPath(dir) { return join(filingDir(dir), 'ledger.json'); }

/** FAILS CLOSED: a present-but-unparseable ledger throws rather than silently becoming `[]` — a torn ledger must
 *  be noticed, never treated as "no requests ever made" (which would re-file every live episode's request from
 *  scratch and blow past the daily cap's whole point). Absence is the ONLY case that legitimately means empty. */
export function readLedgerStrict(dir) {
  const p = ledgerPath(dir);
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, 'utf8');
  let value;
  try { value = JSON.parse(raw); } catch (e) {
    throw new Error(`health-file-request: ledger at ${p} is corrupt JSON — refusing to treat it as empty (${e.message})`);
  }
  if (!Array.isArray(value)) throw new Error(`health-file-request: ledger at ${p} is not an array — refusing to treat it as empty`);
  return value;
}

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmp, path);
}

export function writeLedger(dir, ledger) { writeJsonAtomic(ledgerPath(dir), ledger); }

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Zero-padded so lexical order == numeric order for the generation lock files. */
const LOCK_GEN_WIDTH = 12;
const LOCK_GEN_RE = /^ledger\.lock\.(\d+)$/;
const genName = (gen) => `ledger.lock.${String(gen).padStart(LOCK_GEN_WIDTH, '0')}`;

/** Read a lock file's mtime AND content from ONE fd so both describe the same file. null when absent. */
function observeLockFile(path) {
  let fd;
  try { fd = openSync(path, 'r'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  try {
    const { mtimeMs } = fstatSync(fd);
    const buf = Buffer.alloc(64);
    const n = readSync(fd, buf, 0, 64, 0);
    return { mtimeMs, content: buf.toString('utf8', 0, n) };
  } finally { closeSync(fd); }
}

/** A tiny generation-CAS lock around the ledger's read-modify-write ONLY — never held across a subprocess
 *  (`git`/`gh`/lane-pool) call, so the tick's planning write and the landing pass's claim/finalize writes
 *  serialize into short, bounded transactions instead of racing into a lost update.
 *
 *  Lock state is a set of monotonic generation files `<filingDir>/ledger.lock.<gen>`; the highest gen is
 *  "current" and holds `held:<pid>` or `released`. A waiter OBSERVES the current gen (mtime + content from one
 *  fd), and if it is takeable (absent, `released`, or `held` older than `staleMs`) TAKES it by exclusively
 *  creating (`wx`) gen `cur+1`. Only one process can ever create that name, so anyone who (re)created the lock
 *  inside our observe->create window necessarily created the same name and our `wx` fails `EEXIST`: the swap
 *  succeeds only if the current generation is still the one we inspected. No step ever removes or renames a lock
 *  by path, so there is no window where the lock is absent-then-restored. Release overwrites our own gen file
 *  (`r+`, never creates) with `released` and leaves it as a tombstone so its successor name can never be
 *  re-created by a waiter holding a stale observation; the winner prunes older gens best-effort. A holder whose
 *  gen was superseded writes only to its own old file — harmless to any successor.
 *
 *  A crash-held lock is reclaimed once older than `staleMs` (which must outlast the longest real critical
 *  section — mtime staleness can still reclaim a live holder that runs past it; unchanged, out of scope).
 *  A legacy bare `ledger.lock` (old scheme) is unlinked once if stale, waited on if fresh.
 *
 *  `hooks.afterObserve` is a test seam called between observe and take; production passes nothing. */
export function withLedgerLock(dir, fn, { staleMs = 60_000, timeoutMs = 10_000, sleepMs = 25 } = {}, hooks = {}) {
  const fdir = filingDir(dir);
  mkdirSync(fdir, { recursive: true });
  const legacyPath = join(fdir, 'ledger.lock');
  const deadline = Date.now() + timeoutMs;
  let myPath;
  let myGen;
  for (;;) {
    const legacy = observeLockFile(legacyPath);
    if (legacy) {
      if (Date.now() - legacy.mtimeMs > staleMs) { try { unlinkSync(legacyPath); } catch { /* raced away */ } continue; }
    } else {
      const gens = readdirSync(fdir).map((f) => LOCK_GEN_RE.exec(f)).filter(Boolean).map((m) => Number(m[1]));
      const cur = gens.length ? Math.max(...gens) : 0;
      const obs = cur ? observeLockFile(join(fdir, genName(cur))) : null;
      if (hooks.afterObserve) hooks.afterObserve({ cur, obs });
      const takeable = cur === 0 || !obs || obs.content === 'released' || Date.now() - obs.mtimeMs > staleMs;
      if (takeable) {
        const path = join(fdir, genName(cur + 1));
        try {
          writeFileSync(path, `held:${process.pid}`, { flag: 'wx' });
          myPath = path;
          myGen = cur + 1;
          break;
        } catch (e) {
          if (e.code !== 'EEXIST') throw e; // CAS refused: the generation moved on — re-observe
        }
      }
    }
    if (Date.now() > deadline) throw new Error(`health-file-request: timed out waiting for the ledger lock at ${legacyPath}`);
    sleepSync(sleepMs);
  }
  for (const f of readdirSync(fdir)) {
    const m = LOCK_GEN_RE.exec(f);
    if (m && Number(m[1]) < myGen) { try { unlinkSync(join(fdir, f)); } catch { /* already gone */ } }
  }
  try {
    return fn();
  } finally {
    try {
      const fd = openSync(myPath, 'r+'); // never creates: a pruned gen just ENOENTs
      try { writeSync(fd, 'released', 0); ftruncateSync(fd, 8); } finally { closeSync(fd); }
    } catch { /* pruned/gone — nothing of ours left to release */ }
  }
}

/**
 * Claim a `pending` (or stale `landing`) entry for landing — exclusive, short-lived, lock-protected. Returns
 * `{claimed:null, reason}` when nothing is claimable (already landed, or another attempt's claim is still
 * live) — the caller (the landing operation) must treat that as "skip this entry, try again later", never as
 * an error. Runs NO subprocess itself.
 */
export function claimForLanding(dir, key, now = Date.now()) {
  return withLedgerLock(dir, () => {
    const ledger = readLedgerStrict(dir);
    const idx = ledger.findIndex((e) => e.key === key);
    if (idx < 0) return { claimed: null, reason: 'not-on-ledger' };
    const entry = ledger[idx];
    if (entry.pr) return { claimed: null, reason: 'already-landed' };
    if (entry.status === 'landing' && entry.claimedAt && now - entry.claimedAt < ATTEMPT_TIMEOUT_MS) {
      return { claimed: null, reason: 'in-flight' };
    }
    const attemptId = `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const claimed = { ...entry, status: 'landing', attemptId, claimedAt: now };
    const next = [...ledger];
    next[idx] = claimed;
    writeLedger(dir, next);
    return { claimed };
  });
}

/**
 * Patch a ledger entry by key — identity-checked by `attemptId` so a stale/expired claimant can never clobber a
 * fresher attempt's own result (a lost-update guard, not just a lock: the lock only protects the write itself,
 * this protects against a SUPERSEDED writer winning a race after its own claim already expired).
 * @returns {object|null} the patched entry, or `null` if the write was refused (entry gone, or superseded).
 */
export function patchLedgerEntry(dir, key, attemptId, patch) {
  return withLedgerLock(dir, () => {
    const ledger = readLedgerStrict(dir);
    const idx = ledger.findIndex((e) => e.key === key);
    if (idx < 0) return null;
    if (attemptId != null && ledger[idx].attemptId !== attemptId) return null;
    const next = [...ledger];
    next[idx] = { ...ledger[idx], ...patch };
    writeLedger(dir, next);
    return next[idx];
  });
}

const FILING_START = '<!-- health-file-request:start -->';
const FILING_END = '<!-- health-file-request:end -->';

/**
 * Idempotently splice this episode's filing section into an ALREADY-WRITTEN episode report file — regardless
 * of whether the episode is still open in the tick's own state. A closed episode drops out of the tick's normal
 * per-episode render loop (`health-watch.mjs`'s `tick()` only re-renders episodes it still holds open, the same
 * gap #4078's own late-findings handling names in its header), so the landing pass calls this directly by
 * report path instead of relying on ever being re-rendered by a future tick. No-op if the report file doesn't
 * exist yet (nothing to splice into — the tick always writes the report before any filing request is even
 * planned for that episode, so this should not happen in practice).
 * @returns {boolean} whether the file was changed
 */
export function spliceFilingSection(reportPath, entry) {
  if (!existsSync(reportPath)) return false;
  const body = readFileSync(reportPath, 'utf8');
  const section = [FILING_START, ...renderFilingSection(entry), FILING_END].join('\n');
  const re = new RegExp(`${FILING_START}[\\s\\S]*?${FILING_END}`);
  const next = re.test(body) ? body.replace(re, section) : `${body.replace(/\n+$/, '')}\n\n${section}\n`;
  if (next === body) return false;
  writeFileSync(reportPath, next);
  return true;
}
