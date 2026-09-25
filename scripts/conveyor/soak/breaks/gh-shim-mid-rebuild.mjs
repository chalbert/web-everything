/**
 * @file breaks/gh-shim-mid-rebuild.mjs — live break 2, 2026-09-25 08:14 + 09:30 ET (#4075, epic card x0zg44l). The
 * shared GitHub App gh shim (`scripts/lib/gh-app-shim.mjs#buildGhShimSettingsEnv`) wrote ONE machine-wide file
 * (`~/.claude/github-app-token/gh-shim/gh`), baking in the WRITER's own checkout's absolute path to
 * `gh-throttle.mjs`. A dispatched session ("dispatcher B") resolves its gh shim PATH override once, at dispatch
 * time, and keeps using that PATH for its whole life; a LATER, unrelated dispatch ("dispatcher A" — a clone, a
 * rebuild's fresh tree, a sibling daemon's checkout) rewrites the SAME shared file with ITS OWN throttle path;
 * A's tree is then deleted/recreated (a rebuild). Dispatcher B's next `gh` call, through its still-unchanged PATH
 * override, execs the file A last wrote — pointing at a path that no longer exists —
 * `node:internal/modules/cjs/loader:1227 (Cannot find module)`.
 *
 * Fixes on lane/4044:
 *   - `6ec566884` — a missing throttle CLI degrades to calling the real `gh` directly (never crashes); the shim
 *     write itself becomes atomic (temp file + rename).
 *   - `11661ed52` — structural: `checkoutShimDir({ghThrottleCliPath, home})` gives every checkout its OWN shim
 *     dir under `gh-shim.d/<hash of its own throttle path>` instead of one shared file, and
 *     `resolveRealGhBinary()` skips every generated shim dir. Two checkouts' shims can no longer clobber
 *     each other at all.
 *
 * PROVEN (see this file's own `run`): reverting ONLY `11661ed52` restores the shared dir, so dispatcher A's write
 * DOES clobber dispatcher B's — but `6ec566884`'s missing-throttle-CLI guard is still present, so the crash is
 * MASKED (the shim degrades to a direct real-`gh` call). Reverting `6ec566884` too removes that guard and the
 * crash reproduces. `red-green.mjs` was extended (minimally) to accept `--revert=sha1,sha2` for this reason.
 *
 * Scenario: App auth is faked into the sim world's own fake `HOME` (the three `WE_GITHUB_APP_*` env vars —
 * `buildGhShimSettingsEnv`'s only opt-in gate, `resolveGithubAppEnvConfig`, never checks the key file's contents
 * or mints a real token). A throwaway "dispatch site" (dispatcher B) resolves + writes its own shim FIRST via the
 * REAL `scripts/operations/dispatch-lane-io.mjs#resolveGhShimSettingsEnv`, capturing the PATH override its
 * session would keep using. A SECOND, unrelated checkout (dispatcher A) then clones fresh under the world root,
 * writes its OWN shim via the REAL `scripts/lib/gh-app-shim.mjs#buildGhShimSettingsEnv`, and is immediately
 * deleted (the rebuild). Dispatcher B then makes a REAL `gh pr list` call through its ALREADY-CAPTURED PATH
 * override — the actual crash surface a dispatched session's Bash tool would hit.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSoak } from '../soak.mjs';

const FIXTURE = fileURLToPath(new URL('./fixtures/gh-shim-probe.mjs', import.meta.url));

function runFixture(mode, modulePath, arg, env) {
  const res = spawnSync(process.execPath, [FIXTURE, mode, modulePath, arg ?? ''], {
    env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  let parsed = null;
  try { parsed = JSON.parse((res.stdout || '').trim() || 'null'); } catch { /* leave null — caller checks status/stderr */ }
  return { ...res, parsed };
}

