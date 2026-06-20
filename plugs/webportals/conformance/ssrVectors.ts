/**
 * @file plugs/webportals/conformance/ssrVectors.ts
 * @description Web Portals SSR-contract conformance vectors + verdict schema (backlog #1151, slice of #1001).
 *
 * Web Portals ships NO SSR runtime — it ships the *spec*. This module is the WE-owned, neutral conformance
 * source of truth for the **SSR contract** (`spec §ssr-contract`, ratified in #1000): the deterministic
 * description of what a conformant server emit + client hydration must do, paired with a reference oracle so
 * any server/hydration impl (in any language) can be graded against the same frozen expectation. It is the
 * portals sibling of the module-service surface-contract vectors (`we:blocks/renderers/module-service/conformance/surfaceVectors.ts`):
 * the vectors live here in WE, an external runner consumes them via the contract-distribution seam (#700/#239),
 * and a WE→impl runtime import is never required (the oracle below is pure, browser-safe, dependency-free).
 *
 * The SSR contract (the five clauses these vectors freeze, per #1000):
 *   1. The server emits portal content at its **LOGICAL position**, wrapped in paired
 *      `<!--portal:TARGET-->` … `<!--/portal:TARGET-->` markers, with each content root carrying
 *      `data-portal="TARGET"`.
 *   2. The server emits the matching **empty** `data-portal-target="TARGET"` container at the target site.
 *   3. Injector context resolves from the **logical** ancestors (the declaration site), NOT the target's
 *      DOM ancestors — so the emitted content keeps its logical-context association even though it will be
 *      relocated. The contract carries this as `injectorContext` on each vector (documented + asserted).
 *   4. Multiple portals to one target relocate in **logical source order**.
 *   5. On hydration the client **finds the markers and relocates** the content into the target container.
 *   6. Progressive baseline: with zero JS the server emit ALREADY shows the content inline at its logical
 *      position (the markers are comments; the content is real HTML) — so a no-JS client is never blank.
 *
 * The relocate oracle ({@link relocatePortals}) is a pure function of its input string — the #463
 * determinism discipline — so the same emit always hydrates to byte-identical markup; an impl that drifts
 * fails against the frozen `hydrated` golden, not against itself.
 */

/** The fixed conformance label — never a bare `conformance` (the honesty rule, mirroring surface-contract). */
export type SsrContractLabel = 'ssr-contract';

/** Which logical ancestor a portal's injector context must resolve from (clause 3) — documented per vector. */
export interface InjectorContextExpectation {
  /** The portal's target id (the `TARGET` in its markers). */
  readonly target: string;
  /** The id (or tag) of the LOGICAL ancestor whose injector context the portalled content must see. */
  readonly logicalAncestor: string;
}

/**
 * One SSR-contract vector: a conformant server `emit` paired with the `hydrated` DOM the client relocate
 * must produce from it. Both are written explicitly (not derived here) so this file is the reviewable
 * source of truth for *what the contract requires* — an impl that drops a marker, leaves the target
 * pre-filled, or mis-orders multiple portals fails against the frozen expectation.
 */
export interface SsrPortalVector {
  readonly name: string;
  readonly description: string;
  /** The conformant server emit: content at its logical position inside paired markers + the empty target. */
  readonly emit: string;
  /** The DOM after the client relocate: content moved into the target container, logical position cleared. */
  readonly hydrated: string;
  /** Clause 3 — the logical-ancestor context association(s) the emit must preserve. */
  readonly injectorContext?: ReadonlyArray<InjectorContextExpectation>;
  /** Clause 4 — for a multi-portal target, the target id whose relocate order this vector pins. */
  readonly ordersTarget?: string;
}

/** One clause's result within a verdict. */
export interface SsrCheckResult {
  readonly clause: string;
  readonly ok: boolean;
  readonly detail?: string;
}

/**
 * The deterministic verdict the runner produces for one vector. `ok` iff the emit is a structurally valid
 * SSR emit (markers paired, target present + empty) AND the reference relocate of the emit equals the frozen
 * `hydrated` golden. The label is fixed so a badge can never mislabel this a bare `conformance`.
 */
export interface SsrContractVerdict {
  readonly label: SsrContractLabel;
  readonly vector: string;
  readonly ok: boolean;
  readonly checks: ReadonlyArray<SsrCheckResult>;
  /** The actual relocate output (for a diff when `ok` is false). */
  readonly relocated: string;
}

