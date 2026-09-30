/** Pure validation and resolution for the declarative routing policy. */
import { initialRoutingPolicy as defaults } from './dispatch-routing-policy-source.mjs';

const CATALOG = Object.freeze({
  claude: ['claude-haiku-4-5-20251001', 'claude-sonnet-5-5', 'claude-opus-5'],
  codex: ['gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna', 'gpt-5.6-sol', 'gpt-5.6-terra'],
  antigravity: ['claude-sonnet-4-6', 'claude-opus-4-6-thinking', 'gemini-3.8-flash-high', 'gemini-3.1-pro'],
  'agy-claude': ['claude-sonnet-4-6', 'claude-opus-4-6-thinking'],
  'agy-gemini': ['gemini-3.8-flash-high', 'gemini-3.1-pro'],
});
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = message => { throw new TypeError(`routing policy: ${message}`); };
function keys(value, allowed, path) {
  if (!object(value)) fail(`${path} must be an object`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${path}.${key} is unknown`);
}
function modelFor(policy, provider, model, path) {
  if (!Object.hasOwn(CATALOG, provider)) fail(`${path}: unknown provider ${JSON.stringify(provider)}`);
  const resolved = policy.aliases?.[provider]?.[model] ?? model;
  if (!CATALOG[provider].includes(resolved)) fail(`${path}: unknown model/alias ${JSON.stringify(model)} for ${provider}`);
  return resolved;
}
function freeze(value) {
  if (object(value) || Array.isArray(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export function validateRoutingPolicy(input) {
  const policy = structuredClone(input);
  keys(policy, ['_howTo', 'version', 'aliases', 'criticalWorkGate', 'operations', 'taskTypes'], 'policy');
  if (policy.version !== 1) fail('version must be 1');
  if (!object(policy.aliases)) fail('aliases must be an object');
  for (const [provider, aliases] of Object.entries(policy.aliases)) {
    if (!Object.hasOwn(CATALOG, provider)) fail(`aliases: unknown provider ${provider}`);
    if (!object(aliases)) fail(`aliases.${provider} must be an object`);
    for (const [alias, model] of Object.entries(aliases)) {
      if (!/^[\w.-]+$/.test(alias) || !CATALOG[provider].includes(model)) fail(`aliases.${provider}.${alias}: unknown model ${JSON.stringify(model)}`);
    }
  }
  const gate = policy.criticalWorkGate;
  keys(gate, ['kinds', 'openForNonCritical', 'basis', 'reason'], 'criticalWorkGate');
  if (!Array.isArray(gate.kinds) || gate.kinds.some(k => typeof k !== 'string' || !k.trim()) || new Set(gate.kinds).size !== gate.kinds.length) fail('criticalWorkGate.kinds must contain distinct operation names');
  if (!object(gate.openForNonCritical) || Object.values(gate.openForNonCritical).some(v => typeof v !== 'boolean')) fail('criticalWorkGate.openForNonCritical must contain booleans');
  for (const group of ['operations', 'taskTypes']) {
    if (!object(policy[group])) fail(`${group} must be an object`);
    for (const [name, entry] of Object.entries(policy[group])) {
      const path = `${group}.${name}`;
      if (!name.trim()) fail(`${group} has an empty key`);
      if (entry?.inherit === true) { keys(entry, ['inherit'], path); continue; }
      keys(entry, ['provider', 'model', 'fallback'], path);
      modelFor(policy, entry.provider, entry.model, path);
      if (!Array.isArray(entry.fallback)) fail(`${path}.fallback must be an array`);
      for (const [i, next] of entry.fallback.entries()) {
        keys(next, ['provider', 'model'], `${path}.fallback[${i}]`);
        modelFor(policy, next.provider, next.model, `${path}.fallback[${i}]`);
      }
    }
  }
  if (!policy.operations['*']) fail('operations.* is required');
  return freeze(policy);
}
/** Null means retain the existing evidence/tier decision. Availability is supplied by the launch boundary. */
export function resolveOperationRoute({ operation, taskType, available, gateClosed = false, vetoes = [], policy = DEFAULT_ROUTING_POLICY } = {}) {
  let entry = policy.operations[`${operation}:${taskType}`] ?? policy.operations[operation] ?? policy.operations[String(operation).split(':')[0]];
  if (!entry || entry.inherit) entry = policy.taskTypes[taskType] ?? entry ?? policy.operations['*'];
  if (entry.inherit) return null;
  const chain = [entry, ...entry.fallback].map(({ provider, model }) => ({ provider, model: modelFor(policy, provider, model, operation) }))
    .filter(route => (!gateClosed || route.provider === 'claude') && (route.provider === 'claude' || !vetoes.some(veto => veto.model === route.model && veto.provider === (route.provider.startsWith('agy-') ? 'antigravity' : route.provider))));
  const selected = chain.find(route => (!gateClosed || route.provider === 'claude') && (!available || available.includes(route.provider)));
  if (!selected) fail(`${operation}: no available route${gateClosed ? ' permitted by critical-work gate' : ''}`);
  return { ...selected, fallback: chain.slice(chain.indexOf(selected) + 1), source: 'routing-policy' };
}

/** Validate explicit CLI pins through the same provider-specific catalogue as policy aliases. */
export function resolvePolicyModel(provider, model, policy = DEFAULT_ROUTING_POLICY) {
  return modelFor(policy, provider, model, 'explicit model');
}

export const DEFAULT_ROUTING_POLICY = validateRoutingPolicy(defaults);
