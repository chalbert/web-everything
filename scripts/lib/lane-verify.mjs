/**
 * lane-verify.mjs — the pure verification-record core for #2833 (subagent-stall mitigation).
 *
 * THE STALL THIS EXISTS FOR. A build subagent's delivery arc is: run the required suites, then
 * `lane-pool release` / `pr-land` to finish. Twice one night a subagent BACKGROUNDED its long test run and
 * then yielded/terminated before the run finished — leaving the lane/PR mid-flight, producing nothing, never
 * erroring, so nothing reclaimed it. The root cause (prevention-introspection): the verification was
 * BACKGROUNDABLE, and yielding mid-run LOOKED complete. The fix must make an unfinished verification NOT look
 * complete.
 *
 * THE MECHANISM. A lane records its verification as a marker keyed to the exact commit it verified:
 *   - `scripts/verify-lane.mjs` runs the suites SYNCHRONOUSLY (foreground, blocks until exit). It writes a
 *     `running` marker at start and rewrites it to `green`/`red` at finish. If the process is killed mid-run
 *     (the stall), the marker is stranded at `running` — a DETECTABLY-unfinished verification.
 *   - the delivery gate (`pr-land.mjs`) reads the marker for the HEAD it is about to land and REFUSES when the
 *     verification is unfinished (`running` — the exact stall signature) or — since #3321, BY DEFAULT — absent
 *     or red. A stranded/abandoned run can no longer masquerade as a delivered lane, and neither can a lane that
 *     never started one.
 *
 * This module is the DECISION half — the gate functions (`verifyGateDecision`, `isVerifyAbandoned`, the marker
 * body builders) take no filesystem, no git, no clock (the caller passes `nowMs`), so they stay unit-testable.
 * `verify-lane.mjs` owns the heavy IO (git rev-parse, the synchronous suite run) and `pr-land.mjs` calls
 * `verifyGateDecision` at its finish-guard. Mirrors the split in `scripts/lib/lane-lease.mjs`.
 *
 * The ONE piece of IO that lives here is the SHARED marker reader (`readVerifyMarker` / its pure normalizer
 * `normalizeVerifyRecord`): both entry points (`verify-lane.mjs`'s `readMarker` and `pr-land.mjs`'s finish-guard)
 * read the exact same marker, and #2833 finding 2 was that they hand-inlined two *different* parsers — pr-land's
 * caught only a throw, so a valid-JSON non-object (`null`/`"x"`/`[]`) slipped through as "no sha → untracked →
 * land unverified". Single-sourcing the read here is the fix (a valid-JSON non-object normalizes to
 * `{ corrupt: true }`, which the gate refuses). Likewise `resolveVerifyOptions` single-sources the
 * `--require-verified`/`WE_REQUIRE_VERIFIED`/`WE_LAND_UNVERIFIED` flag+env resolution both entry points apply
 * (#2833 finding 5 — `check` mode used to ignore `WE_REQUIRE_VERIFIED`, disagreeing with pr-land).
 *
 * ── #3321: VERIFICATION IS MANDATORY BEFORE A LANE LANDS ────────────────────────────────────────────────
 * #2833 shipped the gate but left `requireVerified` DEFAULT FALSE, so the mandatory half never engaged: a lane
 * whose suites had never run at all landed on the `untracked` verdict — "no marker → not tracked here → allow".
 * That is a gate that PASSES WHEN IT CANNOT TELL, and it is measurably expensive: 18 of the 39 confirmed review
 * findings in `scripts/review-corpus/` had their input available at COMMIT time, where the very suite this marker
 * records would have caught them. The suite itself had been red on every macOS host and nobody noticed, because
 * nothing on the delivery path was obliged to look.
 *
 * So the default INVERTS. Verification is required unless a caller explicitly says otherwise, and there are now
 * exactly two documented ways past the gate — deliberately different in strength:
 *
 *   1. OPT-OUT — `--no-require-verified` (or `--require-verified=0|false|no|off`, or `WE_REQUIRE_VERIFIED=0`).
 *      Restores the pre-#3321 ADVISORY posture for callers that genuinely verify elsewhere (a CI-gated path
 *      whose required GitHub check is the real gate). It relaxes only the two "we never saw a result" cells —
 *      absent/stale and `red` — and it is NOT a bypass: a FRESH `running` marker (the #2833 stall) and a
 *      `corrupt` marker still refuse, because those are evidence of a BROKEN verification, not a missing one.
 *   2. BREAK-GLASS — `WE_LAND_UNVERIFIED=1`. The full override, every cell, including stall and corrupt. For a
 *      guard bug or a wedged lane; the PR still rides the required CI check. House style: `WE_MERGE_BREAK_GLASS`.
 *
 * Fail-closed by construction: `verifyGateDecision`'s own `requireVerified` parameter defaults TRUE as well, so a
 * caller that FORGETS to pass the resolved option gets the strict gate, never the permissive one. The whole
 * defect class this item closes is a default that reads as "allow" when the answer is unknown.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** The marker lives in the lane clone's `.git/` (like `.lane-lease`): never tracked, never `git clean`-ed,
 *  invisible to `git status`, one-per-lane. */
