/**
 * @file breaks/gh-shim-lane-path.mjs — live break, 2026-09-26 (PR #2772, lane/fix-gh-shim-stable-path). The gh
 * App shim (`scripts/lib/gh-app-shim.mjs#buildGhShimSettingsEnv`) baked `GH_THROTTLE_CLI` from the WRITING
 * process's own `import.meta.url` sibling. A dispatched session doing its work inside a lane clone wrote a shim
 * hard-coding `.../.lanes/web-everything/lane-22/scripts/lib/gh-throttle.mjs` — a checkout the lane pool
 * resets/recycles/deletes the moment its own PR lands. Every `gh` call routed through that shim then lost its
 * throttle (or, before #4044's fail-open, crashed with `Cannot find module`).
 *
 * Fix (`833edc872`): `defaultGhThrottleCliPath` resolves through `bootstrap-session.mjs#primaryCheckout`, never
 * a lane; the generated shim also fails open with a visible stderr warning.
 *
 * Scenario: App auth is faked into the sim world's own fake `HOME` (same as `gh-shim-mid-rebuild`). The sim
 * world gets a constellation layout — a PRIMARY checkout `<ws>/web-everything` and a lane clone
 * `<ws>/.lanes/web-everything/lane-22`, both cloned from the sim WE origin. The lane's OWN copy of the REAL
 * `gh-app-shim.mjs` writes its shim (exactly what a session working in that lane does). The lane is then
 * removed (the pool recycling it after its PR lands), and a REAL `gh pr list` runs through the written shim.
 * The break happened when the shim baked a lane path, or when that gh call crashed / fell back unthrottled.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSoak } from '../soak.mjs';

const FIXTURE = fileURLToPath(new URL('./fixtures/gh-shim-probe.mjs', import.meta.url));

export default {
  id: 'gh-shim-lane-path',
  title: "a gh App shim written from inside a lane clone baked that lane's gh-throttle.mjs path; the lane being recycled broke every gh call through it",
  card: 'PR #2772 (lane/fix-gh-shim-stable-path)',
  fixedBy: {
    sha: '833edc872',
    where: 'lane/fix-gh-shim-stable-path',
    paths: ['scripts/lib/gh-app-shim.mjs'],
  },
  fixPresent(root) {
    try {
      return /primaryCheckout\(root/.test(readFileSync(join(root, 'scripts/lib/gh-app-shim.mjs'), 'utf8'));
    } catch {
      return false;
    }
  },
  async run({ log } = {}) {
    let workspace = null;
    const report = await runSoak({
      name: 'break:gh-shim-lane-path',
      rounds: 1,
      mainEvery: 0,
      fleet: false,
      log,
      setup(w) {
        Object.assign(w.env, {
          WE_GITHUB_APP_ID: 'sim-app-1',
          WE_GITHUB_APP_INSTALLATION_ID: 'sim-install-1',
          WE_GITHUB_APP_PRIVATE_KEY_PATH: join(w.home, 'app-key.pem'),
        });
        mkdirSync(w.home, { recursive: true });
        writeFileSync(w.env.WE_GITHUB_APP_PRIVATE_KEY_PATH, '-----BEGIN FAKE KEY-----\n(not a real key — never minted in this scenario)\n');
        return {};
      },
      async perRound(w, round, ctx, api) {
        if (round !== 0) return;

        // A constellation layout: the primary checkout, and a lane clone in its pool beneath the same workspace.
        workspace = join(w.root, 'ws');
        const primary = join(workspace, 'web-everything');
        const lane = join(workspace, '.lanes', 'web-everything', 'lane-22');
        mkdirSync(join(workspace, '.lanes', 'web-everything'), { recursive: true });
        execFileSync('git', ['clone', '--quiet', w.repos.we.originPath, primary], { stdio: 'ignore' });
        execFileSync('git', ['clone', '--quiet', w.repos.we.originPath, lane], { stdio: 'ignore' });

        // A session working in the lane writes its gh shim through the LANE's own copy of the real module.
        const res = spawnSync(process.execPath, [FIXTURE, 'build-shim', join(lane, 'scripts/lib/gh-app-shim.mjs'), lane], {
          env: w.env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, cwd: lane,
        });
        let settingsEnv = null;
        try { settingsEnv = JSON.parse((res.stdout || '').trim() || 'null'); } catch { /* checked below */ }
        if (res.status !== 0 || !settingsEnv || !settingsEnv.PATH) {
          throw new Error(`gh-shim-lane-path: the lane failed to write its gh shim: ${res.stderr || res.stdout}`);
        }
        const ghBin = join(settingsEnv.PATH.split(':')[0], 'gh');
        const baked = /const GH_THROTTLE_CLI = ("[^"\n]*");/.exec(readFileSync(ghBin, 'utf8'));
        if (!baked) throw new Error(`gh-shim-lane-path: no GH_THROTTLE_CLI line found in the generated shim ${ghBin}`);
        const throttleCli = JSON.parse(baked[1]);
        api.say(`r00 the lane wrote its gh shim ${ghBin} with GH_THROTTLE_CLI=${throttleCli}`);
        if (/\/\.lanes\//.test(throttleCli)) {
          api.violation('gh-shim-lane-path', `the shim baked a lane-clone throttle path: ${throttleCli}`);
        }

        // The pool recycles the lane (its PR landed) — then any session's gh call runs through that shim.
        rmSync(lane, { recursive: true, force: true });
        api.say('r00 the lane was removed (the pool recycling it after its PR landed)');
        const ghCall = spawnSync(ghBin, ['pr', 'list', '--repo', w.repos.we.slug, '--limit', '1', '--json', 'number'], {
          env: { ...w.env, ...settingsEnv }, encoding: 'utf8', cwd: primary,
        });
        const stderr = ghCall.stderr || '';
        const broke = Boolean(ghCall.error) || ghCall.status !== 0
          || /Cannot find module/.test(stderr) || /falling back to direct, unthrottled gh/.test(stderr);
        api.say(`r00 \`gh pr list\` through the shim exited ${ghCall.status ?? ghCall.signal} — ${broke ? 'LOST ITS THROTTLE' : 'ok'}`);
        if (broke) {
          api.violation('gh-shim-lane-path', `gh through the shim failed or lost its throttle after the lane was recycled (exit ${ghCall.status ?? ghCall.error ?? ghCall.signal}): ${stderr.trim().split('\n')[0]}`);
        }
      },
    });
    if (workspace && existsSync(workspace)) {
      try { rmSync(workspace, { recursive: true, force: true }); } catch { /* best-effort */ }
    }
    return report;
  },
  judge(report) {
    return report.violations
      .filter((v) => v.invariant === 'gh-shim-lane-path')
      .map((v) => `${v.daemon ?? '-'} tick ${v.tick ?? '-'}: [${v.invariant}] ${v.detail}`);
  },
};
