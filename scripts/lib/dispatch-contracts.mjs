/**
 * dispatch-contracts.mjs — pure mechanical-dispatch contracts (#3383, slice G1).
 *
 * Callers supply cards, plans, provenance, scorecards and timestamps. This module owns
 * validation and composition; provider fitness and supervision remain router policy.
 * Invalid boundary inputs fail closed, including malformed or cyclic objects.
 */
import {
  PROVEN_TASK_ENVELOPES, isStatuteTierPath, isHighStakesTask, isWithinProvenEnvelope,
  selectProvider, selectSupervisionLevel, RECOMMENDATIONS, CLAUDE_TIERS, SUPERVISION_LEVELS, AGY_CLAUDE_MODEL_BY_TIER,
} from './provider-routing.mjs';
import { scrubPublish } from './secret-scrub.mjs';
import { thresholdsForRisk, neverSpotCheck, spotCheckSample } from './dispatch-thresholds.mjs';
import { CODEX_MODEL } from './codex-model-routing.mjs';

/** Closed task vocabulary, sourced from the router's proven envelopes. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const TASK_TYPES = Object.freeze([...Object.keys(PROVEN_TASK_ENVELOPES), 'triage-research', 'architectural-decision']);
/** Risk order; array index is the rank. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const RISKS = Object.freeze(['low', 'medium', 'high']);
/** Derived complexity order. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const COMPLEXITIES = Object.freeze(['S', 'M', 'L']);
/** Terminal task execution statuses. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const TASK_STATUSES = Object.freeze(['landed', 'blocked', 'failed']);
/** Supervisor judgments. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const VERDICTS = Object.freeze(['accept', 'rework', 'reject']);
/** Recorded verifier provenance. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const VERIFIED_BY = Object.freeze(['independent-claude', 'claude-subagent', 'other']);
/** Verifiers that can supply graduation evidence. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const GRADUATION_VERIFIERS = Object.freeze(VERIFIED_BY.slice(0, 2));
/** Concrete execution providers; a dual routing recommendation is not provenance. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const PROVIDERS = Object.freeze(['claude', 'gemini', 'antigravity', 'codex']);
/** Execution mechanisms that stamp task results. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const EXECUTORS = Object.freeze(['codex-direct-task', 'gemini-direct-task', 'claude-subagent', 'claude-session']);
/** Allowed provider provenance per execution mechanism. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const EXECUTOR_PROVIDERS = Object.freeze({
  'codex-direct-task': Object.freeze(['codex']),
  'gemini-direct-task': Object.freeze(['gemini', 'antigravity']),
  'claude-subagent': Object.freeze(['claude']), 'claude-session': Object.freeze(['claude']),
});
/** Mirrors we:scripts/operations/dispatch-lane.mjs#LAUNCH_KINDS without its impure imports. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const STORY_KINDS = Object.freeze(['build', 'prepare', 'prepare-decision', 'investigate', 'fix', 'ci-heal']);
/** Dispatcher entry stages. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const ROUTE_STAGES = Object.freeze(['story', 'task']);
/** Build story planner role. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const SUPERVISOR_ROLE = 'build-supervisor';
/** Router Sonnet blast-radius ceiling in changed lines. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const M_COMPLEXITY_MAX_LOC = 500;
/** Router Sonnet blast-radius ceiling in files. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const M_COMPLEXITY_MAX_FILES = 8;
/**
 * Auditable size-to-LOC table:
 * 1 → 30: trivial one-file edit, under every envelope.
 * 2 → 80: doc-fix envelope and observed 80-LOC conflict-resolution trial.
 * 3 → 150: observed max bugfix trial (~150 LOC / 2 files); modal size.
 * 5 → 300: top of build-new-feature / other proven envelopes.
 * 8 → 500: Sonnet blast-radius ceiling; batchable cutoff (size <= 8).
 * 13 → 900: should-split band (size > 8), beyond envelopes and Sonnet ceiling.
 * Real `size` distribution across backlog/ on 2026-09-20 (3,662 cards,
 * 2,512 sized): 1:39, 2:416, 3:1124, 5:747, 8:172, 13:14; 1,148 cards carry no size. Envelope source: PROVEN_TASK_ENVELOPES
 * (doc-fix 100, self-fix 200, conflict-resolution 200, bugfix 250, build-new-feature 300, other 300 LOC). Auditable table, not a
 * formula: change a row, not an expression.
 */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const SIZE_TO_ESTIMATED_LOC = Object.freeze({ 1: 30, 2: 80, 3: 150, 5: 300, 8: 500, 13: 900 });
/** Prepared-card kind defaults; explicit invalid values never default. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const TASK_TYPE_BY_CARD_KIND = Object.freeze({ story: 'build-new-feature', feature: 'build-new-feature', task: 'other', epic: 'other', investigation: 'triage-research', decision: 'architectural-decision' });
/**
 * docs/agent/backlog-workflow.md “Model routing”: Sonnet executes decided specs;
 * Opus handles judgment and ambiguous investigation. No per-kind code table preceded G1.
 */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const STORY_KIND_RUNGS = Object.freeze({ prepare: CLAUDE_TIERS.SONNET, 'prepare-decision': CLAUDE_TIERS.OPUS, investigate: CLAUDE_TIERS.OPUS, fix: CLAUDE_TIERS.SONNET, 'ci-heal': CLAUDE_TIERS.SONNET });

