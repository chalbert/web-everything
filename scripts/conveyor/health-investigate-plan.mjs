/**
 * @file scripts/conveyor/health-investigate-plan.mjs
 * @description #4078 (health daemon slice 2, ruling #4065 clause 2) — the PURE CORE of the diagnose-only
 *   investigation dispatch. No fs, no child_process, no clock: the IO shell
 *   (we:scripts/conveyor/health-investigate-dispatch.mjs) reads the ledger and the episode store, hands them in
 *   here, and performs whatever this module decides.
 *
 * What lives here:
 *   1. {@link planInvestigations} — which open episodes get an agent THIS tick, and why each other candidate is
 *      held: one per episode, {@link INHIBITING_SMELLS}, at most `investigateMaxRunning` running, at most
 *      `investigateMaxPerWindow` per rolling window, no fourth on a (smell, subject) inside
 *      `investigateSubjectWindowMs`, and never when the deterministic diagnosis settled the cause.
 *   2. {@link planWallClock} — which running investigations are due to be stopped (findings recorded, or the
 *      wall clock reached).
 *   3. {@link validateFindings} — the agent's `record` input, shape-checked, capped and privacy-scrubbed
 *      ({@link scrubInvestigationText}) before anything is written.
 *
 * THE LEDGER (`<healthDir>/investigations/ledger.json`, written only by the tick) is the one memory every budget
 * rule reads. An entry: `{ episodeId, key, smell, subject, session, handle, startedAt, deadlineAt, status,
 * endedAt, endReason, lastStopError }`, `status` one of {@link LEDGER_STATUSES}. An entry is never removed while
 * `running`; a finished one ages out after the longest budget window.
 */

import { DEFAULT_HEALTH_CONFIG, scrubText } from './health-watch-core.mjs';
import { PATH_PATTERNS, CODE_PATTERNS, scrubReasons } from '../lib/secret-scrub.mjs';

/**
 * Smells whose OPEN episode inhibits every investigation dispatch (4065 clause 2: "while no inhibiting episode
 * (App token / rate limit, host load) is open"). An agent started under one of these would spend its 20 minutes
 * reading the SAME outage every other episode is a symptom of, and would itself add load or gh calls to it.
 * `claude-auth-expired` is here too: a dispatched session would fail on its first turn.
 */
export const INHIBITING_SMELLS = Object.freeze(new Set([
  'bad-credentials', 'gh-graphql-budget', 'gh-call-failures', 'machine-overload', 'claude-auth-expired',
]));

export const LEDGER_STATUSES = Object.freeze(['running', 'finished', 'stopped-wall-clock', 'dispatch-failed']);

const OPEN_STATUSES = new Set(['open', 'flapping']);

/** Every hold's machine-readable rule — what a test (and the report) keys on. */
export const HOLD_RULES = Object.freeze({
  ONE_PER_EPISODE: 'one-per-episode',
  TRACKED: 'tracked',
  AWAITING_DIAGNOSIS: 'awaiting-diagnosis',
  DIAGNOSIS_SETTLED: 'diagnosis-settled',
  INHIBITED: 'inhibited',
  MAX_RUNNING: 'max-running',
  WINDOW_BUDGET: 'window-budget',
  SUBJECT_CAP: 'subject-cap',
});

/**
 * PURE: which open investigate-action episodes get an agent this tick.
 *
 * Candidates are EVERY open/flapping episode whose smell's `action` is `investigate` — not only this tick's
 * `opened` transitions — so an episode held for "one already running" is dispatched once the slot frees, instead
 * of being lost because its open transition happened while another agent ran. Oldest-opened first.
 *
 * `smell.diagnosisSettles(diagnosis)` (optional, data on the smell) is how a smell says its deterministic
 * diagnosis already names the cause; absent, a diagnosis never settles it (an `investigate` smell is by
 * definition one with more than one plausible cause). A smell that declares a `diagnose` waits for it to run.
 *
 * @param {{ episodes: Record<string, object>, smellsById: Record<string, object>, ledger: Array<object>,
 *   config?: object, now: number }} o
 * @returns {{ off: boolean, dispatch: Array<{key:string, episodeId:string, smell:string, subject:string}>,
 *   held: Array<{key:string, episodeId:string, rule:string, reason:string}> }}
 */
