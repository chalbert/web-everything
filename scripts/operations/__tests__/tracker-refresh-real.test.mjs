/**
 * @file tracker-refresh-real.test.mjs — the REAL mechanism of `tracker-refresh` (#2949): a real git repo holding a
 * tracker card and cards, the real command line (`run.mjs tracker-refresh`), its real child processes
 * (`priority-sync --apply`, `check-priority --strict`, `render`) and a real temp `.operations` directory. The only
 * stub is a fake `operator-queue.mjs` on a fake main checkout, so the run never reaches GitHub.
 *
 * The story: the first run finds no published page (`publish: needed`, a brief for the worker); the worker's `record`
 * command writes the state; the second run finds nothing changed (`publish: current`, no dispatch); a card's title
 * changes and the third run is `publish: needed` again, but the worker must WAIT (the last publish is minutes old) and the
 * brief now updates the recorded page in place. A dry run writes nothing.
 *
 * HOME points at a temp directory so the search for `operator-queue.mjs` cannot find this machine's real checkouts.
 */
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { withRealRepo } from './helpers/real-repo.mjs';
import { fixtureFiles } from '../../__tests__/fixtures/tracker-compact-fixture.mjs';
import { contentHash } from '../../lib/tracker-page-hash.mjs';
import { parseState } from '../tracker-refresh.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const RUN = join(REPO, 'scripts', 'operations', 'run.mjs');
const STATE_CLI = join(REPO, 'scripts', 'operations', 'tracker-refresh-state.mjs');

const QUEUE_LINE = 'PR #2401 (chalbert/web-everything) — review:human, gates pass, needs you';
const QUEUE_STUB = `console.log('NEEDS YOU (review:human + advisory:accepted, all gates pass):');
console.log(${JSON.stringify(QUEUE_LINE)});
console.log('PENDING — transient, re-run (GitHub is still computing mergeability; no agent work owed):');
console.log('(none)');
`;

/** The fixture with the two cards that would make `check-priority` drift left as they are for the compact-page tests
 *  put back in step: #3906 is ordered, so it must be open; #3940 is off-path, so it must be outside #3383. */
function cleanFixture() {
  const files = fixtureFiles();
  files['backlog/3906-card.md'] = files['backlog/3906-card.md'].replace('status: active', 'status: open');
  files['backlog/3940-card.md'] = files['backlog/3940-card.md'].replace('parent: "3383"', 'parent: "3054"');
  return files;
}

async function scenario(fn) {
  return withRealRepo(async (ctx) => {
    ctx.commit(cleanFixture(), 'fixture: tracker card and cards');
    const mainRoot = join(ctx.tmp, 'main-checkout');
    mkdirSync(join(mainRoot, 'scripts/operations'), { recursive: true });
    writeFileSync(join(mainRoot, 'scripts/operations/operator-queue.mjs'), QUEUE_STUB);
    const home = join(ctx.tmp, 'home');
    mkdirSync(home, { recursive: true });
    const ops = join(ctx.tmp, 'ops');
    const env = { ...process.env, HOME: home, WIP_MAIN_ROOT: mainRoot, OPERATION_RUNS_DIR: join(ctx.tmp, 'runs'), OPERATION_CALLS_DIR: join(ctx.tmp, 'calls'), GIT_CONFIG_GLOBAL: '/dev/null' };
    const sh = (script, args) => { const r = spawnSync(process.execPath, [script, ...args], { cwd: ctx.root, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 }); return { code: r.status, out: r.stdout, err: r.stderr }; };
    const refresh = (...args) => sh(RUN, ['tracker-refresh', `--operationsDir=${ops}`, '--ref=main', '--fetch=false', ...args]);
    const paths = { html: join(ops, 'tracker/prototype-tracker.html'), state: join(ops, 'tracker/artifact.json'), brief: join(ops, 'jobs/tracker-publish-task.md') };
    return fn({ ...ctx, ops, sh, refresh, paths, tracker: join(ctx.root, 'backlog/3383-tracker.md') });
  });
}

const lastLine = (out) => out.trim().split('\n').at(-1);

