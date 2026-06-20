/**
 * Web Directives: Virtual Elements demo (#1134, webdirectives completion #1098).
 *
 * Proves the layout-preserving "virtual element" claim of the webdirectives spec
 * (`we:src/_includes/project-webdirectives.njk` §case-study) end to end in a real browser, wiring the two
 * primitives the #1098 cluster shipped:
 *
 *   - `CustomCommentRegistry` (#1131) — `define`s `control:if` / `control:for-each` and `upgrade()`s the
 *     document's comment nodes onto those `CustomComment` (#1130) subclasses, invoking `connectedCallback`.
 *   - `defaultCommentParser` (#1132) — turns each opening marker's text (`control:if when="showMiddle"`)
 *     into `{ name, options }`; the registry's bare `upgrade` only seeds `options = {}`, so each directive
 *     re-parses its own `this.data` here (the same parser the parser registry consumes).
 *
 * The directives are expressed as REAL HTML comment markers in the page (`<!-- control:if … -->` …
 * `<!-- /control:if -->`), so they add zero element nodes to the layout tree: the 3-column CSS Grid keeps
 * its direct parent→child relationship whether the conditional card is shown or hidden — the thing a
 * framework `<If>` wrapper element breaks.
 *
 * Native `.ts` (not the `.tsx` JSX dialect): this exercises a plug (comment-node directives), not block
 * rendering, so plain DOM APIs are the right substrate (demo-workflow.md allows `.ts` for non-block demos).
 */
import {
  CustomComment,
  CustomCommentRegistry,
  defaultCommentParser,
} from '/plugs/webdirectives/index';

// --- Demo data the for-each directive renders ----------------------------------------------------------
const MEMBERS = [
  { name: 'Alice Chen', role: 'Lead Engineer' },
  { name: 'Bob Martinez', role: 'Designer' },
  { name: 'Carol Park', role: 'Backend Dev' },
];

const DATA: Record<string, unknown> = { members: MEMBERS };

/** The opening directive comment for a given name whose closing marker (`/name`) is a later sibling. */
function closingMarkerOf(open: Comment, name: string): Comment | null {
  let node: ChildNode | null = open.nextSibling;
  while (node) {
    if (node.nodeType === Node.COMMENT_NODE) {
      const text = (node as Comment).data.trim();
      if (text === `/${name}`) return node as Comment;
    }
    node = node.nextSibling;
  }
  return null;
}

/** Remove every node strictly between two sibling markers (the directive's rendered region). */
function clearBetween(open: Comment, close: Comment): void {
  let node = open.nextSibling;
  while (node && node !== close) {
    const next = node.nextSibling;
    node.remove();
    node = next;
  }
}

/** Re-parse a directive comment's own text into options via the shipped default parser (#1132). */
function optionsOf(comment: Comment): Record<string, unknown> {
  return defaultCommentParser.parse(comment.data.trim())?.options ?? {};
}

/**
 * `control:if` — shows/hides the nodes between `<!-- control:if when="key" -->` and `<!-- /control:if -->`
 * by reading the boolean `DATA[key]`. The markers are comments, so toggling adds/removes no wrapper node.
 */
class ControlIf extends CustomComment {
  connectedCallback(): void {
    this.render();
  }

  /** Capture the conditional region's nodes once, then attach/detach them based on the `when` flag. */
  private captured: ChildNode[] | null = null;

  render(): void {
    const close = closingMarkerOf(this, 'control:if');
    if (!close) return;
    const when = String(optionsOf(this).when ?? '');
    const show = Boolean(DATA[when]);

    if (this.captured === null) {
      // First render: remember the authored region so we can re-attach it later.
      const region: ChildNode[] = [];
      let node = this.nextSibling;
      while (node && node !== close) {
        region.push(node);
        node = node.nextSibling;
      }
      this.captured = region;
    }

    if (show) {
      // Re-insert the captured region before the closing marker (if not already present).
      if (!this.captured[0]?.isConnected) {
        for (const node of this.captured) close.parentNode?.insertBefore(node, close);
      }
    } else {
      clearBetween(this, close);
    }
  }
}

/**
 * `control:for-each` — stamps one `<li>` per item of `DATA[items]` between its open/close markers, again
 * with no wrapping element: the `<ul>`'s only element children are the produced rows.
 */
class ControlForEach extends CustomComment {
  connectedCallback(): void {
    this.render();
  }

  render(): void {
    const close = closingMarkerOf(this, 'control:for-each');
    if (!close) return;
    clearBetween(this, close);
    const key = String(optionsOf(this).items ?? '');
    const items = (DATA[key] as Array<{ name: string; role: string }>) ?? [];
    for (const item of items) {
      const li = document.createElement('li');
      li.className = 'member';
      li.dataset.test = 'member';
      li.innerHTML = `<span class="member-name"></span><span class="member-role"></span>`;
      (li.querySelector('.member-name') as HTMLElement).textContent = item.name;
      (li.querySelector('.member-role') as HTMLElement).textContent = item.role;
      close.parentNode?.insertBefore(li, close);
    }
  }
}

// --- Wire up: one registry, two directives, one upgrade walk -------------------------------------------
const customComments = new CustomCommentRegistry();
customComments.define('control:if', ControlIf as unknown as typeof CustomComment & (new () => CustomComment));
customComments.define(
  'control:for-each',
  ControlForEach as unknown as typeof CustomComment & (new () => CustomComment),
);

function readouts(): void {
  const grid = document.querySelector<HTMLElement>('[data-test="card-grid"]');
  const gridReadout = document.querySelector<HTMLElement>('[data-test="grid-readout"]');
  if (grid && gridReadout) {
    const directChildren = grid.children.length; // element children only — comments excluded
    gridReadout.textContent = `grid element children: ${directChildren} (markers are comments, not nodes)`;
  }
  const memberReadout = document.querySelector<HTMLElement>('[data-test="member-readout"]');
  const list = document.querySelector<HTMLElement>('[data-test="member-list"]');
  if (memberReadout && list) {
    memberReadout.textContent = `list element children: ${list.children.length} (rows only — no wrapper)`;
  }
}

function init(): void {
  customComments.upgrade(document.body);
  readouts();

  // Toggle re-runs the control:if directive — the comment marker stays put; only its region appears/hides.
  const toggle = document.querySelector<HTMLInputElement>('[data-test="toggle-middle"]');
  const ifMarker = findOpeningMarker('control:if');
  toggle?.addEventListener('change', () => {
    DATA.showMiddle = toggle.checked;
    (ifMarker as ControlIf | null)?.render();
    readouts();
  });

  (window as unknown as { demoReady?: boolean }).demoReady = true;
}

/** The first upgraded opening directive comment for a name (for the toggle to re-render). */
function findOpeningMarker(name: string): Comment | null {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
  let node = walker.nextNode();
  while (node) {
    if ((node as Comment).data.trim().startsWith(name)) return node as Comment;
    node = walker.nextNode();
  }
  return null;
}

DATA.showMiddle = true;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
