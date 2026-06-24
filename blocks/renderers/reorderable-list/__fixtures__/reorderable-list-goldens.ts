/**
 * Reorderable List golden projections — the STORED expected DOM projection per fixture case (the #899
 * vector-conformance model), and the capture step that (re)generates them from the reference renderer.
 *
 * Per ratified #1467 / #899 (and the #1356 pagination / #1494 data-table precedent): WE keeps the
 * reorderable-list verifier + vector corpus + types, and that verifier must assert a **stored golden
 * output as data — no live render in the assertion path**. A golden is the EXPECTED DOM projection at a
 * case's contract state, captured ONCE as plain JSON-serializable data; `auditReorderableList`
 * (`../renderReorderableList.ts`) reads a root rebuilt from that golden (`goldenToRoot`, the inverse of
 * the capture step) and asserts it, never re-running `renderReorderableList` in the assertion path.
 *
 * Sibling of the cross-list golden corpus next door (`./cross-list-reorder-goldens.ts`) and shaped like
 * the pagination/data-table goldens: the inputs live in `reorderable-list-cases.ts`, the frozen output
 * lives in `reorderable-list-goldens.json`, and a drift test asserts the committed JSON equals a fresh
 * capture — so the golden bytes are computed once and reviewed in the diff, never hand-guessed, and can
 * never silently go stale. `captureGolden` (which DOES render) is used ONLY to generate goldens, never
 * in the assertion path.
 */
import {
  renderReorderableList,
  type ReorderItem,
  type ReorderState,
} from '../renderReorderableList';
import { reorderableListCases } from './reorderable-list-cases';
import goldensJson from './reorderable-list-goldens.json';

/** One item's projected attributes — exactly what `auditReorderableList` reads off each `<li>`. */
export interface ReorderItemProjection {
  /** `data-reorder-id` — the stable identity. */
  id: string;
  /** `role` (the contract requires `option`). */
  role: string | null;
  /** `tabindex` — `'0'` on the focused item (roving), `'-1'` otherwise. */
  tabindex: string | null;
  /** Carries `data-reorder-grabbed` (the lifted card). */
  grabbed: boolean;
  /** Carries `data-reorder-target` (the candidate landing slot). */
  target: boolean;
  /** Carries `preserve-on-move` (atomic relocation keeps the card's state). */
  preserveOnMove: boolean;
}

/** The stored DOM projection for one reorderable-list case — what the verifier asserts as DATA. */
export interface ReorderableListGolden {
  id: string;
  /** `'UL'`. */
  rootTag: string;
  /** Root carries the `reorderable` boolean attribute. */
  reorderable: boolean;
  /** Root `role` (the contract requires `listbox`). */
  role: string | null;
  /** Root `aria-label` (the configured accessible name, or null). */
  ariaLabel: string | null;
  /** The list items in DOM order. */
  items: ReorderItemProjection[];
}

/** Serialize an already-rendered reorderable-list root into a golden projection. Pure DOM reads. */
export function serializeGolden(id: string, root: HTMLElement): ReorderableListGolden {
  const items: ReorderItemProjection[] = Array.from(root.querySelectorAll<HTMLElement>(':scope > li')).map((li) => ({
    id: li.getAttribute('data-reorder-id') ?? '',
    role: li.getAttribute('role'),
    tabindex: li.getAttribute('tabindex'),
    grabbed: li.hasAttribute('data-reorder-grabbed'),
    target: li.hasAttribute('data-reorder-target'),
    preserveOnMove: li.hasAttribute('preserve-on-move'),
  }));
  return {
    id,
    rootTag: root.tagName,
    reorderable: root.hasAttribute('reorderable'),
    role: root.getAttribute('role'),
    ariaLabel: root.getAttribute('aria-label'),
    items,
  };
}

/**
 * CAPTURE STEP (generation only — never the assertion path). Render the case at its contract state via
 * the reference renderer and serialize the rendered root into a `ReorderableListGolden`. The verifier
 * does NOT call this; it reads the committed `reorderable-list-goldens.json`.
 */
export function captureGolden(id: string, items: ReorderItem[], state: ReorderState): ReorderableListGolden {
  return serializeGolden(id, renderReorderableList(items, {}, state));
}

/** Build the complete golden set from the fixture cases — deterministic; the `*-goldens.json` source. */
export function buildGoldens(): ReorderableListGolden[] {
  return reorderableListCases.map((c) => captureGolden(c.id, c.items, c.expected));
}

/**
 * Reconstruct a reorderable-list root FROM a stored golden — the inverse of {@link serializeGolden}.
 * Lets the conformance test assert the golden output AS DATA (build a root from the committed golden,
 * then run `auditReorderableList` over it) so the verifier is green WITHOUT a live WE
 * `renderReorderableList` in the assertion path. It re-materializes exactly the projection the verifier
 * reads (root grounding + each item's role/id/tabindex/grabbed/target/preserve-on-move).
 */
export function goldenToRoot(golden: ReorderableListGolden): HTMLElement {
  const root = document.createElement(golden.rootTag.toLowerCase());
  if (golden.rootTag !== 'UL') return root; // honor a non-ul golden verbatim (faithful inverse for negatives)
  root.className = 'reorderable-list';
  if (golden.reorderable) root.setAttribute('reorderable', '');
  if (golden.role != null) root.setAttribute('role', golden.role);
  if (golden.ariaLabel != null) root.setAttribute('aria-label', golden.ariaLabel);

  for (const item of golden.items) {
    const li = document.createElement('li');
    if (item.role != null) li.setAttribute('role', item.role);
    li.setAttribute('data-reorder-id', item.id);
    if (item.preserveOnMove) li.setAttribute('preserve-on-move', '');
    if (item.tabindex != null) li.setAttribute('tabindex', item.tabindex);
    if (item.grabbed) li.setAttribute('data-reorder-grabbed', '');
    if (item.target) li.setAttribute('data-reorder-target', '');
    root.append(li);
  }
  return root;
}

/** The committed, frozen goldens (the assertion source of truth). Keyed access via {@link goldenFor}. */
export const reorderableListGoldens: readonly ReorderableListGolden[] = goldensJson as readonly ReorderableListGolden[];

/** Look up the committed golden for a case id (throws if absent — a missing golden is a corpus gap). */
export function goldenFor(id: string): ReorderableListGolden {
  const g = reorderableListGoldens.find((x) => x.id === id);
  if (!g) throw new Error(`No committed reorderable-list golden for case "${id}" — run the capture step.`);
  return g;
}
