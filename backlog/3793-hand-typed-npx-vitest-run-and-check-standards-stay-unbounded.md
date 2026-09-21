---
bornAs: x1yh4um
kind: story
size: 2
parent: "3383"
status: open
relatedTo: ["3785", "3417", "3650", "3471"]
scope: ["we:scripts/guard-bash.mjs", "we:scripts/readiness/heavy-admission.mjs", "we:scripts/bootstrap-session.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Hand-typed npx vitest run and check-standards stay unbounded in an interactive session: add a wrapper hint

Hand-typed `npx vitest run` and `node we:scripts/check-standards.mjs` stay unbounded in an interactive session: the heavy-admission wrapper covers the npm scripts and the repo's own callers, but a raw command typed by hand is denied only to a dispatched agent. Give the interactive session a hint at the moment it types one. Design-first and deliberately not cleared for the conveyor. Relates #3785 (`3785`, resolved: routed every heavy command through the pool), #3417, #3650 and #3471.

## FOUND (2026-09-21)

- **What #3785 did.** In we:package.json the `test:unit`, `check:standards` and `verify` scripts run through `node we:scripts/readiness/heavy-admission.mjs run --`; the repo callers were routed through the same wrapper. The statute is `we:docs/agent/platform-decisions.md#heavy-command-admission-queue`.
- **What it left open.** `dispatchedAgentVerificationReason` in we:scripts/guard-bash.mjs denies the raw spellings only for an agent whose environment carries `WE_DISPATCH_KIND` (build, fix, ci-heal); its own docblock says the operator's interactive session, with no `WE_DISPATCH_KIND`, is deliberately not blocked. For everyone, only BACKGROUNDING the verification set is blocked. So an interactive `npx vitest run` runs unbounded and can take all cores beside the pool's 2 x 4 threads.
- **The repo guide leaves it as advice.** The Definition of Done in we:AGENTS.md says a single interactive session running one test file directly is unaffected, and asks for the wrapper only under concurrency.

## DESIGN TO SETTLE

1. **A warn-level hint.** A guard rule that lets the raw spelling through for an interactive session but prints the wrapper command. Never a deny: the operator legitimately runs one test file directly.
2. **Or a shell alias** set by the bootstrap, so the short command is the wrapped one. Machine state the bootstrap can compute; it must not edit settings silently.
3. **Which spellings.** `npx vitest run|related`, `node we:scripts/check-standards.mjs`, `npm run verify`, `npx playwright test`, the same set as the dispatched-agent arm, so the two cannot drift.
4. **Noise.** A hint on every run is ignored; decide whether it prints once per session.

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/guard-bash.test.mjs` passes, with new cases that fail today: with no `WE_DISPATCH_KIND` in the environment, a raw `npx vitest run` of one test file is allowed and the result carries a hint naming `node we:scripts/readiness/heavy-admission.mjs run --`; `npx vitest --version` and `git commit -m "npx vitest run"` carry no hint; and the dispatched-agent denial is unchanged.
2. **Observable** — typing one raw `npx vitest run` in an interactive session shows the hint, and a second one in the same session does not (if the design settles on once per session).
