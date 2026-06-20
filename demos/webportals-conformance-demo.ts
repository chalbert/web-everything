/**
 * Web Portals conformance demo (#1152, final slice of epic #1001) — the runnable proof of the Web Portals
 * runtime contract in a REAL browser. A deeply nested component portals a modal/tooltip/toast to a
 * top-level outlet that escapes its stacking context, while two invariants the spec promises hold live:
 *
 *   - CONTEXT preservation — the portalled content resolves a context provided by a LOGICAL ancestor
 *     (its declaration site's ancestor), NOT by the outlet's physical DOM ancestors.
 *   - LOGICAL event bubbling — a click inside the portalled content fires a handler on the logical
 *     ancestor via `composedLogical`, retargeted into the logical (not physical) tree.
 *
 * Unlike the SSR slice (#1151, server-side vectors), this exercises the actual webportals plug
 * (`we:plugs/webportals/`) in the browser: the directive projects content into the outlet, `logicalParent`
 * links the projection to its declaration, and `dispatchLogical` walks the logical chain. The conformance
 * section asserts each invariant; `setPlaygroundReady` reports the pass count the e2e smoke reads.
 */
import {
  applyPatches,
  definePortalElements,
  getLogicalParent,
  addLogicalEventListener,
  dispatchLogical,
  PortalDirective,
} from '/plugs/webportals/index.ts';
import type { PortalOutlet } from '/plugs/webportals/index.ts';
import { setPlaygroundReady } from '/demos/playground-harness';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(c);
  return node;
}

/**
 * Walk the LOGICAL ancestry for the nearest provider of `key` — an in-demo `getContext`. At each hop the
 * logical parent is the explicit logical link if one exists (the portal boundary), else the DOM parent (an
 * un-portalled element's logical parent IS its DOM parent). So a portalled node threads back through its
 * declaration site, NOT its physical outlet — which is the whole point of the logical tree.
 */
function getContextViaLogical(start: Element, key: string): string | null {
  let cur: Element | null = start;
  while (cur) {
    const v = cur.getAttribute?.(`data-ctx-${key}`);
    if (v != null) return v;
    cur = getLogicalParent(cur) ?? cur.parentElement;
  }
  return null;
}

/** Walk the PHYSICAL DOM ancestry for the same key — used to PROVE the context came via logical, not physical. */
function getContextViaDom(start: Element, key: string): string | null {
  const hit = start.closest(`[data-ctx-${key}]`);
  return hit ? hit.getAttribute(`data-ctx-${key}`) : null;
}

interface Scene {
  /** The top-level outlet the portal escapes into (sibling of the clipped stack). */
  outlet: PortalOutlet;
  /** The deep declaration card — the LOGICAL ancestor + the context provider. */
  card: HTMLElement;
  /** The portalled modal content (physically in the outlet, logically under `card`). */
  modal: HTMLElement;
  /** The clipping/transformed ancestor the modal must visually escape. */
  clip: HTMLElement;
}

/**
 * Build the live scene: a `.clip` ancestor (a CSS-transformed, overflow-hidden stacking context) holding a
 * deeply nested `.card` that declares a portal whose content targets a TOP-LEVEL outlet. After connect, the
 * modal is physically in the outlet (escaped the clip) but logically still under the card.
 */
function buildScene(host: HTMLElement): Scene {
  const outlet = document.createElement('portal-outlet') as PortalOutlet;
  outlet.id = 'wp-outlet';

  const card = el('section', { class: 'wp-card', 'data-ctx-theme': 'midnight', 'data-ctx-user': 'ada' });
  card.append(el('h3', {}, 'Deeply nested card (logical ancestor + context provider)'));

  // The portalled modal content — created up-front so we can reference it after projection.
  const modal = el('div', { class: 'wp-modal', role: 'dialog' });
  modal.append(
    el('p', {}, 'Modal portalled to a top-level outlet — escaped the clip, kept its logical home.'),
    el('button', { class: 'wp-modal-btn', type: 'button' }, 'Act (logical bubble →)'),
  );

  // The portal directive: a customized <template is="portal-directive"> targeting the outlet by id. The
  // projected content goes in the template's `.content` (its canonical home — where the HTML parser also
  // puts a declarative `<template>`'s children). We populate it directly rather than via the `{children}`
  // constructor option: that option appends from an INSTANCE-property connectedCallback, but the browser
  // invokes the PROTOTYPE connectedCallback cached at define() time, so the option is a no-op in a real
  // browser (it works only under jsdom). Tracked as a webdirectives follow-up (#1174).
  const portal = new PortalDirective({});
  portal.setAttribute('target', 'wp-outlet');
  portal.content.append(modal);

  // Nest the portal DEEP inside the clipped, transformed ancestor.
  const inner = el('div', { class: 'wp-inner' }, portal);
  card.append(inner);
  const clip = el('div', { class: 'wp-clip' }, el('div', { class: 'wp-clip-label' }, 'transform + overflow:hidden (clips its DOM children)'), card);

  // The outlet (the escape target, sibling of the clip) must be in the DOM BEFORE the portal connects, so
  // resolution is synchronous (present→attach) rather than deferred to the shared observer — the
  // conformance checks below run synchronously right after this returns.
  host.append(outlet);
  host.append(clip);
  return { outlet, card, modal, clip };
}

