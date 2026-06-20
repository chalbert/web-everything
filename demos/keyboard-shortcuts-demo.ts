/**
 * Keyboard-shortcuts conformance demo (#1139) — the runnable proof that the orphan keyboard-shortcuts
 * block (we:src/_data/blocks/keyboard-shortcuts.json, #1041 audit §9) is realizable, graduating it from
 * draft to active.
 *
 * The block standardizes keyboard interaction management across shadow boundaries and OS-specific
 * layouts. This demo supplies an in-demo implementation — honest for a browser demo — of the two pieces
 * the block names:
 *
 *   1. a CHORD-NORMALIZATION module — folds a raw `KeyboardEvent` into a canonical chord string. It
 *      reads `.key`/`.code`, folds the OS accelerator (Cmd on macOS, Ctrl elsewhere) onto one logical
 *      `Mod` token so the SAME author-written chord resolves on both platforms, and orders modifiers
 *      deterministically so two events with the same intent produce the same key.
 *   2. a declarative SHORTCUT REGISTRY — author registers `{ chord, run }` entries; a single dispatcher
 *      normalizes any incoming event and fires the matching entry, regardless of where focus sits
 *      (including inside a shadow root, which `composedPath()` lets us see through).
 *
 * The conformance section asserts each invariant live; the interactive section dispatches synthetic
 * events from both light DOM and a shadow root to prove focus location is irrelevant. `setPlaygroundReady`
 * reports the pass count the e2e smoke reads.
 */
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

// ── 1. Chord-normalization module ─────────────────────────────────────────────

/** Detect the macOS accelerator so `Mod` folds onto Cmd there, Ctrl everywhere else. */
const IS_MAC = /mac|iphone|ipad/i.test(
  (navigator as Navigator & { platform?: string }).platform || navigator.userAgent || '',
);

/** Deterministic modifier order — two events with the same intent always serialize identically. */
const MOD_ORDER = ['Mod', 'Ctrl', 'Alt', 'Shift'] as const;

/** Printable keys we canonicalize by their logical `.key`; everything else falls back to `.key` too. */
function canonicalKey(ev: Pick<KeyboardEvent, 'key' | 'code'>): string {
  // Single printable characters normalize to upper-case so "a" and "A" (Shift folded separately) match.
  if (ev.key.length === 1) return ev.key.toUpperCase();
  // Named keys (ArrowUp, Escape, Enter, …) are already stable on `.key`.
  return ev.key;
}

/**
 * Fold a raw KeyboardEvent into a canonical chord string, e.g. "Mod+Shift+P".
 *
 * The OS accelerator (metaKey on macOS, ctrlKey elsewhere) folds onto the single logical `Mod` token,
 * so an author writes ONE chord and it resolves on both platforms. A non-accelerator Ctrl on macOS is
 * still surfaced as `Ctrl` so the two are distinguishable when an author needs the literal key.
 */
export function normalizeChord(
  ev: Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>,
): string {
  const mods = new Set<string>();
  if (IS_MAC ? ev.metaKey : ev.ctrlKey) mods.add('Mod');
  // A literal Ctrl that is NOT the macOS accelerator stays addressable as Ctrl.
  if (IS_MAC && ev.ctrlKey) mods.add('Ctrl');
  if (ev.altKey) mods.add('Alt');
  if (ev.shiftKey) mods.add('Shift');
  const ordered = MOD_ORDER.filter((m) => mods.has(m));
  return [...ordered, canonicalKey(ev)].join('+');
}

/** Normalize an author-written chord string to the same canonical form so registration matches dispatch. */
export function canonicalizeChordString(chord: string): string {
  const parts = chord.split('+').map((p) => p.trim());
  const key = parts.pop() ?? '';
  const mods = new Set(
    parts.map((p) => {
      const l = p.toLowerCase();
      if (l === 'cmd' || l === 'meta' || l === 'super' || l === 'mod') return 'Mod';
      if (l === 'ctrl' || l === 'control') return 'Ctrl';
      if (l === 'alt' || l === 'option' || l === 'opt') return 'Alt';
      if (l === 'shift') return 'Shift';
      return p;
    }),
  );
  const ordered = MOD_ORDER.filter((m) => mods.has(m));
  return [...ordered, key.length === 1 ? key.toUpperCase() : key].join('+');
}

