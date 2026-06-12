/**
 * TreeSelectBehavior — reference runtime for the tree-select block (#296), the hierarchical member of the
 * droplist family. Realizes the `hierarchy` intent: a `role="tree"` of `role="treeitem"` /`role="group"`
 * with `aria-level` / `aria-setsize` / `aria-posinset`, Right/Left expand-then-descend / collapse-then-
 * ascend traversal, and node selection (the `selection` paradigm) with optional `cascade`. Native-first.
 *
 * Per #064's ruling it is thin trait selection over composed paradigms; this reference implements the
 * tree keyboard + ARIA directly (so the tree's Right/Left expand semantics don't fight a flat-list
 * selection handler) and exposes the selection as `aria-checked` + a `tree-change` event.
 */

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  /** Whether this node can be checked (a leaf coverage, or a selectable group). */
  selectable?: boolean;
}

export type TreeModel = 'single' | 'multiple';

export interface TreeSelectOptions {
  model?: TreeModel;
  /** Toggling a node toggles all its descendants; a partially-checked parent reads mixed. */
  cascade?: boolean;
  defaultExpanded?: boolean;
  onChange?: (selectedIds: string[]) => void;
}

interface Flat {
  node: TreeNode;
  level: number;
  parent: Flat | null;
  el: HTMLLIElement;
}

export class TreeSelectBehavior {
  private readonly model: TreeModel;
  private readonly cascade: boolean;
  private readonly selected = new Set<string>();
  private readonly flats: Flat[] = [];
  private active = 0;

  constructor(private readonly host: HTMLElement, private readonly nodes: TreeNode[], private readonly opts: TreeSelectOptions = {}) {
    this.model = opts.model ?? 'multiple';
    this.cascade = opts.cascade ?? false;
    host.innerHTML = '';
    const root = document.createElement('ul');
    root.setAttribute('role', 'tree');
    this.buildLevel(root, nodes, 1, null, opts.defaultExpanded ?? false);
    host.append(root);
    this.refreshRoving();

    host.addEventListener('click', (e) => this.onClick(e));
    host.addEventListener('keydown', (e) => this.onKey(e));
  }