const object = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const nonempty = (x) => typeof x === 'string' && x.trim().length > 0;
const integer = (x, min = 1) => Number.isInteger(x) && x >= min;
const owns = (x, key) => Object.hasOwn(x, key);
const result = (errors) => ({ ok: errors.length === 0, errors });
const storyRefOK = (x) => nonempty(x) && /^[A-Za-z0-9._#]+$/.test(x);
const taskIdOK = (x) => nonempty(x) && /^[A-Za-z0-9._-]+$/.test(x);
function check(errors, condition, message) { if (!condition) errors.push(message); }
function guarded(fn) {
  try { return fn(); } catch { return result(['unreadable contract input']); }
}
function strings(x, predicate = nonempty, unique = false) {
  return Array.isArray(x) && Array.from(x).every(predicate) && (!unique || new Set(x).size === x.length);
}
function identity(x, errors) {
  check(errors, taskIdOK(x.taskId), 'taskId is invalid');
  check(errors, storyRefOK(x.storyRef), 'storyRef is invalid');
  check(errors, integer(x.round), 'round must be a positive integer');
  check(errors, integer(x.attempt), 'attempt must be a positive integer');
}

/** Whether a value belongs to the closed task vocabulary. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function isTaskType(x) { return TASK_TYPES.includes(x); }
/** Require already-normalised, non-traversing repository paths. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function isRepoRelativePath(p) {
  return nonempty(p) && !p.startsWith('/') && !p.startsWith('./') && !p.includes('\\') && !p.includes('\0') && !p.split('/').includes('..') && !/^[a-z][a-z0-9+.-]*:/i.test(p);
}
/** Compare path prefixes only at segment boundaries, ignoring trailing slashes. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function pathsOverlap(a, b) {
  if (!nonempty(a) || !nonempty(b)) return false;
  a = a.replace(/\/+$/, ''); b = b.replace(/\/+$/, '');
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}
/** Derive complexity from proven envelopes and the router's Sonnet ceiling. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function deriveComplexity(taskType, estimatedLoc, filesCount) {
  return isWithinProvenEnvelope(taskType, estimatedLoc, filesCount) ? 'S'
    : estimatedLoc <= M_COMPLEXITY_MAX_LOC && filesCount <= M_COMPLEXITY_MAX_FILES ? 'M' : 'L';
}
/** Derive minimum risk from governance, correctness, complexity and acceptance. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function deriveRisk(taskType, filesTouched, complexity, acceptanceTestable, { isStatutePath = isStatuteTierPath } = {}) {
  if (filesTouched.some(isStatutePath) || isHighStakesTask({ taskType }, { filesTouched })) return 'high';
  return complexity === 'L' || acceptanceTestable === false ? 'medium' : 'low';
}
/** A requested risk can raise but never lower the derived risk. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function raiseRisk(derived, requested) { return RISKS.indexOf(requested) > RISKS.indexOf(derived) ? requested : derived; }

function profileInputs(p, errors) {
  check(errors, isTaskType(p.taskType), 'taskType is invalid');
  check(errors, integer(p.estimatedLoc), 'estimatedLoc must be a positive integer');
  check(errors, strings(p.filesTouched, isRepoRelativePath, true) && p.filesTouched.length > 0, 'filesTouched must contain unique repo-relative paths');
  check(errors, typeof p.acceptanceTestable === 'boolean', 'acceptanceTestable must be boolean');
  check(errors, strings(p.dependsOn, nonempty, true), 'dependsOn must contain unique non-empty strings');
}
/** Validate raw profile fields and derive complexity and minimum risk. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function buildDispatchProfile(input, options = {}) {
  const checked = guarded(() => {
    if (!object(input)) return result(['profile input must be an object']);
    const errors = []; profileInputs(input, errors);
    if (owns(input, 'risk')) check(errors, RISKS.includes(input.risk), 'risk is invalid');
    if (errors.length) return result(errors);
    const { taskType, estimatedLoc, acceptanceTestable } = input;
    const filesTouched = [...input.filesTouched], dependsOn = [...input.dependsOn];
    const complexity = deriveComplexity(taskType, estimatedLoc, filesTouched.length);
    const risk = raiseRisk(deriveRisk(taskType, filesTouched, complexity, acceptanceTestable, options), input.risk);
    return { ok: true, errors: [], profile: { taskType, estimatedLoc, filesTouched, acceptanceTestable, risk, complexity, dependsOn } };
  });
  return checked.ok ? checked : { ...checked, profile: null };
}
/** Validate a profile, including derived complexity and the minimum risk floor. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function validateDispatchProfile(profile, options = {}) {
  return guarded(() => {
    if (!object(profile)) return result(['profile must be an object']);
    const errors = []; profileInputs(profile, errors);
    check(errors, COMPLEXITIES.includes(profile.complexity), 'complexity is invalid');
    check(errors, RISKS.includes(profile.risk), 'risk is invalid');
    if (!errors.length) {
      const complexity = deriveComplexity(profile.taskType, profile.estimatedLoc, profile.filesTouched.length);
      check(errors, profile.complexity === complexity, `complexity must equal derived ${complexity}`);
      const risk = deriveRisk(profile.taskType, profile.filesTouched, complexity, profile.acceptanceTestable, options);
      check(errors, RISKS.indexOf(profile.risk) >= RISKS.indexOf(risk), `risk must be at least derived ${risk}`);
    }
    return result(errors);
  });
}
/** Validate a standalone task; dependency existence belongs to the enclosing plan. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function validateTaskShape(task, options = {}) {
  return guarded(() => {
    if (!object(task)) return result(['task must be an object']);
    const errors = [];
    check(errors, taskIdOK(task.id), 'id is invalid');
    check(errors, TASK_LIFECYCLE.includes(task.status), 'status is invalid');
    checkAgent(task.agent, { ...options, taskId: task.id }, errors);
    check(errors, !owns(task, 'complexity') && !owns(task, 'risk'), 'complexity and risk belong in profile');
    check(errors, nonempty(task.title) && task.title.length <= 200, 'title must be non-empty and at most 200 characters');
    const depsOK = strings(task.dependsOn, taskIdOK, true);
    check(errors, depsOK, 'dependsOn must contain unique task ids');
    if (depsOK) check(errors, !task.dependsOn.includes(task.id), 'self dependency');
    const profile = validateDispatchProfile(task.profile, options);
    errors.push(...profile.errors.map((e) => `profile: ${e}`));
    if (depsOK && profile.ok) check(errors, task.dependsOn.length === task.profile.dependsOn.length && task.dependsOn.every((d) => task.profile.dependsOn.includes(d)), 'dependsOn and profile.dependsOn must equal as sets');
    return result(errors);
  });
}

// Iterative reachability avoids recursion limits, even for long supervisor plans.
function closures(tasks) {
  const edges = new Map(tasks.map((t) => [t.id, t.dependsOn]));
  const out = new Map();
  for (const task of tasks) {
    const seen = new Set(), pending = [...task.dependsOn];
    while (pending.length) {
      const id = pending.pop();
      if (seen.has(id)) continue;
      seen.add(id); pending.push(...(edges.get(id) || []));
    }
    out.set(task.id, seen);
  }
  return out;
}
/** Validate a plan and report cyclic components deterministically in plan order. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function validatePlan(plan, options = {}) {
  return guarded(() => {
    if (!object(plan)) return result(['plan must be an object']);
    const errors = [];
    check(errors, storyRefOK(plan.storyRef), 'storyRef is invalid');
    checkSupervisor(plan.supervisor, errors);
    check(errors, integer(plan.round), 'round must be a positive integer');
    if (!Array.isArray(plan.tasks) || !plan.tasks.length) return result([...errors, 'tasks must be a non-empty array']);
    const ids = new Set(); let shapesOK = true;
    for (const [index, task] of plan.tasks.entries()) {
      const shape = validateTaskShape(task, { ...options, storyRef: plan.storyRef, round: plan.round });
      errors.push(...shape.errors.map((e) => `tasks[${index}]: ${e}`));
      shapesOK &&= shape.ok;
      if (object(task) && taskIdOK(task.id)) {
        if (ids.has(task.id)) errors.push(`duplicate task id: ${task.id}`);
        ids.add(task.id);
      }
    }
    for (const task of plan.tasks) if (object(task) && strings(task.dependsOn, taskIdOK)) {
      for (const dep of task.dependsOn) if (!ids.has(dep)) errors.push(`unknown dependency: ${dep}`);
    }
    if (shapesOK && ids.size === plan.tasks.length) {
      const reach = closures(plan.tasks), reported = new Set();
      for (const task of plan.tasks) if (reach.get(task.id).has(task.id) && !reported.has(task.id)) {
        const members = plan.tasks.filter((t) => reach.get(task.id).has(t.id) && reach.get(t.id).has(task.id)).map((t) => t.id);
        members.forEach((id) => reported.add(id));
        errors.push(`dependency cycle: ${[...members, members[0]].join(' -> ')}`);
      }
    }
    return result(errors);
  });
}
/** Enumerate disjoint task pairs without a dependency path in either direction. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function computeParallelEligible(plan, options = {}) {
  return guarded(() => {
    const valid = validatePlan(plan, options); if (!valid.ok) return valid;
    const reach = closures(plan.tasks), pairs = [];
    for (let i = 0; i < plan.tasks.length; i++) for (let j = i + 1; j < plan.tasks.length; j++) {
      const a = plan.tasks[i], b = plan.tasks[j];
      if (!reach.get(a.id).has(b.id) && !reach.get(b.id).has(a.id)
        && !a.profile.filesTouched.some((p) => b.profile.filesTouched.some((q) => pathsOverlap(p, q)))) pairs.push([a.id, b.id]);
    }
    return { ok: true, pairs };
  });
}
/** Validate stamped execution provenance and evidence supporting the terminal status. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function validateTaskResult(value) {
  return guarded(() => {
    if (!object(value)) return result(['result must be an object']);
    const errors = []; identity(value, errors);
    check(errors, isTaskType(value.taskType), 'taskType is invalid');
    check(errors, nonempty(value.authorRef), 'authorRef is required');
    check(errors, Object.values(SUPERVISION_LEVELS).includes(value.supervisionLevel), 'supervisionLevel is invalid');
    checkSupervisor(value.supervisor, errors);
    checkSession(value.sessionName, value, errors);
    check(errors, TASK_STATUSES.includes(value.status), 'status is invalid');
    check(errors, PROVIDERS.includes(value.provider), 'provider is invalid');
    check(errors, nonempty(value.model), 'model is required');
    check(errors, EXECUTORS.includes(value.executor), 'executor is invalid');
    if (EXECUTORS.includes(value.executor)) check(errors, EXECUTOR_PROVIDERS[value.executor].includes(value.provider), 'executor/provider mismatch');
    check(errors, strings(value.findings, (s) => nonempty(s) && s.length <= 2000), 'findings must contain non-empty strings of at most 2000 characters');
    if (!object(value.evidence)) return result([...errors, 'evidence must be an object']);
    const e = value.evidence;
    if (owns(e, 'sha')) check(errors, typeof e.sha === 'string' && /^[a-f0-9]{7,40}$/.test(e.sha), 'evidence.sha is invalid');
    if (owns(e, 'pr')) check(errors, integer(e.pr), 'evidence.pr must be a positive integer');
    if (owns(e, 'tests')) {
      check(errors, object(e.tests), 'evidence.tests must be an object');
      if (object(e.tests)) {
        check(errors, nonempty(e.tests.command), 'evidence.tests.command is required');
        check(errors, integer(e.tests.passed, 0), 'evidence.tests.passed must be a non-negative integer');
        check(errors, integer(e.tests.failed, 0), 'evidence.tests.failed must be a non-negative integer');
      }
    }
    if (value.status === 'landed') {
      check(errors, owns(e, 'sha') || owns(e, 'pr'), 'landed requires sha or pr');
      check(errors, object(e.tests), 'landed requires tests');
      if (object(e.tests)) check(errors, e.tests.failed === 0, 'landed requires zero failed tests');
    }
    return result(errors);
  });
}
/** Validate supervisor judgment, identity and permitted round-control actions. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function validateSupervisorVerdict(value, options = {}) {
  return guarded(() => {
    if (!object(value)) return result(['verdict must be an object']);
    const errors = []; identity(value, errors);
    check(errors, VERDICTS.includes(value.verdict), 'verdict is invalid');
    check(errors, VERDICT_MODES.includes(value.mode), 'mode is invalid');
    checkSupervisor(value.supervisor, errors);
    check(errors, !owns(value, 'supervisorRef'), 'supervisorRef is not permitted');
    check(errors, isTaskType(value.storyTaskType), 'storyTaskType is invalid');
    if (value.mode === 'shadow') check(errors, !owns(value, 'newTasks') && !owns(value, 'complete'), 'shadow verdicts cannot act');
    check(errors, VERIFIED_BY.includes(value.verifiedBy), 'verifiedBy is invalid');
    check(errors, strings(value.findings), 'findings must contain non-empty strings');
    if (value.verdict === 'rework' || value.verdict === 'reject') check(errors, Array.isArray(value.findings) && value.findings.length > 0, 'rework/reject requires findings');
    if (owns(value, 'complete')) check(errors, typeof value.complete === 'boolean', 'complete must be boolean');
    if (value.complete === true) check(errors, value.verdict === 'accept', 'complete requires accept');
    if (owns(value, 'newTasks')) {
      check(errors, Array.isArray(value.newTasks), 'newTasks must be an array');
      check(errors, value.verdict === 'accept' || value.verdict === 'reject', 'newTasks requires accept or reject');
      check(errors, value.complete !== true, 'newTasks and complete are mutually exclusive');
      if (Array.isArray(value.newTasks)) for (const [i, task] of value.newTasks.entries()) errors.push(...validateTaskShape(task, { ...options, storyRef: value.storyRef, round: value.round }).errors.map((e) => `newTasks[${i}]: ${e}`));
    }
    if (value.verdict === 'rework') check(errors, !owns(value, 'complete'), 'rework carries neither complete nor newTasks');
    return result(errors);
  });
}
/** Match the exact task attempt the supervisor judged. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function verdictMatchesResult(taskResult, verdict) {
  try {
    return object(taskResult) && object(verdict) && taskIdOK(taskResult.taskId) && storyRefOK(taskResult.storyRef)
      && integer(taskResult.round) && integer(taskResult.attempt)
      && ['taskId', 'storyRef', 'round', 'attempt'].every((k) => taskResult[k] === verdict[k]);
  } catch { return false; }
}
/** Report every failed graduation condition in fixed rule order. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function gradeGraduation(taskResult, verdict, groundTruth) {
  try {
    const reasons = [...validateTaskResult(taskResult).errors.map(e => `result: ${e}`),
      ...validateSupervisorVerdict(verdict).errors.map(e => `verdict: ${e}`),
      ...validateGroundTruth(groundTruth).errors.map(e => `groundTruth: ${e}`)];
    if (!verdictMatchesResult(taskResult, verdict)) reasons.push('verdict does not match result identity');
    if (!groundTruthMatches(taskResult, groundTruth)) reasons.push('ground truth does not match result identity');
    if (verdict?.mode !== 'acting') reasons.push('graduation requires acting verdict');
    // One trial from the final accepted attempt. Outright failures without independent
    // review are a known gap; the router ignores non-independently-verified rows anyway.
    if (verdict?.verdict !== 'accept') reasons.push('graduation requires accept');
    if (taskResult?.status !== 'landed') reasons.push('graduation requires landed status');
    if (!verifiedByFromGroundTruth(groundTruth)) reasons.push('ground truth requires independent-pr-review graduation verifier');
    // The verdict's own verifiedBy is deliberately NOT consulted for graduation.
    const session = verdict?.supervisor?.sessionId;
    if (!nonempty(session) || !nonempty(taskResult?.authorRef) || session === taskResult?.authorRef
      || !Array.isArray(groundTruth?.sources) || groundTruth.sources.some(s => s?.actorRef === taskResult?.authorRef || s?.actorRef === session))
      reasons.push('author, supervisor and ground truth actors must be independent');
    return { ok: reasons.length === 0, reasons };
  } catch { return { ok: false, reasons: ['unreadable graduation input'] }; }
}
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function isGraduationGrade(taskResult, verdict, groundTruth) { return gradeGraduation(taskResult, verdict, groundTruth).ok; }

/** Derive a dispatch-ready profile from a prepared backlog card, failing closed. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function deriveDispatchProfile(card, options = {}) {
  try {
    if (!object(card)) return { ready: false, missing: ['preparedDate', 'scope', 'size'] };
    const missing = [];
    if (typeof card.preparedDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(card.preparedDate)) missing.push('preparedDate');
    const scope = typeof card.scope === 'string' ? [card.scope] : card.scope;
    const filesTouched = []; let scopeOK = Array.isArray(scope);
    if (scopeOK) for (const entry of scope) {
      if (typeof entry !== 'string') { scopeOK = false; continue; }
      let path = entry.trim().replace(/^we:/, '').replace(/^([A-Za-z0-9._-]+):/, '$1/').replace(/^\.\//, '');
      if (!path) continue;
      if (!isRepoRelativePath(path)) scopeOK = false;
      if (!filesTouched.includes(path)) filesTouched.push(path);
    }
    if (!scopeOK || !filesTouched.length) missing.push('scope');
    const size = typeof card.size === 'string' && /^\d+$/.test(card.size) ? Number(card.size) : card.size;
    if (typeof size !== 'number' || !owns(SIZE_TO_ESTIMATED_LOC, size)) missing.push('size');
    if (owns(card, 'taskType') && !isTaskType(card.taskType)) missing.push('taskType:invalid');
    if (owns(card, 'risk') && !RISKS.includes(card.risk)) missing.push('risk:invalid');
    if (owns(card, 'acceptanceTestable') && typeof card.acceptanceTestable !== 'boolean') missing.push('acceptanceTestable:invalid');
    if (owns(card, 'kind') && (typeof card.kind !== 'string' || !owns(TASK_TYPE_BY_CARD_KIND, card.kind))) missing.push('kind:invalid');
    if (missing.length) return { ready: false, missing };
    const blocked = Array.isArray(card.blockedBy) ? card.blockedBy : [card.blockedBy];
    const dependsOn = [...new Set(blocked.filter((x) => typeof x === 'string' || typeof x === 'number').map((x) => String(x).trim()).filter(Boolean))];
    const input = { taskType: card.taskType ?? TASK_TYPE_BY_CARD_KIND[card.kind] ?? 'other', estimatedLoc: SIZE_TO_ESTIMATED_LOC[size], filesTouched, acceptanceTestable: card.acceptanceTestable ?? true, dependsOn };
    if (owns(card, 'risk')) input.risk = card.risk;
    const built = buildDispatchProfile(input, options);
    return built.ok ? { ready: true, profile: built.profile } : { ready: false, missing: built.errors };
  } catch { return { ready: false, missing: ['unreadable card'] }; }
}

function audit(criterion, resultValue, dataConsulted, reasoning) { return { criterion, result: resultValue, dataConsulted, reasoning }; }
function refused(errors) {
  return { mode: null, shadow: null, backend: null, spotCheck: null, role: 'refused', provider: null, model: null, tier: null, supervision: SUPERVISION_LEVELS.FULL, alternateBackend: null,
    auditTrail: errors.map((e) => audit('invalid-dispatch', 'refused', 'dispatch input', e)) };
}
// A stable projection ignores input key order and irrelevant/cyclic metadata. Equal-date
// records get a canonical tie-break before the router's stable descending timestamp sort.
function routingRecords(scorecards) {
  const records = Array.isArray(scorecards) ? scorecards : Array.isArray(scorecards?.records) ? scorecards.records : [];
  const keys = ['role', 'subjectClass', 'provider', 'model', 'taskType', 'scoredAt', 'outcome', 'verifiedBy', 'findings', 'handle', 'pr', 'item', 'taskDescription'];
  return records.filter(object).map((r) => Object.fromEntries(keys.map((k) => [k, ['string', 'number', 'boolean'].includes(typeof r[k]) ? r[k] : null])))
    .sort((a, b) => compare(b.scoredAt || '', a.scoredAt || '') || compare(JSON.stringify(a), JSON.stringify(b)));
}
function compare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
/** Route a validated profile through story policy or the existing provider cascade. */
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function routeDispatch(profile, options = {}) {
  try {
    const errors = [...validateDispatchProfile(profile).errors];
    const { stage, kind, scorecards = [], taskKey } = options;
    if (!ROUTE_STAGES.includes(stage)) errors.push('stage is invalid');
    if (stage === 'story' && !STORY_KINDS.includes(kind)) errors.push('kind is invalid');
    if (errors.length) return refused(errors);
    if (stage === 'story' && kind === 'build') return { ...selectSupervisor(profile, { scorecards }), spotCheck: null };
    // The router does not filter roles: work and supervisor evidence must never mix.
    const records = routingRecords(scorecards).filter(r => r.role !== 'supervise'), ownAudit = [], routerAudit = [];
    const high = profile.risk === 'high' || profile.filesTouched.some(isStatuteTierPath);
    const out = { mode: 'acting', shadow: null, backend: null, spotCheck: null, role: stage === 'story' ? kind === 'build' ? SUPERVISOR_ROLE : 'lane-agent' : 'task-agent', provider: null, model: null, tier: null, supervision: SUPERVISION_LEVELS.FULL, alternateBackend: null, auditTrail: [] };
    if (stage === 'story') {
      out.provider = RECOMMENDATIONS.CLAUDE;
      out.tier = high ? CLAUDE_TIERS.OPUS : kind === 'build' ? CLAUDE_TIERS.SONNET : STORY_KIND_RUNGS[kind];
      out.model = CLAUDE_NATIVE_MODEL_BY_TIER[out.tier];
      ownAudit.push(audit(kind === 'build' ? 'build-supervisor-tier' : 'story-kind-tier', out.tier, `kind=${kind}, risk=${profile.risk}, statute=${profile.filesTouched.some(isStatuteTierPath)}`, 'Story rung is raise-only for high-risk or statute work.'));
    } else {
      const task = { taskType: profile.taskType };
      const context = { filesTouched: [...profile.filesTouched], estimatedSize: profile.estimatedLoc, acceptanceTestable: profile.acceptanceTestable, scorecards: records };
      const selected = selectProvider(task, context);
      routerAudit.push(...selected.auditTrail);
      out.provider = selected.recommendation;
      if (selected.recommendation === RECOMMENDATIONS.CLAUDE) {
        out.tier = selected.claudeTier; out.model = CLAUDE_NATIVE_MODEL_BY_TIER[out.tier]; out.alternateBackend = selected.alternateBackend ?? null;
      } else if (selected.recommendation === RECOMMENDATIONS.BOTH) {
        ownAudit.push(audit('both-supervision', SUPERVISION_LEVELS.FULL, 'dual-provider route', 'No single provider/model/taskType triple can graduate dual dispatch.'));
      } else {
        const group = selected.recommendation === RECOMMENDATIONS.GEMINI ? EXECUTOR_PROVIDERS['gemini-direct-task'] : EXECUTOR_PROVIDERS['codex-direct-task'];
        const candidates = records.filter((r) => r.taskType === profile.taskType && group.includes(r.provider) && nonempty(r.model));
        const model = [...new Set(candidates.map((r) => r.model))].find((m) => selectProvider(task, { ...context, model: m }).recommendation === selected.recommendation);
        if (!model) return refused(['no candidate model reproduces the provider recommendation']);
        out.model = model; out.provider = candidates.find((r) => r.model === model).provider;
        ownAudit.push(audit('task-model-recovery', model, `provider=${out.provider}, taskType=${profile.taskType}`, 'Model reproduces the router recommendation under its own fitness policy.'));
      }
    }
    if (!(stage === 'story' && kind === 'build') && out.provider !== RECOMMENDATIONS.BOTH) {
      const supervision = selectSupervisionLevel(out.provider, out.model, profile.taskType, records, thresholdsForRisk(profile.risk));
      out.supervision = supervision.level; routerAudit.push(...supervision.auditTrail);
    }
    if (neverSpotCheck(profile) && out.supervision === SUPERVISION_LEVELS.SPOT_CHECK) {
      out.supervision = SUPERVISION_LEVELS.FULL;
      ownAudit.push(audit('never-spot-check', out.supervision, 'risk and filesTouched', 'Statute, gate-self, irreversible and high-risk tasks require full supervision.'));
    }
    out.backend = out.provider === 'claude' ? 'claude-native' : out.provider === 'codex' ? 'codex' : ['gemini', 'antigravity'].includes(out.provider) ? 'agy' : null;
    if (out.supervision === 'spot-check' && taskSessionName(taskKey)) {
      out.spotCheck = spotCheckSample(taskKey, profile.risk);
      ownAudit.push(audit('spot-check-sample', out.spotCheck.sampled, JSON.stringify(taskKey), JSON.stringify(out.spotCheck)));
    }
    out.auditTrail = [...ownAudit, ...routerAudit]; return out;
  } catch { return refused(['unreadable dispatch input']); }
}

// Validate Gregorian dates and explicit ISO time zones without consulting a clock.
function validTimestamp(value) {
  if (typeof value !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m) return false;
  const [, year, month, day, hour, minute, second, zone] = m;
  const y = Number(year), mo = Number(month), d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= days[mo - 1] && Number(hour) < 24 && Number(minute) < 60 && Number(second) < 60
    && (zone === 'Z' || (Number(zone.slice(1, 3)) <= 23 && Number(zone.slice(4)) < 60));
}
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const CLAUDE_NATIVE_MODEL_BY_TIER = Object.freeze({ haiku: 'claude-haiku-4-5-20251001', sonnet: 'claude-sonnet-5', opus: 'claude-opus-5' });
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const TASK_LIFECYCLE = Object.freeze(['planned', 'dispatched', 'landed', 'blocked', 'failed', 'validated', 'reworked']);
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const VERDICT_MODES = Object.freeze(['acting', 'shadow']);
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const GROUND_TRUTH_KINDS = Object.freeze(['ci', 'independent-pr-review', 'rework-rounds', 'revert']);

function checkSupervisor(s, errors) {
  check(errors, object(s) && PROVIDERS.includes(s.provider) && nonempty(s.model)
    && (s.sessionId === null || nonempty(s.sessionId)), 'supervisor must have provider, model and sessionId (string or null)');
}
function checkSession(name, key, errors) {
  check(errors, name === null || (typeof name === 'string' && name === taskSessionName(key)), 'sessionName must match task identity or be null');
}
function checkAgent(agent, key, errors) {
  if (agent === null) return;
  if (!object(agent)) { errors.push('agent must be an object or null'); return; }
  check(errors, PROVIDERS.includes(agent.provider) || agent.provider === 'both', 'agent.provider is invalid');
  check(errors, nonempty(agent.model) || (agent.provider === 'both' && agent.model === null), 'agent.model is invalid');
  check(errors, agent.executor === null || EXECUTORS.includes(agent.executor), 'agent.executor is invalid');
  check(errors, Object.values(SUPERVISION_LEVELS).includes(agent.supervisionLevel), 'agent.supervisionLevel is invalid');
  if (key.storyRef !== undefined && key.round !== undefined) checkSession(agent.sessionName, key, errors);
  else check(errors, agent.sessionName === null || parseTaskSessionName(agent.sessionName)?.taskId === key.taskId, 'agent.sessionName is invalid');
}
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function taskSessionName(key) {
  try { return object(key) && storyRefOK(key.storyRef) && Number.isSafeInteger(key.round) && key.round >= 1 && taskIdOK(key.taskId)
    ? `t-${key.storyRef}-r${key.round}-${key.taskId}` : null; } catch { return null; }
}
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function parseTaskSessionName(name) {
  if (typeof name !== 'string') return null;
  const m = /^t-([A-Za-z0-9._#]+)-r(\d+)-([A-Za-z0-9._-]+)$/.exec(name);
  if (!m || m[2].startsWith('0')) return null;
  const key = { storyRef: m[1], round: Number(m[2]), taskId: m[3] };
  return taskSessionName(key) === name ? key : null;
}
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function verdictEffects(verdict) {
  const inert = { acted: false, newTasks: [], complete: false };
  try { return validateSupervisorVerdict(verdict).ok && verdict.mode === 'acting'
    ? { acted: true, newTasks: verdict.newTasks ?? [], complete: verdict.complete === true } : inert; } catch { return inert; }
}
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function validateGroundTruth(gt) {
  return guarded(() => {
    if (!object(gt)) return result(['ground truth must be an object']);
    const errors = [];
    check(errors, taskIdOK(gt.taskId), 'taskId is invalid');
    check(errors, storyRefOK(gt.storyRef), 'storyRef is invalid');
    check(errors, integer(gt.round), 'round must be a positive integer');
    check(errors, gt.recordedBy === 'orchestrator', 'recordedBy must be orchestrator');
    if (!Array.isArray(gt.sources) || !gt.sources.length) return result([...errors, 'sources must be non-empty']);
    for (const [i, source] of gt.sources.entries()) {
      const e = [];
      if (!object(source)) { errors.push(`sources[${i}] must be an object`); continue; }
      check(e, GROUND_TRUTH_KINDS.includes(source.kind), 'kind is invalid');
      check(e, ['clean', 'unclean'].includes(source.outcome), 'outcome is invalid');
      check(e, nonempty(source.actorRef), 'actorRef is required');
      if (source.kind === 'independent-pr-review' || owns(source, 'verifiedBy')) check(e, VERIFIED_BY.includes(source.verifiedBy), 'verifiedBy is invalid');
      if (source.kind === 'rework-rounds' || owns(source, 'reworkRounds')) check(e, integer(source.reworkRounds, 0), 'reworkRounds is invalid');
      if (source.kind === 'rework-rounds') check(e, (source.reworkRounds > 0) === (source.outcome === 'unclean'), 'rework outcome contradicts rounds');
      if (owns(source, 'findings')) check(e, strings(source.findings, s => nonempty(s) && s.length <= 2000), 'findings are invalid');
      errors.push(...e.map(message => `sources[${i}]: ${message}`));
    }
    return result(errors);
  });
}
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function groundTruthOutcome(gt) {
  return !validateGroundTruth(gt).ok || gt.sources.some(s => s.outcome === 'unclean') ? 'unclean' : 'clean';
}
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function groundTruthMatches(r, gt) {
  try { return object(r) && object(gt) && taskSessionName(r) !== null && ['taskId', 'storyRef', 'round'].every(k => r[k] === gt[k]); } catch { return false; }
}
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function outcomeFromGroundTruth(gt) {
  if (!validateGroundTruth(gt).ok) return 'rejected';
  if (groundTruthOutcome(gt) === 'clean') return 'landed';
  return gt.sources.filter(s => s.outcome === 'unclean').every(s => s.kind === 'rework-rounds') ? 'reworked' : 'rejected';
}
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function verifiedByFromGroundTruth(gt) {
  if (!validateGroundTruth(gt).ok) return null;
  return gt.sources.find(s => s.kind === 'independent-pr-review' && GRADUATION_VERIFIERS.includes(s.verifiedBy))?.verifiedBy ?? null;
}

// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const SUPERVISOR_CANDIDATES = Object.freeze([
  { id: 'agy-sonnet-4-6', backend: 'agy', provider: 'antigravity', model: AGY_CLAUDE_MODEL_BY_TIER.sonnet, tier: 'sonnet' },
  { id: 'codex-astra', backend: 'codex', provider: 'codex', model: CODEX_MODEL, tier: null },
  { id: 'claude-sonnet-5', backend: 'claude-native', provider: 'claude', model: CLAUDE_NATIVE_MODEL_BY_TIER.sonnet, tier: 'sonnet' },
  { id: 'agy-opus-4-6', backend: 'agy', provider: 'antigravity', model: AGY_CLAUDE_MODEL_BY_TIER.opus, tier: 'opus' },
  { id: 'claude-opus-5', backend: 'claude-native', provider: 'claude', model: CLAUDE_NATIVE_MODEL_BY_TIER.opus, tier: 'opus' },
].map(Object.freeze));
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export const SUPERVISOR_LADDERS = Object.freeze(Object.fromEntries(Object.entries({
  'low/S': 0, 'low/M': 1, 'low/L': 2, 'medium/S': 1, 'medium/M': 2, 'medium/L': 3, 'high/S': 3, 'high/M': 3, 'high/L': 3,
}).map(([key, start]) => [key, Object.freeze(SUPERVISOR_CANDIDATES.slice(start).map(c => c.id))])));
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function selectSupervisor(profile, options = {}) {
  try {
    const valid = validateDispatchProfile(profile); if (!valid.ok) return refused(valid.errors);
    // selectSupervisionLevel has no role/subjectClass filter; partition before calling.
    const records = routingRecords(options.scorecards).filter(r => r.role === 'supervise' && r.subjectClass === 'driver');
    const hard = profile.filesTouched.some(isStatuteTierPath) || ['architectural-decision', 'triage-research'].includes(profile.taskType);
    const ids = hard ? ['claude-opus-5'] : SUPERVISOR_LADDERS[`${profile.risk}/${profile.complexity}`];
    const auditTrail = []; let chosen;
    for (const id of ids) {
      const candidate = SUPERVISOR_CANDIDATES.find(c => c.id === id);
      const assessment = selectSupervisionLevel(candidate.provider, candidate.model, profile.taskType, records, thresholdsForRisk(profile.risk));
      const fallback = id === ids.at(-1);
      auditTrail.push(audit('supervisor-candidate', id, assessment.auditTrail, fallback ? 'fallback' : assessment.reasoning));
      if (fallback || assessment.level === 'spot-check') { chosen = candidate; break; }
    }
    const { provider, model, tier, backend } = chosen;
    const cheaper = !hard && ids[0] !== chosen.id ? SUPERVISOR_CANDIDATES.find(c => c.id === ids[0]) : null;
    const shadow = cheaper ? { provider: cheaper.provider, model: cheaper.model, tier: cheaper.tier, backend: cheaper.backend, mode: 'shadow' } : null;
    auditTrail.push(audit('supervisor-selected', chosen.id, ids, chosen.id === ids.at(-1) ? 'fallback' : 'first eligible rung'));
    return { role: SUPERVISOR_ROLE, provider, model, tier, backend, mode: 'acting', shadow, supervision: 'full', alternateBackend: null, auditTrail };
  } catch { return refused(['unreadable supervisor input']); }
}

// One idempotent row per task, from its final accepted attempt.
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function trialIdempotencyKey(storyRef, round, taskId) { return `mech-trial:${storyRef}:r${round}:${taskId}`; }
function makeTrial(r, v, options, role, shadow = null) {
  try {
    const gt = options?.groundTruth, reasons = [];
    if (!validTimestamp(options?.now)) reasons.push('now must be a valid ISO-8601 timestamp');
    reasons.push(...gradeGraduation(r, v, gt).reasons);
    for (const field of ['provider', 'model', 'executor', 'authorRef']) if (!nonempty(r?.[field])) reasons.push(`missing provenance: ${field}`);
    const verifiedBy = verifiedByFromGroundTruth(gt);
    if (!verifiedBy) reasons.push('missing provenance: verifiedBy from ground truth');
    if (shadow) {
      reasons.push(...validateSupervisorVerdict(shadow).errors);
      if (shadow.mode !== 'shadow' || !verdictMatchesResult(r, shadow)) reasons.push('shadow identity or mode is invalid');
      if (shadow.supervisor?.provider === v?.supervisor?.provider && shadow.supervisor?.model === v?.supervisor?.model) reasons.push('shadow and acting supervisor must differ');
      // The shadow session must be an identifiable process independent of the author, the acting supervisor and every ground-truth actor.
      const shadowSession = shadow.supervisor?.sessionId;
      if (!nonempty(shadowSession) || shadowSession === r?.authorRef || shadowSession === v?.supervisor?.sessionId
        || (Array.isArray(gt?.sources) && gt.sources.some(s => s?.actorRef === shadowSession))) reasons.push('shadow session must be independent of author, acting supervisor and ground truth');
    }
    if (reasons.length) return { ok: false, reason: reasons.join('; ') };
    const subject = shadow ?? v;
    const { provider, model } = role === 'work' ? r : subject.supervisor;
    const findings = [...new Set([...gt.sources.flatMap(s => s.findings ?? []), ...v.findings, ...r.findings, ...(shadow?.findings ?? [])])].join('; ') || null;
    for (const [field, value] of [['provider', provider], ['model', model], ['findings', findings ?? ''], ['work model', r.model], ['acting model', v.supervisor.model]])
      if (scrubPublish(value).length) reasons.push(`${field} failed publish scrub`);
    if (reasons.length) return { ok: false, reason: reasons.join('; ') };
    const { storyRef, round, taskId } = r, handle = `${storyRef}/r${round}/${taskId}`;
    const idempotencyKey = role === 'work' ? trialIdempotencyKey(storyRef, round, taskId)
      : shadow ? `mech-sup-shadow-trial:${storyRef}:r${round}:${taskId}:${provider}:${model}` : `mech-sup-trial:${storyRef}:r${round}:${taskId}`;
    const correct = shadow && ((shadow.verdict === 'accept') === (groundTruthOutcome(gt) === 'clean'));
    const row = { v: 1, outcome: shadow ? correct ? 'landed' : 'rejected' : outcomeFromGroundTruth(gt), scoredAt: options.now,
      rubricVersion: role === 'work' ? 'mechanical-dispatch.1' : 'mechanical-supervise.1', provider, model,
      subjectClass: role === 'work' ? 'work-agent' : 'driver', role,
      dispatchKind: role === 'work' ? 'mechanical-task' : shadow ? 'mechanical-supervise-shadow' : 'mechanical-supervise',
      criteriaEvaluated: 0, score: null, deductions: [],
      item: /^\d+$/.test(storyRef) && Number.isSafeInteger(Number(storyRef)) && Number(storyRef) > 0 ? Number(storyRef) : null,
      pr: r.evidence.pr ?? null, handle, taskDescription: `mechanical task ${handle}`, taskType: role === 'work' ? r.taskType : subject.storyTaskType,
      verifiedBy, findings, retroactive: false, idempotencyKey };
    if (shadow) row.agreedWithActing = shadow.verdict === v.verdict;
    return { ok: true, row, idempotencyKey };
  } catch { return { ok: false, reason: 'unreadable trial input' }; }
}
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function trialFromVerdict(r, v, options = {}) { return makeTrial(r, v, options, 'work'); }
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function supervisorTrialFromVerdict(r, v, options = {}) { return makeTrial(r, v, options, 'supervise'); }
// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)
export function shadowTrialFromVerdict(r, shadow, acting, options = {}) {
  if (!shadow) return { ok: false, reason: 'shadow verdict is required' };
  return makeTrial(r, acting, options, 'supervise', shadow);
}
