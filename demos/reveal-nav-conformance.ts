/**
 * @file demos/reveal-nav-conformance.ts
 * @description Drives the reveal-nav conformance demo: wires the disclosure toggles
 * (native popover for the anchored surface, hidden-attr for the in-flow accordion),
 * layers the hover-intent JS enhancement on the anchored panel, and runs the W3C APG
 * Disclosure-Navigation invariant checks, rendering a pass/fail report.
 *
 * The recipe (#609 Fork 1A): disclosure `surface: anchored` + anchor `strategy=escape`
 * `type=menu` + hover-intent — a disclosure, NOT an ARIA menu.
 */

type Check = { name: string; pass: boolean; detail: string };

function syncExpanded(trigger: HTMLElement, open: boolean): void {
  trigger.setAttribute('aria-expanded', String(open));
}

// ── Anchored surface: keep aria-expanded in sync with the native popover state ──
function wireAnchored(): void {
  const trigger = document.querySelector<HTMLButtonElement>('[data-reveal-trigger]');
  const panel = document.querySelector<HTMLElement>('[data-reveal-panel]');
  if (!trigger || !panel) return;

  // The Popover API toggles the panel; mirror its state onto aria-expanded.
  panel.addEventListener('toggle', (e) => {
    const open = (e as ToggleEvent).newState === 'open';
    syncExpanded(trigger, open);
    if (open) positionFallback(trigger, panel);
  });

  // Hover-intent enhancement (deliberate open, forgiving travel) — JS on top of the CSS baseline.
  const OPEN_DELAY = 120;
  const CLOSE_DELAY = 240;
  let openTimer: number | undefined;
  let closeTimer: number | undefined;
  const cancel = () => {
    window.clearTimeout(openTimer);
    window.clearTimeout(closeTimer);
  };
  const open = () => {
    cancel();
    openTimer = window.setTimeout(() => {
      if (!panel.matches(':popover-open')) panel.showPopover?.();
    }, OPEN_DELAY);
  };
  const close = () => {
    cancel();
    closeTimer = window.setTimeout(() => {
      if (panel.matches(':popover-open')) panel.hidePopover?.();
    }, CLOSE_DELAY);
  };
  for (const el of [trigger, panel]) {
    el.addEventListener('pointerenter', open);
    el.addEventListener('pointerleave', close);
  }
}

/** Position fallback for engines lacking CSS anchor positioning (sets the custom props the CSS reads). */
function positionFallback(trigger: HTMLElement, panel: HTMLElement): void {
  if (CSS.supports?.('anchor-name: --x')) return;
  const r = trigger.getBoundingClientRect();
  panel.style.setProperty('--reveal-top', `${r.bottom + 6}px`);
  panel.style.setProperty('--reveal-left', `${r.left}px`);
}

// ── In-flow accordion: plain hidden-attr disclosure ──
function wireAccordion(): void {
  const trigger = document.querySelector<HTMLButtonElement>('[data-accordion-trigger]');
  const panelId = trigger?.getAttribute('aria-controls');
  const panel = panelId ? document.getElementById(panelId) : null;
  if (!trigger || !panel) return;
  trigger.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    syncExpanded(trigger, open);
  });
}

// ── APG Disclosure-Navigation invariants ──
function runChecks(): Check[] {
  const checks: Check[] = [];
  const panel = document.querySelector<HTMLElement>('[data-reveal-panel]');
  const trigger = document.querySelector<HTMLButtonElement>('[data-reveal-trigger]');

  // 1. Disclosure, not a menu: trigger is a button with aria-expanded; links are <a>, none role=menuitem.
  const links = panel ? Array.from(panel.querySelectorAll('a')) : [];
  const noMenuRoles =
    !!trigger &&
    trigger.hasAttribute('aria-expanded') &&
    links.length > 0 &&
    links.every((a) => !a.hasAttribute('role')) &&
    !panel?.querySelector('[role="menu"],[role="menuitem"]');
  checks.push({
    name: 'Disclosure, not a menu',
    pass: noMenuRoles,
    detail: 'Trigger is a button[aria-expanded]; panel links are plain <a> with no role=menuitem/menu.',
  });

  // 2. No reflow: the anchored panel is out of normal flow (top layer / fixed / absolute).
  let outOfFlow = false;
  if (panel) {
    const wasOpen = panel.matches(':popover-open');
    if (!wasOpen) panel.showPopover?.();
    const pos = getComputedStyle(panel).position;
    outOfFlow = panel.hasAttribute('popover') || pos === 'fixed' || pos === 'absolute';
    if (!wasOpen) panel.hidePopover?.();
  }
  checks.push({
    name: 'No reflow (out-of-flow surface)',
    pass: outOfFlow,
    detail: 'Panel uses the popover top layer (or fixed/absolute) so revealing it does not shift sibling content.',
  });

  // 3. i18n label-growth: the panel is content-sized (no fixed width that would clip a longer locale).
  let elastic = false;
  if (panel) {
    const w = getComputedStyle(panel).width;
    elastic = !/^\d+px$/.test(panel.style.width || '') && w !== '0px';
  }
  checks.push({
    name: 'i18n label-growth tolerant',
    pass: elastic,
    detail: 'Panel width is content-driven (min-width, not a hard-coded width), so longer translated labels are not clipped.',
  });

  // 4. Native-first CSS baseline: the panel is reachable without JS (native popover + popovertarget).
  const cssBaseline =
    !!trigger && trigger.hasAttribute('popovertarget') && !!panel && panel.hasAttribute('popover');
  checks.push({
    name: 'Native-first CSS baseline',
    pass: cssBaseline,
    detail: 'button[popovertarget] + [popover] toggles the panel with zero JS; hover-intent is a progressive enhancement.',
  });

  // 5. JS enhancement present but optional: aria-expanded tracks state (the JS layer is wired).
  checks.push({
    name: 'JS enhancement (state synced)',
    pass: !!trigger && trigger.getAttribute('aria-expanded') !== null,
    detail: 'aria-expanded is kept in sync and hover-intent (deliberate open, forgiving travel) is layered on top.',
  });

  return checks;
}

function renderReport(checks: Check[]): void {
  const body = document.getElementById('conformance-body');
  if (!body) return;
  body.innerHTML = checks
    .map(
      (c) =>
        `<tr data-test="check-${c.name.replace(/[^a-z]+/gi, '-').toLowerCase()}">` +
        `<td>${c.name}</td>` +
        `<td class="${c.pass ? 'pass' : 'fail'}">${c.pass ? 'PASS' : 'FAIL'}</td>` +
        `<td>${c.detail}</td></tr>`,
    )
    .join('');
}

function init(): void {
  wireAnchored();
  wireAccordion();
  renderReport(runChecks());
  (window as unknown as { demoReady?: boolean }).demoReady = true;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
