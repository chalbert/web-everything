/** Shared agy provenance and backend quota holds. Init is CLI-reported identity, not server attestation. */
import { mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

export const agyBackend = (model) => /^claude-|^(sonnet|opus)$/.test(model ?? '') ? 'anthropic' : /^gemini-/.test(model ?? '') ? 'google' : 'unknown';
export const agyEvidenceDir = () => process.env.ANTIGRAVITY_QUOTA_DIR || join(homedir(), '.antigravity-quota');
export function agyRunEvidence({ stdout = '', stderr = '', requestedModel, now = Date.now() } = {}) {
  const events = String(stdout).split('\n').flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
  const reported = events.find((e) => e?.event === 'init')?.init?.model;
  const servedModel = typeof reported === 'string' && reported ? reported : 'unknown';
  const terminal = events.filter((e) => e?.event === 'result').at(-1)?.result;
  // Never scan response/prompt/tool text: quoted quota prose is not an exhaustion signal.
  const error = [stderr, terminal?.error].filter(Boolean).join('\n');
  const exhausted = /RESOURCE_EXHAUSTED|Individual quota reached|quota (?:exceeded|exhausted)|usage limit|rate[ -]?limit|\b429\b/i.test(error);
  const reset = /Resets in\s+(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i.exec(error);
  const delay = reset ? (+reset[1] || 0) * 3600000 + (+reset[2] || 0) * 60000 + (+reset[3] || 0) * 1000 : 3600000;
  const mismatch = agyBackend(requestedModel) !== 'unknown' && agyBackend(servedModel) !== 'unknown' && agyBackend(requestedModel) !== agyBackend(servedModel);
  const canonical = (m) => String(m).replace(/-(?:high|medium|low|max)$/, '');
  const modelMismatch = /^(?:claude|gemini)-/.test(requestedModel ?? '') && servedModel !== 'unknown' && canonical(requestedModel) !== canonical(servedModel);
  return { requestedModel: requestedModel || 'default', servedModel, servedBackend: agyBackend(servedModel),
    modelEvidence: servedModel === 'unknown' ? 'unavailable' : 'agy-init',
    quotaState: exhausted ? 'exhausted' : 'unknown',
    quotaResetsAt: exhausted ? new Date(now + (delay || 3600000)).toISOString() : null,
    fallbackDecision: exhausted ? 'skip-quota-exhausted' : mismatch ? 'skip-backend-mismatch' : modelMismatch ? 'skip-model-mismatch' : 'none' };
}
export function readAgyHold(model, { dir = agyEvidenceDir(), now = Date.now() } = {}) {
  // A CLI-default launch has no known backend before init: conservatively sit out an active hold.
  if (!model) {
    for (const candidate of ['claude-sonnet-4-6', 'gemini-3.1-pro', 'default']) {
      const hold = readAgyHold(candidate, { dir, now });
      if (hold) return { ...hold, requestedModel: 'default' };
    }
    return null;
  }
  try {
    const folder = join(dir, agyBackend(model));
    const row = readdirSync(folder).filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(readFileSync(join(folder, name), 'utf8')))
      .filter((entry) => Date.parse(entry.quotaResetsAt) > now)
      .sort((a, b) => Date.parse(b.quotaResetsAt) - Date.parse(a.quotaResetsAt))[0];
    return row ? { ...row, requestedModel: model || 'default', servedModel: 'unknown', servedBackend: 'unknown', modelEvidence: 'not-launched', fallbackDecision: 'skip-quota-hold' } : null;
  } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
export function saveAgyHold(evidence, { dir = agyEvidenceDir() } = {}) {
  if (evidence.quotaState !== 'exhausted') return;
  const backend = evidence.servedBackend === 'unknown' ? agyBackend(evidence.requestedModel) : evidence.servedBackend;
  const folder = join(dir, backend);
  mkdirSync(folder, { recursive: true });
  // Independent immutable observations: concurrent failures cannot shorten a previously observed hold.
  const file = join(folder, `${randomUUID()}.json`);
  const temp = `${file}.tmp`;
  writeFileSync(temp, JSON.stringify(evidence));
  renameSync(temp, file);
}
export function agyEvidenceError(evidence) {
  const error = new Error(`antigravity: ${evidence.fallbackDecision}; requested ${evidence.requestedModel}; reported ${evidence.servedModel}; quota reset ${evidence.quotaResetsAt ?? 'unknown'}`);
  error.telemetry = evidence;
  return error;
}

/** Whitelist provenance at each record boundary; never persist prompts or arbitrary report keys. */
export function pickAgyEvidence(report = {}) {
  return Object.fromEntries(['requestedModel', 'servedModel', 'servedBackend', 'modelEvidence', 'quotaState', 'quotaResetsAt', 'fallbackDecision']
    .filter((key) => typeof report?.[key] === 'string').map((key) => [key, report[key]]));
}
export function parseAgyReportEvidence(text) {
  try { return pickAgyEvidence(JSON.parse(text)); } catch { return {}; }
}