describe('tracker-refresh (real command line)', () => {
  it('a dry run prints the plan and writes nothing', async () => {
    await scenario(({ refresh, paths, tracker }) => {
      const before = readFileSync(tracker, 'utf8');
      const r = refresh();
      expect(r.code).toBe(0);
      expect(r.out).toContain('dry run — would run: ');
      expect(r.out).toContain('priority-sync --apply --ref=main');
      expect(r.out).not.toMatch(/^publish:/m);
      expect(existsSync(paths.html)).toBe(false);
      expect(existsSync(paths.brief)).toBe(false);
      expect(readFileSync(tracker, 'utf8')).toBe(before);
    });
  });

  it('first run: syncs, checks, renders the compact page, and asks for a publish with a brief for the worker', async () => {
    await scenario(({ refresh, paths, ops }) => {
      const r = refresh('--apply');
      expect(r.code).toBe(0);
      expect(lastLine(r.out)).toBe('publish: needed');
      expect(r.out).toContain('tracker-refresh: priority-sync: ');
      expect(r.out).toContain('tracker-refresh: check-priority OK');
      expect(r.out).toContain('last publish never');
      expect(r.out).toMatch(/dispatch: due: node scripts\/operations\/run\.mjs dispatch-task --brief=.*tracker-publish-task\.md --session=tracker-publish/);

      // the page: compact, written under the operations directory, with the stub's NEEDS YOU line
      const html = readFileSync(paths.html, 'utf8');
      expect(html).toContain('id="up-next"');
      expect(html).toContain(`<pre class="needs">${QUEUE_LINE}</pre>`);
      expect(Buffer.byteLength(html)).toBeLessThan(60 * 1024);

      // the brief: complete, names the page and the stub queue script, creates a NEW page (none recorded)
      const brief = readFileSync(paths.brief, 'utf8');
      expect(brief).toContain(paths.html);
      expect(brief).toContain(`--hash=${contentHash(html)}`);
      expect(brief).toContain('Create a NEW private page');
      expect(brief).toContain('main-checkout/scripts/operations/operator-queue.mjs');
      expect(existsSync(join(ops, 'tracker/artifact.json'))).toBe(false); // refresh never writes the state: only `record` does
    });
  });

  it('the section is synced first: a claimed card leaves the ordered list, then the strict check passes', async () => {
    await scenario(({ refresh, tracker, git, commit }) => {
      // #3906 is claimed on `main` after the section was written: priority-sync must move its line to the claimed list.
      commit({ 'backlog/3906-card.md': readFileSync(join(dirname(tracker), '3906-card.md'), 'utf8').replace('status: open', 'status: active') }, 'fixture: #3906 is claimed');
      const r = refresh('--apply');
      expect(r.code).toBe(0);
      expect(r.out).toMatch(/priority-sync: APPLIED — 0 added, 0 dropped, 1 moved/);
      expect(r.out).toContain('check-priority OK');
      const card = readFileSync(tracker, 'utf8');
      expect(card).not.toMatch(/^\d+\. #3906 /m);
      expect(card).toMatch(/^- #3906 · task · claimed · /m);
      expect(git(['status', '--porcelain']).trim()).toContain('backlog/3383-tracker.md'); // left edited, never committed
    });
  });

  it('after the worker records a publish the next run is current (no dispatch); a changed card makes it needed but not due, and updates in place', async () => {
    await scenario(({ refresh, sh, paths, root }) => {
      expect(lastLine(refresh('--apply').out)).toBe('publish: needed');

      // the worker's half: verify, then record the published url
      const html = readFileSync(paths.html, 'utf8');
      const verify = sh(STATE_CLI, ['verify', `--html=${paths.html}`, `--hash=${contentHash(html)}`]);
      expect(verify.code).toBe(0);
      const url = 'https://claude.ai/artifact/tracker-abc';
      const rec = sh(STATE_CLI, ['record', `--html=${paths.html}`, `--url=${url}`]);
      expect(rec.code).toBe(0);
      const state = parseState(readFileSync(paths.state, 'utf8'));
      expect(state).toMatchObject({ url, id: 'tracker-abc', lastPublishedHash: contentHash(html) });
      expect(Date.now() - Date.parse(state.lastPublishedAt)).toBeLessThan(60_000);

      // nothing changed (the render time moves, the content does not): current, no dispatch
      const again = refresh('--apply');
      expect(lastLine(again.out)).toBe('publish: current');
      expect(again.out).toContain('dispatch: none');
      expect(again.out).toContain('no worker brief needed');

      // a card's title changes: the page differs, but the last publish is minutes old, so the worker waits
      const card = join(root, 'backlog/3901-card.md');
      writeFileSync(card, readFileSync(card, 'utf8').replace('# Fix the standards check on the prototype branch', '# Fix the standards check on this branch'));
      const changed = refresh('--apply');
      expect(lastLine(changed.out)).toBe('publish: needed');
      expect(changed.out).toContain('dispatch: wait (minimum 30 min between publishes)');
      const brief = readFileSync(paths.brief, 'utf8');
      expect(brief).toContain(`Artifact(action:"read", url:"${url}")`);
      expect(brief).toContain('UPDATE the page in place');
      // and the worker's verify catches a page that changed after the brief was made
      expect(sh(STATE_CLI, ['verify', `--html=${paths.html}`, `--hash=${contentHash(html)}`]).code).toBe(1);
    });
  });

  it('--json carries the plan with every path, and the effect result with the publish verdict', async () => {
    await scenario(({ refresh, paths }) => {
      const r = refresh('--apply', '--json');
      expect(r.code).toBe(0);
      const payload = JSON.parse(r.out.slice(r.out.indexOf('{')));
      const text = JSON.stringify(payload);
      expect(text).toContain('"publish":"needed"');
      for (const p of [paths.html, paths.state, paths.brief]) expect(text).toContain(p);
      expect(text).toContain('tracker-publish.result.md');
    });
  });

  it('exits 1 with no publish line when the sync cannot run', async () => {
    await scenario(({ sh, ops }) => {
      const r = sh(RUN, ['tracker-refresh', `--operationsDir=${ops}`, '--ref=nosuchref', '--fetch=false', '--apply']);
      expect(r.code).toBe(1);
      expect(r.out).toContain('tracker-refresh: FAILED');
      expect(r.out).not.toMatch(/^publish:/m);
      expect(existsSync(join(ops, 'tracker/prototype-tracker.html'))).toBe(false);
    });
  });
});
