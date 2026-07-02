#!/usr/bin/env node
/**
 * render-check.mjs — the #2000 headless cross-origin visual render check, CLI form. Boots its OWN WE
 * docs server on a dedicated port (never the user's 3000/8080 — see the don't-kill-a-running-server
 * rule), drives a headless Playwright chromium at the home grid, and asserts the dogfooded `.fui-card`
 * tiles render as a LIGHT surface. A dark computed background means a FUI dark-default card token
 * leaked into the WE consumer (the #2050/#2019 → near-black-tiles regression class, #1895 lineage).
 *
 * This is the RENDER floor the auto-merge landing gate joins for visual-touching lanes (wired in
 * `.claude/skills/batch-backlog-items/parallel-execute.workflow.js`) — it catches the emergent,
 * multi-item visual interaction the per-file `check:standards` and the `token-css` unit test cannot
 * (two lanes each green alone, broken together). The color math + the visual-touch predicate live in
 * `scripts/lib/render-check.mjs` (unit-tested off-server); this file only owns the boot + browser drive.
 *
 * ## Why "WE + FUI cross-origin pair" is satisfied by booting WE alone
 * The chosen fixture (#2000 Update) is the WE home-grid `.fui-card` tiles, which render in WE's OWN
 * document, styled by WE's inlined `--token-*` CSS. Those token VALUES are derived from FUI's webtheme
 * source cross-repo AT BUILD TIME (`scripts/lib/token-css.mjs` transpiles `../frontierui/plugs/webtheme`,
 * the #96 / #1731 copy boundary). So booting WE with the FUI sibling checked out IS the coupled pair for
 * this regression class — the leak crosses the repo boundary at build, then paints in WE's page. (The
 * runtime iframe path — `.fui-card` inside a cross-origin FUI demo frame, #1895 proper — additionally
 * needs FUI's dev server on env-driven ports, which FUI does not yet expose; tracked as a follow-on.)
 *
 * Usage:
 *   node scripts/dev/render-check.mjs                       # boot WE on :8130, assert home .fui-card is LIGHT
 *   node scripts/dev/render-check.mjs --simulate-regression # inject FUI dark card tokens → assert the check FIRES
 *   node scripts/dev/render-check.mjs --url=http://localhost:8080   # reuse a running server, no boot
 *   node scripts/dev/render-check.mjs --port=8137 --path=/ --selector=.fui-card --json
 *
 * Exit 0 = check behaved as expected (light in default mode; correctly-detected-dark in --simulate mode).
 * Exit 1 = regression (dark/transparent tile) or the check could not run (no server, no tile).
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';
import { classifyCardSurface, FUI_DARK_CARD } from '../lib/render-check.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

// ── args ────────────────────────────────────────────────────────────────────────────────────────
const flags = {};
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
}
// Dedicated render-check port, off the WE dev band (8080) so a boot never collides with the user's
// running server. Overridable via --port or WE_RENDER_CHECK_PORT; `strictPort`-style fail-loud is the
// readiness poll timing out rather than binding elsewhere.
const PORT = Number(flags.port ?? process.env.WE_RENDER_CHECK_PORT ?? 8130);
const PATHNAME = flags.path ?? '/';
const SELECTOR = flags.selector ?? '.fui-card';
const SIMULATE = !!flags['simulate-regression'];
const JSON_OUT = !!flags.json;
const REUSE_URL = flags.url ? String(flags.url).replace(/\/$/, '') : null;
const BASE = REUSE_URL || `http://localhost:${PORT}`;

const log = (...a) => { if (!JSON_OUT) console.log(...a); };

// ── boot the WE docs server (unless reusing a running one) ────────────────────────────────────────
async function waitForReady(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status >= 200 && res.status < 500) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function bootEleventy() {
  // Only eleventy is needed: it inlines the token CSS pre-paint (`<style id="we-token-css">`) and
  // passthrough-copies `/css` (the `.fui-card` base rule), so the SSR home renders the finished tiles
  // with resolved tokens — no Vite required.
  const child = spawn('npx', ['@11ty/eleventy', '--serve', `--port=${PORT}`, '--quiet'], {
    cwd: ROOT,
    env: { ...process.env, WE_ELEVENTY_PORT: String(PORT) },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const ready = await waitForReady(`${BASE}${PATHNAME}`);
  if (!ready) {
    child.kill('SIGTERM');
    throw new Error(`WE docs server did not become ready on ${BASE} within timeout`);
  }
  return child;
}

// ── run ──────────────────────────────────────────────────────────────────────────────────────────
let server = null;
let browser = null;
let exitCode = 0;
let result = {};
try {
  if (!REUSE_URL) {
    log(`booting WE docs server on ${BASE} …`);
    server = await bootEleventy();
  } else {
    log(`reusing running server at ${BASE}`);
  }

  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${BASE}${PATHNAME}`, { waitUntil: 'load', timeout: 60_000 });

  const card = page.locator(SELECTOR).first();
  await card.waitFor({ state: 'attached', timeout: 15_000 }).catch(() => {});
  if ((await page.locator(SELECTOR).count()) === 0) {
    throw new Error(`no ${SELECTOR} tile found on ${BASE}${PATHNAME} — cannot render-check the frame`);
  }

  if (SIMULATE) {
    // Reproduce the known-bad state through the REAL `.fui-card` CSS rule: inject FUI's dark-default
    // card tokens (the exact bytes that leak when the WE light override is missing) as `:root` vars, so
    // `.fui-card { background: var(--color-surface-card) }` resolves dark exactly as it did pre-fix.
    await page.addStyleTag({
      content: `:root{${Object.entries(FUI_DARK_CARD)
        .flatMap(([k, v]) => [`--token-color-${k}:${v}`, `--color-${k}:${v}`])
        .join(';')}}`,
    });
  }

  const bg = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
  const verdict = classifyCardSurface(bg);
  result = { mode: SIMULATE ? 'simulate-regression' : 'assert-light', selector: SELECTOR, url: `${BASE}${PATHNAME}`, ...verdict };

  if (SIMULATE) {
    // In simulate mode the check PASSES when it correctly FLAGS the injected dark surface (proves it
    // catches the regression class from the CLI, no human screen).
    exitCode = verdict.ok ? 1 : 0;
    result.detectorCaughtRegression = !verdict.ok;
  } else {
    exitCode = verdict.ok ? 0 : 1;
  }
} catch (err) {
  exitCode = 1;
  result = { error: String(err && err.message ? err.message : err) };
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) server.kill('SIGTERM');
}

if (JSON_OUT) {
  console.log(JSON.stringify(result, null, 2));
} else if (result.error) {
  log(`✗ render-check ERROR: ${result.error}`);
} else if (SIMULATE) {
  log(result.detectorCaughtRegression
    ? `✓ render-check correctly FLAGGED the simulated regression (${result.color}, ${result.reason})`
    : `✗ render-check FAILED to flag the simulated dark surface (${result.color})`);
} else {
  log(result.ok
    ? `✓ render-check PASS — ${SELECTOR} is a light surface (${result.color}, luminance ${result.luminance?.toFixed(3)})`
    : `✗ render-check FAIL — ${SELECTOR} regression: ${result.reason} (${result.color})`);
}
process.exit(exitCode);