export function planInvestigations({ episodes = {}, smellsById = {}, ledger = [], config = {}, now }) {
  const cfg = { ...DEFAULT_HEALTH_CONFIG, ...config };
  if (cfg.investigateDispatch !== true) return { off: true, dispatch: [], held: [] };
  const entries = Array.isArray(ledger) ? ledger : [];
  const open = Object.values(episodes).filter((e) => e && OPEN_STATUSES.has(e.status) && e.id);
  const inhibitor = open.find((e) => INHIBITING_SMELLS.has(e.smell)) ?? null;
  let running = entries.filter((x) => x.status === 'running').length;
  let inWindow = entries.filter((x) => now - x.startedAt < cfg.investigateWindowMs).length;
  const dispatch = [];
  const held = [];
  const candidates = open
    .filter((e) => smellsById[e.smell]?.action === 'investigate')
    .sort((a, b) => (a.openedAt ?? 0) - (b.openedAt ?? 0) || String(a.key).localeCompare(String(b.key)));

  for (const ep of candidates) {
    const smell = smellsById[ep.smell];
    const hold = (rule, reason) => held.push({ key: ep.key, episodeId: ep.id, rule, reason });
    const prior = entries.find((x) => x.episodeId === ep.id);
    if (prior) { hold(HOLD_RULES.ONE_PER_EPISODE, `this episode already had its one investigation (${prior.status})`); continue; }
    if (ep.tracked) { hold(HOLD_RULES.TRACKED, `tracked by ${ep.tracked.card ? `card ${ep.tracked.card}` : 'a silence'} — quiet`); continue; }
    if (smell.diagnose && !ep.diagnosis) { hold(HOLD_RULES.AWAITING_DIAGNOSIS, 'waiting for the deterministic diagnosis to run first'); continue; }
    let settled = false;
    if (ep.diagnosis && typeof smell.diagnosisSettles === 'function') {
      try { settled = smell.diagnosisSettles(ep.diagnosis) === true; } catch { settled = false; }
    }
    if (settled) { hold(HOLD_RULES.DIAGNOSIS_SETTLED, 'the deterministic diagnosis already names the cause'); continue; }
    if (inhibitor) {
      hold(HOLD_RULES.INHIBITED, `an inhibiting episode is open — ${inhibitor.smell} (${inhibitor.subject})`);
      continue;
    }
    if (running >= cfg.investigateMaxRunning) {
      hold(HOLD_RULES.MAX_RUNNING, `${running} investigation(s) already running (max ${cfg.investigateMaxRunning})`);
      continue;
    }
    if (inWindow >= cfg.investigateMaxPerWindow) {
      hold(HOLD_RULES.WINDOW_BUDGET, `${inWindow} investigation(s) in the last ${Math.round(cfg.investigateWindowMs / 3_600_000)}h (max ${cfg.investigateMaxPerWindow})`);
      continue;
    }
    const sameSubject = [...entries, ...dispatch.map((d) => ({ ...d, startedAt: now }))]
      .filter((x) => x.smell === ep.smell && x.subject === ep.subject && now - x.startedAt < cfg.investigateSubjectWindowMs).length;
    if (sameSubject >= cfg.investigateSubjectMax) {
      hold(HOLD_RULES.SUBJECT_CAP, `${sameSubject} investigation(s) of ${ep.smell} on ${ep.subject} in the last ${Math.round(cfg.investigateSubjectWindowMs / 86_400_000)}d (max ${cfg.investigateSubjectMax})`);
      continue;
    }
    dispatch.push({ key: ep.key, episodeId: ep.id, smell: ep.smell, subject: ep.subject });
    running += 1;
    inWindow += 1;
  }
  return { off: false, dispatch, held };
}

/**
 * PURE: the running investigations to stop this tick, each with why. `hasFindings(episodeId)` says the agent
 * already recorded its findings (its work is done — stop it now rather than waiting for the clock). Otherwise a
 * session is stopped on the first tick within `investigateReapLeadMs` of its deadline, so a tick cadence of that
 * size never lets it run past `investigateWallClockMs`.
 * @param {Array<object>} ledger
 * @param {{ now:number, config?:object, hasFindings?:(episodeId:string)=>boolean }} o
 * @returns {Array<{episodeId:string, handle:string|null, session:string|null, why:'findings-recorded'|'wall-clock'}>}
 */
export function planWallClock(ledger, { now, config = {}, hasFindings = () => false }) {
  const cfg = { ...DEFAULT_HEALTH_CONFIG, ...config };
  const out = [];
  for (const x of Array.isArray(ledger) ? ledger : []) {
    if (x.status !== 'running') continue;
    const deadline = x.deadlineAt ?? (x.startedAt + cfg.investigateWallClockMs);
    if (hasFindings(x.episodeId)) out.push({ episodeId: x.episodeId, handle: x.handle ?? null, session: x.session ?? null, why: 'findings-recorded' });
    else if (now >= deadline - cfg.investigateReapLeadMs) out.push({ episodeId: x.episodeId, handle: x.handle ?? null, session: x.session ?? null, why: 'wall-clock' });
  }
  return out;
}

/** PURE: drop finished entries older than the longest budget window; never a running one. */
export function pruneLedger(ledger, { now, config = {} }) {
  const cfg = { ...DEFAULT_HEALTH_CONFIG, ...config };
  const keep = Math.max(cfg.investigateWindowMs, cfg.investigateSubjectWindowMs);
  return (Array.isArray(ledger) ? ledger : []).filter((x) => x.status === 'running' || now - x.startedAt < keep);
}