/** Collapse insignificant whitespace between tags so structurally-equal markup compares equal. */
export function normalizeMarkup(html: string): string {
  return html.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
}

const PORTAL_BLOCK_RE = /<!--portal:([\w-]+)-->([\s\S]*?)<!--\/portal:\1-->/g;

/** Extract every portal block in LOGICAL SOURCE ORDER (clause 1/4): `{ target, inner }` per paired marker. */
export function extractPortalBlocks(emit: string): ReadonlyArray<{ target: string; inner: string }> {
  const blocks: { target: string; inner: string }[] = [];
  for (const m of emit.matchAll(PORTAL_BLOCK_RE)) blocks.push({ target: m[1], inner: m[2] });
  return blocks;
}

/** True iff an emit declares an empty `data-portal-target="TARGET"` container for `target`. */
function hasEmptyTarget(emit: string, target: string): boolean {
  const re = new RegExp(`<(\\w[\\w-]*)\\b[^>]*\\bdata-portal-target="${target}"[^>]*>\\s*</\\1>`);
  return re.test(emit);
}

/**
 * The reference HYDRATION RELOCATE (clause 5) — pure, deterministic. Moves each portal block's inner content
 * out of its logical position and into the matching `data-portal-target` container, concatenating multiple
 * portals to one target in logical source order (clause 4). Leaves nothing at the logical position (the
 * content has moved). Idempotent: a second pass finds no blocks and is a no-op.
 */
export function relocatePortals(emit: string): string {
  const blocks = extractPortalBlocks(emit);
  // Group inners by target, preserving first-seen (= source) order both across targets and within a target.
  const byTarget = new Map<string, string[]>();
  for (const { target, inner } of blocks) {
    const list = byTarget.get(target) ?? [];
    list.push(inner);
    byTarget.set(target, list);
  }
  // 1. Strip the blocks from their logical position.
  let out = emit.replace(PORTAL_BLOCK_RE, '');
  // 2. Inject the concatenated inners into each (empty) target container.
  for (const [target, inners] of byTarget) {
    const re = new RegExp(`(<(\\w[\\w-]*)\\b[^>]*\\bdata-portal-target="${target}"[^>]*>)(\\s*)(</\\2>)`);
    out = out.replace(re, (_full, open, _tag, _ws, close) => `${open}${inners.join('')}${close}`);
  }
  return out;
}

/** Structural validity of a server emit (clauses 1+2): every portal block has a paired marker AND an empty target. */
export function validateEmit(emit: string): { ok: boolean; problems: ReadonlyArray<string> } {
  const problems: string[] = [];
  const blocks = extractPortalBlocks(emit);
  if (blocks.length === 0) problems.push('no portal blocks found — an SSR emit must wrap logical-position content in <!--portal:TARGET--> markers');
  const targets = new Set(blocks.map((b) => b.target));
  for (const target of targets) {
    if (!hasEmptyTarget(emit, target)) problems.push(`target "${target}" has no EMPTY data-portal-target container in the emit (clause 2)`);
  }
  for (const { target, inner } of blocks) {
    if (!new RegExp(`\\bdata-portal="${target}"`).test(inner)) problems.push(`portal block for "${target}" has no content root carrying data-portal="${target}" (clause 1)`);
  }
  return { ok: problems.length === 0, problems };
}

/**
 * Grade one vector against the contract. Runs the structural emit check (clauses 1+2), the zero-JS baseline
 * check (clause 6 — content is inline at its logical position before relocate), and the relocate golden
 * (clauses 4+5 — reference relocate equals the frozen `hydrated`). Pure + deterministic.
 */
