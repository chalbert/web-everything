---
kind: task
parent: "4075"
status: open
scope: ["we:scripts/conveyor/canary.mjs", "we:scripts/conveyor/canary-stages.mjs", "we:scripts/conveyor/__tests__/canary-stages.test.mjs", "we:skills-src/conveyor/canary-agent-brief.md", "we:docs/agent/prototype-based-dev.md"]
dateOpened: "2026-09-26"
tags: []
---

# Real end-to-end dispatch canary (proves the daemon path with a live claude --bg session)

Build we:scripts/conveyor/canary.mjs — a single entry point that dispatches a tiny real claude --bg canary job through the REAL production dispatch path (same dispatch module we:scripts/operations/dispatch-lane-io.mjs, same scratch cwd, same settings/trust, same env, same brief machinery as the build/fix daemons). It watches the session acquire a lane, edit one file, run the selected gate, and commit+push to a throwaway canary/<timestamp> branch (no PR opened, or a draft PR labelled canary so the drain and reviewers ignore it and it is closed at the end). It reports PASS/FAIL per stage: spawned, no permission prompt, lane acquired, edit ok, gate ran, pushed, session finished, cleaned up (lane released, branch deleted, scratch folder reaped). Includes unit tests for the stage evaluator (fixture transcripts, including a permission-prompt stall) and one live run against real infra. Motivation: the daemon-soak harness (we:scripts/conveyor + we:scripts/readiness soak) uses FAKE sessions and missed the real PR #2701 scratch-cwd permission-prompt regression; the operator approved one real end-to-end run before counting a daemon change as proven.

## Done when

1. **Executable** — `node we:scripts/conveyor/canary.mjs --repo=chalbert/web-everything` exits 0 with a
   PASS on every stage (spawned · no permission prompt · lane acquired · edit ok · gate ran · pushed ·
   session finished · cleaned up) on a real `claude --bg` run, and the stage evaluator's unit tests
   (`npx vitest run we:scripts/conveyor/__tests__/canary-stages.test.mjs`) go red→green against fixture
   transcripts, including a fixture that stalls on a permission prompt.
