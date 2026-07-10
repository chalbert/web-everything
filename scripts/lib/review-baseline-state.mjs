/**
 * @file scripts/lib/review-baseline-state.mjs
 * @description The durable REVIEWED-MANIFEST BASELINE the #2414 land-time tamper gate diffs a landing PR
 *   against — the escalation-sensitive manifest values (`hasManifest` bit, `dismissedFindings`, `crossRepo`,
 *   `blockedBy`) as the drain FIRST saw them, so a later body edit that WEAKENS them is caught at land.
 *
 * WHY (#2414, follow-up to #2415/PR #375): the manifest rides the editable PR BODY, not the reviewed
 * commit-set. #2415 records the acted-on values into a durable, timestamped `gh pr comment` at each
 * park/skip/land decision — tamper-EVIDENCE an honest observer can diff. But that only fires when the drain
 * comments, and the land stamp itself is gated on `c.hasManifest`: deleting the whole `<!-- lane-manifest -->`
 * block flips `hasManifest` false, the PR degrades to "no manifest → always ready", it merges, and NO land
 * record is written — a full STRIP is stealthier than the modeled edit-DOWN and slips the #2415 evidence net.
 *
 * This module upgrades the evidence toward a GATE: the drain captures the manifest values the FIRST pass it
 * reviews a candidate (first-seen-wins, so it does NOT depend on a prior park having fired), and at land — for
 * EVERY landing PR — diffs the LIVE manifest against that baseline BEFORE merge. A WEAKENING mismatch (a value
 * edited DOWN to suppress escalation, OR the manifest now absent when the baseline had one) refuses the
 * auto-land and re-parks for a fresh look. Because the baseline is captured at review and the check runs at
 * land regardless of a prior park, this catches the STRIP and the edit-DOWN uniformly.
 *
 * ONLY the weakening direction is flagged (fewer dismissed findings, crossRepo cleared, a dropped blocker, a
 * stripped manifest) — a STRENGTHENING edit (more scrutiny: added blocker, raised dismissedFindings, crossRepo
 * set) is harmless and must never block an honest land. `dismissedFindings` round-trips its RAW finite value
 * (negatives included) so the baseline mirrors what `scoreEscalation` actually acted on — the same faithful-
 * record invariant `manifestAuditLine` rests on; clamping would hide the exact tamper this gate targets.
 *
 * PURE — no fs, no `Date` reads (mirrors review-park-state.mjs). The CLI (`merge-ai-prs.mjs`) owns the fs
 * boundary: it reads the state file (tolerantly — a missing/corrupt file degrades to empty, never breaking the
 * drain), calls these functions, and writes the result back. Local, machine-scoped, best-effort: losing the
 * file just drops the baseline for PRs seen only on this machine, so the gate FAILS OPEN (that PR re-captures a
 * fresh baseline from its current body) — the accepted residual, matching the sibling gates (an actor who edits
 * AND deletes the baseline together is not defeated). PR numbers are monotonic, so a merged PR's dead entry can
 * never match a future PR; the file is safe to delete.
 */

/** A fresh, empty baseline-state (no file yet, or an unreadable one). */
export function emptyBaselineState() {
  return { baselines: [] };
}

/** The stable key a (repo, PR#) pair is tracked under. `repo` is the `owner/name` slug, or `null`/`'cwd'`
 *  for the local repo the drain runs in — normalized so both spellings collide on the same entry (mirrors
 *  review-park-state.mjs's `parkKey`). */
export function baselineKey(repo, num) {
  return `${repo || 'cwd'}#${num}`;
}

/** Coerce a raw manifest-values object to the stored baseline shape. Faithful to what `scoreEscalation`
 *  acts on: `dismissedFindings` keeps its RAW finite value (negatives included — a body edited to `-4`
 *  scores LOWER, exactly the tamper this gate targets), non-finite → 0; `blockedBy` entries are stringified
 *  and reduced to the legit-id allowlist (`[A-Za-z0-9_-]`, the same sanitize `manifestAuditLine` uses) so a
 *  smuggled delimiter can never split the field; the two bits are hard booleans. Pure. */
function normalizeValues(v = {}) {
  return {
    hasManifest: !!v.hasManifest,
    dismissedFindings: Number.isFinite(Number(v.dismissedFindings)) ? Number(v.dismissedFindings) : 0,
    crossRepo: !!v.crossRepo,
    blockedBy: (Array.isArray(v.blockedBy) ? v.blockedBy : []).map((x) => String(x).replace(/[^A-Za-z0-9_-]/g, '')).filter(Boolean),
  };
}

/**
 * Tolerant parse of the baseline-state file text → normalized `{ baselines: [{key, repo, num, values}] }`.
 * NEVER throws: bad JSON or junk rows degrade to empty rather than breaking the drain pass that reads it.
 * @param {string} text
 */
export function parseBaselineState(text) {
  if (!text || !text.trim()) return emptyBaselineState();
  let raw;
  try { raw = JSON.parse(text); } catch { return emptyBaselineState(); }
  const baselines = Array.isArray(raw?.baselines)
    ? raw.baselines
        .filter((b) => b && b.num != null && b.values && typeof b.values === 'object')
        .map((b) => ({ key: baselineKey(b.repo ?? null, b.num), repo: b.repo ?? null, num: String(b.num), values: normalizeValues(b.values) }))
    : [];
  return { baselines };
}

