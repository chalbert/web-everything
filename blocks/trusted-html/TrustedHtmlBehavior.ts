/**
 * TrustedHtmlBehavior — attribute behavior that enforces a Trusted Types policy on an
 * element's `innerHTML` mutations (#1140, graduating the orphan `trusted-html-behavior` block).
 *
 * This is the composable BEHAVIOR form of Trusted Types: an attribute you put on ANY element so
 * that subsequent string assignments to that element's `innerHTML` are routed through a
 * `TrustedHTMLPolicy.createHTML(...)` sink before they reach the DOM. It is distinct from — and
 * composes with — the `trusted-html` *element* block (the dedicated element form): the behavior
 * hardens an existing element's sink, the element block owns a dedicated structural form
 * (bias-toward-separation, #1041 per-block call: own, do not fold).
 *
 * Default registration name: trusted-html
 *
 * Native-first / graceful degradation (the platform IS the standard): when the
 * [Trusted Types API](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API) is
 * unavailable (`window.trustedTypes` absent — e.g. Firefox/Safari today, or any non-secure
 * context), the behavior is a no-op pass-through: assignments still work, they are simply not
 * routed through a `TrustedHTML` object. The hardening is an enhancement layered over the native
 * `innerHTML` sink, never a replacement for it, so a page that opts in keeps working everywhere.
 *
 * @module blocks/trusted-html
 *
 * @example
 * ```html
 * <!-- Any innerHTML assignment to this element is routed through a Trusted Types policy. -->
 * <div trusted-html data-test="sink"></div>
 * ```
 *
 * @example
 * ```html
 * <!-- Name the policy to reuse a shared, app-defined sanitizer policy. -->
 * <article trusted-html="article-html"></article>
 * ```
 */

import CustomAttribute from '@frontierui/plugs/webbehaviors/CustomAttribute';

/**
 * Minimal structural shape of the Trusted Types globals this behavior consumes. Declared locally
 * so the behavior type-checks without DOM-lib `TrustedTypes` ambient types (which are not yet in
 * every TS lib target) — it never widens or replaces the real platform object at runtime.
 */
interface TrustedTypePolicyLike {
  createHTML(input: string): unknown;
}
interface TrustedTypePolicyFactoryLike {
  createPolicy(
    name: string,
    rules: { createHTML: (input: string) => string },
  ): TrustedTypePolicyLike;
}

/** Default policy name when the attribute carries no value. */
const DEFAULT_POLICY_NAME = 'trusted-html';

/**
 * One shared policy per name, deduped process-wide. The Trusted Types API throws if you
 * `createPolicy` the same name twice, so many elements that opt into the same (default) policy must
 * resolve to one instance.
 */
const policyCache = new Map<string, TrustedTypePolicyLike | null>();

/**
 * Clear the per-name policy cache. Test-only seam: the cache is keyed by name and memoizes the
 * "Trusted Types unavailable → null" result, so a test that toggles `globalThis.trustedTypes`
 * between cases must reset it. Production code never calls this — a policy is created once per name.
 */
export function __resetPolicyCacheForTests(): void {
  policyCache.clear();
}

/** Read the platform Trusted Types factory if present (secure context + supporting engine). */
function getTrustedTypes(): TrustedTypePolicyFactoryLike | undefined {
  return (globalThis as { trustedTypes?: TrustedTypePolicyFactoryLike }).trustedTypes;
}

/**
 * Resolve (creating once) the named Trusted Types policy. Returns `null` when Trusted Types is
 * unavailable or the policy could not be created — callers treat `null` as the native pass-through.
 *
 * The default `createHTML` is an identity pass: this behavior's job is to ROUTE assignments through
 * a `TrustedHTML` sink (so a CSP `require-trusted-types-for 'script'` page accepts them and the sink
 * is auditable), not to sanitize. An app that wants sanitization registers its own policy of the
 * same name first (`trustedTypes.createPolicy('trusted-html', { createHTML: sanitize })`), which
 * this resolver then reuses.
 */
function resolvePolicy(name: string): TrustedTypePolicyLike | null {
  if (policyCache.has(name)) return policyCache.get(name) ?? null;

  const tt = getTrustedTypes();
  let policy: TrustedTypePolicyLike | null = null;
  if (tt) {
    try {
      policy = tt.createPolicy(name, { createHTML: (input: string) => input });
    } catch {
      // Name already created by the app (or disallowed by CSP `trusted-types` allow-list).
      // Fall back to native pass-through rather than throwing inside an attribute lifecycle.
      policy = null;
    }
  }
  policyCache.set(name, policy);
  return policy;
}

export default class TrustedHtmlBehavior extends CustomAttribute {
  /** Whether Trusted Types routing is active for this element (vs. native pass-through). */
  #active = false;

  /** Resolved policy name (attribute value, or the default). */
  #policyName: string = DEFAULT_POLICY_NAME;

  /** Whether this behavior owns the `innerHTML` override installed on the element (for teardown). */
  #installed = false;

  /** Is Trusted Types routing currently enforced on this element? */
  get active(): boolean {
    return this.#active;
  }

  /** The policy name this behavior routes through. */
  get policyName(): string {
    return this.#policyName;
  }

  connectedCallback(): void {
    const element = this.ownerElement;
    if (!element) return;

    this.#policyName = this.value.trim() || DEFAULT_POLICY_NAME;
    const policy = resolvePolicy(this.#policyName);

    // No Trusted Types support (or policy creation refused): native pass-through, nothing to install.
    if (!policy) {
      this.#active = false;
      return;
    }

    this.#install(element, policy);
    this.#active = true;
  }

  disconnectedCallback(): void {
    if (this.#installed && this.ownerElement) {
      // Restore the prototype `innerHTML` accessor by deleting our own-property override.
      delete (this.ownerElement as unknown as Record<string, unknown>).innerHTML;
      this.#installed = false;
    }
    this.#active = false;
  }

  /**
   * Install an own-property `innerHTML` accessor on the element that routes string assignments
   * through `policy.createHTML(...)` before delegating to the native prototype setter. Reading
   * `innerHTML`, and assigning an already-`TrustedHTML` value, both fall straight through.
   */
  #install(element: HTMLElement, policy: TrustedTypePolicyLike): void {
    const proto = Object.getPrototypeOf(element) as HTMLElement;
    const native = Object.getOwnPropertyDescriptor(
      Element.prototype,
      'innerHTML',
    ) ?? Object.getOwnPropertyDescriptor(proto, 'innerHTML');
    if (!native || !native.set || !native.get) return;

    const nativeGet = native.get;
    const nativeSet = native.set;

    Object.defineProperty(element, 'innerHTML', {
      configurable: true,
      enumerable: false,
      get(this: HTMLElement) {
        return nativeGet.call(this);
      },
      set(this: HTMLElement, value: unknown) {
        // A raw string is the case Trusted Types guards: route it through the policy. A value that
        // is already a TrustedHTML object passes straight through to the native sink.
        const trusted = typeof value === 'string' ? policy.createHTML(value) : value;
        nativeSet.call(this, trusted as string);
      },
    });
    this.#installed = true;
  }
}
