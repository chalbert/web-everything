/**
 * Web Positioning conformance demo (#1050, slice C of #1018) — the runnable proof of the
 * `PositioningStrategy` contract (#1048) in a real browser.
 *
 * The contract is type-only (`we:positioning/contract.ts`); the native CSS-anchor strategy + the JS
 * fallback + the `customPositioning` swap registry are impl and live in FUI. So, like the analytics demo's
 * recording stubs, this demo supplies its **own** in-demo `PositioningStrategy` — a small JS placement loop
 * — to prove the contract is realizable: a surface declares *intent* (a `Placement` + collision flags) and
 * the strategy realizes it and returns a reversible `PositioningTeardown`. The conformance section asserts
 * each contract invariant live; `setPlaygroundReady` reports the pass count the e2e smoke reads.
 */
import type {
  Placement,
  PlacementContext,
  PositioningStrategy,
  PositioningTeardown,
} from '/positioning/contract.ts';
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

/** The side a placement resolves to before alignment (`bottom-start` → `bottom`). */
type Side = 'top' | 'bottom' | 'left' | 'right';
const sideOf = (p: Placement): Side => p.split('-')[0] as Side;
const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

/**
 * An in-demo JS positioning strategy conforming to the contract: it places `surface` on the requested
 * side of `trigger` (flipping to the opposite side when the preferred one would overflow the viewport,
 * shifting along the axis to stay in view), records the strategy name on `data-positioning-strategy`, and
 * returns a teardown that restores every style it set — the contract's reversibility ruling.
 */
class JsPositioningStrategy implements PositioningStrategy {
  readonly name = 'js-fallback-demo';

  place(context: PlacementContext): PositioningTeardown {
    const { trigger, surface, placement, flip = true, shift = true } = context;
    // Snapshot every property we mutate so teardown restores the surface exactly.
    const saved = {
      position: surface.style.position,
      top: surface.style.top,
      left: surface.style.left,
      strategy: surface.dataset.positioningStrategy,
      side: surface.dataset.placedSide,
    };

    const t = trigger.getBoundingClientRect();
    const s = surface.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let side = sideOf(placement);

    // Flip when the preferred side overflows and the opposite has room.
    if (flip) {
      if (side === 'bottom' && t.bottom + s.height > vh && t.top - s.height >= 0) side = 'top';
      else if (side === 'top' && t.top - s.height < 0 && t.bottom + s.height <= vh) side = 'bottom';
      else if (side === 'right' && t.right + s.width > vw && t.left - s.width >= 0) side = 'left';
      else if (side === 'left' && t.left - s.width < 0 && t.right + s.width <= vw) side = 'right';
    }

    let top = side === 'bottom' ? t.bottom : side === 'top' ? t.top - s.height : t.top;
    let left = side === 'right' ? t.right : side === 'left' ? t.left - s.width : t.left;
    // Shift along the axis to keep the surface within the viewport.
    if (shift) {
      left = Math.max(0, Math.min(left, vw - s.width));
      top = Math.max(0, Math.min(top, vh - s.height));
    }

    surface.style.position = 'fixed';
    surface.style.top = `${Math.round(top)}px`;
    surface.style.left = `${Math.round(left)}px`;
    surface.dataset.positioningStrategy = this.name;
    surface.dataset.placedSide = side;

    return () => {
      surface.style.position = saved.position;
      surface.style.top = saved.top;
      surface.style.left = saved.left;
      if (saved.strategy === undefined) delete surface.dataset.positioningStrategy;
      else surface.dataset.positioningStrategy = saved.strategy;
      if (saved.side === undefined) delete surface.dataset.placedSide;
      else surface.dataset.placedSide = saved.side;
    };
  }
}

