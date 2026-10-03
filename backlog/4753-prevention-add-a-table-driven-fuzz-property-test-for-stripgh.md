---
bornAs: x8ys5ga
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/__tests__/gh-throttle.test.mjs", "we:scripts/lib/gh-spend.mjs", "we:scripts/lib/__tests__/gh-spend.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a table-driven fuzz/property test for stripGhDebug that injects marker lines into each section (req… (from chalbert/web-everything#3263 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/gh-throttle.mjs:797` — Add a table-driven fuzz/property test for stripGhDebug that injects marker lines into each section (request, headers, body) and asserts no sentinel leaks.
2. `we:scripts/lib/__tests__/gh-throttle.test.mjs:860` — Add a branch-coverage threshold on we:scripts/lib/gh-throttle.mjs in the test gate so untested scanner branches show up.
3. `we:scripts/lib/gh-throttle.mjs:797` — Extend the named regression test with blank-separated timing markers followed by sentinel content, and require that content to remain stripped.
4. `we:scripts/lib/gh-spend.mjs:424` — A unit test with interleaved requests from a long-lived invocation and a short-lived one, asserting that the short-lived one is correctly aggregated even while the long-lived one remains open.
5. `we:scripts/lib/gh-throttle.mjs:790` — A fidelity test that runs a real GraphQL query against GitHub using gh api --graphql --include and asserts that the parsed cost is correctly extracted from the debug output, preventing assumptions about whitespace from breaking the parser.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3263@54b8da685f6891bb46bb725f06ad36f7705493d0

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
