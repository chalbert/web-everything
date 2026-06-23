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
 * **2-C union (#1661).** 2-A's baseline-diff has a fail-unsafe hole #953 found: a file *already dirty at
 * claim* (so in the baseline) that THIS session then breaks stays `external` → demoted → stepped over (own
 * real red mistaken for foreign — the modal trigger being the shared registries every concurrent claim/
 * release touches). 2-C closes it by also recording each file a session **explicitly touches** (via the
 * PostToolUse Edit/Write hook and direct appends from the backlog CLIs), then computing
 * `mineFiles = (currentFiles − baseline) ∪ touched`. This is **monotonic** — the registry can only *add*
 * files to "mine", so the gate can never red *less* than 2-A, only catch the own-edit-of-a-baseline-file
 * case it missed. **Honest residual:** a mutation outside *both* Edit/Write and the CLIs (a raw `sed` /
 * `node -e` on a registry) is still invisible to the toucher and rides the 2-A baseline-diff with its
 * residual. So the accurate stance is *2-A alone could mistake an own red for foreign on a baseline file;
 * 2-C closes the hooked/CLI paths but not raw-shell ones* — not the absolute "NEVER a foreign red mistaken
 * for clean" the original header claimed (#953 corrected).
 *
 * The over-cautious direction is unchanged and safe: a concurrent session newly-dirtying a file *inside* my
 * window still leaks into "mine" (an extra stop, never a foreign red mistaken for clean).
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
          touched: Array.isArray(s.touched) ? s.touched.map(String) : [],
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
  const sessions = (state.sessions ?? []).map((s) => ({ ...s, ids: [...s.ids], baseline: [...s.baseline], touched: [...(s.touched ?? [])] }));
  const existing = sessions.find((s) => s.session === session);
  if (existing) {
    if (id && !existing.ids.includes(id)) existing.ids.push(id);
    // baseline kept from the first claim — do NOT overwrite.
  } else {
    sessions.push({
      session,
      ids: id ? [id] : [],
      baseline: [...new Set(baselineFiles ?? [])],
      touched: [],
      at: nowIso,
    });
  }
  return { ttlMinutes: state.ttlMinutes ?? DEFAULT_TTL_MINUTES, sessions };
}

/**
 * Record that `session` explicitly touched `files` (the 2-C union source, #1661). Appends de-duped paths to
 * the session's `touched` row — a **no-op if the session is unknown** (a touch is only meaningful relative
 * to a claimed session's baseline; recording one against a phantom session with no baseline would mark every
 * current file "mine"). Returns a new state (pure). `nowIso` is unused today but kept in the signature so a
 * future per-touch timestamp doesn't break callers.
 */
export function recordTouch(state, { session, files, nowIso: _nowIso }) {
  const list = Array.isArray(files) ? files.filter((f) => typeof f === 'string' && f) : [];
  const sessions = (state.sessions ?? []).map((s) => ({ ...s, ids: [...s.ids], baseline: [...s.baseline], touched: [...(s.touched ?? [])] }));
  const existing = sessions.find((s) => s.session === session);
  if (existing && list.length) existing.touched = [...new Set([...existing.touched, ...list])];
  return { ttlMinutes: state.ttlMinutes ?? DEFAULT_TTL_MINUTES, sessions };
}

/** The slug of the most-recently-claimed session (newest `at`), or `null` — the hook/CLI touch-attribution signal. */
export function mostRecentSession(state) {
  let best = null;
  let bestT = -Infinity;
  for (const s of state.sessions ?? []) {
    const t = Date.parse(s.at);
    if (Number.isFinite(t) && t > bestT) { bestT = t; best = s.session; }
  }
  return best;
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
 * The set of files attributable to `session` (the 2-C union, #1661): `(currentFiles − baseline) ∪ touched`.
 * The baseline-diff catches files this session newly dirtied; the explicit `touched` set additionally
 * catches a file that was *already in the baseline* yet this session then edited (the #953 hole). Monotonic
 * — it can only add to "mine", never subtract, so it never reds *less* than 2-A. Returns `null` when the
 * session is unknown (→ caller falls back to whole-repo strict).
 */
export function mineFiles(state, session, currentFiles) {
  const s = (state.sessions ?? []).find((x) => x.session === session);
  if (!s) return null;
  const baseline = new Set(s.baseline);
  const mine = new Set(s.touched ?? []); // explicit touches are always mine (incl. baseline files this session edited)
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

/**
 * Per-lane local gating (backlog #1144, consumed by the parallel-batch orchestrator #1147). Partitions
 * findings for `check:standards --local [--files=<list>]` into `{ blocking, demoted }`:
 *
 *   - `fileSet` (an explicit file list — the `--files` sibling of `--scope`'s claim baseline): a finding
 *     BLOCKS iff at least one of its files is in the set; a finding on OTHER files is demoted to a note.
 *   - `local` (the `--local` flag): two classes of finding are demoted, because a lane runs in its OWN
 *     git worktree branched from base and cannot see sibling lanes — these invariants only become real at
 *     MERGE, where the full no-flag gate is the authority:
 *       (a) a path-less / cross-entity finding — a GLOBAL/RELATIONAL invariant (dup ids, the blockedBy
 *           cycle walk) with no single owning file; and
 *       (b) a `descriptor.global` finding — a GLOBAL-CONSISTENCY rule (a cross-registry join / `unresolved-ref`,
 *           the AGENTS.md derived-artifact `inventory` coherence) that *does* attribute to a file the lane
 *           edited, yet cannot be satisfied in isolation because it depends on whole-repo or sibling-lane
 *           state (#1159). Without this, such a rule false-reds a clean lane (4 of 7 items in #1153's first
 *           multi-lane run), eating the parallel speed-win.
 *     A lane must not red on a global it cannot have caused; the integrator's per-merge full gate re-runs it.
 *
 * The default (no `--local`) keeps the fail-safe stance — path-less AND `global`-marked findings stay
 * blocking — matching `partitionFindings`. With no `fileSet` (i.e. `--local` alone), every file-local
 * finding blocks and only the global ones (path-less or `descriptor.global`) demote. Pure; mirrors
 * `partitionFindings` on the file-isolation axis.
 */
export function partitionLocal(findings, { fileSet = null, local = false } = {}) {
  const blocking = [];
  const demoted = [];
  for (const f of findings) {
    const files = findingFiles(f);
    // (b) above: a global-consistency rule deferred to the integrator's merge gate. Checked before the
    // file-membership branches so a `global` finding on one of the lane's OWN files still demotes (#1159).
    if (local && f?.descriptor?.global) { demoted.push(f); continue; }
    if (fileSet) {
      if (files.some((x) => fileSet.has(x))) blocking.push(f);        // attributable to my files → blocks
      else if (files.length > 0) demoted.push(f);                     // another file → note
      else (local ? demoted : blocking).push(f);                      // path-less global → note iff --local
    } else {
      // `--local` with no file list: keep every file-attributable finding, demote only path-less globals.
      (files.length > 0 ? blocking : demoted).push(f);
    }
  }
  return { blocking, demoted };
}
