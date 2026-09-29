/**
 * @file breaks/daemon-entry-boot-crash.mjs — live break, 2026-09-29 ~10:45 ET (#4468, card xzdo6ux). Overlay PR
 * #2921 introduced an ESM circular-import TDZ (`ReferenceError: Cannot access 'DELIVER_ITEM_RUN_SCRIPT' before
 * initialization` in `scripts/operations/dispatch-provider-registry.mjs`). The rebuild's live smoke PASSED and
 * adopted the tree — none of `daemon-live-smoke.mjs#SMOKE_CHECKS` at the time ever actually BOOTED a daemon
 * entry module, so nothing exercised the broken import closure the way `node build-dispatch-daemon.mjs --live`
 * actually does. The moment a daemon restarted onto the adopted tree it crash-looped at import time, before
 * `main()` ever ran — and the code that would roll a bad build back (`daemon-live-smoke.mjs#rollbackToSha`)
 * runs INSIDE that same process, so it could never roll itself back. The builder was down until the operator
 * removed the overlay and ran `daemon-load-overlay.mjs` by hand.
 *
 * THIS BREAK reproduces the exact failure SHAPE — a genuine ESM circular-import TDZ, not a stand-in — with a
 * throwaway two-file fixture pair built fresh in a scratch temp dir (never touching a real production daemon
 * entry, and never a real running daemon process — see `we:scripts/lib/daemon-boot-watchdog.mjs`'s own header
 * for why this whole card proves itself on a scratch clone only):
 *
 *   tdz-a.mjs:  import { b } from './tdz-b.mjs'; export const a = 1; console.log(b);
 *   tdz-b.mjs:  import { a } from './tdz-a.mjs'; export const b = a + 1;
 *
 * Node's ESM loader evaluates `tdz-b.mjs` (hoisted by `tdz-a.mjs`'s own import) before `tdz-a.mjs`'s own body
 * runs, so `tdz-b.mjs`'s `a + 1` reads `a` before `tdz-a.mjs` ever reaches its `export const a = 1` line —
 * `ReferenceError: Cannot access 'a' before initialization`, the same class of error #2921 hit live.
 *
 * FIX (xzdo6ux / #4468): `scripts/lib/daemon-boot-smoke.mjs#checkDaemonEntriesBoot`, appended to
 * `daemon-live-smoke.mjs#SMOKE_CHECKS` as the `daemon-entries-boot` row — spawns a child that dynamically
 * `import()`s every real daemon entry module (or, here, the fixture's own entry) and fails the whole smoke if
 * any entry throws at import time.
 *
 * RED (fix absent): `daemon-boot-smoke.mjs` does not exist, so the whole fixture entry is never checked at all
 * — a smoke run over `SMOKE_CHECKS` alone would report nothing wrong with a tree that cannot actually boot.
 * GREEN (fix present): `checkDaemonEntriesBoot`, pointed at the fixture entry via its own test-only env override
 * (`WE_SMOKE_DAEMON_ENTRIES` — never used against the real entry list outside a test), reports `ok:false` naming
 * the broken entry and the exact `ReferenceError`.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FIXTURES = {
  'tdz-a.mjs': "import { b } from './tdz-b.mjs';\nexport const a = 1;\nconsole.log(b);\n",
  'tdz-b.mjs': "import { a } from './tdz-a.mjs';\nexport const b = a + 1;\n",
  'tdz-entry.mjs': "import './tdz-a.mjs';\n",
};

export default {
  id: 'daemon-entry-boot-crash',
  title: 'a candidate whose daemon entry throws an ESM circular-import TDZ at boot passes the live smoke (nothing ever imports the entry) and crash-loops every daemon that restarts onto it, with no way to self-roll-back',
  card: 'we:backlog/xzdo6ux (#4468)',
  // `sha` is a symbolic placeholder, not a real git sha — the fix and this break land in the SAME commit, so
  // the real merge sha is not knowable at authoring time. Same precedent as
  // `breaks/broken-smoke-harness-holds-last-good.mjs`'s own `fixedBy.sha: 'x5wbsbc-daemon-last-good-fallback'`
  // (#4468 review flagged this as unresolvable provenance; it is an accepted, already-established repo pattern,
  // not an oversight here).
  fixedBy: { sha: 'x4468-daemon-boot-smoke', where: 'lane/4468-daemon-rebuild-smoke-boots-the-daemon-entry-and-a-boot-crash', paths: ['scripts/lib/daemon-boot-smoke.mjs', 'scripts/lib/daemon-live-smoke.mjs'] },
  // fixPresent probe (per the brief; MUST be synchronous — `define-break-test.mjs` calls it without an
  // `await`). A bare substring/comment match on "daemon-entries-boot" is too loose (a stale comment mentioning
  // the check's name would still read as "present" after the row itself was removed — a #4468 review finding).
  // This instead requires BOTH: `daemon-boot-smoke.mjs` exports the real `checkDaemonEntriesBoot`, AND
  // `daemon-live-smoke.mjs` imports `DAEMON_BOOT_SMOKE_CHECK` from it and lists that exact identifier as a bare
  // `SMOKE_CHECKS` array element (never a same-shaped hand-written literal, which is exactly the duplication
  // #4468's review caught and fixed) — a comment can satisfy neither anchored pattern.
  fixPresent(root) {
    try {
      const smokeSrc = readFileSync(join(root, 'scripts/lib/daemon-boot-smoke.mjs'), 'utf8');
      const liveSrc = readFileSync(join(root, 'scripts/lib/daemon-live-smoke.mjs'), 'utf8');
      const exportsCheck = /export\s+(?:async\s+)?function\s+checkDaemonEntriesBoot\b/.test(smokeSrc);
      const importsRow = /import\s*\{[^}]*\bDAEMON_BOOT_SMOKE_CHECK\b[^}]*\}\s*from\s*['"]\.\/daemon-boot-smoke\.mjs['"]/.test(liveSrc);
      const registersRow = /^\s*DAEMON_BOOT_SMOKE_CHECK\s*,?\s*$/m.test(liveSrc);
      return exportsCheck && importsRow && registersRow;
    } catch { return false; }
  },
  async run({ log } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'soak-daemon-boot-crash-'));
    try {
      for (const [name, content] of Object.entries(FIXTURES)) writeFileSync(join(dir, name), content);
      let mod;
      try {
        mod = await import('../../../lib/daemon-boot-smoke.mjs');
      } catch (e) {
        // RED: the fix does not exist on this tree at all — the fixture entry is unreachable by any check.
        return { violations: [{ invariant: 'no-boot-check', detail: `daemon-boot-smoke.mjs is not importable — the fix is absent: ${String(e?.message || e)}` }] };
      }
      const result = await mod.checkDaemonEntriesBoot({
        root: dir,
        budgets: { daemonBootMs: 15_000 },
        env: { ...process.env, WE_SMOKE_DAEMON_ENTRIES: 'tdz-entry.mjs' },
      });
      log?.(`daemon-entry-boot-crash: checkDaemonEntriesBoot -> ${JSON.stringify(result)}`);
      const violations = [];
      if (result.ok) {
        violations.push({ invariant: 'boot-crash-not-caught', detail: `checkDaemonEntriesBoot reported ok:true against a fixture entry with a real ESM TDZ — detail: ${result.detail}` });
      } else if (!/ReferenceError/.test(result.detail) || !/tdz-entry\.mjs/.test(result.detail)) {
        violations.push({ invariant: 'wrong-failure-reason', detail: `expected a ReferenceError naming tdz-entry.mjs, got: ${result.detail}` });
      }
      return { violations };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  judge(report) {
    return (report.violations || []).map((v) => `[${v.invariant}] ${v.detail}`);
  },
};
