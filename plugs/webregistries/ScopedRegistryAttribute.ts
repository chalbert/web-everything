/**
 * `ScopedRegistryAttribute` — the CustomAttribute binding-behavior for the `registry="<id>"` association
 * (#901, the third piece of the #854 ruling; the attribute name is #900's `registry`).
 *
 * #854 ruled that scoped registration binds via a **CustomAttribute behavior resolving at MOMENT 2** — a
 * declaration-time, dom-less hook, not a `<component>` attribute. This behavior is the consumer side: when
 * the `registry` attribute attaches to a host element, it resolves the host's `registry="<id>"` (or
 * `{{ expr }}` raw-object bridge) against the most recent declared-registry scan and maps that scoped
 * registry through to the host (the `attachShadow({ customElementRegistry })` consumption path). If the
 * declaration hasn't been scanned yet (consumer-before-declaration), nothing resolves now and a re-run of
 * the registry scan + a re-attach drains it — the same lazy-queue tolerance the declaration side has.
 *
 * It deliberately reuses {@link applyScopedRegistryToHost} and {@link resolveScopedRegistry} so the
 * behavior path and a direct imperative call go through one mechanism (no divergent second implementation).
 */

import CustomAttribute from '../webbehaviors/CustomAttribute';
import {
  REGISTRY_ASSOC_ATTR,
  applyScopedRegistryToHost,
  getActiveRegistryResult,
  resolveScopedRegistry,
} from './declarativeRegistry';

export default class ScopedRegistryAttribute extends CustomAttribute {
  /** The behavior observes its own association attribute so a late `registry="…"` set re-resolves. */
  static observedAttributes = [REGISTRY_ASSOC_ATTR];

  /** Bind on attach (MOMENT 2): resolve the association and map the scoped registry through to the host. */
  attachedCallback(): void {
    this.#bind();
  }

  /** Re-bind if the `registry` value changes after attach. */
  attributeChangedCallback(attributeName: string): void {
    if (attributeName === REGISTRY_ASSOC_ATTR) this.#bind();
  }

  /** Whether a scoped registry was successfully resolved + applied (false until a declaration exists). */
  bound = false;

  #bind(): void {
    const host = this.target;
    const result = getActiveRegistryResult();
    if (!host || !result) {
      this.bound = false;
      return;
    }
    const registry = resolveScopedRegistry(result, host);
    if (!registry) {
      this.bound = false;
      return;
    }
    applyScopedRegistryToHost(host, registry);
    this.bound = true;
  }
}
