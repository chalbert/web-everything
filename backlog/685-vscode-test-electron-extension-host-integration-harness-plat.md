---
type: issue
workItem: story
size: 3
status: open
dateOpened: "2026-06-15"
locus: plateau-app
tags: [dev-browser, ide-bridge, vscode-extension, testing, harness, verification, plateau-app]
---

# @vscode/test-electron extension-host integration harness (plateau-app)

Stand up the `@vscode/test-electron` runner in plateau-app that downloads a throwaway VS Code, launches the Extension Development Host, and provides the integration-test entry that activates an extension and asserts `activate()` / `registerUriHandler` / server wiring. The harness real-extension-host verification depends on; unblocks #676. DoD: a smoke integration test activating a trivial extension goes green via the runner.

## Why this is its own item (the agent-runnable-verification rule)

#676 ("VS Code extension publishable shell — activate() + localhost HTTP/WS server + URI handler") is explicitly *"the only part that needs a real extension host to run."* plateau-app's `npm test` is Vitest — it never loads an extension host, so it cannot execute `activate()`, the `contributes`/`engines.vscode` manifest, or `registerUriHandler` routing. Per the **"every verification must be agent-runnable"** rule (`docs/agent/testing.md`), that end-to-end claim needs a harness that actually launches an Extension Development Host, declared as a resolved `blockedBy`. This card *is* that harness; #676 now `blockedBy: ["685"]`.

## Scope

- **Runner** — add `@vscode/test-electron` (dev dep) + a `runTests`-driven entry that downloads a pinned throwaway VS Code build and launches it with `--extensionDevelopmentPath` pointed at the extension under test (and `--extensionTestsPath` at the integration suite).
- **Integration entry** — a `suite/index` that, inside the host, activates the extension, hits the localhost HTTP/WS server, and fires a `vscode://publisher.ext/…` URI to assert the handler routes — the e2e assertion `npm test` can't make.
- **Script wiring** — a `test:extension-host` (or equivalent) npm script in plateau-app so the lane is one command; keep it separate from the fast Vitest `npm test` (it downloads a VS Code build and is slower).

## DoD

A smoke integration test that activates a **trivial** extension and asserts one host-only behavior (e.g. a `registerUriHandler` round-trip) goes **green** via the runner on a clean checkout (CI-capable: `xvfb` or headless-electron note included). Then #676 can build its shell against a real, agent-runnable proof.
