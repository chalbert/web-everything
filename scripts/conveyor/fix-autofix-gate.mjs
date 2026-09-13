/**
 * @file scripts/conveyor/fix-autofix-gate.mjs
 * @description THE BLACKLIST-FIRST AUTO-FIX GATE for a `review:human` PR's advisory-panel findings (Part 3 of
 *   the mechanical-dispatcher review line; Part 1/2 built the panel dispatch + advisory-comment posting, this
 *   is the first thing that ACTS on a finding rather than only reporting it).
 *
 * DESIGN DIRECTION (operator, 2026-09-13): default to "safe to auto-fix" and explicitly DENY-LIST what must
 * never be auto-applied — never a narrow allow-list of pre-approved categories, which is too conservative by
 * construction (it blocks legitimate fixes by default rather than only the dangerous ones).
 *
 * REUSE OF #3649 FORK 6 — read carefully before this file was written, and adapted rather than copied. Fork 6
 * ("within the work-agent class, what AXIS decides low-risk enough to auto-apply") is scoped to a DIFFERENT
 * subject — scoring a DISPATCHED AGENT'S OWN TRANSCRIPT for self-improvement, not a PR-review finding — but its
 * ratified axis is exactly the "blacklist first" principle this card needs:
 *
 *   "(b) A risk assessment of the proposed fix itself, with a destructive-operation blacklist checked FIRST and
 *   INDEPENDENTLY of any confidence judgment. Blacklist hit → file and hold; any flagged risk criterion
 *   (security · data-leak · performance · blast-radius · baseline-correctness) → file a card, no auto-apply;
 *   clean → auto-apply."
 *
 * Fork 6 also names the reusable MECHANISM, not just the principle: `assessMissingOperationConfidence`
 * (`we:scripts/conveyor/hiccup-classify.mjs:114`), which already returns exactly `{selfClears, batched,
 * escalate, reason}` off a blacklist checked first plus a `CONFIDENCE_CRITERIA` bag. This module MIRRORS that
 * return shape (below) so this gate speaks the same ratified vocabulary — but does NOT call that function
 * directly, because its blacklist is a case-insensitive SUBSTRING match against a proposed shell COMMAND
 * (`rm -rf`, `git push --force`, …), and this domain's blacklist is PATH PATTERNS + FINDING SEVERITY, not a
 * command string. Fork 6 anticipates exactly this kind of adaptation ("if the five criteria prove too coarse,
 * widening THEM is the move") — same axis, same shape, criteria authored for this domain.
 *
 * THE TWO TIERS (operator direction #2). A fix destined straight for `main` gets the STRICT blacklist (no POC
 * safety net downstream — the diff either lands clean or a human catches it in the ordinary review gate). A fix
 * whose PR targets a registered POC branch (`we:scripts/lib/poc-branches.mjs`) gets the LENIENT blacklist — a
 * STRICT SUBSET of the strict one (fewer things forbidden), because POC-branch content gets a full human review
 * later anyway, at graduation (the already-ratified POC-branch doctrine). The lenient tier keeps only the two
 * invariants that hold even inside a POC branch — governance (statute-layer edits) and true security-sensitive
 * code — and drops the generic blast-radius / supply-chain / config denials and the blocker-severity gate,
 * because a bad auto-fix there is caught by the lane's own verify gate today and by the graduation review later.
 *
 * PURE. No fs, no clock, no process, no network — {@link resolveAutoFixTier} takes an already-read registry
 * object (the IO shell reads it once; see `we:scripts/conveyor/autofix-review-findings.mjs`).
 */
import { isStatutePath, isBlastRadiusPath, isGateSelfPath } from '../lib/review-escalation.mjs';
import { EXTRA_DENY } from '../readiness/test-selection.mjs';
import { readRegistry, isPocBranch } from '../lib/poc-branches.mjs';

/** The two auto-fix blacklist tiers (operator direction #2). */
export const AUTO_FIX_TIERS = Object.freeze({ STRICT: 'strict', LENIENT: 'lenient' });