interface Check {
  title: string;
  run: (s: Scene) => boolean;
}

const CHECKS: Check[] = [
  {
    title: 'the portal relocates its content into the top-level outlet (escapes the clipped stacking context)',
    run: (s) => s.modal.parentElement === s.outlet && s.modal.closest('.wp-clip') === null,
  },
  {
    title: 'logicalParent of the portalled modal is its declaration site (not the physical outlet)',
    run: (s) => {
      const lp = getLogicalParent(s.modal);
      return lp !== null && lp !== s.outlet && s.card.contains(lp);
    },
  },
  {
    title: 'context resolves via LOGICAL ancestry — the modal sees the card’s context though mounted elsewhere',
    run: (s) => getContextViaLogical(s.modal, 'theme') === 'midnight' && getContextViaLogical(s.modal, 'user') === 'ada',
  },
  {
    title: 'the same context is NOT reachable via the physical DOM ancestry (proves it came through the logical tree)',
    run: (s) => getContextViaDom(s.modal, 'theme') === null,
  },
  {
    title: 'a click inside the portal bubbles to a handler on the LOGICAL ancestor (composedLogical retarget)',
    run: (s) => {
      const btn = s.modal.querySelector('.wp-modal-btn') as HTMLButtonElement;
      let sawTarget: Node | null = null;
      const handler = (e: Event) => { sawTarget = e.target as Node; };
      addLogicalEventListener(s.card, 'click', handler);
      dispatchLogical(btn, new MouseEvent('click', { bubbles: true }), { bubblesLogical: true, composedLogical: true });
      // The logical-ancestor handler fired, and the retargeted event.target is the button INSIDE the
      // portalled content (the logical tree) — not the physical outlet the modal is mounted in.
      return sawTarget !== null && s.modal.contains(sawTarget);
    },
  },
];

function runConformance(host: HTMLElement, scene: Scene): number {
  const summary = el('div', { class: 'summary' });
  host.append(summary);
  let pass = 0;
  for (const check of CHECKS) {
    let ok = false;
    try {
      ok = check.run(scene);
    } catch {
      ok = false;
    }
    if (ok) pass += 1;
    const card = el('div', { class: 'play-card wp-check' });
    const badge = el('span', { class: `badge ${ok ? 'pass' : 'fail'}` }, ok ? '✓ holds' : '✗ violated');
    card.append(badge, el('span', { class: 'wp-check-title' }, check.title));
    host.append(card);
  }
  summary.className = `summary ${pass === CHECKS.length ? 'pass' : 'fail'}`;
  summary.textContent = `${pass}/${CHECKS.length} webportals runtime invariants hold`;
  return pass;
}

function main(): void {
  const root = document.getElementById('play-root');
  if (!root) return;
  root.textContent = '';

  // Bring the webportals plug to life: logical-tree + logical-event patches, then define the elements.
  applyPatches();
  definePortalElements();

  const stage = el('section', { class: 'wp-stage' });
  stage.append(el('h2', {}, 'Live stage — a deep card portals a modal to a top-level outlet'));
  const scene = buildScene(stage);
  root.append(stage);

  const conformance = el('section', { class: 'wp-card-section' });
  conformance.append(el('h2', {}, 'Runtime conformance — Web Portals contract'));
  const passCount = runConformance(conformance, scene);
  root.append(conformance);

  setPlaygroundReady(passCount);
}

main();
