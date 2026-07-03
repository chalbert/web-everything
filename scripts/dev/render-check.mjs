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
 * ## Two coupled-pair fixtures for the same leak class
 * 1. BUILD-TIME (default). The #2000 fixture is the WE home-grid `.fui-card` tiles, which render in WE's
 *    OWN document, styled by WE's inlined `--token-*` CSS. Those token VALUES are derived from FUI's
 *    webtheme source cross-repo AT BUILD TIME (`scripts/lib/token-css.mjs` transpiles
 *    `../frontierui/plugs/webtheme`, the #96 / #1731 copy boundary). So booting WE with the FUI sibling
 *    checked out IS the coupled pair — the leak crosses the repo boundary at build, then paints in WE's page.
 * 2. RUNTIME cross-origin iframe (`--fui-iframe`, #2081, the #1895-PROPER case). A `.fui-card` rendered
 *    INSIDE a live cross-origin FUI demo frame, not a WE-own tile. This boots the FUI vite demo server on
 *    an env-driven lane port (`FUI_DEMO_PORT`, the #2142 parity of WE's #1997 `WE_*_PORT`), serves a tiny
 *    WE-origin host page that iframes `{FUI}/demos/card-demo.html` (the same sandboxed embed shape as the
 *    `fuiDemo` shortcode), and asserts the `.fui-card` painted in the FUI frame's shadow root is a LIGHT
 *    surface — the leak now crossing the boundary at RUNTIME (a dark FUI card token reaching the served
 *    demo), not at build. Playwright pierces the cross-origin frame + shadow root from the CLI, no screen.
 *
 * Usage:
 *   node scripts/dev/render-check.mjs                       # boot WE on :8130, assert home .fui-card is LIGHT
 *   node scripts/dev/render-check.mjs --simulate-regression # inject FUI dark card tokens → assert the check FIRES
 *   node scripts/dev/render-check.mjs --url=http://localhost:8080   # reuse a running server, no boot
 *   node scripts/dev/render-check.mjs --port=8137 --path=/ --selector=.fui-card --json
 *   node scripts/dev/render-check.mjs --fui-iframe          # boot a WE+FUI pair on lane ports; assert .fui-card INSIDE a live cross-origin FUI demo iframe is LIGHT
 *   node scripts/dev/render-check.mjs --fui-iframe --simulate-regression   # inject dark tokens into the FUI frame → assert the check FIRES
 *   node scripts/dev/render-check.mjs --fui-iframe --fui-url=http://localhost:6002   # reuse a running FUI demo server, no FUI boot
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

// ── runtime cross-origin iframe mode (#2081) ─────────────────────────────────────────────────────
const FUI_IFRAME = !!flags['fui-iframe'];
// The FUI sibling checkout (the #96 constellation `../frontierui` assumption, same as .eleventy.js's
// FUI_DEMO_BASE and vite.config's weRoot). Overridable via --fui-root for a non-sibling layout.
const FUI_ROOT = flags['fui-root'] ? String(flags['fui-root']) : join(ROOT, '../frontierui');
// FUI's env-driven demo port (#2142). Default off FUI's 6000 band + a render-check offset so a boot never
// collides with the human's FUI dev server (:6002). Overridable via --fui-port or FUI_DEMO_PORT.
const FUI_PORT = Number(flags['fui-port'] ?? process.env.FUI_DEMO_PORT ?? 6142);
const FUI_REUSE_URL = flags['fui-url'] ? String(flags['fui-url']).replace(/\/$/, '') : null;
const FUI_BASE = FUI_REUSE_URL || `http://localhost:${FUI_PORT}`;
// The cross-origin FUI demo that renders a `.fui-card` (the card block mounts `<article class="fui-card">`
// into a shadow root on `#card-host`). Overridable via --fui-demo for another `.fui-card`-bearing demo.
const FUI_DEMO = flags['fui-demo'] ? String(flags['fui-demo']) : 'card-demo.html';
// The WE-origin host page that iframes the FUI demo — its own dedicated port off the WE dev band so the
// cross-origin pair (WE host origin ≠ FUI frame origin) is real. Overridable via --host-port.
const HOST_PORT = Number(flags['host-port'] ?? process.env.WE_RENDER_CHECK_HOST_PORT ?? 8131);

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

// ── runtime cross-origin iframe boot (#2081) ───────────────────────────────────────────────────────
// Boot FUI's vite demo server from the sibling checkout on the env-driven lane port (#2142). Passes
// FUI_DEMO_PORT so vite.config.mts reads it directly (it resolves config before `.env*` loads), and
// `--port` so the CLI flag matches. Never touches the human's :6002 (the render-check offset default).
async function bootFuiDemo() {
  const child = spawn('npx', ['vite', `--port=${FUI_PORT}`, '--strictPort'], {
    cwd: FUI_ROOT,
    env: { ...process.env, FUI_DEMO_PORT: String(FUI_PORT) },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const ready = await waitForReady(`${FUI_BASE}/demos/${FUI_DEMO}`);
  if (!ready) {
    child.kill('SIGTERM');
    throw new Error(`FUI demo server did not become ready on ${FUI_BASE} within timeout (is ${FUI_ROOT} the FUI checkout with deps installed?)`);
  }
  return child;
}

// A tiny WE-origin host page that embeds the cross-origin FUI demo through a sandboxed iframe — the same
// embed shape as WE's `fuiDemo` shortcode (.eleventy.js: `sandbox="allow-scripts allow-same-origin"`).
// Serving it from its OWN http origin (not a `data:` URL — an opaque origin whose sandboxed cross-origin
// child frame Playwright cannot enumerate) makes the WE↔FUI origin split real. Returns { server, url }.
async function bootHostPage() {
  const { createServer } = await import('node:http');
  const frameSrc = `${FUI_BASE}/demos/${FUI_DEMO}`;
  const server = createServer((_req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>render-check host</title></head>` +
        `<body><iframe class="fui-demo-frame" src="${frameSrc}" title="fui-card cross-origin render check" ` +
        `sandbox="allow-scripts allow-same-origin" style="width:640px;height:640px;border:0"></iframe></body></html>`,
    );
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(HOST_PORT, resolve);
  });
  return { server, url: `http://localhost:${HOST_PORT}/`, frameSrc };
}

// The `.fui-card` background inside a cross-origin FUI demo frame lives in a shadow root on `#card-host`
// (the card block mounts `<article class="fui-card">` behind `attachShadow`). Pierce it from the frame's
// document. Returns null if the demo hasn't mounted the card yet.
function readShadowCardBg([hostSelector, cardSelector]) {
  const host = document.querySelector(hostSelector);
  const card = host && host.shadowRoot && host.shadowRoot.querySelector(cardSelector);
  return card ? getComputedStyle(card).backgroundColor : null;
}

// ── run ──────────────────────────────────────────────────────────────────────────────────────────
let server = null;      // WE eleventy (default mode)
let fuiServer = null;   // FUI vite demo server (--fui-iframe)
let hostServer = null;  // WE-origin host page http server (--fui-iframe)
let browser = null;
let exitCode = 0;
let result = {};
try {
  browser = await chromium.launch();

  if (FUI_IFRAME) {
    // RUNTIME cross-origin iframe path (#2081): boot the FUI demo server (unless reusing one), serve a
    // WE-origin host page that iframes it, and assert the `.fui-card` painted in the FUI frame is light.
    if (!FUI_REUSE_URL) {
      log(`booting FUI demo server on ${FUI_BASE} …`);
      fuiServer = await bootFuiDemo();
    } else {
      log(`reusing running FUI demo server at ${FUI_BASE}`);
    }
    const host = await bootHostPage();
    hostServer = host.server;
    log(`serving WE-origin host page on ${host.url} → iframe ${host.frameSrc}`);

    const page = await browser.newPage();
    await page.goto(host.url, { waitUntil: 'load', timeout: 60_000 });

    // Find the cross-origin child frame (its url is the FUI origin, not the WE host origin).
    let frame = null;
    for (let i = 0; i < 60 && !frame; i++) {
      frame = page.frames().find((f) => f.url().startsWith(FUI_BASE));
      if (!frame) await new Promise((r) => setTimeout(r, 250));
    }
    if (!frame) throw new Error(`cross-origin FUI frame (${FUI_BASE}) never attached to the host page`);

    // Wait for the card demo to mount (`window.demoReady`), then confirm the `.fui-card` exists in shadow.
    await frame.waitForFunction(() => window.demoReady === true, null, { timeout: 20_000 }).catch(() => {});
    const HOST_SEL = '#card-host';
    const hasCard = await frame.evaluate(
      ([h, c]) => {
        const el = document.querySelector(h);
        return !!(el && el.shadowRoot && el.shadowRoot.querySelector(c));
      },
      [HOST_SEL, SELECTOR],
    );
    if (!hasCard) {
      throw new Error(`no ${SELECTOR} rendered inside the cross-origin FUI demo (${FUI_BASE}/demos/${FUI_DEMO}) — cannot render-check the frame`);
    }

    if (SIMULATE) {
      // Reproduce the RUNTIME leak: inject FUI's dark-default card tokens as `:root` vars INSIDE the FUI
      // frame's document, so `.fui-card { background: var(--color-surface-card) }` resolves dark exactly
      // as it would if a dark FUI token reached the served demo. The injection crosses no origin — it's
      // in the frame's own document — but the ASSERTION reaches across the WE↔FUI origin from the CLI.
      await frame.evaluate((dark) => {
        const style = document.createElement('style');
        style.textContent = `:root{${Object.entries(dark)
          .flatMap(([k, v]) => [`--token-color-${k}:${v}`, `--color-${k}:${v}`])
          .join(';')}}`;
        document.head.appendChild(style);
      }, FUI_DARK_CARD);
      await new Promise((r) => setTimeout(r, 200));
    }

    // `evaluate(fn, arg)` passes ONE arg — the [host, card] selector pair the fn destructures.
    const bg = await frame.evaluate(readShadowCardBg, [HOST_SEL, SELECTOR]).catch(() => null);
    const verdict = classifyCardSurface(bg);
    result = {
      mode: SIMULATE ? 'simulate-regression' : 'assert-light',
      path: 'fui-iframe',
      selector: `${HOST_SEL} >> shadow ${SELECTOR}`,
      url: host.frameSrc,
      ...verdict,
    };
    if (SIMULATE) {
      exitCode = verdict.ok ? 1 : 0;
      result.detectorCaughtRegression = !verdict.ok;
    } else {
      exitCode = verdict.ok ? 0 : 1;
    }
  } else {
    // BUILD-TIME path (#2000, default): WE-own home-grid tile.
    if (!REUSE_URL) {
      log(`booting WE docs server on ${BASE} …`);
      server = await bootEleventy();
    } else {
      log(`reusing running server at ${BASE}`);
    }

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
  }
} catch (err) {
  exitCode = 1;
  result = { error: String(err && err.message ? err.message : err) };
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) server.kill('SIGTERM');
  if (fuiServer) fuiServer.kill('SIGTERM');
  if (hostServer) await new Promise((r) => hostServer.close(r));
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
