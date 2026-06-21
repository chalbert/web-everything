/**
 * Behavioral conformance-vector suite — `treegrid-arbitration` (#1461, the #1411 ruling).
 *
 * Treegrid is a hierarchy projection on the Data Grid, not a new block — the single net-new behaviour is
 * the **Right/Left arbitration** between hierarchy expand/collapse and grid cell-movement. These vectors
 * judge only the **observable** outcome (the focused row's `aria-expanded`, the active cell's position)
 * through the platform surface — never impl internals — so any treegrid impl is checkable against the rule.
 *
 * The rule (APG treegrid): Right on a COLLAPSED parent expands it; Right on an already-expanded parent (or
 * a leaf) moves to the next cell; Left on an EXPANDED parent collapses it; Left on a collapsed/leaf row
 * moves to the previous cell. The driver (downstream #899/#091) seeds a hierarchy, focuses a cell, presses
 * the key, and reads the result through ARIA + the active-cell position.
 */
import type { ConformanceVectorSuite } from './schema.js';

export const treegridArbitrationSuite: ConformanceVectorSuite = {
  standard: 'treegrid-arbitration',
  contract: '@webeverything/contracts/data-grid',
  vectors: [
    {
      id: 'treegrid-arbitration/right/expands-collapsed-parent',
      contract: '@webeverything/contracts/data-grid',
      description: 'Right on a collapsed parent row expands it (aria-expanded false→true); the active cell does NOT move.',
      steps: [
        { do: 'seedHierarchy', rows: [{ id: 'a', level: 1, expandable: true, expanded: false, children: ['a1'] }] },
        { do: 'focusCell', row: 'a', col: 0 },
        { do: 'pressKey', key: 'ArrowRight' },
      ],
      expect: { finalState: 'parent-expanded', aria: { 'aria-expanded': 'true' }, activeCell: { row: 'a', col: 0 } },
      observeVia: ['aria', 'activeCell'],
    },
    {
      id: 'treegrid-arbitration/right/expanded-parent-falls-back-to-cell-move',
      contract: '@webeverything/contracts/data-grid',
      description: 'Right on an already-expanded parent moves to the next cell (cell-movement fallback); aria-expanded unchanged.',
      steps: [
        { do: 'seedHierarchy', rows: [{ id: 'a', level: 1, expandable: true, expanded: true, children: ['a1'] }] },
        { do: 'focusCell', row: 'a', col: 0 },
        { do: 'pressKey', key: 'ArrowRight' },
      ],
      expect: { finalState: 'cell-moved', aria: { 'aria-expanded': 'true' }, activeCell: { row: 'a', col: 1 } },
      observeVia: ['aria', 'activeCell'],
    },
    {
      id: 'treegrid-arbitration/left/collapses-expanded-parent',
      contract: '@webeverything/contracts/data-grid',
      description: 'Left on an expanded parent collapses it (aria-expanded true→false); the active cell does NOT move.',
      steps: [
        { do: 'seedHierarchy', rows: [{ id: 'a', level: 1, expandable: true, expanded: true, children: ['a1'] }] },
        { do: 'focusCell', row: 'a', col: 0 },
        { do: 'pressKey', key: 'ArrowLeft' },
      ],
      expect: { finalState: 'parent-collapsed', aria: { 'aria-expanded': 'false' }, activeCell: { row: 'a', col: 0 } },
      observeVia: ['aria', 'activeCell'],
    },
    {
      id: 'treegrid-arbitration/left/leaf-falls-back-to-cell-move',
      contract: '@webeverything/contracts/data-grid',
      description: 'Left on a leaf row (not at the row start) moves to the previous cell (cell-movement fallback).',
      steps: [
        { do: 'seedHierarchy', rows: [{ id: 'a1', level: 2, expandable: false }] },
        { do: 'focusCell', row: 'a1', col: 1 },
        { do: 'pressKey', key: 'ArrowLeft' },
      ],
      expect: { finalState: 'cell-moved', activeCell: { row: 'a1', col: 0 } },
      observeVia: ['activeCell'],
    },
  ],
};