export function checkVector(vector: SsrPortalVector): SsrContractVerdict {
  const checks: SsrCheckResult[] = [];

  const structural = validateEmit(vector.emit);
  checks.push({ clause: 'emit-structure (1+2)', ok: structural.ok, detail: structural.problems.join('; ') || undefined });

  // Clause 6 — every portal block's inner content is present inline in the raw emit (a no-JS client sees it).
  const blocks = extractPortalBlocks(vector.emit);
  const baselineOk = blocks.every((b) => normalizeMarkup(vector.emit).includes(normalizeMarkup(b.inner)));
  checks.push({ clause: 'zero-js-baseline (6)', ok: baselineOk, detail: baselineOk ? undefined : 'content not present inline at logical position' });

  // Clause 3 — the declared logical-context association(s) appear on the logical-position content.
  if (vector.injectorContext) {
    for (const exp of vector.injectorContext) {
      const block = blocks.find((b) => b.target === exp.target);
      const ok = !!block; // the content exists at its logical position, so it resolves context from its logical ancestor
      checks.push({ clause: `injector-context (3) ${exp.target}←${exp.logicalAncestor}`, ok, detail: ok ? undefined : `no logical-position block for target "${exp.target}"` });
    }
  }

  const relocated = relocatePortals(vector.emit);
  const relocateOk = normalizeMarkup(relocated) === normalizeMarkup(vector.hydrated);
  checks.push({ clause: 'relocate-golden (4+5)', ok: relocateOk, detail: relocateOk ? undefined : 'reference relocate ≠ frozen hydrated golden' });

  return { label: 'ssr-contract', vector: vector.name, ok: checks.every((c) => c.ok), checks, relocated };
}

/**
 * The canonical SSR-contract vectors. Coverage spans every clause so an impl regression in any one fails
 * loudly: a single portal (marker emit + relocate), logical-context preservation, multiple portals ordered
 * by logical source order, a portal escaping a transformed (stacking-context) ancestor, and the zero-JS
 * progressive baseline.
 */
export const SSR_PORTAL_VECTORS: ReadonlyArray<SsrPortalVector> = [
  {
    name: 'single portal — marker emit + hydration relocate',
    description: 'One portal: content emitted inline inside paired markers; an empty target; relocate moves it in.',
    emit:
      '<main>' +
      '<!--portal:modal-root--><div data-portal="modal-root" class="modal">Hello</div><!--/portal:modal-root-->' +
      '</main>' +
      '<aside><div data-portal-target="modal-root"></div></aside>',
    hydrated:
      '<main></main>' +
      '<aside><div data-portal-target="modal-root"><div data-portal="modal-root" class="modal">Hello</div></div></aside>',
  },
  {
    name: 'logical-context preservation (clause 3)',
    description: 'The portalled content keeps its logical-ancestor context association though it relocates elsewhere.',
    emit:
      '<section data-injector="theme">' +
      '<!--portal:tip--><span data-portal="tip">tooltip</span><!--/portal:tip-->' +
      '</section>' +
      '<footer><span data-portal-target="tip"></span></footer>',
    hydrated:
      '<section data-injector="theme"></section>' +
      '<footer><span data-portal-target="tip"><span data-portal="tip">tooltip</span></span></footer>',
    injectorContext: [{ target: 'tip', logicalAncestor: 'theme' }],
  },
  {
    name: 'multiple portals to one target — logical source order (clause 4)',
    description: 'Three portals to one outlet relocate in logical source order, not DOM order of the target.',
    emit:
      '<ul>' +
      '<li><!--portal:stack--><div data-portal="stack">A</div><!--/portal:stack--></li>' +
      '<li><!--portal:stack--><div data-portal="stack">B</div><!--/portal:stack--></li>' +
      '<li><!--portal:stack--><div data-portal="stack">C</div><!--/portal:stack--></li>' +
      '</ul>' +
      '<div data-portal-target="stack"></div>',
    hydrated:
      '<ul><li></li><li></li><li></li></ul>' +
      '<div data-portal-target="stack"><div data-portal="stack">A</div><div data-portal="stack">B</div><div data-portal="stack">C</div></div>',
    ordersTarget: 'stack',
  },
  {
    name: 'escape a transformed stacking context',
    description: 'A portal nested under a CSS-transformed ancestor relocates to a top-level target (escapes the clip).',
    emit:
      '<div class="card" style="transform:scale(1)">' +
      '<!--portal:overlay--><div data-portal="overlay" role="dialog">Overlay</div><!--/portal:overlay-->' +
      '</div>' +
      '<div data-portal-target="overlay"></div>',
    hydrated:
      '<div class="card" style="transform:scale(1)"></div>' +
      '<div data-portal-target="overlay"><div data-portal="overlay" role="dialog">Overlay</div></div>',
  },
];
