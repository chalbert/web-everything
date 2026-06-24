/**
 * Cross-list reorder golden projections — the STORED expected DOM projection per fixture case (the #899
 * vector-conformance model), and the capture step that (re)generates them from the reference renderer.
 *
 * The cross-list (Tier-2) sibling of `./reorderable-list-goldens.ts`, same contract: per ratified
 * #1467 / #899, WE keeps the verifier + vector corpus + types and asserts a **stored golden output as
 * data — no live render in the assertion path**. A golden is the EXPECTED group DOM projection at a
 * case's contract state, captured ONCE as JSON-serializable data; `auditCrossListReorder`
 * (`../renderCrossListReorder.ts`) reads a root rebuilt from that golden (`goldenToRoot`, the inverse of
 * the capture step) and asserts it, never re-running `renderCrossListReorder` in the assertion path.
 *
 * The inputs live in `cross-list-reorder-cases.ts`, the frozen output lives in
 * `cross-list-reorder-goldens.json`, and a drift test asserts the committed JSON equals a fresh capture
 * — so the golden bytes are computed once and reviewed in the diff, never hand-guessed, and can never
 * silently go stale. `captureGolden` (which DOES render) is used ONLY to generate goldens.
 */
import {
  renderCrossListReorder,
  type CrossListConfig,
  type CrossListState,
  type ReorderItem,
} from '../renderCrossListReorder';
import { crossListReorderCases } from './cross-list-reorder-cases';
import goldensJson from './cross-list-reorder-goldens.json';

/** The shared group key every cross-list case renders under (matches the conformance suite's CONFIG). */
export const CROSS_LIST_GROUP = 'board';

/** One item's projected attributes — exactly what `auditCrossListReorder` reads off each `<li>`. */
export interface CrossListItemProjection {
  /** `data-reorder-id` — the stable identity. */
  id: string;
  /** `role` (the contract requires `option`). */
  role: string | null;
  /** `tabindex` — `'0'` on the group's single roving item, `'-1'` otherwise. */
  tabindex: string | null;
  /** Carries `data-reorder-grabbed` (the lifted card). */
  grabbed: boolean;
  /** Carries `preserve-on-move` (atomic relocation keeps the card's state across lists). */
  preserveOnMove: boolean;
}

/** One list's projected attributes — the `<ul reorderable role="listbox" scope="cross-list">` grounding. */
export interface CrossListListProjection {
  /** `data-list-id` — the list's stable identity / `reorder-group` member key. */
  id: string;
  /** `aria-label` — the list's accessible name. */
  ariaLabel: string | null;
  /** Carries the `reorderable` boolean attribute. */
  reorderable: boolean;
  /** `role` (the contract requires `listbox`). */
  role: string | null;
  /** `scope` (the contract requires `cross-list`). */
  scope: string | null;
  /** `reorder-group` — the shared group key. */
  reorderGroup: string | null;
  /** `tabindex` on the `<ul>` container itself — `'0'` for an empty active list (Option A), else null. */
  containerTabindex: string | null;
  /** The list's items in DOM order. */
  items: CrossListItemProjection[];
}

/** The stored DOM projection for one cross-list case — what the verifier asserts as DATA. */
export interface CrossListReorderGolden {
  id: string;
  /** `'DIV'`. */
  rootTag: string;
  /** `data-reorder-group` — the group key the wrapper carries. */
  group: string | null;
  /** The sibling lists in DOM order. */
  lists: CrossListListProjection[];
}

