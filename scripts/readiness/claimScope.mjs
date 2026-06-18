/**
 * @file scripts/readiness/claimScope.mjs
 * @description Gate-violation attribution — claim-time git baseline + finding partition (backlog #952,
 *              ratified by #949 Fork 1-A / 2-A / 3-A).
 *
 * Concurrent agent sessions share ONE filesystem + ONE git working tree (solo-dev, single checkout). So
 * `check:standards` — whole-repo, file-keyed — reds session A on session B's mid-build `active` files.
 * #949 ratified the deterministic fix: at `claim`, snapshot the set of files ALREADY dirty (= everyone
 * else's in-flight + pre-existing) as a per-session **baseline**; then `check:standards --scope=<session>`
 * counts a finding as **mine** only when its file is dirty *now* but was NOT in that baseline. "Mine"
 * errors still fail (exit 1); everything else prints as a non-failing note. The default no-flag run stays
 * whole-repo-strict (CI / close-out unchanged).
 *
 * Failure mode by design (#949 Fork 2-A): a concurrent session newly-dirtying a file *inside* my window
 * leaks into "mine" — an over-cautious stop, NEVER a foreign red mistaken for clean.
 *
 * This module is PURE — no fs, no process, no `Date` reads. Callers inject the file text, the
 * `git status --porcelain` lines, and the clock. Mirrors `reservations.mjs` (the sibling #083 registry).
 */

/** Default lease before a claim baseline is ignored (mirrors the #083 reservation TTL). */
export const DEFAULT_TTL_MINUTES = 120;

/** A fresh, empty claim-scope state. */
export function emptyClaimState() {
  return { ttlMinutes: DEFAULT_TTL_MINUTES, sessions: [] };
}

/**
 * Tolerant parse of `claims.json` text → `{ ttlMinutes, sessions: [{ session, ids, baseline, at }] }`.
 * NEVER throws: bad JSON / junk rows degrade to an empty state (a corrupt attribution hint must never
 * break the gate or the claim CLI).
 * @param {string} text
 */
export function parseClaims(text) {
  if (!text || !text.trim()) return emptyClaimState();
  let raw;
  try { raw = JSON.parse(text); } catch { return emptyClaimState(); }
  const ttlMinutes = Number.isFinite(raw?.ttlMinutes) && raw.ttlMinutes > 0 ? raw.ttlMinutes : DEFAULT_TTL_MINUTES;
  const sessions = Array.isArray(raw?.sessions)
    ? raw.sessions
        .filter((s) => s && s.session && s.at)
        .map((s) => ({
          session: String(s.session),
          ids: Array.isArray(s.ids) ? s.ids.map(String) : [],
          baseline: Array.isArray(s.baseline) ? s.baseline.map(String) : [],
          at: String(s.at),
        }))
    : [];
  return { ttlMinutes, sessions };
}

/** Serialize a claim-scope state to pretty JSON (carries a `_doc` provenance header). */
export function serializeClaims(state) {
  return JSON.stringify(
    {
      _doc:
        'Per-session claim-time git baselines (backlog #952, ratified #949). `backlog.mjs claim <NNN> ' +
        '--session=<slug>` records the files already dirty at claim time (everyone else\'s in-flight + ' +
        'pre-existing); `check:standards --scope=<slug>` blocks only on findings whose file is dirty ' +
        'now but NOT in that baseline. Advisory devtools state — the default no-flag gate stays strict.',
      ttlMinutes: state.ttlMinutes ?? DEFAULT_TTL_MINUTES,
      sessions: state.sessions ?? [],
    },
    null,
    2,
  );
}

/** Drop session baselines older than `ttlMinutes` (or with an unparseable timestamp) — TTL hygiene. */
export function pruneExpiredClaims(state, nowMs, ttlMinutes = state.ttlMinutes ?? DEFAULT_TTL_MINUTES) {
  const ttlMs = ttlMinutes * 60_000;
  const sessions = (state.sessions ?? []).filter((s) => {
    const t = Date.parse(s.at);
    return Number.isFinite(t) && nowMs - t < ttlMs;
  });
  return { ttlMinutes, sessions };
}

/** Extract changed file paths from `git status --porcelain` output (handles rename `old -> new`). */
export function porcelainFiles(porcelain) {
  const files = new Set();
  for (const line of String(porcelain || '').split('\n')) {
    if (!line.trim()) continue;
    // Format: XY<space>path  (rename/copy: `R  old -> new`). Status cols are the first 3 chars.
    const rest = line.slice(3).trim();
    const arrow = rest.indexOf(' -> ');
    files.add(arrow >= 0 ? rest.slice(arrow + 4).trim() : rest);
  }
  return files;
}

