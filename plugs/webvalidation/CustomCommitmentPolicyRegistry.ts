/**
 * Runtime `customCommitmentPolicy` plug (#1113, webvalidation completion #1090) — the live counterpart to
 * the dependency-free `commitment-policy/` model shipped by #1112, and the sibling of
 * {@link ./CustomValidatorResolutionRegistry} (async resolution) and `CustomValidityMergeRegistry` (merge).
 *
 * Where the standalone model (`commitment-policy/registry.ts`) is a self-contained table, this is the
 * **real plug**: a `CustomRegistry<CommitmentPolicy>` (the same base every Web Everything registry extends)
 * so it participates in the injector chain — a scope sets one on its injector and controls below resolve
 * it nearest-scope-wins (#207 D6), exactly like `customValidityMerge` / `customValidatorResolution`. It
 * reuses the built-in policies (`full`/`deferred`) from the `commitment-policy/` model verbatim — only the
 * registry differs (core `CustomRegistry` here vs the standalone table there), so the commit/staleness
 * policy has one home and cannot drift. Mirrors `CustomValidatorResolutionRegistry:28-67`.
 */
import CustomRegistry from '../core/CustomRegistry';
import {
  type CommitmentPolicy,
  FullCommitmentPolicy,
  DeferredCommitmentPolicy,
  assertCommitmentPolicy,
} from '../../commitment-policy/index.js';
import { UnknownCommitmentPolicyError } from '../../commitment-policy/registry.js';

/**
 * The live registry of named commitment policies. Extends the core `CustomRegistry` (keyed by policy
 * `key`) so it is injector-chain-resolvable and inheritable via `extends`; adds the
 * `define(policy, asDefault?)` / `resolve(key?)` surface the standalone model documents, deriving the
 * registration key from the policy's own `key` rather than a hand-passed name.
 */
export default class CustomCommitmentPolicyRegistry extends CustomRegistry<CommitmentPolicy> {
  localName = 'customCommitmentPolicy';
  #defaultKey: string | null = null;

  /**
   * Register a policy under its own `key`. The first registered — or one passed `asDefault` — becomes
   * the policy a control uses when its scope names none (`full`, the eager native-first default, by
   * convention). Re-registering a key overrides it. The policy is identity-guarded (#1112).
   */
  define(policy: CommitmentPolicy, asDefault = false): void {
    assertCommitmentPolicy(policy);
    this.set(policy.key, policy);
    if (asDefault || this.#defaultKey === null) this.#defaultKey = policy.key;
  }

  /** The key of the policy `resolve()` returns when called with no argument. */
  get defaultKey(): string | null {
    return this.#defaultKey;
  }

  /**
   * Resolve a policy by name, falling back to the registered default when `key` is omitted. Throws
   * `UnknownCommitmentPolicyError` when the named (or default) policy is absent — the registry never
   * silently substitutes a different policy, in plugged mode exactly as in the standalone model.
   */
  resolve(key?: string): CommitmentPolicy {
    const wanted = key ?? this.#defaultKey;
    if (wanted === null) throw new UnknownCommitmentPolicyError('default', [...this.keys()]);
    const policy = this.get(wanted as string);
    if (!policy) throw new UnknownCommitmentPolicyError(wanted, [...this.keys()]);
    return policy;
  }
}

/** A registry pre-loaded with the two shipped policies; `full` (eager) is the native-first default. */
export function createDefaultCommitmentPolicyRegistry(): CustomCommitmentPolicyRegistry {
  const registry = new CustomCommitmentPolicyRegistry();
  registry.define(new FullCommitmentPolicy(), true); // native-first eager default
  registry.define(new DeferredCommitmentPolicy());
  return registry;
}