/** Serialize state back to file text (with a self-documenting `_doc` header). */
export function serializeBaselineState(state) {
  return JSON.stringify(
    {
      _doc:
        "The #2414 reviewed-manifest baseline. Records the escalation-sensitive manifest values " +
        "(hasManifest/dismissedFindings/crossRepo/blockedBy) the drain FIRST saw for each PR, so the land-time " +
        "tamper gate can diff a landing PR's LIVE manifest against them and refuse+re-park on a WEAKENING edit " +
        "(a value edited down to suppress escalation, OR a stripped manifest). Local, machine-scoped, " +
        "best-effort — safe to delete (a PR just re-captures a fresh baseline; the gate fails open).",
      baselines: (state?.baselines ?? []).map(({ repo, num, values }) => ({ repo, num, values })),
    },
    null,
    2,
  ) + '\n';
}

/** The recorded baseline values for `(repo, num)`, or `null` if it isn't tracked (never reviewed on this
 *  machine, or the file was lost). Pure read — `null` is what makes the land gate fail OPEN. */
export function getBaseline(state, { repo, num }) {
  const k = baselineKey(repo, num);
  const entry = (state?.baselines ?? []).find((b) => b.key === k);
  return entry ? entry.values : null;
}

/**
 * Capture the reviewed baseline for `(repo, num)` from the values the drain saw this pass. FIRST-SEEN-WINS,
 * idempotent: a PR already tracked KEEPS its original baseline — a later pass reading an already-tampered body
 * must NOT overwrite the honest baseline, or the edit-DOWN would silently become the new "reviewed" truth.
 * Pure — returns new state (same reference when already tracked, so the CLI can skip a needless file write).
 */
export function recordBaseline(state, { repo, num }, values) {
  const k = baselineKey(repo, num);
  const baselines = state?.baselines ?? [];
  if (baselines.some((b) => b.key === k)) return state; // already captured — keep the honest first-seen baseline
  return { ...state, baselines: [...baselines, { key: k, repo: repo ?? null, num: String(num), values: normalizeValues(values) }] };
}

/** Clear the baseline for `(repo, num)`. Pure, idempotent (same reference when nothing tracked). Exposed for
 *  callers that want to prune a settled PR; the drain does NOT call it on a gate-clear (the baseline must
 *  OUTLIVE the honest review to catch a LATER edit-down) — dead entries for merged PRs are harmless. */
export function clearBaseline(state, { repo, num }) {
  const k = baselineKey(repo, num);
  const baselines = state?.baselines ?? [];
  if (!baselines.some((b) => b.key === k)) return state; // nothing to clear — same reference, no-op
  return { ...state, baselines: baselines.filter((b) => b.key !== k) };
}

/**
 * Diff a landing PR's LIVE manifest values against the reviewed `baseline`. Pure. Returns
 * `{ tampered:boolean, reasons:string[] }` — `tampered` true iff any WEAKENING (escalation-suppressing) edit
 * is found. No baseline (never reviewed here, or the file was lost) → `{ tampered:false, reasons:[] }` (fails
 * OPEN, the accepted residual). Weakening cases, in the direction that LOWERS review scrutiny:
 *   • manifest STRIPPED — present at review, absent at land (`hasManifest` flipped false so the PR degrades to
 *     always-ready). This is the whole reason #2415's `c.hasManifest`-gated land stamp misses a full strip; a
 *     strip zeroes every other field, so it is reported alone.
 *   • dismissedFindings edited DOWN — fewer dismissed findings ⇒ the `dismissed` escalation signal is weaker
 *     (raw compare, so a drop into negatives counts).
 *   • crossRepo cleared (true→false) — drops the cross-repo escalation signal.
 *   • blockedBy entr(y/ies) dropped — a removed cross-item blocker makes the PR falsely-ready ahead of its
 *     predecessor.
 * A STRENGTHENING edit (more scrutiny) is never flagged.
 * @param {ReturnType<typeof normalizeValues>|null} baseline
 * @param {object} liveRaw  the live manifest values (normalized internally)
 */
export function diffBaseline(baseline, liveRaw) {
  if (!baseline) return { tampered: false, reasons: [] };
  const live = normalizeValues(liveRaw);
  const reasons = [];
  if (baseline.hasManifest && !live.hasManifest) {
    reasons.push('manifest STRIPPED (present at review, absent at land — the PR would degrade to always-ready)');
    return { tampered: true, reasons };
  }
  if (live.dismissedFindings < baseline.dismissedFindings) {
    reasons.push(`dismissedFindings edited down (${baseline.dismissedFindings}→${live.dismissedFindings}) — suppresses the dismissed-findings escalation signal`);
  }
  if (baseline.crossRepo && !live.crossRepo) {
    reasons.push('crossRepo cleared (true→false) — drops the cross-repo escalation signal');
  }
  const dropped = baseline.blockedBy.filter((id) => !live.blockedBy.includes(id));
  if (dropped.length) {
    reasons.push(`blockedBy dropped [${dropped.join(',')}] — a removed cross-item blocker makes the PR falsely-ready`);
  }
  return { tampered: reasons.length > 0, reasons };
}
