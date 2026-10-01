/** The only filesystem boundary for routing policy: reload, retain last-good, and forward snapshots. */
import { readFileSync } from 'node:fs';
import { ROUTING_POLICY_PATH, trustedSnapshot } from './dispatch-routing-policy-source.mjs';
import { validateRoutingPolicy, DEFAULT_ROUTING_POLICY, resolveOperationRoute as resolvePureRoute, resolvePolicyModel as resolvePureModel } from './dispatch-routing-policy.mjs';
import { decideDispatchRoute } from './dispatch-contracts.mjs';
function initialPolicy() {
  return trustedSnapshot(process.env.WE_DISPATCH_ROUTING_SNAPSHOT) ?? DEFAULT_ROUTING_POLICY;
}
export function createRoutingPolicyReader({ path = ROUTING_POLICY_PATH, read = readFileSync, log = message => console.error(message), initial = initialPolicy() } = {}) {
  let good = validateRoutingPolicy(initial), seen, lastError;
  return () => {
    try {
      const text = read(path, 'utf8');
      if (text !== seen) {
        seen = text;
        good = validateRoutingPolicy(JSON.parse(text));
        lastError = null;
      }
    } catch (error) {
      // Report once per bad content, but retry after a later valid edit (including a repaired missing file).
      const signature = `error:${error.message}`;
      if (lastError !== signature) log(`routing-policy-invalid: keeping last good policy: ${error.message}`);
      lastError = signature;
    }
    return good;
  };
}
export const readRoutingPolicy = createRoutingPolicyReader();


export function resolveOperationRoute(options = {}) {
  return resolvePureRoute({ ...options, policy: options.policy ?? readRoutingPolicy() });
}
export function resolvePolicyModel(provider, model, policy = readRoutingPolicy()) {
  return resolvePureModel(provider, model, policy);
}
export function resolveDispatchRoute(dispatch, options = {}) {
  return decideDispatchRoute(dispatch, { ...options, routingPolicy: options.routingPolicy ?? readRoutingPolicy() });
}
export function routingPolicyEnv() {
  return { WE_DISPATCH_ROUTING_SNAPSHOT: JSON.stringify(readRoutingPolicy()) };
}