// ── findings: validation + the privacy scrub ─────────────────────────────────────────────────────────────────

/**
 * The `scrubReasons` categories that are NOT a privacy leak in a LOCAL operator report: a path or a code shape is
 * exactly what a diagnosis cites (`ps` rows, log lines, a stack frame). Every OTHER reason — a secret shape, a
 * credential label, a URL with inline credentials, an email/IP, an opaque high-entropy token — redacts the line.
 */
const INLINE_CRED_REASON = 'URL with inline credentials (user:pass@host)';
const REPORT_SAFE_REASONS = new Set([
  ...PATH_PATTERNS.map(([, why]) => why).filter((why) => why !== INLINE_CRED_REASON),
  ...CODE_PATTERNS.map(([, why]) => why),
  'relative path traversal (../ — repo-identifying)',
  'source file path/name (code extension — repo-identifying)',
  'repo-relative doc path',
  'repo-identifying name (webeverything)',
]);

/**
 * PURE: the privacy scrub every investigation string passes through before it is written (#4065 clause 4, via
 * #automated-session-introspection clause 3's wide `scrubReasons` detector). Three passes:
 *   1. the home directory → `~` (the one path fragment that names the operator);
 *   2. {@link scrubText} — the health watch's own token/entropy redaction, token by token;
 *   3. `scrubReasons` per LINE — a line carrying any non-{@link REPORT_SAFE_REASONS} reason is replaced whole
 *      by `[redacted: <reasons>]`, since `scrubReasons` is field-local and cannot point at the offending span.
 * Residual, stated rather than hidden: the detector is pattern-based with an entropy floor, so a short or
 * low-entropy secret still passes — the same accepted residual as the learnings pool.
 * @param {string} text
 * @param {{ home?: string }} [o]
 */
export function scrubInvestigationText(text, { home = '' } = {}) {
  let s = String(text ?? '');
  if (home && home.length > 1) s = s.split(home).join('~');
  s = scrubText(s);
  return s.split('\n').map((line) => {
    if (!line.trim()) return line;
    const bad = scrubReasons(line).filter((r) => !REPORT_SAFE_REASONS.has(r));
    return bad.length ? `[redacted: ${bad.join('; ')}]` : line;
  }).join('\n');
}

export const FINDINGS_LIMITS = Object.freeze({
  maxEvidence: 8, commandChars: 300, outputChars: 4000, fieldChars: 600, nextStepChars: 240,
});

/**
 * PURE: shape-check, cap and scrub the agent's findings. Throws with a message the agent can act on; never
 * returns a partially-valid object.
 * Required: `evidence` — 1..8 `{command, output}` (every claim cites command output it actually ran);
 * `recommendation` — `{whatIsWrong, productChange, nextStep}`, `nextStep` a single line.
 * @param {unknown} input
 * @param {{ home?: string }} [o]
 */
export function validateFindings(input, { home = '' } = {}) {
  const fail = (m) => { throw new Error(`health-investigate: findings refused — ${m}`); };
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('expected a JSON object {evidence, recommendation}');
  const L = FINDINGS_LIMITS;
  const str = (v, name, max) => {
    if (typeof v !== 'string' || !v.trim()) fail(`\`${name}\` must be a non-empty string`);
    return scrubInvestigationText(v.trim(), { home }).slice(0, max);
  };
  const { evidence, recommendation } = input;
  if (!Array.isArray(evidence) || evidence.length === 0) fail('`evidence` must be a non-empty array of {command, output} — cite the command output behind every claim');
  if (evidence.length > L.maxEvidence) fail(`\`evidence\` carries ${evidence.length} entries (max ${L.maxEvidence}) — keep the ones that prove the cause`);
  const ev = evidence.map((e, i) => {
    if (!e || typeof e !== 'object') fail(`evidence[${i}] must be an object {command, output}`);
    return { command: str(e.command, `evidence[${i}].command`, L.commandChars), output: str(e.output, `evidence[${i}].output`, L.outputChars) };
  });
  if (!recommendation || typeof recommendation !== 'object') fail('`recommendation` must be an object {whatIsWrong, productChange, nextStep}');
  const nextStep = str(recommendation.nextStep, 'recommendation.nextStep', L.nextStepChars);
  if (nextStep.includes('\n')) fail('`recommendation.nextStep` must be ONE line');
  return {
    evidence: ev,
    recommendation: {
      whatIsWrong: str(recommendation.whatIsWrong, 'recommendation.whatIsWrong', L.fieldChars),
      productChange: str(recommendation.productChange, 'recommendation.productChange', L.fieldChars),
      nextStep,
    },
  };
}