/**
 * Record a claim for `session`: capture the baseline (the files already dirty) the FIRST time the session
 * claims, and append the claimed `id`. The baseline is captured once — at session start — so every file
 * THIS session subsequently dirties counts as mine; re-snapshotting per claim would wrongly bucket the
 * session's own earlier edits as baseline. Returns a new state (pure).
 */
export function recordClaim(state, { session, id, baselineFiles, nowIso }) {
  const sessions = (state.sessions ?? []).map((s) => ({ ...s, ids: [...s.ids], baseline: [...s.baseline] }));
  const existing = sessions.find((s) => s.session === session);
  if (existing) {
    if (id && !existing.ids.includes(id)) existing.ids.push(id);
    // baseline kept from the first claim — do NOT overwrite.
  } else {
    sessions.push({
      session,
      ids: id ? [id] : [],
      baseline: [...new Set(baselineFiles ?? [])],
      at: nowIso,
    });
  }
  return { ttlMinutes: state.ttlMinutes ?? DEFAULT_TTL_MINUTES, sessions };
}

/** Look up a session's recorded baseline file set; `null` when the session is unknown. */
export function baselineFor(state, session) {
  const s = (state.sessions ?? []).find((x) => x.session === session);
  return s ? new Set(s.baseline) : null;
}

/**
 * Look up the backlog item ids a session has claimed (as strings); `null` when the session is unknown.
 * Mirrors `baselineFor` but on the `ids` axis — `check:health --scope` attributes by owning item id (its
 * findings are id-keyed, not file-keyed) rather than by the git baseline (#957).
 */
export function claimedIdsFor(state, session) {
  const s = (state.sessions ?? []).find((x) => x.session === session);
  return s ? new Set(s.ids.map(String)) : null;
}

/**
 * Partition id-keyed findings by ownership against `mineIds`. `mine` = findings whose `id` is claimed by
 * the session (or that carry NO id at all — unattributable, kept fail-safe like a path-less gate finding);
 * `external` = id-carrying findings owned by another session. Pure; mirrors `partitionFindings` on the id
 * axis (#957). `getId` extracts the owning id from a finding (default `f.id`).
 */
export function partitionById(findings, mineIds, getId = (f) => f.id) {
  const mine = [];
  const external = [];
  for (const f of findings) {
    const id = getId(f);
    if (id == null) { mine.push(f); continue; }      // unattributable → fail-safe, stays in scope
    (mineIds.has(String(id)) ? mine : external).push(f);
  }
  return { mine, external };
}

/**
 * The set of files attributable to `session`: dirty NOW (`currentFiles`) minus its claim baseline.
 * Returns `null` when the session has no recorded baseline (→ caller falls back to whole-repo strict).
 */
export function mineFiles(state, session, currentFiles) {
  const baseline = baselineFor(state, session);
  if (!baseline) return null;
  const mine = new Set();
  for (const f of currentFiles) if (!baseline.has(f)) mine.add(f);
  return mine;
}

/** The file(s) a finding pertains to: `descriptor.file` (single) and/or `descriptor.files` (aggregate). */
export function findingFiles(finding) {
  const d = finding?.descriptor;
  if (!d) return [];
  const out = [];
  if (typeof d.file === 'string') out.push(d.file);
  if (Array.isArray(d.files)) for (const f of d.files) if (typeof f === 'string') out.push(f);
  return out;
}

/**
 * Classify one finding against `mineSet`:
 *   - 'mine'           — at least one of its files is mine → blocks under --scope.
 *   - 'external'       — it has file(s), none mine → a concurrent/pre-existing red, printed as a note.
 *   - 'unattributable' — no file at all → can't prove it isn't mine, so it stays blocking (fail-safe).
 */
export function classifyFinding(finding, mineSet) {
  const files = findingFiles(finding);
  if (files.length === 0) return 'unattributable';
  return files.some((f) => mineSet.has(f)) ? 'mine' : 'external';
}

/**
 * Partition findings by ownership against `mineSet`. `blocking` = mine + unattributable (fail-safe);
 * `external` = attributable-but-not-mine (non-failing notes). Pure.
 */
export function partitionFindings(findings, mineSet) {
  const blocking = [];
  const external = [];
  for (const f of findings) {
    if (classifyFinding(f, mineSet) === 'external') external.push(f);
    else blocking.push(f);
  }
  return { blocking, external };
}