/** Serialize an already-rendered cross-list group root into a golden projection. Pure DOM reads. */
export function serializeGolden(id: string, root: HTMLElement): CrossListReorderGolden {
  const lists: CrossListListProjection[] = Array.from(root.querySelectorAll<HTMLElement>(':scope > ul')).map((ul) => ({
    id: ul.getAttribute('data-list-id') ?? '',
    ariaLabel: ul.getAttribute('aria-label'),
    reorderable: ul.hasAttribute('reorderable'),
    role: ul.getAttribute('role'),
    scope: ul.getAttribute('scope'),
    reorderGroup: ul.getAttribute('reorder-group'),
    containerTabindex: ul.getAttribute('tabindex'),
    items: Array.from(ul.querySelectorAll<HTMLElement>(':scope > li')).map((li) => ({
      id: li.getAttribute('data-reorder-id') ?? '',
      role: li.getAttribute('role'),
      tabindex: li.getAttribute('tabindex'),
      grabbed: li.hasAttribute('data-reorder-grabbed'),
      preserveOnMove: li.hasAttribute('preserve-on-move'),
    })),
  }));
  return { id, rootTag: root.tagName, group: root.getAttribute('data-reorder-group'), lists };
}

/**
 * CAPTURE STEP (generation only — never the assertion path). Render the case at its contract state via
 * the reference renderer and serialize the rendered group into a `CrossListReorderGolden`.
 */
export function captureGolden(id: string, items: ReorderItem[], config: CrossListConfig, state: CrossListState): CrossListReorderGolden {
  return serializeGolden(id, renderCrossListReorder(state.lists, items, config, state));
}

/** Build the complete golden set from the fixture cases — deterministic; the `*-goldens.json` source. */
export function buildGoldens(): CrossListReorderGolden[] {
  return crossListReorderCases.map((c) => captureGolden(c.id, c.items, { group: CROSS_LIST_GROUP }, c.expected));
}

/**
 * Reconstruct a cross-list group root FROM a stored golden — the inverse of {@link serializeGolden}.
 * Lets the conformance test assert the golden output AS DATA (build a root from the committed golden,
 * then run `auditCrossListReorder` over it) so the verifier is green WITHOUT a live WE
 * `renderCrossListReorder` in the assertion path. It re-materializes exactly the projection the verifier
 * reads (group wrapper, each list's grounding + container tabstop, each item's role/id/tabindex/grabbed/
 * preserve-on-move).
 */
export function goldenToRoot(golden: CrossListReorderGolden): HTMLElement {
  const group = document.createElement(golden.rootTag.toLowerCase());
  if (golden.rootTag !== 'DIV') return group; // honor a non-div golden verbatim (faithful inverse)
  group.className = 'reorder-group';
  if (golden.group != null) group.setAttribute('data-reorder-group', golden.group);

  for (const list of golden.lists) {
    const ul = document.createElement('ul');
    ul.className = 'reorderable-list';
    if (list.reorderable) ul.setAttribute('reorderable', '');
    if (list.role != null) ul.setAttribute('role', list.role);
    if (list.scope != null) ul.setAttribute('scope', list.scope);
    if (list.reorderGroup != null) ul.setAttribute('reorder-group', list.reorderGroup);
    ul.setAttribute('data-list-id', list.id);
    if (list.ariaLabel != null) ul.setAttribute('aria-label', list.ariaLabel);
    if (list.containerTabindex != null) ul.setAttribute('tabindex', list.containerTabindex);

    for (const item of list.items) {
      const li = document.createElement('li');
      if (item.role != null) li.setAttribute('role', item.role);
      li.setAttribute('data-reorder-id', item.id);
      if (item.preserveOnMove) li.setAttribute('preserve-on-move', '');
      if (item.tabindex != null) li.setAttribute('tabindex', item.tabindex);
      if (item.grabbed) li.setAttribute('data-reorder-grabbed', '');
      ul.append(li);
    }
    group.append(ul);
  }
  return group;
}

/** The committed, frozen goldens (the assertion source of truth). Keyed access via {@link goldenFor}. */
export const crossListReorderGoldens: readonly CrossListReorderGolden[] = goldensJson as readonly CrossListReorderGolden[];

/** Look up the committed golden for a case id (throws if absent — a missing golden is a corpus gap). */
export function goldenFor(id: string): CrossListReorderGolden {
  const g = crossListReorderGoldens.find((x) => x.id === id);
  if (!g) throw new Error(`No committed cross-list reorder golden for case "${id}" — run the capture step.`);
  return g;
}