export const VERIFY_FILENAME = '.lane-verify';

/** Normalize a JSON-parsed marker payload to the shape the gate expects. Pure. A parsed value that is not a
 *  plain object (an array, `null`, a string, a number — all VALID JSON) is NOT a verification record: fold it to
 *  `{ corrupt: true }` so the gate refuses it, never treats it as `absent` and fails OPEN (#2833 finding 2/5). A
 *  plain object passes through untouched (its fields are validated downstream by `verifyGateDecision`). */
export function normalizeVerifyRecord(parsed) {
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { corrupt: true };
}

/** Read + normalize the lane verification marker from a git dir. The SINGLE reader both entry points share
 *  (#2833 finding 2): resolve `<gitDir>/.lane-verify`, and
 *    - missing file            → `null`   (absent — the gate decides per `requireVerified`),
 *    - present but unparseable  → `{ corrupt: true }` (torn/garbled — the gate refuses, never fails open),
 *    - present valid non-object → `{ corrupt: true }` (via `normalizeVerifyRecord` — the finding-2 hole),
 *    - present plain object     → the record as-is.
 *  IO (fs read) — but the whole point is that the read is defined in exactly one place so the two callers can
 *  never drift. `gitDir` is the ABSOLUTE git dir (`git rev-parse --absolute-git-dir`), correct for both a clone
 *  (`.git` is a directory) and a worktree (`.git` is a file / relocated). */
export function readVerifyMarker(gitDir) {
  const markerPath = join(gitDir, VERIFY_FILENAME);
  if (!existsSync(markerPath)) return null;
  try {
    return normalizeVerifyRecord(JSON.parse(readFileSync(markerPath, 'utf8')));
  } catch {
    return { corrupt: true };
  }
}

/** The tokens that mean "no" in a flag value or an env var. `''` is deliberately NOT one of them: an env var set
 *  to empty is an accident, not a decision, and a fail-closed gate must not read an accident as consent (#3321). */
const NEGATIVE_TOKENS = new Set(['0', 'false', 'no', 'off']);

/** Is this flag/env value an EXPLICIT negative? Pure. `undefined` (absent) is not — absence never opts out. */
function isNegative(value) {
  if (value === false) return true;
  return typeof value === 'string' && NEGATIVE_TOKENS.has(value.trim().toLowerCase());
}

/** Resolve the verification GATE options from an entry point's parsed flags + process env. Pure. The SINGLE
 *  source both `verify-lane.mjs check` and `pr-land.mjs` call, so the two can never disagree (#2833 finding 5 —
 *  `check` mode read only `flags['require-verified']` while pr-land also honoured `WE_REQUIRE_VERIFIED`, so the
 *  same environment gave two verdicts).
 *
 *  #3321 — `requireVerified` now defaults TRUE. Verification is MANDATORY before a lane lands; a caller must say
 *  so explicitly to land unverified, and saying nothing means "verified, please", never "don't bother":
 *    - `--require-verified` (bare, or `=1|true|…`)  → required  (the pre-#3321 spelling, still honoured)
 *    - `WE_REQUIRE_VERIFIED=1`                      → required  (ditto)
 *    - nothing at all                               → required  ← THE FLIP
 *    - `--no-require-verified`                      → OPT-OUT   (advisory posture; NOT a bypass — see below)
 *    - `--require-verified=0|false|no|off`          → OPT-OUT
 *    - `WE_REQUIRE_VERIFIED=0|false|no|off`         → OPT-OUT
 *  The opt-out only relaxes the "we never saw a result" cells (absent/stale, `red`). A fresh `running` marker
 *  (the #2833 stall) and a `corrupt` marker still refuse under it — the FULL override is `WE_LAND_UNVERIFIED=1`,
 *  reported separately as `breakGlass`. Two different strengths, kept distinguishable on purpose.
 *
 *  When those inputs CONFLICT, an explicit positive FLAG beats a negative ENV (`--require-verified` with an
 *  ambient `WE_REQUIRE_VERIFIED=0` ⇒ required), and `--require-verified` beats `--no-require-verified`. Both
 *  tie-breaks resolve toward verifying — a fail-closed gate must not read a contradiction as consent, for the
 *  same reason an empty env var is not consent. See the precedence note in the body. */