export default {
  id: 'gh-shim-mid-rebuild',
  title: "the ONE shared gh App shim baked in a checkout's own gh-throttle.mjs path; that checkout vanishing (a rebuild) crashed every other dispatched session's gh calls",
  card: 'we:backlog/4044 via PR #2625 (epic #4075)',
  fixedBy: {
    sha: '11661ed52,6ec566884',
    where: 'lane/4044-daemon-rebuild-and-clone-lock',
    paths: ['scripts/lib/gh-app-shim.mjs'],
  },
  fixPresent(root) {
    try {
      return /checkoutShimDir/.test(readFileSync(join(root, 'scripts/lib/gh-app-shim.mjs'), 'utf8'));
    } catch {
      return false;
    }
  },
  async run({ log } = {}) {
    let secondCheckout = null;
    const report = await runSoak({
      name: 'break:gh-shim-mid-rebuild',
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

        // Dispatcher B (a lane/session that dispatched EARLIER) resolves + writes its OWN shim FIRST, capturing
        // the PATH override its session keeps using for its whole lifetime — a real dispatched session never
        // recomputes this per gh call; it just inherits whatever `.claude/settings.local.json` already says.
        const dispatchSite = join(w.root, 'dispatch-site-b');
        mkdirSync(dispatchSite, { recursive: true });
        const bRes = runFixture('resolve-dispatch-env', join(w.simCloneRoot, 'scripts/operations/dispatch-lane-io.mjs'), dispatchSite, w.env);
        const bSettingsEnv = bRes.parsed;
        if (bRes.status !== 0 || !bSettingsEnv || !bSettingsEnv.PATH) {
          throw new Error(`gh-shim-mid-rebuild: dispatcher B failed to resolve its gh shim env: ${bRes.stderr || bRes.stdout}`);
        }
        api.say(`r00 dispatcher B (${dispatchSite}) resolved its gh shim PATH override: ${bSettingsEnv.PATH}`);

        // Dispatcher A — a SECOND, unrelated checkout (what a rebuild's fresh tree, or a sibling daemon's clone,
        // is) — clones fresh, ALSO resolves+writes its OWN shim (baking in ITS OWN gh-throttle.mjs path), AFTER
        // B, so a pre-fix SHARED shim dir now holds A's path, not B's.
        secondCheckout = join(w.root, 'wev-second-checkout');
        execFileSync('git', ['clone', '--quiet', w.repos.we.originPath, secondCheckout], { stdio: 'ignore' });
        const aRes = runFixture('build-shim', join(secondCheckout, 'scripts/lib/gh-app-shim.mjs'), secondCheckout, w.env);
        if (aRes.status !== 0 || !aRes.parsed) {
          throw new Error(`gh-shim-mid-rebuild: dispatcher A failed to write its gh shim: ${aRes.stderr || aRes.stdout}`);
        }
        api.say(`r00 dispatcher A (second checkout ${secondCheckout}) wrote its own gh shim: ${JSON.stringify(aRes.parsed)}`);

        // The rebuild: A's tree is gone — exactly what a daemon rebuild (or a lane reclaim) does to a checkout.
        rmSync(secondCheckout, { recursive: true, force: true });
        secondCheckout = null;
        api.say("r00 dispatcher A's checkout was removed (a rebuild deleting/replacing the tree it just wrote its shim from)");

        // Dispatcher B's session, STILL using the PATH it captured before A ever wrote, makes a real `gh` call —
        // exactly what a long-running dispatched session's Bash tool does, any time after A's write.
        const ghBin = join(bSettingsEnv.PATH.split(':')[0], 'gh');
        const ghEnv = { ...w.env, ...bSettingsEnv };
        const ghCall = spawnSync(ghBin, ['pr', 'list', '--repo', w.repos.we.slug, '--limit', '1', '--json', 'number'], {
          env: ghEnv, encoding: 'utf8', cwd: dispatchSite,
        });
        const crashed = ghCall.status !== 0 && /Cannot find module/.test(ghCall.stderr || '');
        api.say(`r00 dispatcher B's \`gh pr list\` (through its own already-resolved shim) exited ${ghCall.status ?? ghCall.signal} — ${crashed ? 'CRASHED (Cannot find module)' : 'ok'}`);
        if (crashed) {
          api.violation('gh-shim-crash', `dispatcher B's gh call crashed after dispatcher A's checkout vanished: ${(ghCall.stderr || '').trim().split('\n')[0]}`);
        }
      },
    });
    if (secondCheckout && existsSync(secondCheckout)) {
      try { rmSync(secondCheckout, { recursive: true, force: true }); } catch { /* best-effort */ }
    }
    return report;
  },
  judge(report) {
    return report.violations
      .filter((v) => v.invariant === 'gh-shim-crash')
      .map((v) => `${v.daemon ?? '-'} tick ${v.tick ?? '-'}: [${v.invariant}] ${v.detail}`);
  },
};
