/**
 * Composition-seam cases — the single source of the four sanctioned **HTML-first composition seams**
 * ratified in #1795 (rule `we:docs/agent/platform-decisions.md#composition-preserves-a11y-contract`).
 *
 * One a11y-complete base block — `<nav-item>` (a W3C APG Disclosure-Navigation part, per the
 * `we:demos/reveal-nav-conformance.ts` pattern) — is re-skinned four ways. The forms below ARE the real
 * authoring seams in-tree; the base block's a11y contract (its `<a>`, focus, keyboard, aria surface) is
 * **single-sourced on the base** and is touched **add-only** in every case — the ratified invariant.
 *
 * WE owns this seam *catalog* (the canonical authoring form + the add-only annotation), build-agnostic
 * so BOTH a demo and FUI's runtime/conformance can consume it — exactly as `component-cases.ts` is the
 * single source for the `<component>` seam. Per [we-zero-standard-implementation] WE ships **no runtime**
 * for these strategies: the `<component>` lowering, the `CustomAttribute` registry, and the scoped
 * custom-element registry runtimes all live in FUI; whether a given *composed* variant honors the
 * add-only contract is a **FUI/Plateau conformance-run concern**, not a WE per-strategy proof matrix
 * (composed tuples are not expressible in `we:conformance-vectors/schema.ts`). Sibling build slices:
 * #1832 (the contract statement), #1833 (the `nav-list` a11y vector corpus the base needs).
 */

/** The four sanctioned add-only composition strategies (the #1795 support-all set). */
export type CompositionStrategy =
  /** Shadow `<slot>` (named + default) + imperative `HTMLSlotElement.assign()` — the `<component>` form. */
  | 'slots'
  /** A `CustomAttribute` on a child decorates it (the HOC analog) — the most mature seam; e.g. `route:link`. */
  | 'decoration'
  /** Scoped custom-element registry + IDREF (#854, `#component-dc`) swaps a sub-part. */
  | 'scoped-replace'
  /** A userland convention (distinct tags + tree-shakable traits) — WE ships no primitive for it. */
  | 'abstract-split';

/**
 * Whether the seam's runtime mechanism is available now or is gated on a migration. `scoped-replace`
 * adopts #854's *ratified* contract but its runtime is **blocked on the webregistries FUI re-home**
 * (#901's registry runtime is not yet landed in FUI; see `we:backlog/1483-…`, `we:backlog/1545-…`).
 */
export type SeamRuntimeStatus = 'available' | 'blocked-on-webregistries-rehome';

export interface CompositionSeamCase {
  /** Stable id — the strategy plus a short case suffix. */
  readonly id: string;
  /** The sanctioned strategy this case demonstrates. */
  readonly strategy: CompositionStrategy;
  /** Whether this is a first-class WE-seamed strategy or a userland convention WE ships nothing for. */
  readonly tier: 'first-class' | 'userland-convention';
  /** Runtime availability of the seam mechanism. */
  readonly runtime: SeamRuntimeStatus;
  /** Human-facing one-liner on what the case re-skins and how it stays add-only. */
  readonly title: string;
  /** The in-tree seam this case rides — the real authoring mechanism, cited file-relative. */
  readonly seam: string;
  /** The canonical HTML authoring form, authored as text (the base is single-sourced; this only adds). */
  readonly usage: string;
  /**
   * What the seam **adds** to the base's a11y surface — never an override/removal. The add-only invariant
   * made concrete per case (`null` for the userland convention: it composes new tags, adds nothing to an
   * existing base's surface).
   */
  readonly addsToA11y: string | null;
  /** Optional note. */
  readonly note?: string;
}

/**
 * The one a11y-complete base, single-sourced. Its `<a>`, focus order, keyboard model and aria surface are
 * the base's job — every case below leaves this untouched and only *adds* via its slot/decoration/replace
 * injection points. Named + default `<slot>`s are the add-only injection seams (the `<component>` form,
 * `we:blocks/renderers/component/__fixtures__/component-cases.ts`).
 */
export const compositionBaseDef =
  `<component name="nav-item" shadow="open">\n` +
  `  <!-- a11y contract lives HERE, once: the <a>, focus, keyboard, aria are the base's job -->\n` +
  `  <a part="link"><slot name="icon"></slot><slot></slot><slot name="badge"></slot></a>\n` +
  `</component>`;

/**
 * The four sanctioned add-only re-skins of `compositionBaseDef`. Order follows the #1795 maturity
 * ordering used in the statute: decoration is the most mature, scoped-replace is sanctioned-but-blocked,
 * abstract-split is a userland convention with no WE primitive.
 */