  private buildLevel(container: HTMLElement, nodes: TreeNode[], level: number, parent: Flat | null, expanded: boolean): void {
    nodes.forEach((node, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'treeitem');
      li.setAttribute('aria-level', String(level));
      li.setAttribute('aria-setsize', String(nodes.length));
      li.setAttribute('aria-posinset', String(i + 1));
      li.dataset.id = node.id;
      li.tabIndex = -1;
      const hasChildren = !!node.children?.length;
      if (hasChildren) li.setAttribute('aria-expanded', String(expanded));
      if (node.selectable) li.setAttribute('aria-checked', 'false');

      const row = document.createElement('span');
      row.className = 'tree-row';
      if (hasChildren) {
        const tw = document.createElement('span');
        tw.className = 'tree-twisty';
        tw.setAttribute('aria-hidden', 'true');
        tw.dataset.toggle = '';
        row.append(tw);
      }
      const label = document.createElement('span');
      label.className = 'tree-label';
      label.textContent = node.label;
      row.append(label);
      li.append(row);

      const flat: Flat = { node, level, parent, el: li };
      this.flats.push(flat);

      if (hasChildren) {
        const group = document.createElement('ul');
        group.setAttribute('role', 'group');
        group.hidden = !expanded;
        li.append(group);
        this.buildLevel(group, node.children!, level + 1, flat, expanded);
      }
      container.append(li);
    });
  }

  // ── visible-order helpers ───────────────────────────────────────────────────
  private isVisible(f: Flat): boolean {
    let p = f.parent;
    while (p) { if (p.el.getAttribute('aria-expanded') === 'false') return false; p = p.parent; }
    return true;
  }
  private visible(): Flat[] { return this.flats.filter((f) => this.isVisible(f)); }
  private flatOf(el: HTMLElement): Flat | undefined { return this.flats.find((f) => f.el === el); }

  private refreshRoving(): void {
    const vis = this.visible();
    this.active = Math.max(0, Math.min(this.active, vis.length - 1));
    this.flats.forEach((f) => { f.el.tabIndex = f === vis[this.active] ? 0 : -1; });
  }
  private focusActive(): void {
    const vis = this.visible();
    const f = vis[this.active];
    if (f) { this.flats.forEach((x) => { x.el.tabIndex = x === f ? 0 : -1; }); f.el.focus(); }
  }

  // ── expand / collapse ───────────────────────────────────────────────────────
  private setExpanded(f: Flat, open: boolean): void {
    if (f.el.getAttribute('aria-expanded') == null) return;
    f.el.setAttribute('aria-expanded', String(open));
    const group = f.el.querySelector(':scope > ul[role="group"]') as HTMLElement | null;
    if (group) group.hidden = !open;
    this.refreshRoving();
  }

  // ── selection ───────────────────────────────────────────────────────────────
  private descendants(f: Flat): Flat[] {
    return this.flats.filter((x) => { let p = x.parent; while (p) { if (p === f) return true; p = p.parent; } return false; });
  }
  private setChecked(f: Flat, on: boolean): void {
    if (!f.node.selectable && !this.cascade) return;
    if (this.model === 'single' && on) { this.selected.clear(); }
    const apply = (g: Flat) => {
      if (!g.node.selectable) return;
      if (on) this.selected.add(g.node.id); else this.selected.delete(g.node.id);
    };
    apply(f);
    if (this.cascade) this.descendants(f).forEach(apply);
    this.syncChecks();
    this.opts.onChange?.(this.getSelected());
    this.host.dispatchEvent(new CustomEvent('tree-change', { detail: { selected: this.getSelected() }, bubbles: true }));
  }
  private syncChecks(): void {
    for (const f of this.flats) {
      if (f.el.getAttribute('aria-checked') == null && !this.cascade) continue;
      const kids = this.descendants(f).filter((d) => d.node.selectable);
      if (this.cascade && kids.length) {
        const on = kids.filter((k) => this.selected.has(k.node.id)).length;
        const state = on === 0 ? 'false' : on === kids.length ? 'true' : 'mixed';
        f.el.setAttribute('aria-checked', state);
      } else if (f.node.selectable) {
        f.el.setAttribute('aria-checked', String(this.selected.has(f.node.id)));
      }
    }
  }
  private toggle(f: Flat): void {
    const checked = f.el.getAttribute('aria-checked');
    this.setChecked(f, checked !== 'true');
  }

  // ── events ──────────────────────────────────────────────────────────────────
  private onClick(e: Event): void {
    const li = (e.target as HTMLElement).closest<HTMLLIElement>('[role="treeitem"]');
    if (!li || !this.host.contains(li)) return;
    const f = this.flatOf(li);
    if (!f) return;
    this.active = this.visible().indexOf(f);
    if ((e.target as HTMLElement).closest('[data-toggle]')) {
      this.setExpanded(f, f.el.getAttribute('aria-expanded') === 'false');
    } else if (f.node.selectable || (this.cascade && f.node.children?.length)) {
      this.toggle(f);
    } else if (f.node.children?.length) {
      this.setExpanded(f, f.el.getAttribute('aria-expanded') === 'false');
    }
    this.focusActive();
  }

  private onKey(e: KeyboardEvent): void {
    const vis = this.visible();
    const f = vis[this.active];
    if (!f) return;
    const expanded = f.el.getAttribute('aria-expanded');
    switch (e.key) {
      case 'ArrowDown': this.active = Math.min(this.active + 1, vis.length - 1); break;
      case 'ArrowUp': this.active = Math.max(this.active - 1, 0); break;
      case 'Home': this.active = 0; break;
      case 'End': this.active = vis.length - 1; break;
      case 'ArrowRight':
        if (expanded === 'false') { this.setExpanded(f, true); } // expand
        else if (expanded === 'true') { this.active = Math.min(this.active + 1, vis.length - 1); } // descend
        break;
      case 'ArrowLeft':
        if (expanded === 'true') { this.setExpanded(f, false); } // collapse
        else if (f.parent) { this.active = this.visible().indexOf(f.parent); } // ascend
        break;
      case ' ': case 'Enter':
        if (f.node.selectable || (this.cascade && f.node.children?.length)) this.toggle(f);
        else if (f.node.children?.length) this.setExpanded(f, expanded === 'false');
        break;
      default: return;
    }
    e.preventDefault();
    this.refreshRoving();
    this.focusActive();
  }

  // ── public API ──────────────────────────────────────────────────────────────
  getSelected(): string[] { return [...this.selected]; }
  setSelected(ids: string[]): void {
    this.selected.clear();
    ids.forEach((id) => this.selected.add(id));
    this.syncChecks();
  }
}

export function registerTreeSelect(): void {
  /* intentionally empty — the behavior is consumed directly */
}