export function resolveVerifyOptions({ flags = {}, env = {} } = {}) {
  // PRECEDENCE: an EXPLICIT POSITIVE FLAG OUTRANKS EVERYTHING BELOW IT — including a negative env var. The first
  // cut of #3321 collapsed flag and env into one flat OR, which silently regressed the pre-#3321 precedence: an
  // ambient `WE_REQUIRE_VERIFIED=0` in the environment defeated an explicit `--require-verified` on the command
  // line (the old resolver had the flag win, since it was `!!flag || env === '1'`). That is fail-OPEN on a
  // contradictory invocation, and this gate exists to fail CLOSED. A flag is a decision made HERE, for THIS run;
  // an env var is ambient and may be inherited from a parent process that knew nothing about this call. When they
  // disagree, the deliberate one wins — and when the deliberate one is "verify", it wins doubly, because reading a
  // stale export as permission to skip verification is the whole defect class this item closes.
  const flagRequires = flags['require-verified'] !== undefined && !isNegative(flags['require-verified']);
  const optedOut = !flagRequires && (
    // `--no-require-verified` — present and not itself negated (`--no-require-verified=0` is a double negative
    // nobody means; treat only a straightforward presence as the opt-out). Passing BOTH `--require-verified` and
    // `--no-require-verified` is contradictory, and `flagRequires` above resolves it fail-closed: verify.
    (flags['no-require-verified'] !== undefined && !isNegative(flags['no-require-verified']))
    || isNegative(flags['require-verified'])
    || isNegative(env.WE_REQUIRE_VERIFIED));
  return {
    requireVerified: !optedOut,
    breakGlass: env.WE_LAND_UNVERIFIED === '1',
  };
}

/** How long a `running` marker may sit before it reads as ABANDONED rather than still-in-flight. This only
 *  refines the human message (`abandoned` vs `in-flight`) — a `running` marker is "verification unfinished"
 *  either way, so the gate refuses regardless of age. Long enough to outlast a genuinely slow suite. */
export const DEFAULT_VERIFY_TTL_MINUTES = 30;

/** Build the AT-START (`running`) marker. The caller stamps `startedAt` (ISO) and the resolved `sha` so this
 *  stays clock-free / git-free / testable. `suites` is the gate command string, recorded for the message. */
export function verifyStartBody({ sha, suites, startedAt }) {
  return {
    sha: sha || null,
    status: 'running',
    startedAt: startedAt || null,
    finishedAt: null,
    suites: suites || null,
    exitCode: null,
  };
}

/** Rewrite a `running` marker into its terminal (`green`/`red`) form once the synchronous run has exited.
 *  Pure: the caller supplies `finishedAt` (ISO), the process `exitCode` (0 ⇒ green), and — crucially — the
 *  `sha` this run ACTUALLY verified.
 *
 *  #2833 finding 1: the finish write must stamp the sha the run itself captured at START, NEVER inherit it from
 *  the on-disk marker (`prev.sha`). Two overlapping `verify-lane` runs share one clone's marker; if a slow run
 *  finishing at X copies whatever sha is on disk (a newer run's Y) onto its own green, it publishes a false
 *  green for a tree it never verified — the exact false-green this guard exists to kill. So `sha` is passed
 *  explicitly and wins. `prev` supplies only `startedAt`/`suites` (audit fields); `base.sha` is a fallback for
 *  legacy callers that pass their own start body as `prev`. */
export function verifyFinishBody(prev, { finishedAt, exitCode, sha } = {}) {
  const base = prev && typeof prev === 'object' ? prev : {};
  const green = Number(exitCode) === 0;
  return {
    sha: sha ?? base.sha ?? null,
    status: green ? 'green' : 'red',
    startedAt: base.startedAt ?? null,
    finishedAt: finishedAt || null,
    suites: base.suites ?? null,
    exitCode: Number.isFinite(Number(exitCode)) ? Number(exitCode) : null,
  };
}

/** Has a `running` marker outlived its TTL (⇒ ABANDONED — the writer is presumed gone)? A `green`/`red`
 *  marker never expires by time: its `sha` binds it to an exact tree, so SHA-identity — not the clock — is the
 *  real freshness test. A malformed / dateless `running` marker reads as abandoned (fail toward "not fresh").
 *  Pure — the caller passes `nowMs`. */
