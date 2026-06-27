/**
 * @file webcompliance/audit.ts
 * @description Audit / evidence trail — backlog #439 (phase 4 of #351), built on the #437 gate
 *   ({@link ./gate}) + #438 waivers ({@link ./waiver}) and emitted through Web Reporting (#350, the
 *   {@link Report} model). The defensible record: **what** was enforced (the evaluated rules), **when**
 *   (`at`), against **which standard version** (`policyId@policyVersion`), with **what result** (passed /
 *   blocked, the violations, the waived overrides, and any expired waivers). It mirrors the loan app's
 *   proof-of-compliance, lifted to the platform level.
 *
 *   An audit result is *just another report source*: {@link auditToReport} maps an {@link AuditRecord}
 *   onto the canonical {@link Report} model, so the same renderers (#432) and export adapters (#434:
 *   `toSarif` / `toJUnit`) that serve every other report serve the audit trail too — no bespoke viewer.
 *
 * Pure + dependency-free like {@link ./gate} and {@link ./waiver}: `at` is passed in (no clock read), so
 * the record and its report are deterministic and testable.
 */
import type {
  AnyGateResult,
  AuditRecord,
  AuditToReportOptions,
  CompliancePolicy,
  GateViolation,
  PolicyRule,
  Severity as GateSeverity,
  Waiver,
  WaiveredGateResult,
  WaivedViolation,
} from './contract';
import type { Report, ReportSection, Finding, Score, Severity as ReportSeverity } from '../blocks/renderers/report/renderReport';

// The audit types ({@link AnyGateResult}/{@link AuditRecord}/{@link AuditToReportOptions}) + every gate/waiver
// type are the pure-contract half — they live in `./contract.ts` (the `@webeverything/contracts/webcompliance`
// entry, #1294 C1). The Report model this maps onto is the renderer's contract (its own home).

/** Narrow to a post-waiver result (carries the `waived` / `expiredWaivers` audit lists). */
function isWaivered(r: AnyGateResult): r is WaiveredGateResult {
  return 'waived' in r;
}

/**
 * Capture an enforcement event as an {@link AuditRecord}: pairs the gate verdict with the policy's identity
 * (id + version) and the time it ran. `at` is supplied by the caller (deterministic — no clock read).
 */
export function recordAudit(policy: CompliancePolicy, result: AnyGateResult, at: string): AuditRecord {
  return { policyId: policy.id, policyVersion: policy.version, at, result };
}

/** Map a gate severity to a report-model severity (the one consistent token across every report view). */
function reportSeverity(severity: GateSeverity): ReportSeverity {
  switch (severity) {
    case 'block': return 'error';
    case 'error': return 'error';
    case 'warn': return 'warn';
    case 'off': return 'info';
  }
}

const ruleLocation = (rule: PolicyRule): Finding['location'] =>
  rule.scope ? { path: rule.scope } : undefined;

function violationFinding(v: GateViolation, source: string): Finding {
  const f: Finding = {
    id: `violation:${v.rule.id}`,
    severity: reportSeverity(v.rule.severity),
    title: `${v.rule.measure} ${v.reason === 'missing-measure' ? 'not measured' : 'below threshold'}`,
    detail: `Required ${v.rule.threshold === undefined ? 'present' : `≥ ${v.rule.threshold}`}, measured ${v.measured ?? '(absent)'}.`,
    ruleId: v.rule.id,
    source,
  };
  const loc = ruleLocation(v.rule);
  return loc ? { ...f, location: loc } : f;
}

function waivedFinding(w: WaivedViolation, source: string): Finding {
  return {
    id: `waived:${w.rule.id}`,
    severity: 'info',
    title: `${w.rule.measure} waived (until ${w.waiver.until})`,
    detail: `Granted by ${w.waiver.who}: ${w.waiver.why}`,
    ruleId: w.rule.id,
    source,
  };
}

function expiredWaiverFinding(w: Waiver, source: string): Finding {
  return {
    id: `expired-waiver:${w.ruleId}`,
    severity: 'warn',
    title: `Expired waiver for ${w.ruleId} (lapsed ${w.until})`,
    detail: `Originally granted by ${w.who}: ${w.why}. Renew or remove — no longer suppressing.`,
    ruleId: w.ruleId,
    source,
  };
}

function passFinding(rule: PolicyRule, source: string): Finding {
  return {
    id: `pass:${rule.id}`,
    severity: 'pass',
    title: `${rule.measure} satisfied`,
    ruleId: rule.id,
    source,
  };
}

/**
 * Map an {@link AuditRecord} onto the canonical {@link Report} model — "an audit result is just another
 * report source". One {@link ReportSource} (`webcompliance`, kind `audit`, stamped with the policy id +
 * version + `at`), then sections for violations, waived overrides, expired waivers, and (by default)
 * passes. A summary {@link Score} block carries the counts so the coverage/score renderers (#432) and the
 * SARIF/JUnit export adapters (#434) consume the audit exactly like any other report.
 */
export function auditToReport(record: AuditRecord, opts: AuditToReportOptions = {}): Report {
  const includePasses = opts.includePasses ?? true;
  const sourceId = 'webcompliance';
  const { result, policyId, policyVersion, at } = record;

  const violations = result.violations;
  const waived: readonly WaivedViolation[] = isWaivered(result) ? result.waived : [];
  const expired: readonly Waiver[] = isWaivered(result) ? result.expiredWaivers : [];
  const violatedIds = new Set(violations.map((v) => v.rule.id));
  const waivedIds = new Set(waived.map((w) => w.rule.id));
  const passes = result.evaluated.filter((r) => !violatedIds.has(r.id) && !waivedIds.has(r.id));

  const sections: ReportSection[] = [];

  const summaryScores: Score[] = [
    { id: 'evaluated', label: 'Rules evaluated', value: result.evaluated.length },
    { id: 'violations', label: 'Violations', value: violations.length },
    { id: 'waived', label: 'Waived', value: waived.length },
    { id: 'expired-waivers', label: 'Expired waivers', value: expired.length },
    { id: 'blocked', label: 'Blocked', value: result.blocked ? 1 : 0, max: 1 },
  ];
  sections.push({ id: 'summary', title: 'Verdict', scores: summaryScores });

  if (violations.length)
    sections.push({ id: 'violations', title: 'Violations', findings: violations.map((v) => violationFinding(v, sourceId)) });
  if (waived.length)
    sections.push({ id: 'waived', title: 'Waived (audited overrides)', findings: waived.map((w) => waivedFinding(w, sourceId)) });
  if (expired.length)
    sections.push({ id: 'expired-waivers', title: 'Expired waivers', findings: expired.map((w) => expiredWaiverFinding(w, sourceId)) });
  if (includePasses && passes.length)
    sections.push({ id: 'passes', title: 'Satisfied', findings: passes.map((r) => passFinding(r, sourceId)) });

  return {
    id: `compliance-audit:${policyId}@${policyVersion}`,
    title: `Compliance audit — ${policyId}@${policyVersion}`,
    generatedAt: at,
    sources: [{
      id: sourceId,
      name: 'Web Compliance gate',
      kind: 'audit',
      at,
      meta: { policy: policyId, version: policyVersion, verdict: result.blocked ? 'blocked' : 'passed' },
    }],
    sections,
  };
}