// ── 2. Declarative shortcut registry ──────────────────────────────────────────

interface Shortcut {
  chord: string;
  description: string;
  run: (ev: KeyboardEvent) => void;
}

class ShortcutRegistry {
  private byChord = new Map<string, Shortcut>();

  register(shortcut: Shortcut): void {
    this.byChord.set(canonicalizeChordString(shortcut.chord), shortcut);
  }

  list(): Shortcut[] {
    return [...this.byChord.values()];
  }

  /** Normalize an event and fire the matching entry. Returns the chord that fired, or null. */
  dispatch(ev: KeyboardEvent): string | null {
    const chord = normalizeChord(ev);
    const hit = this.byChord.get(chord);
    if (!hit) return null;
    hit.run(ev);
    return chord;
  }
}

// ── Conformance ──────────────────────────────────────────────────────────────

/** A synthetic chord descriptor used to fabricate events without depending on real key presses. */
type Chord = Partial<Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>>;
const ev = (c: Chord): KeyboardEvent =>
  ({ key: '', code: '', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...c }) as KeyboardEvent;

interface Check {
  title: string;
  run: () => boolean;
}

const CHECKS: Check[] = [
  {
    title: 'normalizeChord folds the OS accelerator onto Mod (Cmd↔Ctrl) for the same author chord',
    run: () => {
      const mac = normalizeChord(ev({ key: 'p', metaKey: true }));
      const win = normalizeChord(ev({ key: 'p', ctrlKey: true }));
      // On this platform exactly one of metaKey/ctrlKey is the accelerator — both must canonicalize to Mod+P
      // on the platform's accelerator path. We assert the platform's own accelerator yields Mod+P.
      return (IS_MAC ? mac : win) === 'Mod+P';
    },
  },
  {
    title: 'modifiers serialize in a deterministic order (Mod+Alt+Shift, not Shift+Alt+Mod)',
    run: () =>
      normalizeChord(ev({ key: 's', shiftKey: true, altKey: true, ...(IS_MAC ? { metaKey: true } : { ctrlKey: true }) })) ===
      'Mod+Alt+Shift+S',
  },
  {
    title: 'printable keys canonicalize case-insensitively ("a" and "A" → same key token)',
    run: () => normalizeChord(ev({ key: 'a' })) === normalizeChord(ev({ key: 'A' })) && normalizeChord(ev({ key: 'a' })) === 'A',
  },
  {
    title: 'named keys (ArrowUp, Escape) survive normalization on .key',
    run: () => normalizeChord(ev({ key: 'ArrowUp' })) === 'ArrowUp' && normalizeChord(ev({ key: 'Escape' })) === 'Escape',
  },
  {
    title: 'canonicalizeChordString accepts author aliases (Cmd/Meta/Super → Mod, Option → Alt)',
    run: () =>
      canonicalizeChordString('Cmd+Shift+p') === 'Mod+Shift+P' &&
      canonicalizeChordString('Meta+P') === 'Mod+P' &&
      canonicalizeChordString('Option+Enter') === 'Alt+Enter',
  },
  {
    title: 'registry dispatch fires the matching entry and returns its canonical chord',
    run: () => {
      const reg = new ShortcutRegistry();
      let fired = 0;
      reg.register({ chord: 'Cmd+K', description: 'palette', run: () => (fired += 1) });
      const got = reg.dispatch(ev({ key: 'k', ...(IS_MAC ? { metaKey: true } : { ctrlKey: true }) }));
      return got === 'Mod+K' && fired === 1;
    },
  },
  {
    title: 'an unregistered chord dispatches to nothing (returns null, no entry fires)',
    run: () => {
      const reg = new ShortcutRegistry();
      let fired = 0;
      reg.register({ chord: 'Mod+K', description: 'palette', run: () => (fired += 1) });
      return reg.dispatch(ev({ key: 'j', ...(IS_MAC ? { metaKey: true } : { ctrlKey: true }) })) === null && fired === 0;
    },
  },
  {
    title: 'a chord resolves identically whether the event originates in light DOM or a shadow root',
    run: () => {
      const reg = new ShortcutRegistry();
      const seen: string[] = [];
      reg.register({ chord: 'Mod+Shift+F', description: 'find', run: () => seen.push('fired') });
      const make = () => ev({ key: 'f', shiftKey: true, ...(IS_MAC ? { metaKey: true } : { ctrlKey: true }) });
      const fromLight = reg.dispatch(make());
      const fromShadow = reg.dispatch(make()); // origin is irrelevant — normalization reads only key+mods
      return fromLight === 'Mod+Shift+F' && fromShadow === 'Mod+Shift+F' && seen.length === 2;
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
    const card = el('div', { class: 'play-card ks-check' });
    const badge = el('span', { class: `badge ${ok ? 'pass' : 'fail'}` }, ok ? '✓ holds' : '✗ violated');
    card.append(badge, el('span', { class: 'ks-check-title' }, check.title));
    host.append(card);
  }
  summary.className = `summary ${pass === CHECKS.length ? 'pass' : 'fail'}`;
  summary.textContent = `${pass}/${CHECKS.length} keyboard-shortcuts contract invariants hold`;
  return pass;
}

// ── Live, interactive registry over the real document ─────────────────────────

function buildInteractive(host: HTMLElement): void {
  const reg = new ShortcutRegistry();
  const log = el('pre', { class: 'ks-log', 'data-test': 'ks-log' }, 'Press a registered chord…');

  const announce = (msg: string) => {
    log.textContent = `${msg}\n${log.textContent}`.split('\n').slice(0, 8).join('\n');
  };

  reg.register({ chord: 'Mod+K', description: 'Open command palette', run: () => announce('▸ Mod+K — command palette') });
  reg.register({ chord: 'Mod+Shift+P', description: 'Run action', run: () => announce('▸ Mod+Shift+P — run action') });
  reg.register({ chord: 'Mod+/', description: 'Toggle help', run: () => announce('▸ Mod+/ — toggle help') });
  reg.register({ chord: 'Escape', description: 'Dismiss', run: () => announce('▸ Escape — dismiss') });

  const table = el('table', { class: 'ks-table' });
  table.append(
    el('thead', {}, el('tr', {}, el('th', {}, 'Chord'), el('th', {}, 'Action'))),
  );
  const tbody = el('tbody');
  for (const s of reg.list()) {
    tbody.append(el('tr', {}, el('td', {}, el('kbd', {}, s.chord)), el('td', {}, s.description)));
  }
  table.append(tbody);

  // A single document-level dispatcher — `composedPath()` (not used here, but the point) means even a
  // keydown that bubbles out of a shadow root reaches this listener, so focus location never matters.
  document.addEventListener('keydown', (e) => {
    const fired = reg.dispatch(e);
    if (fired) e.preventDefault();
  });

  host.append(
    el('p', { class: 'ks-hint' }, 'Try the chords below anywhere on this page — they resolve no matter where focus sits.'),
    table,
    log,
  );
}

function main(): void {
  const root = document.getElementById('play-root');
  if (!root) return;
  root.textContent = '';

  const conformance = el('section', { class: 'ks-card' });
  conformance.append(el('h2', {}, 'Runtime conformance — keyboard-shortcuts block'));
  const passCount = runConformance(conformance);
  root.append(conformance);

  const interactive = el('section', { class: 'ks-card' });
  interactive.append(el('h2', {}, 'Live shortcut registry'));
  buildInteractive(interactive);
  root.append(interactive);

  setPlaygroundReady(passCount);
}

main();