/**
 * Security-sensitive code paths (task item 1's own named category — no existing ratified list covers this
 * narrower surface, unlike the statute/blast-radius sets above, so it is authored here rather than imported).
 * Deliberately narrow and named, not "anything that sounds important": auth/authz/authn, crypto, secrets,
 * credentials, `.env*` files, and the write-time security guard hooks themselves (a bad auto-fix to the guard
 * that enforces the write-time gate is exactly the kind of mistake #43/MEMORY exists to prevent).
 */
export const SECURITY_SENSITIVE_PATTERNS = [
  /(^|\/)auth[nz]?(\/|[-_.]|$)/i,
  /(^|\/)crypto(\/|[-_.]|$)/i,
  /(^|\/)secrets?(\/|[-_.]|$)/i,
  /(^|\/)credentials?(\/|[-_.]|$)/i,
  /(^|\/)\.env(\.[^/]*)?$/,
  /(^|\/)guard-bash\.mjs$/,
  /(^|\/)guard-lane\.mjs$/,
];

/** Is this repo-relative path a security-sensitive code path? Pure. */
export function isSecuritySensitivePath(path) {
  const p = String(path || '');
  if (!p) return false;
  return SECURITY_SENSITIVE_PATTERNS.some((re) => re.test(p));
}

/**
 * THE STRICT TIER'S path-blacklist (main-bound PRs — no POC safety net downstream). The union of:
 *   - the statute layer ({@link isStatutePath} — `docs/agent/platform-decisions.md` + any statute doc);
 *   - the gate's policy-core / trust-chain tier ({@link isGateSelfPath}, `we:scripts/lib/review-escalation.mjs`'s
 *     `isPolicyCorePath` under its historical name);
 *   - the existing blast-radius-sensitive file-pattern list ({@link isBlastRadiusPath} — `scripts/`, CI, git
 *     hooks, the two agent-behaviour trees, standards definitions, conformance-grading surfaces, plus the
 *     relocatable delivery-engine basenames);
 *   - the supply-chain / build-config / full-`.claude/` deny surface ({@link EXTRA_DENY},
 *     `we:scripts/readiness/test-selection.mjs` — reused, never re-listed, for the same reason `isSensitivePath`
 *     there composes rather than re-declares);
 *   - security-sensitive code paths ({@link isSecuritySensitivePath}, above).
 * Pure.
 * @param {string} file
 * @returns {boolean}
 */
export function isStrictDenyPath(file) {
  const p = String(file || '');
  if (!p) return true; // an unanchored/unknown path is treated as sensitive — the safe direction
  return isStatutePath(p) || isGateSelfPath(p) || isBlastRadiusPath(p)
    || EXTRA_DENY.some((re) => re.test(p)) || isSecuritySensitivePath(p);
}

/**
 * THE LENIENT TIER'S path-blacklist (POC-bound PRs) — a STRICT SUBSET of {@link isStrictDenyPath}: only the two
 * invariants that hold no matter where a change lands. Statute-layer edits are a governance act, not a code
 * review outcome, so "full review happens at graduation" does not reach them — a human must ratify a statute
 * change regardless of which branch it landed on first. Security-sensitive code is the other: a vulnerability
 * introduced pre-graduation is live in the POC branch's own dev environment/CI immediately, not only once the
 * branch merges, so deferring its review to graduation does not defer its risk. Generic blast-radius / supply-
 * chain / config / gate-self denials are DROPPED here on purpose — a bad auto-fix there is caught by this lane's
 * own verify gate today (tests/build must stay green) and by the full human review this content gets anyway at
 * graduation. Pure.
 * @param {string} file
 * @returns {boolean}
 */
export function isLenientDenyPath(file) {
  const p = String(file || '');
  if (!p) return true;
  return isStatutePath(p) || isSecuritySensitivePath(p);
}

/** `impactIfUnfixed` values that count as high-severity for the STRICT tier's blocker gate (task item 1's
 *  "any finding whose disposition already carries high severity/blocker status from the panel"). */