export function isVerifyAbandoned(record, nowMs, ttlMs = DEFAULT_VERIFY_TTL_MINUTES * 60_000) {
  if (!record || typeof record !== 'object') return true;
  if (record.status !== 'running') return false;
  const at = Date.parse(record.startedAt);
  if (Number.isNaN(at)) return true;
  return nowMs - at >= ttlMs;
}

/**
 * THE FINISH-GUARD DECISION (#2833). Given the lane's verification `record` and the `headSha` a delivery step
 * (pr-land) is about to land, decide whether that HEAD is verified enough to deliver. Pure — no fs/git/clock.
 *
 * #3321 — `requireVerified` DEFAULTS TRUE here, not just in `resolveVerifyOptions`. A caller that omits the
 * option gets the strict gate: the failure mode this closes is precisely a gate that allows when it cannot tell.
 * Read every "`requireVerified` false" cell below as "under the explicit `--no-require-verified` opt-out".
 *
 *   - `breakGlass` (env `WE_LAND_UNVERIFIED=1`) → ALWAYS ok, flagged. The deliberate documented override so a
 *     guard bug / a legitimately-CI-only land is never permanently wedged (house style: `WE_MERGE_BREAK_GLASS`).
 *     This is the FULL bypass — the opt-out is not: it leaves stall and corrupt refusing.
 *   - a `green` record whose `sha` === `headSha` → ok (`verified`). The one clean pass.
 *   - a `running` record whose `sha` === `headSha` → the EXACT observed stall: a verification was started for
 *     this commit and never finished. A FRESH (in-flight) `running` marker is NOT ok (`verify-unfinished`) — a
 *     half-run verification must never look complete. But a PAST-TTL `running` marker (the writer is presumed
 *     gone) must not wedge an opted-out CI-gated caller forever: past-TTL AND `requireVerified` false ⇒ DEGRADE
 *     to the non-blocking `untracked` verdict (the required CI check still gates the merge) — #2833 finding 1.
 *     Under `requireVerified` — now the DEFAULT (#3321) — it stays refused even when abandoned: that path demands
 *     a real green. That is not a wedge, because re-running `verify-lane` legitimately overwrites a `running`
 *     marker for the same sha (its start-write refuses only to clobber a TERMINAL record for a FOREIGN sha).
 *   - a `red` record whose `sha` === `headSha`: refused (`verify-red`) ONLY under `requireVerified`; without it
 *     the marker is advisory and the record is allowed (`red-ci-gated`). This is the asymmetry between the two
 *     hazard classes — "never finished" (`running`) is always refused; "finished badly" (`red`) blocks only when
 *     the caller demanded a local green. It matches the "absent/red under `--require-verified`" contract in the
 *     PR body + #2833 resolution, and keeps the CI-gated drain / parallel-workflow paths (which gate the merge
 *     via the required GitHub `test` check — a red tree also fails it) untouched, as documented.
 *   - a `corrupt` record (the marker exists but did not parse) → NOT ok (`verify-corrupt`), regardless of
 *     `requireVerified`. A torn/garbled marker must never fold into `absent` and fail OPEN — exactly backwards
 *     for a stall guard (#2833 finding 5). Re-run `verify-lane` (or delete the marker) to recover.
 *   - no record, or a record for a DIFFERENT `sha` (stale — the tree moved on): if `requireVerified` → NOT ok
 *     (`unverified`); else ok (`untracked`). #3321 flipped which of those is the default. THIS is the cell the
 *     item exists for: "no marker" used to mean "not tracked here, go ahead", so a lane whose suites had never
 *     run landed on the strength of the gate not knowing. It now means "unverified — run `verify-lane`". The
 *     permissive `untracked` verdict survives only for a caller that explicitly opts out (`--no-require-verified`)
 *     because it verifies elsewhere — e.g. a path gated by the required GitHub check rather than this marker.
 *     Note a MISSING `headSha` also lands here (nothing can match it), and so is refused by default rather than
 *     waved through: not being able to identify the tree is not evidence that the tree is fine.
 *
 * @returns {{ ok:boolean, status:string, reason:string, detail:string }}
 */