/** Build a trigger + surface pair positioned at `triggerStyle` for a check. */
function scene(triggerStyle: Partial<CSSStyleDeclaration>, surfaceSize = { w: 120, h: 80 }) {
  const stage = el('div', { class: 'wp-stage' });
  const trigger = el('button', { class: 'wp-trigger' }, 'trigger');
  const surface = el('div', { class: 'wp-surface' }, 'surface');
  Object.assign(trigger.style, { position: 'fixed', width: '80px', height: '32px' }, triggerStyle);
  Object.assign(surface.style, { width: `${surfaceSize.w}px`, height: `${surfaceSize.h}px` });
  stage.append(trigger, surface);
  document.body.append(stage);
  const ctx = (placement: Placement, extra: Partial<PlacementContext> = {}): PlacementContext => ({
    trigger,
    surface,
    placement,
    anchorName: '--wp-demo-anchor',
    ...extra,
  });
  return { stage, trigger, surface, ctx, cleanup: () => stage.remove() };
}

const strategy = new JsPositioningStrategy();

interface Check {
  title: string;
  run: () => boolean;
}

const CHECKS: Check[] = [
  {
    title: 'place() returns a PositioningTeardown function',
    run: () => {
      const { surface, ctx, cleanup } = scene({ top: '100px', left: '100px' });
      const teardown = strategy.place(ctx('bottom-start'));
      const ok = typeof teardown === 'function';
      teardown();
      cleanup();
      void surface;
      return ok;
    },
  },
  {
    title: 'the strategy name is reflected on data-positioning-strategy',
    run: () => {
      const { surface, ctx, cleanup } = scene({ top: '100px', left: '100px' });
      const teardown = strategy.place(ctx('bottom-start'));
      const ok = surface.dataset.positioningStrategy === strategy.name;
      teardown();
      cleanup();
      return ok;
    },
  },
  {
    title: 'a bottom placement positions the surface below its trigger',
    run: () => {
      const { trigger, surface, ctx, cleanup } = scene({ top: '100px', left: '100px' });
      const teardown = strategy.place(ctx('bottom-start'));
      const placed = surface.dataset.placedSide === 'bottom'
        && surface.getBoundingClientRect().top >= trigger.getBoundingClientRect().bottom - 1;
      teardown();
      cleanup();
      return placed;
    },
  },
  {
    title: 'a preferred side that overflows the viewport flips to the opposite side',
    run: () => {
      // Trigger pinned to the very bottom — a `bottom` placement has no room and must flip to `top`.
      const { surface, ctx, cleanup } = scene({ bottom: '2px', left: '100px' });
      const teardown = strategy.place(ctx('bottom-start', { flip: true }));
      const flipped = surface.dataset.placedSide === 'top';
      teardown();
      cleanup();
      return flipped;
    },
  },
  {
    title: 'shift keeps the surface within the viewport (never negative-left)',
    run: () => {
      // Trigger near the left edge with a wide surface — shift must clamp left to >= 0.
      const { surface, ctx, cleanup } = scene({ top: '100px', left: '0px' }, { w: 200, h: 60 });
      const teardown = strategy.place(ctx('left-start', { shift: true }));
      const left = parseFloat(surface.style.left);
      const ok = left >= 0;
      teardown();
      cleanup();
      return ok;
    },
  },
  {
    title: 'teardown is reversible — every mutated style + data-attr is restored',
    run: () => {
      const { surface, ctx, cleanup } = scene({ top: '100px', left: '100px' });
      const before = surface.getAttribute('style') ?? '';
      const teardown = strategy.place(ctx('bottom-start'));
      teardown();
      const restored = (surface.getAttribute('style') ?? '') === before
        && surface.dataset.positioningStrategy === undefined
        && surface.dataset.placedSide === undefined;
      cleanup();
      return restored;
    },
  },
];

function runConformance(host: HTMLElement): number {
  const summary = el('div', { class: 'summary' });
  host.append(summary);
  let pass = 0;
  for (const check of CHECKS) {
    let ok = false;
    try {
      ok = check.run();
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
  summary.textContent = `${pass}/${CHECKS.length} webpositioning contract invariants hold`;
  return pass;
}

function main(): void {
  const root = document.getElementById('play-root');
  if (!root) return;
  root.textContent = '';

  const conformance = el('section', { class: 'wp-card' });
  conformance.append(el('h2', {}, 'Runtime conformance — PositioningStrategy contract'));
  const passCount = runConformance(conformance);
  root.append(conformance);

  setPlaygroundReady(passCount);
}

main();
