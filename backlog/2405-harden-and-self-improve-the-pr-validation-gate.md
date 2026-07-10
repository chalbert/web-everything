---
kind: epic
status: open
dateOpened: "2026-07-10"
tags: []
---

# Harden and self-improve the PR-validation gate

Two-part hardening of the auto-review/merge gate. (1) Deterministic test support so changes to the gate LOGIC are CI-verified instead of human-eyeballed: a tripwire invariant suite plus hermetic integration tests driving the real entrypoints, all under scripts/__tests__ so the required test check gates them — plus a self-reference in GATE_SELF_PATHS so only invariant changes still need a human. (2) The close-session flow surfaces concrete review/PR-flow improvements when a session touched that machinery. Grew out of the realization that human review of gate-self diffs is the weakest, highest-cost, highest-stakes gate — a test is strictly stronger there.
