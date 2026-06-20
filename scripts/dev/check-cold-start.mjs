#!/usr/bin/env node
// #1202: cold-start / config-loadability gate.
//
// The regression this catches: Node-side tooling in the Vite config graph (the config itself, or a
// config-imported plugin like `tools/maas/vite-plugin.ts`) statically importing a specifier that ONLY
// a Vite/vitest/tsc alias resolves — e.g. the bare `@frontierui/plugs/*` the block runtime uses. At
// config-load time that's plain Node ESM resolution (no alias), so `vite`/`vite build` die with
// `ERR_MODULE_NOT_FOUND` before serving a single module. It was invisible for hours because nothing in
// CI cold-starts Vite — the running dev server was frozen on a pre-regression in-memory config.
//
// This probe loads `vite.config.mts` exactly as a fresh `vite` would (Vite's own `createServer`, which
// bundles + evaluates the config through Node), then closes immediately. Config-load failure throws →
// exit 1. Fast (~1s, middlewareMode binds no port) and behaviour-level (asserts the real boot path, not
// a static-import proxy that can drift).
//
//   node scripts/dev/check-cold-start.mjs [--json]
//
// Exit 0 = config loads + a dev server can be created. Exit 1 = cold start broken.
import { createServer } from 'vite';

const asJson = process.argv.includes('--json');

function report(ok, detail, code) {
  if (asJson) {
    process.stdout.write(JSON.stringify({ ok, ...detail }) + '\n');
  } else {
    const GRN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', RST = '\x1b[0m';
    process.stdout.write(
      `${ok ? GRN + '✓ COLD-START OK' : RED + '✗ COLD-START BROKEN'}${RST} — ${detail.message}\n`,
    );
    if (!ok && detail.stack) process.stdout.write(`${DIM}${detail.stack}${RST}\n`);
  }
  process.exit(code);
}

let server;
try {
  server = await createServer({
    // middlewareMode = no port bind; we only need config-load + plugin wiring to run.
    server: { middlewareMode: true },
    logLevel: 'silent',
    clearScreen: false,
  });
  await server.close();
  report(true, { message: 'vite.config loads and a dev server boots cleanly.' }, 0);
} catch (err) {
  try { await server?.close(); } catch { /* best effort */ }
  const message =
    err && /ERR_MODULE_NOT_FOUND/.test(String(err?.stack ?? err))
      ? `config-graph import is not Node-resolvable — a Vite/vitest/tsc-alias-only specifier leaked into ` +
        `the config/plugin graph (#1202). ${err.message}`
      : `vite cold-start failed: ${err?.message ?? err}`;
  report(false, { message, stack: err?.stack }, 1);
}