export function verifyGateDecision({ record, headSha, nowMs = Date.now(), ttlMs = DEFAULT_VERIFY_TTL_MINUTES * 60_000, breakGlass = false, requireVerified = true } = {}) {
  if (breakGlass) {
    return { ok: true, status: 'break-glass', reason: 'break-glass', detail: 'WE_LAND_UNVERIFIED=1 — verification gate overridden (deliberate break-glass; the PR still rides the required CI check).' };
  }
  const rec = record && typeof record === 'object' ? record : null;

  // A marker that exists but did not parse (the IO layer signals `{ corrupt: true }`) is refused unconditionally
  // — never treated as `absent`, which would fail open (#2833 finding 5).
  if (rec && rec.corrupt) {
    return { ok: false, status: 'corrupt', reason: 'verify-corrupt', detail: 'the lane verification marker exists but is unparseable (corrupt/torn) — refusing to land; re-run `node scripts/verify-lane.mjs` (or delete the marker) to record a clean result.' };
  }

  const matches = rec && rec.sha && headSha && rec.sha === headSha;

  if (matches && rec.status === 'green') {
    return { ok: true, status: 'green', reason: 'verified', detail: `lane verified green for ${String(headSha).slice(0, 8)} (suites: ${rec.suites || 'recorded'}).` };
  }
  if (matches && rec.status === 'running') {
    const abandoned = isVerifyAbandoned(rec, nowMs, ttlMs);
    // #2833 finding 1 — the TTL must actually GATE, not just re-word. A stranded `running` marker that has
    // outlived its TTL (the writer is presumed gone) must NOT wedge the CI-gated drain forever: past-TTL AND
    // `requireVerified` false ⇒ DEGRADE to the non-blocking `untracked` verdict (the required GitHub check still
    // gates the merge). Fail-CLOSED otherwise: a FRESH (in-flight) `running` marker is the exact observed stall
    // and is always refused; and under `requireVerified` (the solo/conveyor build gate) even an abandoned run is
    // refused — that flow demands a real local green, never a timed-out one.
    if (abandoned && !requireVerified) {
      return {
        ok: true, status: 'untracked', reason: 'untracked',
        detail: `verification for ${String(headSha).slice(0, 8)} was left UNFINISHED (a backgrounded run that never completed; started ${rec.startedAt || '?'}) and has outlived its TTL (${Math.round(ttlMs / 60_000)}m) — treating it as untracked so a stranded marker cannot wedge the CI-gated drain (#2833 finding 1); the PR's required CI check still gates the merge. Re-run \`node scripts/verify-lane.mjs\` to record a fresh green.`,
      };
    }
    return {
      ok: false, status: 'running', reason: 'verify-unfinished',
      detail: `verification for ${String(headSha).slice(0, 8)} is UNFINISHED (${abandoned ? 'abandoned — a backgrounded run that never completed' : 'still in-flight'}; started ${rec.startedAt || '?'}). A half-run verification must not look complete — re-run \`node scripts/verify-lane.mjs\` to completion (foreground, blocking) before landing.`,
    };
  }
  if (matches && rec.status === 'red') {
    if (requireVerified) {
      return { ok: false, status: 'red', reason: 'verify-red', detail: `verification for ${String(headSha).slice(0, 8)} recorded a RED result (exit ${rec.exitCode ?? '?'}) — fix the failure and re-run \`node scripts/verify-lane.mjs\`.` };
    }
    // Advisory mode: the required CI check (which a red tree also fails) gates the actual merge, so a local red
    // marker does not block here — matching "absent/red under --require-verified" (docs + #2833 resolution).
    return { ok: true, status: 'red', reason: 'red-ci-gated', detail: `verification for ${String(headSha).slice(0, 8)} recorded RED (exit ${rec.exitCode ?? '?'}), but this caller opted out of mandatory verification (--no-require-verified / WE_REQUIRE_VERIFIED=0) — not blocking here; the PR's required CI check gates the merge.` };
  }

  // No marker, or a marker for a different commit (the tree moved since it was written).
  const why = rec ? `the recorded verification is for ${String(rec.sha).slice(0, 8)}, not the HEAD being landed (${String(headSha).slice(0, 8)})` : 'no verification marker for this lane';
  if (requireVerified) {
    return { ok: false, status: 'absent', reason: 'unverified', detail: `${why} — verification is MANDATORY before a lane lands (#3321): run \`node scripts/verify-lane.mjs\` (a foreground, blocking suite run) to record a green result for this HEAD. Deliberate escapes: --no-require-verified when the lane is verified elsewhere, or WE_LAND_UNVERIFIED=1 to override the gate entirely.` };
  }
  return { ok: true, status: 'untracked', reason: 'untracked', detail: `${why} — this caller opted out of mandatory verification (--no-require-verified / WE_REQUIRE_VERIFIED=0), so the marker is advisory here (the PR's required CI check still gates the merge).` };
}