export const compositionSeamCases: readonly CompositionSeamCase[] = [
  {
    id: 'slots/icon-badge',
    strategy: 'slots',
    tier: 'first-class',
    runtime: 'available',
    title: '1 · Slots — inject an icon + status badge with zero forking; the base <a>/a11y is inherited as-is',
    seam: 'blocks/renderers/component/__fixtures__/component-cases.ts (the <component> shadow-<slot> authoring form)',
    usage:
      `<nav-item href="/inbox">\n` +
      `  <svg slot="icon" aria-hidden="true">…</svg>\n` +
      `  Inbox\n` +
      `  <span slot="badge" aria-label="3 unread">3</span>\n` +
      `</nav-item>`,
    addsToA11y:
      'adds an aria-hidden decorative icon and an aria-labelled badge into named slots; the base <a> ' +
      'role/focus/keyboard are inherited unchanged. Dynamic sub-component slotting uses ' +
      "slotEl.assign(node) under slotAssignment:'manual'.",
  },
  {
    id: 'decoration/route-link',
    strategy: 'decoration',
    tier: 'first-class',
    runtime: 'available',
    title: '2 · Behavior/decoration (HOC analog, most mature) — a CustomAttribute on a child adds aria-current',
    seam: "blocks/router/registerRouter.ts:38 attributes.define('route:link', RouteLinkBehavior) → blocks/router/behaviors/RouteLinkBehavior.ts (#updateActiveState adds aria-current='page', add-only)",
    usage:
      `<nav-item>\n` +
      `  <a route:link href="/inbox">Inbox</a>   <!-- behavior adds aria-current="page"; add-only -->\n` +
      `</nav-item>`,
    addsToA11y:
      "adds aria-current='page' on the host <a> when the route matches and removes it when it does not; " +
      'it never strips or rewrites the base anchor a11y (RouteLinkBehavior.#updateActiveState).',
  },
  {
    id: 'scoped-replace/app-link',
    strategy: 'scoped-replace',
    tier: 'first-class',
    runtime: 'blocked-on-webregistries-rehome',
    title: '3 · Sub-component replacement (CustomLink analog) — scoped registry + IDREF swaps the internal link element',
    seam: 'scoped custom-element registry + IDREF, contract ratified #854 / codified `#component-dc`; runtime blocked on the webregistries FUI re-home (#901; we:backlog/1483-…, we:backlog/1545-…)',
    usage:
      `<scope registry="app-registry">\n` +
      `  <nav-item><a is="app-link" href="/inbox">Inbox</a></nav-item>  <!-- 'app-link' resolved in the scoped registry, not global -->\n` +
      `</scope>`,
    addsToA11y:
      "preserves the base anchor contract: the app's replacement element must itself satisfy the base " +
      'role/focus/keyboard; the scope swaps the implementation only, adding none and removing none of the ' +
      'base a11y surface (preserve-not-override).',
    note:
      'Sanctioned but BLOCKED on the webregistries FUI re-home: adopts #854 ratified scoped-registry+IDREF; ' +
      'do not re-decide it here. Native scoped registries default in Chromium 146 + Safari (whatwg/html#10854).',
  },
  {
    id: 'abstract-split/recomposed-internals',
    strategy: 'abstract-split',
    tier: 'userland-convention',
    runtime: 'available',
    title: '4 · Abstract-piece split — a userland convention: factor reusable internals so a new block recomposes them',
    seam: 'userland convention only — distinct tags (#023) + tree-shakable webtraits (#715); WE ships NO primitive for it',
    usage:
      `<!-- a SECOND block recomposes the same internals; not a re-skin of one base but a distinct tag -->\n` +
      `<nav-item-compact href="/inbox">Inbox</nav-item-compact>`,
    addsToA11y: null,
    note:
      'Not a WE primitive: the author factors the reusable internals (link part, disclosure trait) and a new ' +
      'distinct block recomposes them. Listed for completeness of the support-all set; WE ships nothing.',
  },
] as const;

/**
 * The Fork-1 **rejected** shape — kept as a negative example so a consumer can prove the boundary. `as`
 * rewrites the disclosure-nav into a menubar (forces `role=menuitem`, a different arrow-key/focus model),
 * which is *not* reachable add-only → it is **structural, a new component**, never a config flag on the
 * base. This is the contrast example that trips the actual a11y-contract-ownership fork test (#1795).
 */
export const compositionRejectedExample = {
  id: 'rejected/as-menubar',
  reason:
    "'as=\"menubar\"' rewrites the a11y contract (disclosure-nav → menubar: role=menuitem, different " +
    'arrow-key/focus model) — not reachable add-only, so it is a NEW component, not config on the base.',
  usage: `<nav-item as="menubar">Inbox</nav-item>`,
} as const;
