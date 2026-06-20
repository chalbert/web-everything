---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: "plateau-app/src/dev-browser/ide-bridge/vscode-extension/__host-tests__/ (@vscode/test-electron runner + test:extension-host script)"
locus: plateau-app
tags: [dev-browser, ide-bridge, vscode-extension, testing, harness, verification, plateau-app]
---

# @vscode/test-electron extension-host integration harness (plateau-app)

Stand up the `@vscode/test-electron` runner in plateau-app that downloads a throwaway VS Code, launches the Extension Development Host, and provides the integration-test entry that activates an extension and asserts `activate()` / `registerUriHandler` / server wiring. The harness real-extension-host verification depends on; unblocks #676. DoD: a smoke integration test activating a trivial extension goes green via the runner.

## Why this is its own item (the agent-runnable-verification rule)

#676 ("VS Code extension publishable shell — activate() + localhost HTTP/WS server + URI handler") is explicitly *"the only part that needs a real extension host to run."* plateau-app's `npm test` is Vitest — it never loads an extension host, so it cannot execute `activate()`, the `contributes`/`engines.vscode` manifest, or `registerUriHandler` routing. Per the **"every verification must be agent-runnable"** rule (`we:docs/agent/testing.md`), that end-to-end claim needs a harness that actually launches an Extension Development Host, declared as a resolved `blockedBy`. This card *is* that harness; #676 now `blockedBy: ["685"]`.

## Scope

- **Runner** — add `@vscode/test-electron` (dev dep) + a `runTests`-driven entry that downloads a pinned throwaway VS Code build and launches it with `--extensionDevelopmentPath` pointed at the extension under test (and `--extensionTestsPath` at the integration suite).
- **Integration entry** — a `suite/index` that, inside the host, activates the extension, hits the localhost HTTP/WS server, and fires a `vscode://publisher.ext/…` URI to assert the handler routes — the e2e assertion `npm test` can't make.
- **Script wiring** — a `test:extension-host` (or equivalent) npm script in plateau-app so the lane is one command; keep it separate from the fast Vitest `npm test` (it downloads a VS Code build and is slower).

## DoD

A smoke integration test that activates a **trivial** extension and asserts one host-only behavior (e.g. a `registerUriHandler` round-trip) goes **green** via the runner on a clean checkout (CI-capable: `xvfb` or headless-electron note included). Then #676 can build its shell against a real, agent-runnable proof.

## Progress

Resolved 2026-06-15. plateau-app locus (commit → plateau-app). The runner downloads a throwaway VS Code, launches the Extension Development Host with a trivial fixture extension, and goes **green** — exactly the agent-runnable proof #676 needs.

All under `src/dev-browser/ide-bridge/vscode-extension/__host-tests__/`:
- **`fixture-extension/`** — a trivial extension (`we:package.json` with `engines.vscode`, `main`, `activationEvents: ["*"]`, `contributes.commands`) + `plateau:extension.cjs` whose `activate()` registers a URI handler (capturing whether `registerUriHandler` returned a live Disposable) and three runtime commands.
- **`plateau:runner.mjs`** — `@vscode/test-electron`'s `runTests({ version: 'stable', extensionDevelopmentPath, extensionTestsPath, launchArgs: ['--disable-extensions'] })`.
- **`plateau:suite/index.cjs`** — mocha entry (TDD ui) discovering `*.test.cjs` via `fs` (no `glob` dep); **`plateau:suite/extension.test.cjs`** — 4 host-only assertions: real `vscode.version`, `activate()` runs + exposes its public API, runtime command dispatch (`fixture.ping` → `pong`), and `registerUriHandler` returned a live Disposable (the #676 surface).
- **`we:package.json`** — `test:extension-host` script (separate from the fast Vitest `npm test`); dev deps `@vscode/test-electron@^3.0.0`, `mocha`, `@types/vscode`. **`.gitignore`** — `.vscode-test/` (the 238 MB downloaded VS Code + throwaway profiles).

Two real-world footguns hit and fixed (so it's green on a clean checkout, not just locally):
1. **test-electron 2.4.x couldn't launch VS Code 1.124.2** — every launch flag came back `bad option`. Bumped to `@vscode/test-electron@^3.0.0`.
2. **`ELECTRON_RUN_AS_NODE=1`** is set whenever the runner is invoked from inside a VS Code extension host / integrated terminal (as here), which boots the downloaded Electron as plain Node and rejects every GUI flag. The runner now `delete process.env.ELECTRON_RUN_AS_NODE` before launching, so `npm run test:extension-host` is self-sufficient regardless of the ambient env. CI note (Linux needs a display → `xvfb-run -a`) is in the runner header.

**DoD met:** `npm run test:extension-host` → **4 passing (~20ms)** in a real Extension Development Host (`Extension host ... exited with code: 0`), with the ambient `ELECTRON_RUN_AS_NODE=1` present. Fast lane unaffected: `npm test` (vitest) = 154 passed / 18 files.

**Unblocks #676** (`blockedBy: ["685"]`) — the publishable shell's `activate()` + `registerUriHandler` + localhost server can now be asserted against this real-host harness.