const HIGH_SEVERITY_IMPACTS = new Set(['broken', 'unrecoverable']);

/**
 * Does this finding already carry a blocker/high-severity disposition from the panel? Pure. Checked ONLY in
 * the strict tier (see {@link classifyFindingForAutoFix}) — dropped in the lenient tier for the same reason the
 * generic blast-radius denials are dropped there: the lane's own verify gate and the graduation review are the
 * safety net.
 * @param {object} finding
 * @returns {boolean}
 */
export function isHighSeverityFinding(finding) {
  if (!finding || typeof finding !== 'object') return false;
  if (finding.disposition === 'blocker') return true;
  if (HIGH_SEVERITY_IMPACTS.has(finding.impactIfUnfixed)) return true;
  return false;
}

/**
 * THE GATE — classify ONE finding for auto-apply, blacklist first and independently of anything else, mirroring
 * `assessMissingOperationConfidence`'s return CONTRACT (`{selfClears, batched, escalate, reason}`, #3649 Fork 6)
 * even though the underlying blacklist mechanics are this domain's own (path patterns + finding severity, not a
 * command-substring blacklist). `selfClears: true` is the ONLY auto-apply signal a caller should act on —
 * `batched`/`escalate` both mean "leave this finding exactly as the advisory comment already reported it," and
 * a caller need not distinguish them further (task item 4: no change to today's behavior for a non-auto-fixed
 * finding). The two are kept distinct here anyway, for observability: `escalate` is a hard path-blacklist hit
 * (the same "independent of confidence" framing Fork 6 states); `batched` is the softer blocker/high-severity
 * signal, strict-tier only.
 * @param {{finding: object, tier?: string}} o
 * @returns {{selfClears: boolean, batched: boolean, escalate: boolean, reason: string, tier: string}}
 */
export function classifyFindingForAutoFix({ finding, tier = AUTO_FIX_TIERS.STRICT } = {}) {
  const t = tier === AUTO_FIX_TIERS.LENIENT ? AUTO_FIX_TIERS.LENIENT : AUTO_FIX_TIERS.STRICT;
  const file = finding && typeof finding === 'object' ? finding.file : null;
  const denyPath = t === AUTO_FIX_TIERS.LENIENT ? isLenientDenyPath(file) : isStrictDenyPath(file);
  if (denyPath) {
    return { selfClears: false, batched: false, escalate: true, reason: 'path-blacklisted', tier: t };
  }
  if (t === AUTO_FIX_TIERS.STRICT && isHighSeverityFinding(finding)) {
    return { selfClears: false, batched: true, escalate: false, reason: 'blocker-or-high-severity', tier: t };
  }
  return { selfClears: true, batched: false, escalate: false, reason: 'clean', tier: t };
}

/**
 * Resolve which tier a PR's fix findings should be gated under, from the PR's own base ref (the ground truth
 * of where it lands — a PR opened against a registered POC branch has that branch as its GitHub base, per
 * `we:scripts/pr-land.mjs`'s `--base=<deliveryTarget>`). No `deliveryTarget:` frontmatter parsing needed: the
 * base ref IS the resolved delivery target. `registry` is injected (an already-read `poc-branches.mjs` registry
 * object) so this stays pure; the IO shell reads the registry once via {@link readRegistry} — reproduced as a
 * default only when no explicit registry is provided (a real fs read, so this ONE branch is impure — mirrored
 * from `we:scripts/lib/poc-branches.mjs#primaryPocBranch`'s own shape, which reads a registry by default too).
 * @param {{baseRefName: string, registry?: object}} o
 * @returns {string} an {@link AUTO_FIX_TIERS} member.
 */
export function resolveAutoFixTier({ baseRefName, registry } = {}) {
  const reg = registry ?? readRegistry();
  return isPocBranch(reg, baseRefName) ? AUTO_FIX_TIERS.LENIENT : AUTO_FIX_TIERS.STRICT;
}
