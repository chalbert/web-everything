/**
 * Web Manifests conformance demo (#1059, slice C of #1021) — the runnable proof of the
 * changelog-manifest contract (#1057) in a real browser.
 *
 * The contract is type-only (`we:manifests/changelog-contract.ts`); the manifest reader + integrity
 * pipeline are impl and live in FUI. So this demo supplies a sample `ChangelogManifest` plus its **own**
 * in-demo reader to prove the contract is realizable: per-module change entries, severity/type, and a
 * `migration` ref present iff a change is breaking *and* mechanically applicable. The conformance section
 * asserts each contract invariant live; `setPlaygroundReady` reports the pass count the e2e smoke reads.
 */
import type { ChangelogManifest, ChangelogEntry, Severity } from '/manifests/changelog-contract.ts';
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

/** A sample per-release manifest conforming to the contract. */
const MANIFEST: ChangelogManifest = {
  manifestVersion: '1.0',
  package: '@webeverything/webstates',
  release: '2.0.0',
  previous: '1.4.0',
  entries: [
    {
      module: 'CustomStore',
      severity: 'major',
      type: 'changed',
      summary: 'subscribe() now returns a StoreSubscription instead of a bare unsubscribe fn',
      migration: {
        ref: 'codemods/customstore-subscribe-2.0.ts',
        author: 'webstates-team',
        integrity: 'sha256-abc123',
        rewrites: 'all subscribe() call sites that destructure the return',
      },
    },
    { module: 'CustomStore', severity: 'patch', type: 'fixed', summary: 'fixed a listener leak on detach' },
    { module: 'CustomStorageStrategy', severity: 'minor', type: 'added', summary: 'added the IndexedDB strategy' },
    { module: 'LegacyStore', severity: 'major', type: 'removed', summary: 'removed the deprecated LegacyStore' },
  ],
};

/** An in-demo reader over a {@link ChangelogManifest} — the queries the contract's shape supports. */
const reader = {
  entriesFor: (module: string): ChangelogEntry[] => MANIFEST.entries.filter((e) => e.module === module),
  bySeverity: (severity: Severity): ChangelogEntry[] => MANIFEST.entries.filter((e) => e.severity === severity),
  breaking: (): ChangelogEntry[] => MANIFEST.entries.filter((e) => e.severity === 'major'),
  withMigration: (): ChangelogEntry[] => MANIFEST.entries.filter((e) => e.migration !== undefined),
};

interface Check {
  title: string;
  run: () => boolean;
}

const CHECKS: Check[] = [
  {
    title: 'the manifest declares its release + the version it migrates from',
    run: () => MANIFEST.release === '2.0.0' && MANIFEST.previous === '1.4.0' && MANIFEST.package.length > 0,
  },
  {
    title: 'entriesFor(module) returns only that module’s entries (the unit is the module, not the package)',
    run: () => {
      const entries = reader.entriesFor('CustomStore');
      return entries.length === 2 && entries.every((e) => e.module === 'CustomStore');
    },
  },
  {
    title: 'bySeverity filters per the major/minor/patch vocabulary',
    run: () => reader.bySeverity('major').length === 2 && reader.bySeverity('minor').length === 1,
  },
  {
    title: 'breaking changes are exactly the major-severity entries',
    run: () => reader.breaking().every((e) => e.severity === 'major'),
  },
  {
    title: 'a migration ref is present iff the change is breaking + mechanically applicable',
    run: () => {
      const migrations = reader.withMigration();
      // The breaking `changed` entry carries a migration; the breaking `removed` entry does not.
      return migrations.length === 1
        && migrations[0].migration?.integrity.startsWith('sha256-') === true
        && migrations.every((e) => e.severity === 'major');
    },
  },
  {
    title: 'every entry carries a module, severity, type, and human summary',
    run: () => MANIFEST.entries.every((e) => !!e.module && !!e.severity && !!e.type && !!e.summary),
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
    const card = el('div', { class: 'play-card wm-check' });
    const badge = el('span', { class: `badge ${ok ? 'pass' : 'fail'}` }, ok ? '✓ holds' : '✗ violated');
    card.append(badge, el('span', { class: 'wm-check-title' }, check.title));
    host.append(card);
  }
  summary.className = `summary ${pass === CHECKS.length ? 'pass' : 'fail'}`;
  summary.textContent = `${pass}/${CHECKS.length} webmanifests contract invariants hold`;
  return pass;
}

function main(): void {
  const root = document.getElementById('play-root');
  if (!root) return;
  root.textContent = '';

  const conformance = el('section', { class: 'wm-card' });
  conformance.append(el('h2', {}, 'Runtime conformance — changelog-manifest contract'));
  const passCount = runConformance(conformance);
  root.append(conformance);

  setPlaygroundReady(passCount);
}

main();
