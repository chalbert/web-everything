/**
 * @file breaks/queue-cleared-hash-never-resolves-after-jit-number.mjs — the 2026-09-29 "builder starved" live
 * incident: the builder ran at cap 2 with only 1 item in flight while `dispatch-plan.mjs` reported 154 items
 * `cleared-but-not-ready` out of 156 not-ready rows.
 *
 * ROOT CAUSE: the operator clears an item for the conveyor to build under whatever id the tooling shows AT THAT
 * MOMENT — often a not-yet-numbered JIT hash (`x34h6a2`). `.conveyor/queue.json` stores exactly that id. The
 * drain later JIT-numbers the card the instant its WE half lands (#2288), renaming it to `backlog/4290-….md` and
 * stamping `bornAs: x34h6a2` into the numbered card's frontmatter (#2392) — but the sidecar still says
 * `x34h6a2`. Every membership test the dispatcher/daemon used was an EXACT `normNum` match against the
 * build-queue's rows, which are keyed by the LANDED number — so a stale hash row could never again match, and
 * read as "cleared, but not ready" FOREVER, even once the card was numbered and ready. At the 150-card scale
 * this reproduces, that is most of the queue silently invisible to the builder.
 *
 * FIX: `queue-store.mjs#bornAsIndexFromItems` + `#resolveBornAsRefs` resolve a stale hash row through the
 * landed card's own `bornAs:` stamp. The readiness readers (`dispatch-plan.mjs`, `conveyor-state.mjs`) apply
 * this at READ TIME on every tick (so a stale row self-heals the moment anything reads the queue); `queue.mjs
 * migrate-bornas` — exercised directly here — applies the SAME resolution to rewrite the on-disk sidecar itself,
 * the sanctioned self-heal tool an operator (or this soak proof) can run on demand.
 *
 * This scenario proves the on-disk self-heal end-to-end via the real CLI (not just the pure functions unit-
 * tested in `queue-store.test.mjs`): clear a hash id, land its card under a new number with that hash as
 * `bornAs`, then run `queue.mjs migrate-bornas` and assert the stale row is gone and the landed number is in its
 * place — the resolution `dispatch-plan.mjs`/`conveyor-state.mjs` also apply automatically at read time.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');

const HASH = 'x34h6a2';
const LANDED_NUM = '4290';

export default {
  id: 'queue-cleared-hash-never-resolves-after-jit-number',
  title: 'a cleared JIT-hash row stays "cleared-but-not-ready" forever once its card lands under a new number (live incident: 154/156 not-ready)',
  card: 'blocker (hand-briefed 2026-09-29): build daemon starved — ~150 cleared items invisible to the builder',
  fixedBy: {
    sha: 'b538fbeb9',
    where: 'lane/queue-bornas-resolve',
    paths: ['scripts/conveyor/queue-store.mjs', 'scripts/conveyor/queue.mjs'],
  },
  fixPresent(root) {
    const p = join(root, 'scripts/conveyor/queue-store.mjs');
    return existsSync(p) && /export function resolveBornAsRefs/.test(readFileSync(p, 'utf8'));
  },
  async run({ log, sourceRoot = REPO_ROOT } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'soak-queue-bornas-'));
    const backlogDir = join(dir, 'backlog');
    const sidecar = join(dir, 'queue.json');
    const violations = [];
    try {
      mkdirSync(backlogDir, { recursive: true });
      // The card as it sits on main TODAY: JIT-numbered, carrying the hash it was cleared under as `bornAs`.
      writeFileSync(
        join(backlogDir, `${LANDED_NUM}-drain-daemon-starved.md`),
        `---\nkind: story\nsize: 1\nstatus: open\ndateOpened: "2026-09-01"\nbornAs: ${HASH}\n---\n\n# Fix the starved builder\n\nbody.\n`,
      );
      const cli = join(sourceRoot, 'scripts/conveyor/queue.mjs');
      const env = {
        ...process.env,
        CONVEYOR_QUEUE_FILE: sidecar,
        WE_BACKLOG_DIR: backlogDir,
        CONVEYOR_NO_KIND_CHECK: '1',
        CONVEYOR_NO_READY_CHECK: '1',
      };
      const runCli = (...args) => execFileSync('node', [cli, ...args], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });

      // The operator clears the card by the id the tooling showed BEFORE it landed.
      runCli('add', HASH, '--json');
      log?.(`cleared ${HASH} for build; its card has since landed as #${LANDED_NUM} (bornAs: ${HASH})`);

      let migrateOut;
      try {
        migrateOut = JSON.parse(runCli('migrate-bornas', '--json'));
      } catch (e) {
        violations.push({
          invariant: 'migrate-bornas-runs',
          detail: `queue.mjs migrate-bornas is unavailable or crashed on this tree: ${String(e?.stderr || e?.message || e).split('\n')[0]}`,
        });
        return { violations };
      }
      log?.(`migrate-bornas resolved: ${JSON.stringify(migrateOut.resolved)}`);
      if (!Array.isArray(migrateOut.resolved) || !migrateOut.resolved.some((r) => r.from === HASH && r.to === LANDED_NUM)) {
        violations.push({
          invariant: 'stale-hash-resolves-to-landed-nnn',
          detail: `expected migrate-bornas to report ${HASH}→${LANDED_NUM}; got ${JSON.stringify(migrateOut.resolved)}`,
        });
      }

      const after = JSON.parse(readFileSync(sidecar, 'utf8'));
      const nums = after.map((e) => e.num);
      log?.(`sidecar after migrate-bornas: ${JSON.stringify(nums)}`);
      if (nums.includes(HASH)) {
        violations.push({ invariant: 'stale-hash-removed-on-disk', detail: `${HASH} is STILL in the sidecar after migrate-bornas: ${JSON.stringify(nums)}` });
      }
      if (!nums.includes(LANDED_NUM)) {
        violations.push({ invariant: 'landed-num-present-on-disk', detail: `#${LANDED_NUM} never appears in the sidecar after migrate-bornas: ${JSON.stringify(nums)}` });
      }
      return { violations };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  judge(report) {
    return report.violations.map((v) => `[${v.invariant}] ${v.detail}`);
  },
};
